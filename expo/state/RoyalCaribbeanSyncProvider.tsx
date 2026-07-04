import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect, useContext, createContext, useMemo, ReactNode } from 'react';
import { WebView } from 'react-native-webview';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getUserScopedKey, ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';
import { useUser, type UserProfile } from './UserProvider';
import { 
  RoyalCaribbeanSyncState, 
  SyncStatus,
  OfferRow, 
  BookedCruiseRow,
  WebViewMessage,
  ExtendedLoyaltyData,
  LoyaltyApiInformation
} from '@/lib/royalCaribbean/types';
import { convertLoyaltyInfoToExtended, mergeExtendedLoyaltyData } from '@/lib/royalCaribbean/loyaltyConverter';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectLoyaltyWidgetScrape, injectPageClassifier } from '@/lib/royalCaribbean/step4_loyalty';
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape, injectCarnivalTgoExtract } from '@/lib/carnival/carnivalOffersExtraction';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import { parseCasinoOffersPayload } from '@/lib/royalCaribbean/offerPayloadParser';
import { healImportedData } from '@/lib/dataHealing';
import { isActiveBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';
import { mergeRoyalCompletedHistoryTruth, ROYAL_COMPLETED_HISTORY_TRUTH_COUNT } from '@/lib/royalCompletedHistoryTruth';
import { isCloudBackupEnabled } from '@/lib/trpc';

export type CruiseLine = 'royal_caribbean' | 'celebrity' | 'carnival';

export const CRUISE_LINE_CONFIG = {
  royal_caribbean: {
    name: 'Royal Caribbean',
    loginUrl: 'https://www.royalcaribbean.com/club-royale',
    offersUrl: 'https://www.royalcaribbean.com/club-royale/offers',
    upcomingUrl: 'https://www.royalcaribbean.com/myaccount/my-trips',
    // v991: the site's account routes have moved/changed shape more than once.
    // Try every known-good route in order until one actually loads real trip data
    // instead of trusting a single hardcoded URL.
    upcomingUrlAlternates: [
      'https://www.royalcaribbean.com/account/upcoming-cruises',
      'https://www.royalcaribbean.com/myaccount/dashboard',
      'https://www.royalcaribbean.com/myaccount',
      'https://www.royalcaribbean.com/account',
    ],
    holdsUrl: 'https://www.royalcaribbean.com/myaccount/my-trips',
    loyaltyClubName: 'Club Royale',
    loyaltyPageUrl: 'https://www.royalcaribbean.com/myaccount/loyalty-programs',
    loyaltyPageUrlAlternates: [
      'https://www.royalcaribbean.com/account/loyalty-programs',
      'https://www.royalcaribbean.com/myaccount/dashboard',
      'https://www.royalcaribbean.com/myaccount',
      'https://www.royalcaribbean.com/account',
    ],
  },
  celebrity: {
    name: 'Celebrity Cruises',
    loginUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    offersUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    upcomingUrl: 'https://www.celebritycruises.com/myaccount/my-trips',
    upcomingUrlAlternates: [
      'https://www.celebritycruises.com/account/upcoming-cruises',
      'https://www.celebritycruises.com/myaccount/dashboard',
      'https://www.celebritycruises.com/myaccount',
      'https://www.celebritycruises.com/account',
    ],
    holdsUrl: 'https://www.celebritycruises.com/myaccount/my-trips',
    loyaltyClubName: 'Blue Chip Club',
    loyaltyPageUrl: 'https://www.celebritycruises.com/myaccount/loyalty-programs',
    loyaltyPageUrlAlternates: [
      'https://www.celebritycruises.com/account/loyalty-programs',
      'https://www.celebritycruises.com/myaccount/dashboard',
      'https://www.celebritycruises.com/myaccount',
      'https://www.celebritycruises.com/account',
    ],
  },
  carnival: {
    name: 'Carnival Cruise Line',
    loginUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    offersUrl: 'https://www.carnival.com/cruise-deals-2025',
    upcomingUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    holdsUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    loyaltyClubName: 'VIFP Club',
    loyaltyPageUrl: 'https://www.carnival.com/profilemanagement/profiles',
  },
} as const;

const INITIAL_STATE: RoyalCaribbeanSyncState = {
  status: 'not_logged_in',
  currentStep: '',
  progress: null,
  logs: [],
  extractedOffers: [],
  extractedBookedCruises: [],
  loyaltyData: null,
  error: null,
  lastSyncTimestamp: null,
  syncCounts: null,
  syncPreview: null,
  scrapePricingAndItinerary: false
};

const INITIAL_EXTENDED_LOYALTY: ExtendedLoyaltyData | null = null;

type SyncTargetSlot = 'primary' | 'secondary';

interface SyncSectionSelections {
  offers: boolean;
  availableCruises: boolean;
  bookedCruises: boolean;
  completedCruises: boolean;
  loyalty: boolean;
}

interface SyncTargetOptions {
  targetProfileId?: string;
  targetProfileSlot?: SyncTargetSlot;
  syncSections?: Partial<SyncSectionSelections>;
}

function normalizeProfileText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function hasProfileLoyaltyData(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.crownAnchorNumber?.trim() ||
    profile.royalCaribbeanNumber?.trim() ||
    profile.clubRoyaleId?.trim() ||
    profile.clubRoyaleTier?.trim() ||
    (profile.clubRoyalePoints ?? 0) > 0 ||
    profile.crownAnchorLevel?.trim() ||
    (profile.loyaltyPoints ?? 0) > 0 ||
    profile.celebrityCaptainsClubNumber?.trim() ||
    profile.blueChipId?.trim() ||
    profile.celebrityBlueChipTier?.trim() ||
    (profile.celebrityCaptainsClubPoints ?? 0) > 0 ||
    (profile.celebrityBlueChipPoints ?? 0) > 0 ||
    profile.silverseaVenetianNumber?.trim() ||
    profile.silverseaVenetianTier?.trim() ||
    (profile.silverseaVenetianPoints ?? 0) > 0 ||
    profile.carnivalVifpNumber?.trim() ||
    profile.carnivalVifpTier?.trim() ||
    profile.carnivalPlayersClubTier?.trim() ||
    (profile.carnivalPlayersClubPoints ?? 0) > 0
  );
}

function isUnassignedProfile(profile: UserProfile | null | undefined, slot: SyncTargetSlot): boolean {
  if (!profile) return true;
  if (hasProfileLoyaltyData(profile)) return false;

  const label = normalizeProfileText(profile.displayName || profile.name);
  if (slot === 'secondary') {
    return !label || label === 'unassigned' || label === 'second user' || label === 'secondary user';
  }

  return !label || label === 'unassigned' || label === 'player' || label === 'user';
}


function normalizeSyncDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let match = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})/);
  if (match) return `${match[3]}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw;
}


function isCompletedRecordLike(record: any): boolean {
  const status = `${record?.status || ''} ${record?.bookingStatus || ''} ${record?.completionState || ''} ${record?.sourcePage || ''}`.toLowerCase();
  return status.includes('completed') || status.includes('past') || status.includes('history');
}

function isActiveRecordLike(record: any): boolean {
  return !isCompletedRecordLike(record);
}

function isLoyaltyPayloadForCruiseLine(url: unknown, cruiseLine: CruiseLine): boolean {
  const normalizedUrl = String(url || '').toLowerCase();
  if (!normalizedUrl) return true;
  // v991: only use this as a soft signal, never a hard reject. A real loyalty payload
  // (tier/points fields present) should never be thrown away just because it arrived
  // via a CDN/edge host or a relative URL that doesn't literally contain the brand
  // domain - that was silently discarding valid Crown & Anchor / Club Royale data.
  if (cruiseLine === 'celebrity') {
    if (normalizedUrl.includes('royalcaribbean.com') || normalizedUrl.includes('carnival.com')) return false;
    return true;
  }
  if (cruiseLine === 'royal_caribbean') {
    if (normalizedUrl.includes('celebritycruises.com') || normalizedUrl.includes('carnival.com')) return false;
    return true;
  }
  if (cruiseLine === 'carnival') {
    if (normalizedUrl.includes('royalcaribbean.com') || normalizedUrl.includes('celebritycruises.com')) return false;
    return true;
  }
  return true;
}

function hasMeaningfulExtendedLoyaltyData(data: ExtendedLoyaltyData | null | undefined, cruiseLine: CruiseLine): boolean {
  if (!data) return false;
  if (cruiseLine === 'celebrity') {
    return Boolean(
      data.captainsClubTier ||
      data.captainsClubPoints !== undefined ||
      data.celebrityBlueChipTier ||
      data.celebrityBlueChipPoints !== undefined ||
      data.venetianSocietyTier
    );
  }
  if (cruiseLine === 'royal_caribbean') {
    return Boolean(
      data.crownAndAnchorTier ||
      data.crownAndAnchorLevel ||
      data.crownAndAnchorPointsFromApi !== undefined ||
      data.clubRoyaleTierFromApi ||
      data.clubRoyaleTier ||
      data.clubRoyalePointsFromApi !== undefined
    );
  }
  return true;
}

// v1231: A Royal Caribbean account has TWO independent loyalty numbers that live on two
// different pages: Club Royale casino tier credits (shown on the Offers page hero widget,
// e.g. "19,363") and Crown & Anchor cruise points (shown on the My Account homepage widget,
// e.g. "660"). The sync used to mark the whole `loyalty` section "captured" the instant EITHER
// one arrived - which happens as early as Step 1 (offers page) when only Club Royale is found -
// so Step 2's retry loop would think loyalty was fully done and skip visiting the account-home
// page entirely, permanently losing the Crown & Anchor number. This checks whether we actually
// have BOTH real Royal Caribbean numbers yet (not just one) before letting the sync stop looking.
function hasBothRoyalLoyaltyNumbers(fields: { clubRoyale: boolean; crownAnchor: boolean }): boolean {
  return fields.clubRoyale && fields.crownAnchor;
}

function mergeCapturedLoyaltyFields(
  current: { clubRoyale: boolean; crownAnchor: boolean },
  data: ExtendedLoyaltyData | null | undefined
): { clubRoyale: boolean; crownAnchor: boolean } {
  return {
    clubRoyale: current.clubRoyale || Boolean(data?.clubRoyaleTierFromApi || data?.clubRoyaleTier || data?.clubRoyalePointsFromApi !== undefined),
    crownAnchor: current.crownAnchor || Boolean(data?.crownAndAnchorTier || data?.crownAndAnchorLevel || data?.crownAndAnchorPointsFromApi !== undefined),
  };
}

function isHistoryOnlyLoyaltyPayload(data: unknown): boolean {
  const value = data as any;
  const payload = value?.payload ?? value;
  return Boolean(Array.isArray(payload?.sailings) && !payload?.loyaltyInformation && !payload?.data);
}

function filterExtendedLoyaltyForCruiseLine(data: ExtendedLoyaltyData | null | undefined, cruiseLine: CruiseLine): ExtendedLoyaltyData | null {
  if (!data) return null;
  if (cruiseLine === 'celebrity') {
    return {
      accountId: data.accountId,
      captainsClubId: data.captainsClubId,
      captainsClubTier: data.captainsClubTier,
      captainsClubPoints: data.captainsClubPoints,
      captainsClubRelationshipPoints: data.captainsClubRelationshipPoints,
      captainsClubNextTier: data.captainsClubNextTier,
      captainsClubRemainingPoints: data.captainsClubRemainingPoints,
      captainsClubTrackerPercentage: data.captainsClubTrackerPercentage,
      captainsClubLoyaltyMatchTier: data.captainsClubLoyaltyMatchTier,
      celebrityBlueChipTier: data.celebrityBlueChipTier,
      celebrityBlueChipPoints: data.celebrityBlueChipPoints,
      celebrityBlueChipRelationshipPoints: data.celebrityBlueChipRelationshipPoints,
      venetianSocietyTier: data.venetianSocietyTier,
      venetianSocietyNextTier: data.venetianSocietyNextTier,
      venetianSocietyMemberNumber: data.venetianSocietyMemberNumber,
      venetianSocietyEnrolled: data.venetianSocietyEnrolled,
      venetianSocietyLoyaltyMatchTier: data.venetianSocietyLoyaltyMatchTier,
      hasCoBrandCard: data.hasCoBrandCard,
      coBrandCardStatus: data.coBrandCardStatus,
      coBrandCardErrorMessage: data.coBrandCardErrorMessage,
    } as ExtendedLoyaltyData;
  }
  if (cruiseLine === 'royal_caribbean') {
    return {
      accountId: data.accountId,
      crownAndAnchorId: data.crownAndAnchorId,
      crownAndAnchorLevel: data.crownAndAnchorLevel,
      crownAndAnchorTier: data.crownAndAnchorTier,
      crownAndAnchorPoints: data.crownAndAnchorPoints,
      crownAndAnchorPointsFromApi: data.crownAndAnchorPointsFromApi,
      crownAndAnchorRelationshipPointsFromApi: data.crownAndAnchorRelationshipPointsFromApi,
      crownAndAnchorNextTier: data.crownAndAnchorNextTier,
      crownAndAnchorRemainingPoints: data.crownAndAnchorRemainingPoints,
      crownAndAnchorTrackerPercentage: data.crownAndAnchorTrackerPercentage,
      crownAndAnchorLoyaltyMatchTier: data.crownAndAnchorLoyaltyMatchTier,
      clubRoyaleTier: data.clubRoyaleTier,
      clubRoyaleTierFromApi: data.clubRoyaleTierFromApi,
      clubRoyalePoints: data.clubRoyalePoints,
      clubRoyalePointsFromApi: data.clubRoyalePointsFromApi,
      clubRoyaleRelationshipPointsFromApi: data.clubRoyaleRelationshipPointsFromApi,
      hasCoBrandCard: data.hasCoBrandCard,
      coBrandCardStatus: data.coBrandCardStatus,
      coBrandCardErrorMessage: data.coBrandCardErrorMessage,
    } as ExtendedLoyaltyData;
  }
  return data;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizeShipNameFromSailing(sailing: any): string {
  return firstString(
    sailing?.shipName, sailing?.ship, sailing?.shipTitle, sailing?.shipDisplayName,
    sailing?.voyage?.shipName, sailing?.cruise?.shipName, sailing?.sailing?.shipName
  );
}

function parseCompletedSailingsPayload(data: any, cruiseLine: CruiseLine): BookedCruiseRow[] {
  const payload = data?.payload ?? data?.data ?? data;
  const possible = [
    payload?.sailings,
    payload?.history?.sailings,
    payload?.loyaltyHistory?.sailings,
    payload?.data?.sailings,
    data?.sailings,
  ];
  const sailings = possible.find(Array.isArray) as any[] | undefined;
  if (!sailings || !sailings.length) return [];
  const brand = cruiseLine === 'celebrity' ? 'Celebrity' : cruiseLine === 'carnival' ? 'Carnival' : 'Royal Caribbean';
  return sailings.map((sailing, index) => {
    const sailDate = normalizeSyncDate(firstString(
      sailing?.sailDate, sailing?.sailingStartDate, sailing?.startDate, sailing?.departureDate, sailing?.date,
      sailing?.voyage?.sailDate, sailing?.cruise?.sailDate
    ));
    const returnDate = normalizeSyncDate(firstString(
      sailing?.returnDate, sailing?.sailingEndDate, sailing?.endDate, sailing?.arrivalDate,
      sailing?.voyage?.returnDate, sailing?.cruise?.returnDate
    ));
    const nights = firstString(sailing?.numberOfNights, sailing?.nights, sailing?.duration, sailing?.voyage?.nights);
    const shipName = normalizeShipNameFromSailing(sailing) || firstString(sailing?.shipCode) || 'Unknown Ship';
    const bookingId = firstString(sailing?.bookingId, sailing?.bookingNumber, sailing?.reservationId, sailing?.reservationNumber, sailing?.confirmationNumber);
    return {
      sourcePage: 'Completed Cruises',
      shipName,
      shipCode: firstString(sailing?.shipCode, sailing?.voyage?.shipCode),
      sailingStartDate: sailDate,
      sailingEndDate: returnDate,
      itineraryName: firstString(sailing?.itineraryName, sailing?.itinerary, sailing?.cruiseName, sailing?.voyage?.itineraryName),
      itinerary: firstString(sailing?.itineraryName, sailing?.itinerary, sailing?.cruiseName, sailing?.voyage?.itineraryName),
      sailingDates: sailDate && returnDate ? `${sailDate} - ${returnDate}` : sailDate,
      departurePort: firstString(sailing?.departurePort, sailing?.embarkPort, sailing?.portName),
      cabinType: firstString(sailing?.cabinType, sailing?.stateroomType, sailing?.roomType),
      cabinNumberOrGTY: firstString(sailing?.cabinNumber, sailing?.stateroomNumber, sailing?.roomNumber),
      bookingId: bookingId || `${brand.toLowerCase().replace(/\s+/g, '-')}-completed-${shipName}-${sailDate || index}`,
      numberOfGuests: firstString(sailing?.numberOfGuests, sailing?.guests) || '1',
      numberOfNights: nights ? Number.parseInt(nights, 10) || undefined : undefined,
      daysToGo: '0',
      status: 'Completed',
      holdExpiration: '',
      loyaltyLevel: '',
      loyaltyPoints: firstString(sailing?.points, sailing?.cruisePoints, sailing?.loyaltyPoints),
      paidInFull: '',
      balanceDue: '',
      musterStation: '',
      bookingStatus: 'COMPLETED',
      packageCode: firstString(sailing?.packageCode, sailing?.offerCode),
      passengerStatus: '',
      stateroomNumber: firstString(sailing?.cabinNumber, sailing?.stateroomNumber),
      stateroomCategoryCode: firstString(sailing?.stateroomCategoryCode, sailing?.categoryCode),
      stateroomType: firstString(sailing?.stateroomType, sailing?.cabinType),
    } as BookedCruiseRow;
  });
}

const InitialCruiseLineContext = createContext<CruiseLine>('royal_caribbean');

export const [RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync] = createContextHook(() => {
  console.log('[RoyalCaribbeanSync] Provider initializing...');
  const initialCruiseLine = useContext(InitialCruiseLineContext);
  const { authenticatedEmail } = useAuth();
  const staySignedInKey = useCallback(() => getUserScopedKey('stay_signed_in', authenticatedEmail), [authenticatedEmail]);
  const [state, setState] = useState<RoyalCaribbeanSyncState>(INITIAL_STATE);
  const [cruiseLine, setCruiseLine] = useState<CruiseLine>(initialCruiseLine);
  const [extendedLoyaltyData, setExtendedLoyaltyData] = useState<ExtendedLoyaltyData | null>(INITIAL_EXTENDED_LOYALTY);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const { currentUser, users, updateUser: updateUserProfile } = useUser();
  const carnivalUserDataRef = useRef<{ vifpNumber: string; vifpTier: string; firstName: string; lastName: string } | null>(null);
  const extractedOffersRef = useRef<OfferRow[]>([]);
  const extractedBookedCruisesRef = useRef<BookedCruiseRow[]>([]);
  const webViewRef = useRef<WebView | null>(null);
  const hasReceivedApiLoyaltyDataRef = useRef(false);
  const lastAuthenticatedEmailRef = useRef<string | null>(authenticatedEmail);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const stepCompletionMetadataRef = useRef<Record<number, { totalCount: number; offerCount: number; completedAt: number }>>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  const capturedSections = useRef({ offers: false, bookings: false, loyalty: false });
  // v1231: tracks Club Royale vs Crown & Anchor separately so the sync can tell "got one of
  // the two Royal Caribbean loyalty numbers" apart from "got both" - see hasBothRoyalLoyaltyNumbers.
  const capturedLoyaltyFields = useRef({ clubRoyale: false, crownAnchor: false });
  const pageLoadResolver = useRef<((loadedUrl?: string) => void) | null>(null);
  const offerSailingsResolver = useRef<((sailings: OfferRow[]) => void) | null>(null);
  const carnivalPageCheckResolver = useRef<((onOffers: boolean) => void) | null>(null);
  const carnivalTgoDataResolver = useRef<((data: { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> }) => void) | null>(null);
  const navigationRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  const syncToAppInFlightRef = useRef<boolean>(false);
  const ingestionInFlightRef = useRef<boolean>(false);
  const logFlushScheduledRef = useRef<boolean>(false);
  const providerMountedRef = useRef<boolean>(true);
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];
  const [webViewUrl, setWebViewUrl] = useState<string>(CRUISE_LINE_CONFIG[initialCruiseLine].loginUrl);

  useEffect(() => {
    extractedBookedCruisesRef.current = state.extractedBookedCruises;
  }, [state.extractedBookedCruises]);

  useEffect(() => {
    // Brand switch must not leak Royal loyalty into Celebrity Blue Chip sync or vice versa.
    setExtendedLoyaltyData(null);
    hasReceivedApiLoyaltyDataRef.current = false;
    setState(prev => ({ ...prev, loyaltyData: null }));
  }, [cruiseLine]);

  const stringifyValue = useCallback((value: unknown): string => {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }, []);

  const getObjectKeys = useCallback((value: unknown): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [];
    }
    return Object.keys(value as Record<string, unknown>);
  }, []);

  const getPayloadIdentifier = useCallback(function collect(value: unknown, depth: number = 0): string {
    if (depth > 2) {
      return '';
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 6)
        .map((item) => collect(item, depth + 1))
        .filter(Boolean)
        .join('|');
    }

    if (!value || typeof value !== 'object') {
      return stringifyValue(value).slice(0, 120);
    }

    const record = value as Record<string, unknown>;
    const directIdentifier = stringifyValue(
      record.offerCode ??
        record.marketingCouponCode ??
        record.bookingId ??
        record.confirmationNumber ??
        record.reservationId ??
        record.accountId ??
        record.loyaltyNumber ??
        record.shipCode ??
        record.shipName ??
        record.sailDate ??
        record.startDate ??
        record.id ??
        record.code ??
        record.name ??
        record.title
    );

    if (directIdentifier) {
      return directIdentifier.slice(0, 120);
    }

    return (
      collect(record.campaignOffer ?? record.payload ?? record.offers ?? record.casinoOffers ?? record.sailingInfo ?? record.profileBookings ?? record.bookings ?? record.Items, depth + 1) ||
      Object.keys(record).sort().join(',')
    ).slice(0, 240);
  }, [stringifyValue]);

  const createPayloadSignature = useCallback((value: unknown): string => {
    if (Array.isArray(value)) {
      const firstItemKeys = getObjectKeys(value[0]).slice(0, 8).join(',');
      const identifiers = getPayloadIdentifier(value);
      return `array:${value.length}:${firstItemKeys}:${identifiers}`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const topLevelKeys = Object.keys(record).sort().join(',');
      const payloadKeys = getObjectKeys(record.payload).slice(0, 8).sort().join(',');
      const identifiers = getPayloadIdentifier(record);
      return `object:${topLevelKeys}:${payloadKeys}:${identifiers}`;
    }

    return `${typeof value}:${stringifyValue(value).slice(0, 120)}`;
  }, [getObjectKeys, getPayloadIdentifier, stringifyValue]);

  const normalizeOfferRows = useCallback((value: unknown): OfferRow[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedRows: OfferRow[] = [];
    const seenKeys = new Set<string>();
    const detailPresenceByOffer = new Set<string>();

    const getOfferIdentityKey = (row: OfferRow): string => {
      return [
        row.sourcePage,
        row.offerCode || row.offerName,
        row.offerName,
        row.offerExpirationDate,
        row.offerType,
      ].join('|');
    };

    value.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const row = item as Partial<OfferRow>;
      const normalizedRow: OfferRow = {
        sourcePage: stringifyValue(row.sourcePage) || 'Offers',
        offerName: stringifyValue(row.offerName) || stringifyValue(row.offerCode) || 'Carnival Offer',
        offerCode: stringifyValue(row.offerCode),
        offerExpirationDate: stringifyValue(row.offerExpirationDate),
        offerType: stringifyValue(row.offerType) || 'VIFP Club',
        shipName: stringifyValue(row.shipName),
        shipCode: stringifyValue(row.shipCode) || undefined,
        sailingDate: normalizeSyncDate(stringifyValue(row.sailingDate)),
        itinerary: stringifyValue(row.itinerary),
        departurePort: stringifyValue(row.departurePort),
        cabinType: stringifyValue(row.cabinType),
        numberOfGuests: stringifyValue(row.numberOfGuests) || '2',
        perks: stringifyValue(row.perks),
        loyaltyLevel: stringifyValue(row.loyaltyLevel),
        loyaltyPoints: stringifyValue(row.loyaltyPoints),
        interiorPrice: stringifyValue(row.interiorPrice) || undefined,
        oceanviewPrice: stringifyValue(row.oceanviewPrice) || undefined,
        balconyPrice: stringifyValue(row.balconyPrice) || undefined,
        suitePrice: stringifyValue(row.suitePrice) || undefined,
        taxesAndFees: stringifyValue(row.taxesAndFees) || undefined,
        portList: stringifyValue(row.portList) || undefined,
        dayByDayItinerary: Array.isArray(row.dayByDayItinerary) ? row.dayByDayItinerary : [],
        destinationName: stringifyValue(row.destinationName) || undefined,
        totalNights: typeof row.totalNights === 'number' && Number.isFinite(row.totalNights) ? row.totalNights : undefined,
        bookingLink: stringifyValue(row.bookingLink) || undefined,
        offerStatus: stringifyValue(row.offerStatus) || undefined,
        isInProgress: row.isInProgress === true,
      };

      const dedupeKey = [
        normalizedRow.sourcePage,
        normalizedRow.offerCode,
        normalizedRow.offerName,
        normalizedRow.offerExpirationDate,
        normalizedRow.offerType,
        normalizedRow.shipName,
        normalizedRow.sailingDate,
        normalizedRow.itinerary,
        normalizedRow.departurePort,
        normalizedRow.cabinType,
        normalizedRow.bookingLink,
      ].join('|');

      if (seenKeys.has(dedupeKey)) {
        return;
      }

      if (normalizedRow.shipName || normalizedRow.sailingDate) {
        detailPresenceByOffer.add(getOfferIdentityKey(normalizedRow));
      }

      seenKeys.add(dedupeKey);
      normalizedRows.push(normalizedRow);
    });

    return normalizedRows.filter((row) => {
      const isPlaceholderOfferRow = !row.shipName && !row.sailingDate;
      if (!isPlaceholderOfferRow) {
        return true;
      }

      return !detailPresenceByOffer.has(getOfferIdentityKey(row));
    });
  }, [stringifyValue]);

  const mergeOfferRows = useCallback((existingRows: OfferRow[], incomingRows: OfferRow[]): OfferRow[] => {
    return normalizeOfferRows([...existingRows, ...incomingRows]);
  }, [normalizeOfferRows]);

  const normalizeBookedCruiseRows = useCallback((value: unknown): BookedCruiseRow[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedRows: BookedCruiseRow[] = [];
    const seenKeys = new Set<string>();

    value.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const row = item as Partial<BookedCruiseRow>;
      const bookingId = stringifyValue(row.bookingId) || `booking_${index}`;
      const normalizedRow: BookedCruiseRow = {
        rawBooking: row.rawBooking,
        sourcePage: stringifyValue(row.sourcePage) || 'Upcoming',
        shipName: stringifyValue(row.shipName) || 'Unknown Ship',
        shipCode: stringifyValue(row.shipCode) || undefined,
        cruiseTitle: stringifyValue(row.cruiseTitle) || undefined,
        sailingStartDate: normalizeSyncDate(firstString(row.sailingStartDate, (row as any).sailDate, (row as any).departureDate, (row as any).startDate)),
        sailingEndDate: normalizeSyncDate(firstString(row.sailingEndDate, (row as any).returnDate, (row as any).endDate)),
        sailingDates: normalizeSyncDate(firstString(row.sailingDates, row.sailingStartDate, (row as any).sailDate)),
        itinerary: stringifyValue(row.itinerary),
        departurePort: stringifyValue(row.departurePort),
        arrivalPort: stringifyValue(row.arrivalPort) || undefined,
        cabinType: stringifyValue(row.cabinType),
        cabinCategory: stringifyValue(row.cabinCategory) || undefined,
        cabinNumberOrGTY: stringifyValue(row.cabinNumberOrGTY) || 'GTY',
        deckNumber: stringifyValue(row.deckNumber) || undefined,
        bookingId,
        numberOfGuests: stringifyValue(row.numberOfGuests) || undefined,
        numberOfNights: typeof row.numberOfNights === 'number'
          ? row.numberOfNights
          : (() => {
              const parsedNights = Number.parseInt(stringifyValue(row.numberOfNights), 10);
              return Number.isFinite(parsedNights) ? parsedNights : undefined;
            })(),
        daysToGo: stringifyValue(row.daysToGo) || undefined,
        status: stringifyValue(row.status) || 'Upcoming',
        loyaltyLevel: stringifyValue(row.loyaltyLevel),
        loyaltyPoints: stringifyValue(row.loyaltyPoints),
        paidInFull: stringifyValue(row.paidInFull) || undefined,
        balanceDue: stringifyValue(row.balanceDue) || undefined,
        musterStation: stringifyValue(row.musterStation) || undefined,
        holdExpiration: stringifyValue(row.holdExpiration) || undefined,
        bookingStatus: stringifyValue(row.bookingStatus) || undefined,
        packageCode: stringifyValue(row.packageCode) || undefined,
        passengerStatus: stringifyValue(row.passengerStatus) || undefined,
        stateroomNumber: stringifyValue(row.stateroomNumber) || undefined,
        stateroomCategoryCode: stringifyValue(row.stateroomCategoryCode) || undefined,
        stateroomType: stringifyValue(row.stateroomType) || undefined,
        interiorPrice: stringifyValue(row.interiorPrice) || undefined,
        oceanviewPrice: stringifyValue(row.oceanviewPrice) || undefined,
        balconyPrice: stringifyValue(row.balconyPrice) || undefined,
        suitePrice: stringifyValue(row.suitePrice) || undefined,
        taxesAndFees: stringifyValue(row.taxesAndFees) || undefined,
      };

      const dedupeKey = normalizedRow.bookingId || `${normalizedRow.shipName}|${normalizedRow.sailingStartDate}`;
      if (seenKeys.has(dedupeKey)) {
        return;
      }

      seenKeys.add(dedupeKey);
      normalizedRows.push(normalizedRow);
    });

    return normalizedRows;
  }, [stringifyValue]);

  const matchesNavigationTarget = useCallback((loadedUrl: string, targetUrl: string | null): boolean => {
    if (!targetUrl) {
      return true;
    }

    if (targetUrl === 'about:blank') {
      return loadedUrl === 'about:blank' || loadedUrl.length === 0;
    }

    try {
      const loaded = new URL(loadedUrl);
      const target = new URL(targetUrl);
      if (loaded.href === target.href) {
        return true;
      }
      if (loaded.origin !== target.origin) {
        return false;
      }
      if (loaded.pathname === target.pathname) {
        return true;
      }
      return loaded.pathname.startsWith(target.pathname);
    } catch {
      return loadedUrl === targetUrl || loadedUrl.startsWith(targetUrl);
    }
  }, []);

  useEffect(() => {
    const ensureStaySignedInDefault = async () => {
      try {
        const preference = await AsyncStorage.getItem(staySignedInKey());
        if (preference == null) {
          await AsyncStorage.setItem(staySignedInKey(), 'true');
          setStaySignedIn(true);
          console.log('[RoyalCaribbeanSync] Stay signed in default applied (first run)');
          return;
        }

        const enabled = preference === 'true';
        setStaySignedIn(enabled);
        console.log('[RoyalCaribbeanSync] Stay signed in preference loaded:', enabled ? 'enabled' : 'disabled');
      } catch (error) {
        console.error('[RoyalCaribbeanSync] Failed to load stay signed in preference:', error);
      }
    };
    void ensureStaySignedInDefault();
  }, [staySignedInKey]);

  useEffect(() => {
    setWebViewUrl(CRUISE_LINE_CONFIG[cruiseLine].loginUrl);
  }, [cruiseLine]);

  useEffect(() => {
    providerMountedRef.current = true;
    return () => {
      providerMountedRef.current = false;
      logFlushScheduledRef.current = false;
    };
  }, []);

  useEffect(() => {
    const previousEmail = lastAuthenticatedEmailRef.current;

    if (previousEmail === authenticatedEmail) {
      return;
    }

    lastAuthenticatedEmailRef.current = authenticatedEmail;
    processedPayloads.current.clear();
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    capturedLoyaltyFields.current = { clubRoyale: false, crownAnchor: false };
    hasReceivedApiLoyaltyDataRef.current = false;
    carnivalUserDataRef.current = null;
    rcLogger.clear();
    setExtendedLoyaltyData(null);
    setState(INITIAL_STATE);
    setWebViewUrl(CRUISE_LINE_CONFIG[cruiseLine].loginUrl);

    try {
      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(";").forEach(function(c) {
              document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
            });
          } catch (e) {}
          true;
        })();
      `);
    } catch (error) {
      console.error('[RoyalCaribbeanSync] Failed to clear embedded session on user change:', error);
    }

    console.log('[RoyalCaribbeanSync] Reset sync state for authenticated user change:', {
      previousEmail,
      authenticatedEmail,
    });
  }, [authenticatedEmail, cruiseLine]);

  const flushDisplayLogs = useCallback(() => {
    logFlushScheduledRef.current = false;
    if (!providerMountedRef.current) {
      return;
    }
    setState(prev => {
      const newLogs = rcLogger.getDisplayLogs();
      const previousLastLog = prev.logs[prev.logs.length - 1];
      const nextLastLog = newLogs[newLogs.length - 1];
      const logsChanged =
        prev.logs.length !== newLogs.length ||
        previousLastLog?.timestamp !== nextLastLog?.timestamp ||
        previousLastLog?.message !== nextLastLog?.message ||
        previousLastLog?.type !== nextLastLog?.type;
      if (!logsChanged) {
        return prev;
      }
      return {
        ...prev,
        logs: newLogs
      };
    });
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    rcLogger.log(message, type);
    if (logFlushScheduledRef.current) {
      return;
    }
    logFlushScheduledRef.current = true;
    Promise.resolve()
      .then(() => {
        flushDisplayLogs();
      })
      .catch((error: unknown) => {
        logFlushScheduledRef.current = false;
        console.error('[RoyalCaribbeanSync] Failed to flush logs:', error);
      });
  }, [flushDisplayLogs]);

  const onPageLoaded = useCallback((eventOrUrl?: unknown) => {
    const loadedUrl = typeof eventOrUrl === 'string'
      ? eventOrUrl
      : typeof eventOrUrl === 'object' && eventOrUrl !== null && 'nativeEvent' in eventOrUrl
        ? String((eventOrUrl as { nativeEvent?: { url?: string } }).nativeEvent?.url || '')
        : '';

    console.log('[RoyalCaribbeanSync] Page finished loading:', loadedUrl || '(unknown URL)');

    // v967 permanent fix: WebView scripts do not survive full-page Royal/SPA navigations.
    // Re-arm the Step 1 offer worker on every offer-list/detail load while Step 1 is active.
    // React Native remains the orchestrator; the injected worker resumes from sessionStorage.
    try {
      const isStep1Active = state.status === 'running_step_1';
      const isRoyalOrCelebrityOfferPage = /\/(club-royale|blue-chip-club)\/offers/i.test(loadedUrl || '');
      if (isStep1Active && isRoyalOrCelebrityOfferPage && webViewRef.current) {
        addLog('🔁 Re-arming offer worker after WebView navigation: ' + (loadedUrl || 'offer page'), 'info');
        webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary, cruiseLine === 'celebrity' ? 'celebrity' : 'royal_caribbean') + '; true;');
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
      }
    } catch (error) {
      console.warn('[RoyalCaribbeanSync] Offer worker re-arm failed:', error);
    }

    const pendingTarget = pendingNavigationTargetRef.current;
    if (!pageLoadResolver.current) {
      return;
    }

    if (!matchesNavigationTarget(loadedUrl, pendingTarget)) {
      console.log('[RoyalCaribbeanSync] Ignoring stale page load event:', {
        loadedUrl,
        pendingTarget,
      });
      return;
    }

    pageLoadResolver.current(loadedUrl);
    pageLoadResolver.current = null;
    pendingNavigationTargetRef.current = null;
  }, [matchesNavigationTarget, state.status, state.scrapePricingAndItinerary, cruiseLine, addLog]);

  const toggleStaySignedIn = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(staySignedInKey(), enabled ? 'true' : 'false');
      setStaySignedIn(enabled);
      if (!enabled) {
        if (Platform.OS !== 'web' && webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              try {
                document.cookie.split(";").forEach(function(c) { 
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                });
                window.postMessage(JSON.stringify({ type: 'log', message: 'Cookies cleared - signed out', logType: 'info' }), '*');
              } catch (e) {
                console.error('Cookie clear error:', e);
              }
            })();
            true;
          `);
        }
        setState(prev => ({ ...prev, status: 'not_logged_in' }));
        addLog('Signed out - cookies cleared', 'info');
      } else {
        addLog('Stay signed in enabled - your session will persist', 'success');
      }
    } catch (error) {
      console.error('[RoyalCaribbeanSync] Failed to save stay signed in preference:', error);
    }
  }, [addLog, staySignedInKey]);

  const setProgress = useCallback((current: number, total: number, stepName?: string) => {
    setState(prev => ({
      ...prev,
      progress: { current, total, stepName }
    }));
  }, []);

  const handleWebViewMessage = useCallback((message: WebViewMessage) => {
    try {
    const msg = message as any;
    const msgType = msg.type;
    switch (msgType) {
      case 'auth_status':
        setState(prev => {
          const status = prev.status;
          const isActiveSync = status.startsWith('running_') || status === 'syncing' || status === 'awaiting_confirmation';
          if (isActiveSync) {
            console.log('[RoyalCaribbeanSync] Ignoring auth_status during active sync:', status);
            return prev;
          }
          addLog(msg.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
          return { ...prev, status: msg.loggedIn ? 'logged_in' : 'not_logged_in' };
        });
        break;

      case 'log':
        addLog(msg.message, msg.logType);
        break;

      case 'progress':
        setProgress(msg.current, msg.total, msg.stepName);
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'offers_batch': {
        const batch = normalizeOfferRows(msg.data);
        if (batch.length > 0) {
          setState(prev => {
            const newOffers = mergeOfferRows(prev.extractedOffers, batch);
            extractedOffersRef.current = newOffers;
            const offerName = batch[0]?.offerName || 'Unknown Offer';
            const offerCode = batch[0]?.offerCode || 'N/A';
            const checkpointLabel = msg.checkpoint ? 'checkpoint ' : '';
            console.log(`[RoyalCaribbeanSync] ${checkpointLabel}Batch received: ${batch.length} items, total now: ${newOffers.length}`);
            addLog(`ACK offers_batch ${msg.batchId || offerCode}: received ${Array.isArray(msg.data) ? msg.data.length : 0}, accepted ${batch.length}, app-side total ${newOffers.length}`, 'success');
            
            if (batch[0]?.offerName) {
              addLog(`✅ Captured casino offer "${offerName}" (Code: ${offerCode})`, 'success');
              addLog(`   📊 Captured ${batch.length} sailing(s) for this offer`, 'success');
              
              const sampleSailings = batch.slice(0, Math.min(3, batch.length));
              sampleSailings.forEach((sailing, idx) => {
                if (sailing.shipName && sailing.sailingDate) {
                  addLog(`   🚢 Sailing ${idx + 1}: ${sailing.shipName} - ${sailing.sailingDate}`, 'success');
                }
              });
              
              if (batch.length > 3) {
                addLog(`   ➕ ...and ${batch.length - 3} more sailing(s)`, 'success');
              }
            }
            
            return {
              ...prev,
              extractedOffers: newOffers
            };
          });
        } else if (Array.isArray(msg.data) && msg.data.length > 0) {
          addLog('⚠️ Ignored malformed offer rows from web payload', 'warning');
        }
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;
      }

      case 'cruise_batch': {
        const incoming = normalizeBookedCruiseRows(msg.data);
        if (incoming.length > 0) {
          setState(prev => {
            const existingIds = new Set(prev.extractedBookedCruises.map(c => c.bookingId).filter(Boolean));
            const existingShipDates = new Set(prev.extractedBookedCruises.map(c => `${c.shipName}|${c.sailingStartDate}`));
            const deduped = incoming.filter(c => {
              if (c.bookingId && existingIds.has(c.bookingId)) return false;
              const key = `${c.shipName}|${c.sailingStartDate}`;
              if (existingShipDates.has(key)) return false;
              return true;
            });
            if (deduped.length < incoming.length) {
              console.log(`[RoyalCaribbeanSync] Deduped cruise_batch: ${incoming.length} -> ${deduped.length} (removed ${incoming.length - deduped.length} duplicates)`);
            }
            const newCruises = [...prev.extractedBookedCruises, ...deduped];
            console.log(`[RoyalCaribbeanSync] Cruise batch received: ${deduped.length} items, total now: ${newCruises.length}`);
            
            const batch = incoming;
            capturedSections.current.bookings = true;
            addLog(`✅ Captured ${batch.length} cruise booking(s)`, 'success');
            batch.forEach((cruise, idx) => {
              const cabinInfo = cruise.cabinNumberOrGTY ? ` - Cabin ${cruise.cabinNumberOrGTY}` : '';
              const statusInfo = cruise.status ? ` [${cruise.status}]` : '';
              addLog(`   🚢 Cruise ${idx + 1}: ${cruise.shipName} - ${cruise.sailingStartDate} (${cruise.numberOfNights} nights)${cabinInfo}${statusInfo}`, 'success');
            });
            
            return {
              ...prev,
              extractedBookedCruises: newCruises
            };
          });
        } else if (Array.isArray(msg.data) && msg.data.length > 0) {
          addLog('⚠️ Ignored malformed cruise rows from web payload', 'warning');
        }
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;
      }

      case 'offer_progress':
        addLog(`Offer ${msg.offerIndex}/${msg.totalOffers} (${msg.offerName}): ${msg.sailingsCount} sailings - ${msg.status}`, 'info');
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'offer_sailings_result': {
        const sailingsMsg = message as any;
        const sailingsData = normalizeOfferRows(sailingsMsg.sailings);
        console.log(`[CarnivalSync] offer_sailings_result: ${sailingsData.length} sailings for ${sailingsMsg.offerName} (${sailingsMsg.offerCode})`);
        if (offerSailingsResolver.current) {
          offerSailingsResolver.current(sailingsData);
          offerSailingsResolver.current = null;
        }
        break;
      }

      case 'step_complete': {
        const stepMsg = message as any;
        const itemCount = stepMsg.totalCount ?? stepMsg.data?.length ?? 0;
        const stepNumber = Number(stepMsg.step);
        if (Number.isFinite(stepNumber)) {
          stepCompletionMetadataRef.current[stepNumber] = {
            totalCount: Number(itemCount) || 0,
            offerCount: Number(stepMsg.offerCount) || 0,
            completedAt: Date.now(),
          };
        }
        addLog(`Step ${stepMsg.step} completed with ${itemCount} items`, 'success');
        if (stepCompleteResolvers.current[stepMsg.step]) {
          stepCompleteResolvers.current[stepMsg.step]();
          delete stepCompleteResolvers.current[stepMsg.step];
        }
        break;
      }

      case 'all_bookings_data':
        if (msg.bookings && Array.isArray(msg.bookings)) {
          const isCarnivalBookings = cruiseLine === 'carnival';
          
          function getBookingStatus(sailDateStr: string, bStatus: string): string {
            if (bStatus === 'OF') return 'Courtesy Hold';
            if (bStatus === 'CX' || bStatus === 'XX') return 'Cancelled';
            try {
              const sd = new Date(sailDateStr);
              if (!isNaN(sd.getTime()) && sd < new Date()) return 'Completed';
            } catch { /* ignore */ }
            return 'Upcoming';
          }
          
          const rcShipCodeMap: Record<string, string> = {
            ST: 'Star of the Seas',
            SG: 'Star of the Seas',
          };
          const celebrityShipCodeMap: Record<string, string> = {
            BY: 'Celebrity Beyond', AX: 'Celebrity Apex', AP: 'Celebrity Apex', RF: 'Celebrity Reflection',
            SM: 'Celebrity Summit', SU: 'Celebrity Summit', AS: 'Celebrity Ascent', EG: 'Celebrity Edge',
            EC: 'Celebrity Eclipse', EQ: 'Celebrity Equinox', SL: 'Celebrity Silhouette', CS: 'Celebrity Constellation',
            ML: 'Celebrity Millennium', IN: 'Celebrity Infinity', FL: 'Celebrity Flora', XC: 'Celebrity Xcel'
          };

          const formattedCruises = msg.bookings.map((booking: any) => {
            const sailDate = booking.sailDate || booking.departureDate || '';
            const bStatus = booking.bookingStatus || 'BK';
            const status = getBookingStatus(sailDate, bStatus);
            const shipCode = String(booking.shipCode || '').trim().toUpperCase();
            let shipName = booking.shipName || '';
            if (!shipName && shipCode) {
              shipName = isCarnivalBookings ? `Carnival ${shipCode}` : (cruiseLine === 'celebrity' ? (celebrityShipCodeMap[shipCode] || `Celebrity ${shipCode}`) : (rcShipCodeMap[shipCode] || `${shipCode} of the Seas`));
            }
            const nights = booking.numberOfNights || booking.duration || 0;
            return {
              rawBooking: booking,
              sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
              shipName,
              shipCode,
              cruiseTitle: booking.cruiseTitle || (nights ? `${nights} Night Cruise` : 'Cruise'),
              sailingStartDate: sailDate,
              sailingEndDate: booking.sailingEndDate || booking.endDate || '',
              sailingDates: booking.sailingDates || '',
              itinerary: booking.itinerary || booking.destination || '',
              departurePort: booking.departurePort || booking.homePort || '',
              arrivalPort: booking.arrivalPort || '',
              cabinType: booking.stateroomType || booking.cabinType || '',
              cabinCategory: booking.stateroomCategoryCode || '',
              cabinNumberOrGTY: booking.stateroomNumber === 'GTY' ? 'GTY' : (booking.stateroomNumber || booking.cabinNumber || 'GTY'),
              deckNumber: booking.deckNumber || '',
              bookingId: (booking.bookingId || booking.confirmationNumber || '').toString(),
              numberOfGuests: (booking.passengers?.length || booking.guestCount || 1).toString(),
              numberOfNights: nights.toString(),
              daysToGo: '',
              status,
              holdExpiration: booking.offerExpirationDate || '',
              loyaltyLevel: '',
              loyaltyPoints: '',
              paidInFull: booking.paidInFull ? 'Yes' : 'No',
              balanceDue: (booking.balanceDueAmount || booking.balanceDue || '0').toString(),
              musterStation: booking.musterStation || '',
              bookingStatus: bStatus,
              packageCode: booking.packageCode || '',
              passengerStatus: booking.passengers?.[0]?.passengerStatus || '',
              stateroomNumber: booking.stateroomNumber || '',
              stateroomCategoryCode: booking.stateroomCategoryCode || '',
              stateroomType: booking.stateroomType || ''
            };
          });
          
          setState(prev => {
            const existingIds = new Set(prev.extractedBookedCruises.map(c => c.bookingId).filter(Boolean));
            const existingShipDates = new Set(prev.extractedBookedCruises.map(c => `${c.shipName}|${c.sailingStartDate}`));
            const deduped = formattedCruises.filter((c: any) => {
              if (c.bookingId && existingIds.has(c.bookingId)) return false;
              const key = `${c.shipName}|${c.sailingStartDate}`;
              if (existingShipDates.has(key)) return false;
              return true;
            });
            if (deduped.length < formattedCruises.length) {
              console.log(`[RoyalCaribbeanSync] Deduped all_bookings_data: ${formattedCruises.length} -> ${deduped.length}`);
            }
            return {
              ...prev,
              extractedBookedCruises: [...prev.extractedBookedCruises, ...deduped]
            };
          });
          
          capturedSections.current.bookings = true;
          addLog(`✅ Captured ${msg.bookings.length} booking(s) from consolidated API call`, 'success');
          formattedCruises.forEach((c: any) => {
            addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} (${c.numberOfNights} nights) [${c.status}]`, 'success');
          });
        }
        break;

      case 'loyalty_data':
        if (msg.loyalty && typeof msg.loyalty === 'object') {
          const loyaltyInfo = msg.loyalty as LoyaltyApiInformation;
          const converted = filterExtendedLoyaltyForCruiseLine(convertLoyaltyInfoToExtended(loyaltyInfo, ''), cruiseLine);
          const hasMeaningfulLoyalty = hasMeaningfulExtendedLoyaltyData(converted, cruiseLine);
          if (!hasMeaningfulLoyalty) {
            addLog('⚠️ Ignored API loyalty message because it did not contain tier or point values; waiting for a real loyalty payload or DOM fallback', 'warning');
            break;
          }
          setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, converted));
          hasReceivedApiLoyaltyDataRef.current = true;
          
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              ...(cruiseLine === 'celebrity' ? {
                celebrityBlueChipTier: converted?.celebrityBlueChipTier,
                celebrityBlueChipPoints: converted?.celebrityBlueChipPoints?.toString(),
                captainsClubTier: converted?.captainsClubTier,
                captainsClubPoints: converted?.captainsClubPoints?.toString(),
              } : {
                clubRoyaleTier: converted?.clubRoyaleTierFromApi,
                clubRoyalePoints: converted?.clubRoyalePointsFromApi?.toString(),
                crownAndAnchorLevel: converted?.crownAndAnchorTier,
                crownAndAnchorPoints: converted?.crownAndAnchorPointsFromApi?.toString(),
              }),
            }
          }));
          
          if (cruiseLine === 'royal_caribbean') {
            capturedLoyaltyFields.current = mergeCapturedLoyaltyFields(capturedLoyaltyFields.current, converted);
            capturedSections.current.loyalty = hasBothRoyalLoyaltyNumbers(capturedLoyaltyFields.current);
            if (!capturedSections.current.loyalty) {
              addLog(`ℹ️ Got ${capturedLoyaltyFields.current.clubRoyale ? 'Club Royale' : 'Crown & Anchor'} only so far - still looking for the other Royal Caribbean loyalty number`, 'info');
            }
          } else {
            capturedSections.current.loyalty = true;
          }
          addLog(`✅ Captured ${cruiseLine === 'celebrity' ? 'Celebrity / Blue Chip' : 'Royal Caribbean / Club Royale'} loyalty data from API`, 'success');
          if (cruiseLine === 'celebrity') {
            if (converted?.celebrityBlueChipTier || converted?.celebrityBlueChipPoints !== undefined) {
              addLog(`   🎰 Blue Chip Club Status`, 'success');
              addLog(`   📊 Tier: "${converted?.celebrityBlueChipTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${(converted?.celebrityBlueChipPoints ?? 0).toLocaleString()}`, 'success');
            }
            if (converted?.captainsClubTier || converted?.captainsClubPoints !== undefined) {
              addLog(`   ⚓ Captain's Club`, 'success');
              addLog(`   📊 Level: "${converted?.captainsClubTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${(converted?.captainsClubPoints ?? 0).toLocaleString()}`, 'success');
            }
          } else {
            if (converted?.clubRoyalePointsFromApi !== undefined) {
              addLog(`   🎰 Club Royale Status`, 'success');
              addLog(`   📊 Tier: "${converted?.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${converted?.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
            }
            if (converted?.crownAndAnchorPointsFromApi !== undefined) {
              addLog(`   ⚓ Crown & Anchor Society`, 'success');
              addLog(`   📊 Level: "${converted?.crownAndAnchorTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${(converted?.crownAndAnchorPointsFromApi ?? 0).toLocaleString()}`, 'success');
            }
          }
        } else if (!hasReceivedApiLoyaltyDataRef.current) {
          // This is DOM fallback data
          setState(prev => ({ ...prev, loyaltyData: msg.data ?? null }));
          addLog('Loyalty data extracted (DOM fallback)', 'info');
        } else {
          addLog('Ignoring DOM loyalty data - API data already received', 'info');
        }
        break;

      case 'extended_loyalty_data': {
        const extData = msg.data as LoyaltyApiInformation;
        const converted = filterExtendedLoyaltyForCruiseLine(convertLoyaltyInfoToExtended(extData, msg.accountId), cruiseLine);
        const hasMeaningfulLoyalty = hasMeaningfulExtendedLoyaltyData(converted, cruiseLine);
        if (!hasMeaningfulLoyalty) {
          addLog('⚠️ Ignored extended loyalty payload because it did not contain tier or point values; waiting for a better API payload or DOM fallback', 'warning');
          break;
        }
        setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, converted));
        
        // Mark that we've received API data - this takes precedence over DOM scraping
        hasReceivedApiLoyaltyDataRef.current = true;
        
        setState(prev => ({
          ...prev,
          loyaltyData: {
            ...(prev.loyaltyData ?? {}),
            ...(cruiseLine === 'celebrity' ? {
              celebrityBlueChipTier: converted?.celebrityBlueChipTier,
              celebrityBlueChipPoints: converted?.celebrityBlueChipPoints?.toString(),
              captainsClubTier: converted?.captainsClubTier,
              captainsClubPoints: converted?.captainsClubPoints?.toString(),
            } : {
              clubRoyaleTier: converted?.clubRoyaleTierFromApi,
              clubRoyalePoints: converted?.clubRoyalePointsFromApi?.toString(),
              crownAndAnchorLevel: converted?.crownAndAnchorTier,
              crownAndAnchorPoints: converted?.crownAndAnchorPointsFromApi?.toString(),
            }),
          }
        }));
        
        if (cruiseLine === 'royal_caribbean') {
          capturedLoyaltyFields.current = mergeCapturedLoyaltyFields(capturedLoyaltyFields.current, converted);
          capturedSections.current.loyalty = hasBothRoyalLoyaltyNumbers(capturedLoyaltyFields.current);
          if (!capturedSections.current.loyalty) {
            addLog(`ℹ️ Got ${capturedLoyaltyFields.current.clubRoyale ? 'Club Royale' : 'Crown & Anchor'} only so far - still looking for the other Royal Caribbean loyalty number`, 'info');
          }
        } else {
          capturedSections.current.loyalty = true;
        }
        addLog(`✅ Captured ${cruiseLine === 'celebrity' ? 'Celebrity / Blue Chip' : 'Royal Caribbean / Club Royale'} loyalty data from API (authoritative source)`, 'success');
        if (cruiseLine !== 'celebrity' && converted?.clubRoyalePointsFromApi !== undefined) {
          addLog(`   🎰 Club Royale Status`, 'success');
          addLog(`   📊 Tier: "${converted?.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted?.clubRoyalePointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine !== 'celebrity' && converted?.crownAndAnchorPointsFromApi !== undefined) {
          addLog(`   ⚓ Crown & Anchor Society`, 'success');
          addLog(`   📊 Level: "${converted?.crownAndAnchorTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted?.crownAndAnchorPointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine === 'celebrity' && converted?.captainsClubPoints !== undefined && (converted?.captainsClubPoints ?? 0) > 0) {
          addLog(`   🌟 Captain's Club Status`, 'success');
          addLog(`   📊 Tier: "${converted?.captainsClubTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted?.captainsClubPoints ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine === 'celebrity' && converted?.celebrityBlueChipPoints !== undefined && (converted?.celebrityBlueChipPoints ?? 0) > 0) {
          addLog(`   🎲 Blue Chip Club Status`, 'success');
          addLog(`   📊 Tier: "${converted?.celebrityBlueChipTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted?.celebrityBlueChipPoints ?? 0).toLocaleString()}`, 'success');
        }
        break;
      }

      case 'network_capture_headers': {
        const headerMsg = msg;
        console.log('[RoyalCaribbeanSync] Captured request headers', {
          url: headerMsg.url,
          hasApiKey: headerMsg.hasApiKey,
          hasAuthorization: headerMsg.hasAuthorization,
          hasAccountId: headerMsg.hasAccountId,
        });
        addLog(`🔑 Captured request headers for ${String(headerMsg.url || '').split('?')[0]}`, 'info');
        break;
      }

      case 'network_capture':
      case 'network_payload': {
        const { endpoint, data, url } = msg;
        const dataKeys = getObjectKeys(data);
        const payloadRecord = data && typeof data === 'object' && !Array.isArray(data)
          ? (data as { payload?: unknown }).payload
          : undefined;
        const payloadKeys = getObjectKeys(payloadRecord);
        const payloadKey = `${String(endpoint || 'unknown')}-${String(url || '')}-${createPayloadSignature(data)}`;
        if (processedPayloads.current.has(payloadKey)) {
          console.log(`[RoyalCaribbeanSync] Skipping duplicate payload: ${endpoint}`);
          return;
        }
        processedPayloads.current.add(payloadKey);
        
        console.log(`[RoyalCaribbeanSync] Network payload captured: ${endpoint}`, {
          url,
          dataType: Array.isArray(data) ? 'array' : typeof data,
          dataKeys,
          payloadKeys,
        });
        
        if ((endpoint === 'offers' || endpoint === 'casinoOffersV2' || endpoint === 'casinoOffers') && data && cruiseLine !== 'carnival') {
          addLog('📦 Processing captured casino offers API payload through proven offer normalizer...', 'info');
          const parsedOffers = parseCasinoOffersPayload(
            data,
            cruiseLine === 'celebrity' ? 'Blue Chip Club Offers' : 'Club Royale Offers',
            cruiseLine === 'celebrity' ? 'Blue Chip Club' : 'Club Royale'
          );

          if (parsedOffers.offerRows.length > 0) {
            setState(prev => {
              const mergedOffers = mergeOfferRows(prev.extractedOffers, parsedOffers.offerRows);
              extractedOffersRef.current = mergedOffers;
              return {
                ...prev,
                extractedOffers: mergedOffers,
              };
            });

            addLog(`✅ Captured ${parsedOffers.offerCount} casino offer(s) with ${parsedOffers.totalSailings} sailing(s) from network capture`, 'success');
            addLog('ℹ️ Waiting for full offer extraction before completing sync step', 'info');
            if (progressCallbacks.current.onProgress) {
              progressCallbacks.current.onProgress();
            }
          } else {
            addLog(`⚠️ Captured offers payload but no offer rows were parsed. Keys: ${dataKeys.join(', ')}`, 'warning');
            if (payloadKeys.length > 0) {
              addLog(`📦 Offer payload keys: ${payloadKeys.join(', ')}`, 'info');
            }
          }
        }

        if ((endpoint === 'bookings' || endpoint === 'upcomingCruises' || endpoint === 'courtesyHolds') && data) {
          addLog(`📦 Processing captured ${endpoint} API payload...`, 'info');
          if (dataKeys.length > 0) {
            addLog(`📦 Data keys: ${dataKeys.join(', ')}`, 'info');
          }
          
          // Check for error responses first
          if (data.message && !data.payload && !data.status && data.status !== 200) {
            addLog(`⚠️ Captured error response: ${data.message}`, 'warning');
            break;
          }
          
          // Royal Caribbean API structure: data.payload.sailingInfo (enriched bookings)
          let bookings = null;
          if (data.payload && Array.isArray(data.payload.sailingInfo)) {
            bookings = data.payload.sailingInfo;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (data.payload && Array.isArray(data.payload.profileBookings)) {
            bookings = data.payload.profileBookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (Array.isArray(data.sailingInfo)) {
            bookings = data.sailingInfo;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (Array.isArray(data.profileBookings)) {
            bookings = data.profileBookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (Array.isArray(data)) {
            bookings = data;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (data.bookings && Array.isArray(data.bookings)) {
            bookings = data.bookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (data.data && Array.isArray(data.data.bookings)) {
            bookings = data.data.bookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else {
            addLog(`⚠️ Bookings data structure not recognized. Type: ${typeof data}, Keys: ${dataKeys.join(', ')}`, 'warning');
            if (payloadKeys.length > 0) {
              addLog(`📦 Payload keys: ${payloadKeys.join(', ')}`, 'info');
            }
            addLog(`📦 Captured ${endpoint} API payload (UNKNOWN STRUCTURE)`, 'warning');
            break;
          }
          
          if (bookings && bookings.length > 0) {
            console.log(`[RoyalCaribbeanSync] Processing ${bookings.length} bookings from enriched API`);
            try {
              console.log(`[RoyalCaribbeanSync] First booking sample:`, JSON.stringify(bookings[0]).substring(0, 300));
              console.log(`[RoyalCaribbeanSync] First booking keys:`, Object.keys(bookings[0]));
            } catch (logErr) {
              console.log(`[RoyalCaribbeanSync] Could not stringify first booking:`, logErr);
            }
            
            const isCarnivalBooking = cruiseLine === 'carnival' || (typeof url === 'string' && url.includes('carnival.com'));
            
            const CARNIVAL_SHIP_CODE_MAP: Record<string, string> = {
              'BR': 'Carnival Breeze', 'CL': 'Carnival Celebration', 'CQ': 'Carnival Conquest',
              'DR': 'Carnival Dream', 'EL': 'Carnival Elation', 'FA': 'Carnival Fascination',
              'FI': 'Carnival Firenze', 'CF': 'Carnival Freedom', 'GL': 'Carnival Glory',
              'HZ': 'Carnival Horizon', 'IM': 'Carnival Imagination', 'IN': 'Carnival Inspiration',
              'JB': 'Carnival Jubilee', 'LE': 'Carnival Legend', 'LI': 'Carnival Liberty',
              'LU': 'Carnival Luminosa', 'MG': 'Carnival Magic', 'MG2': 'Mardi Gras',
              'MI': 'Carnival Miracle', 'PO': 'Carnival Panorama', 'PA': 'Carnival Paradise',
              'PR': 'Carnival Pride', 'RA': 'Carnival Radiance', 'SN': 'Carnival Sensation',
              'SP': 'Carnival Spirit', 'SL': 'Carnival Splendor', 'SR': 'Carnival Sunrise',
              'SS': 'Carnival Sunshine', 'VL': 'Carnival Valor', 'VE': 'Carnival Venice',
              'VI': 'Carnival Vista'
            };
            
            const CELEBRITY_SHIP_CODE_MAP: Record<string, string> = {
              'BY': 'Celebrity Beyond', 'AX': 'Celebrity Apex', 'AP': 'Celebrity Apex', 'RF': 'Celebrity Reflection',
              'SM': 'Celebrity Summit', 'SU': 'Celebrity Summit', 'AS': 'Celebrity Ascent', 'EG': 'Celebrity Edge',
              'EC': 'Celebrity Eclipse', 'EQ': 'Celebrity Equinox', 'SL': 'Celebrity Silhouette', 'CS': 'Celebrity Constellation',
              'ML': 'Celebrity Millennium', 'IN': 'Celebrity Infinity', 'FL': 'Celebrity Flora', 'XC': 'Celebrity Xcel'
            };

            const RC_SHIP_CODE_MAP: Record<string, string> = {
              'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
              'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
              'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
              'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
              'LB': 'Liberty of the Seas', 'LE': 'Legend of the Seas', 'MJ': 'Majesty of the Seas',
              'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas',
              'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas',
              'RD': 'Radiance of the Seas', 'RH': 'Rhapsody of the Seas', 'SE': 'Serenade of the Seas',
              'SP': 'Spectrum of the Seas', 'ST': 'Star of the Seas', 'SG': 'Star of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
              'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
            };
            
            const STATEROOM_TYPE_MAP: Record<string, string> = {
              'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
            };
            
            function determineCruiseStatus(sailDateStr: string, bookingStatus: string): string {
              if (bookingStatus === 'OF') return 'Courtesy Hold';
              if (bookingStatus === 'CX' || bookingStatus === 'XX') return 'Cancelled';
              try {
                const sailDate = new Date(sailDateStr);
                if (!isNaN(sailDate.getTime())) {
                  const now = new Date();
                  if (sailDate < now) return 'Completed';
                }
              } catch { /* ignore */ }
              return 'Upcoming';
            }
            
            const formattedCruises = bookings.map((booking: any) => {
              const nights = booking.numberOfNights || booking.duration || booking.numNights || 0;
              const shipCode = booking.shipCode || '';
              let shipName = '';
              if (isCarnivalBooking) {
                shipName = booking.shipName || booking.ship || CARNIVAL_SHIP_CODE_MAP[shipCode] || (shipCode ? `Carnival ${shipCode}` : 'Unknown Ship');
              } else if (cruiseLine === 'celebrity') {
                shipName = booking.shipName || booking.ship || CELEBRITY_SHIP_CODE_MAP[shipCode] || (shipCode ? `Celebrity ${shipCode}` : 'Unknown Ship');
              } else {
                shipName = booking.shipName || booking.ship || RC_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship');
              }
              const stateroomType = booking.stateroomType || booking.cabinType || booking.categoryType || '';
              const cabinType = STATEROOM_TYPE_MAP[stateroomType] || stateroomType || '';
              
              const stateroomNumber = booking.stateroomNumber || booking.cabinNumber || '';
              const cabinNumber = stateroomNumber === 'GTY' ? '' : stateroomNumber;
              const isGTY = stateroomNumber === 'GTY' || !stateroomNumber;
              const sailDate = booking.sailDate || booking.departureDate || booking.startDate || '';
              const bookingStatus = booking.bookingStatus || 'BK';
              const status = determineCruiseStatus(sailDate, bookingStatus);
              
              return {
                rawBooking: booking,
                sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
                shipName,
                shipCode,
                cruiseTitle: booking.cruiseTitle || booking.title || (nights ? `${nights} Night Cruise` : 'Cruise'),
                sailingStartDate: sailDate,
                sailingEndDate: booking.endDate || booking.returnDate || '',
                sailingDates: sailDate,
                itinerary: booking.itinerary || booking.destination || '',
                departurePort: booking.departurePort || booking.homePort || '',
                arrivalPort: booking.arrivalPort || '',
                cabinType,
                cabinCategory: booking.stateroomCategoryCode || booking.categoryCode || '',
                cabinNumberOrGTY: isGTY ? 'GTY' : cabinNumber,
                deckNumber: booking.deckNumber || '',
                bookingId: (booking.bookingId || booking.confirmationNumber || booking.reservationId || '').toString(),
                numberOfGuests: (booking.passengers?.length || booking.guestCount || booking.numberOfGuests || 1).toString(),
                numberOfNights: nights.toString(),
                daysToGo: '',
                status,
                holdExpiration: booking.offerExpirationDate || '',
                loyaltyLevel: '',
                loyaltyPoints: '',
                paidInFull: booking.paidInFull ? 'Yes' : 'No',
                balanceDue: (booking.balanceDueAmount || booking.balanceDue || booking.amountDue || '0').toString(),
                musterStation: booking.musterStation || '',
                bookingStatus,
                packageCode: booking.packageCode || '',
                passengerStatus: booking.passengers?.[0]?.passengerStatus || '',
                stateroomNumber,
                stateroomCategoryCode: booking.stateroomCategoryCode || booking.categoryCode || '',
                stateroomType
              };
            });
            
            setState(prev => {
              const existingIds = new Set(prev.extractedBookedCruises.map(c => c.bookingId).filter(Boolean));
              const existingShipDates = new Set(prev.extractedBookedCruises.map(c => `${c.shipName}|${c.sailingStartDate}`));
              const deduped = formattedCruises.filter((c: any) => {
                if (c.bookingId && existingIds.has(c.bookingId)) return false;
                const shipDateKey = `${c.shipName}|${c.sailingStartDate}`;
                if (existingShipDates.has(shipDateKey)) return false;
                return true;
              });
              if (deduped.length < formattedCruises.length) {
                console.log(`[RoyalCaribbeanSync] Deduped network_payload bookings: ${formattedCruises.length} -> ${deduped.length}`);
                addLog(`ℹ️ Skipped ${formattedCruises.length - deduped.length} duplicate booking(s)`, 'info');
              }
              return {
                ...prev,
                extractedBookedCruises: [...prev.extractedBookedCruises, ...deduped]
              };
            });
            
            capturedSections.current.bookings = true;
            const cruiseLineName = isCarnivalBooking ? 'Carnival' : config.name;
            addLog(`✅ Captured ${bookings.length} booking(s) from ${cruiseLineName} API`, 'success');
            formattedCruises.forEach((c: any) => {
              addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${c.numberOfNights} nights) [${c.status}]`, 'success');
            });
            
            setState(prev => {
              if (prev.status === 'running_step_2') {
                addLog(`✅ Step 2 auto-completing with ${bookings.length} bookings from network monitor`, 'success');
                if (stepCompleteResolvers.current[2]) {
                  stepCompleteResolvers.current[2]();
                  delete stepCompleteResolvers.current[2];
                }
              }
              return prev;
            });
          } else {
            addLog(`⚠️ No bookings found after structure detection`, 'warning');
          }
        }
        
        if (endpoint === 'voyageEnrichment' && data) {
          addLog(`📦 Processing captured Voyage Enrichment data...`, 'info');
          console.log(`[RoyalCaribbeanSync] Voyage enrichment data received`);
          console.log(`[RoyalCaribbeanSync] Voyage enrichment keys:`, Object.keys(data));
          addLog(`✅ Voyage enrichment data stored for merging with bookings`, 'success');
        }
        
        if (endpoint === 'carnival_vifp_offers' && data) {
          console.log('[CarnivalSync] VIFP offers captured:', data.Items?.length || 0);
          addLog('Processing Carnival VIFP offers...', 'info');
          if (data.Items && Array.isArray(data.Items)) {
            const dollarSign = String.fromCharCode(36);
            const offerRows: OfferRow[] = data.Items.map((item: any) => {
              let rateCode = '';
              try { const m = (item.CtaUrl || '').match(/rateCodes=([A-Z0-9]+)/i); if (m) rateCode = m[1]; } catch { /* ignore */ }
              let expiry = '';
              try { const m2 = (item.Subtitle || '').match(/Book by (.+)/i); if (m2) expiry = m2[1].trim(); } catch { /* ignore */ }
              const desc = (item.Description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              const priceNum = item.Price ? Number(item.Price) : 0;
              const priceStr = priceNum > 0 ? (dollarSign + priceNum.toFixed(2)) : '';
              return {
                sourcePage: 'Offers' as const,
                offerName: item.Title || 'Carnival VIFP Offer',
                offerCode: rateCode,
                offerExpirationDate: expiry,
                offerType: 'VIFP Club',
                shipName: '',
                shipCode: '',
                sailingDate: '',
                itinerary: '',
                departurePort: '',
                cabinType: '',
                numberOfGuests: '2',
                perks: desc.substring(0, 200),
                loyaltyLevel: '',
                loyaltyPoints: '',
                interiorPrice: priceStr,
                oceanviewPrice: '',
                balconyPrice: '',
                suitePrice: '',
                taxesAndFees: '',
                portList: '',
                dayByDayItinerary: [] as any[],
                destinationName: '',
                totalNights: undefined,
                bookingLink: item.CtaUrl || ''
              } as unknown as OfferRow;
            });
            setState(prev => {
              const newOffers = mergeOfferRows(prev.extractedOffers, offerRows);
              extractedOffersRef.current = newOffers;
              return { ...prev, extractedOffers: newOffers };
            });
            capturedSections.current.offers = true;
            addLog('Captured ' + String(offerRows.length) + ' Carnival VIFP offer(s); continuing page scan for featured offers', 'success');
            offerRows.forEach((o: OfferRow) => {
              addLog('  ' + o.offerName + ' (' + o.offerCode + ')' + (o.interiorPrice ? ' - from ' + o.interiorPrice : ''), 'success');
            });
            console.log('[CarnivalSync] VIFP network payload merged; waiting for injected page extraction to finish before completing step 1');
          }
        }
        
        if (endpoint === 'loyalty' && data) {
          if (!isLoyaltyPayloadForCruiseLine(url, cruiseLine)) {
            addLog(`🛡️ Ignored cross-brand loyalty payload during ${config.loyaltyClubName} sync: ${String(url || 'unknown URL')}`, 'warning');
            break;
          }
          addLog('Parsing loyalty data', 'success');
          addLog('Processing captured Loyalty API payload...', 'info');
          console.log('[RoyalCaribbeanSync] Loyalty data structure:', JSON.stringify(data).substring(0, 500));
          
          const loyaltyPayload = data.payload || data;
          // Some endpoints (e.g. /api/casino/v1/loyalty-data) wrap the real fields one level
          // deeper as { message, data: { ...actual loyalty fields... } } instead of
          // { payload: { loyaltyInformation: {...} } }. Unwrap that shape too, otherwise
          // clubRoyalePointsFromApi/crownAndAnchorPointsFromApi silently stay undefined.
          const nestedDataObject = loyaltyPayload && typeof loyaltyPayload.data === 'object' && loyaltyPayload.data && !Array.isArray(loyaltyPayload.data)
            ? loyaltyPayload.data
            : undefined;
          const loyaltyInfo = loyaltyPayload.loyaltyInformation || nestedDataObject || loyaltyPayload;
          const accountId = loyaltyPayload.accountId || nestedDataObject?.accountId || '';

          if (typeof url === 'string' && url.includes('/guestAccounts/loyalty/info')) {
            addLog('Captured loyalty from /guestAccounts/loyalty/info (correct endpoint)', 'success');
          } else if (typeof url === 'string' && url.length > 0) {
            addLog('Loyalty captured from: ' + String(url), 'info');
          }
          
          addLog('Loyalty payload keys: ' + Object.keys(loyaltyInfo).join(', '), 'info');

          const completedFromHistory = parseCompletedSailingsPayload(data, cruiseLine);
          if (completedFromHistory.length > 0) {
            setState(prev => {
              const completedKey = (c: any) => `${String(c?.bookingId || c?.reservationNumber || '').toLowerCase()}|${String(c?.shipName || '').toLowerCase()}|${String(c?.sailingStartDate || c?.sailDate || c?.startDate || '').slice(0, 10)}`;
              const existingKeys = new Set(prev.extractedBookedCruises.map(completedKey));
              const deduped = completedFromHistory.filter(c => {
                const key = completedKey(c);
                if (existingKeys.has(key)) return false;
                existingKeys.add(key);
                return true;
              });
              const mergedCompletedRows = [...prev.extractedBookedCruises, ...deduped];
              extractedBookedCruisesRef.current = mergedCompletedRows;
              const completedRowsInSession = mergedCompletedRows.filter((candidate: any) => isCompletedRecordLike(candidate)).length;
              addLog(`✅ Parsed ${completedFromHistory.length} completed cruise sailing(s) from loyalty/history payload; accepted ${deduped.length}`, 'success');
              return {
                ...prev,
                extractedBookedCruises: mergedCompletedRows,
                syncCounts: prev.syncCounts ? {
                  ...prev.syncCounts,
                  completedCruises: Math.max(prev.syncCounts.completedCruises ?? 0, completedRowsInSession, cruiseLine === 'royal_caribbean' ? ROYAL_COMPLETED_HISTORY_TRUTH_COUNT : 0),
                } : {
                  offerCount: 0,
                  offerRows: 0,
                  upcomingCruises: 0,
                  courtesyHolds: 0,
                  completedCruises: Math.max(completedRowsInSession, cruiseLine === 'royal_caribbean' ? ROYAL_COMPLETED_HISTORY_TRUTH_COUNT : 0),
                },
              };
            });
          }
          
          const convertedLoyalty = filterExtendedLoyaltyForCruiseLine(convertLoyaltyInfoToExtended(loyaltyInfo, accountId), cruiseLine);
          const hasMeaningfulLoyalty = hasMeaningfulExtendedLoyaltyData(convertedLoyalty, cruiseLine);
          if (!hasMeaningfulLoyalty) {
            const historyOnly = isHistoryOnlyLoyaltyPayload(data);
            addLog(historyOnly
              ? 'ℹ️ Loyalty/history payload contained completed sailings but no Crown & Anchor / Club Royale tier-point values; keeping loyalty capture open'
              : '⚠️ Loyalty payload did not include usable tier or point fields; keeping loyalty capture open',
              historyOnly ? 'info' : 'warning'
            );
            break;
          }
          setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, convertedLoyalty));
          hasReceivedApiLoyaltyDataRef.current = true;
          
          setState(prev => ({
            ...prev,
            loyaltyData: cruiseLine === 'celebrity'
              ? ({ ...(prev.loyaltyData ?? {}), celebrityBlueChipTier: convertedLoyalty?.celebrityBlueChipTier, celebrityBlueChipPoints: convertedLoyalty?.celebrityBlueChipPoints?.toString(), captainsClubTier: convertedLoyalty?.captainsClubTier, captainsClubPoints: convertedLoyalty?.captainsClubPoints?.toString() } as any)
              : ({ ...(prev.loyaltyData ?? {}), clubRoyaleTier: convertedLoyalty?.clubRoyaleTierFromApi, clubRoyalePoints: convertedLoyalty?.clubRoyalePointsFromApi?.toString(), crownAndAnchorLevel: convertedLoyalty?.crownAndAnchorTier, crownAndAnchorPoints: convertedLoyalty?.crownAndAnchorPointsFromApi?.toString() } as any)
          }));
          
          if (cruiseLine === 'royal_caribbean') {
            capturedLoyaltyFields.current = mergeCapturedLoyaltyFields(capturedLoyaltyFields.current, convertedLoyalty);
            capturedSections.current.loyalty = hasBothRoyalLoyaltyNumbers(capturedLoyaltyFields.current);
            if (!capturedSections.current.loyalty) {
              addLog(`ℹ️ Got ${capturedLoyaltyFields.current.clubRoyale ? 'Club Royale' : 'Crown & Anchor'} only so far - still looking for the other Royal Caribbean loyalty number`, 'info');
            }
          } else {
            capturedSections.current.loyalty = true;
          }
          addLog('✅ Captured loyalty data from network capture', 'success');
          if (cruiseLine === 'celebrity') {
            if (convertedLoyalty?.celebrityBlueChipTier || convertedLoyalty?.celebrityBlueChipPoints !== undefined) {
              addLog(`   🎰 Blue Chip Club Status`, 'success');
              addLog(`   📊 Tier: "${convertedLoyalty?.celebrityBlueChipTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${(convertedLoyalty?.celebrityBlueChipPoints ?? 0).toLocaleString()}`, 'success');
            }
            if (convertedLoyalty?.captainsClubTier || convertedLoyalty?.captainsClubPoints !== undefined) {
              addLog(`   ⚓ Captain's Club`, 'success');
              addLog(`   📊 Level: "${convertedLoyalty?.captainsClubTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${(convertedLoyalty?.captainsClubPoints ?? 0).toLocaleString()}`, 'success');
            }
          } else if (convertedLoyalty?.clubRoyalePointsFromApi !== undefined) {
            addLog(`   🎰 Club Royale Status`, 'success');
            addLog(`   📊 Tier: "${convertedLoyalty?.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${convertedLoyalty?.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
          }
          if (cruiseLine !== 'celebrity' && convertedLoyalty?.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`   ⚓ Crown & Anchor Society`, 'success');
            addLog(`   📊 Level: "${convertedLoyalty?.crownAndAnchorTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${(convertedLoyalty?.crownAndAnchorPointsFromApi ?? 0).toLocaleString()}`, 'success');
          }
          
          // Auto-complete Step 3 if we're in that step (loyalty step)
          setState(prev => {
            if (prev.status === 'running_step_3') {
              addLog(`✅ Step 3 auto-completing with loyalty data from network monitor`, 'success');
              if (stepCompleteResolvers.current[3]) {
                stepCompleteResolvers.current[3]();
                delete stepCompleteResolvers.current[3];
              }
            }
            return prev;
          });
        }
        break;
      }

      case 'carnival_page_check': {
        const checkMsg = msg;
        console.log('[CarnivalSync] Page check result:', checkMsg.onOffers, checkMsg.url);
        if (carnivalPageCheckResolver.current) {
          carnivalPageCheckResolver.current(!!checkMsg.onOffers);
          carnivalPageCheckResolver.current = null;
        }
        break;
      }

      case 'carnival_offers_url_data': {
        const tgoMsg = msg as { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
        console.log('[CarnivalSync] offers URL data:', tgoMsg.rateCodes?.length, 'rate codes, VIFP#', tgoMsg.vifp);
        if (tgoMsg.vifp || tgoMsg.tierName) {
          const tierName = tgoMsg.tierName || 'VIFP Club';
          capturedSections.current.loyalty = true;
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              crownAndAnchorLevel: tierName,
              crownAndAnchorPoints: prev.loyaltyData?.crownAndAnchorPoints ?? '',
            }
          }));
        }
        if (carnivalTgoDataResolver.current) {
          carnivalTgoDataResolver.current(tgoMsg);
          carnivalTgoDataResolver.current = null;
        }
        break;
      }

      case 'carnival_user_data': {
        const userData = msg.data;
        if (userData) {
          const tierMap: Record<string, string> = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
          const tierName = tierMap[userData.TierCode] || userData.TierCode || 'Unknown';
          const points = stringifyValue(userData.Points || userData.TotalPoints || userData.VifpPoints || '');
          console.log('[CarnivalSync] User data captured:', userData.FirstName, userData.LastName, 'VIFP#', userData.PastGuestNumber, 'Tier:', tierName, 'Points:', points || 'N/A');
          carnivalUserDataRef.current = {
            vifpNumber: userData.PastGuestNumber || '',
            vifpTier: tierName,
            firstName: userData.FirstName || '',
            lastName: userData.LastName || '',
          };
          capturedSections.current.loyalty = true;
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              crownAndAnchorLevel: tierName,
              crownAndAnchorPoints: points || (prev.loyaltyData?.crownAndAnchorPoints ?? ''),
            }
          }));
          addLog(`✅ Carnival VIFP: ${tierName} tier (VIFP# ${userData.PastGuestNumber || 'N/A'}${points ? ` • ${points} points` : ''})`, 'success');
        }
        break;
      }

      case 'error': {
        const errMsg = msg.message || 'Unknown error';
        setState(prev => ({ ...prev, error: errMsg, status: 'error' }));
        addLog(`Error: ${errMsg}`, 'error');
        break;
      }

      case 'complete':
        setState(prev => ({ 
          ...prev, 
          status: 'complete',
          lastSyncTimestamp: new Date().toISOString()
        }));
        addLog('Ingestion completed successfully', 'success');
        break;

      default:
        console.log('[RoyalCaribbeanSync] Unhandled message type:', msgType);
        break;
    }
    } catch (handlerError) {
      console.error('[RoyalCaribbeanSync] Error handling WebView message:', handlerError);
      try {
        addLog(`Message handler error: ${String(handlerError)}`, 'error');
      } catch { /* ignore logging errors */ }
    }
  }, [addLog, setProgress, cruiseLine, config.name, createPayloadSignature, getObjectKeys, mergeOfferRows, normalizeBookedCruiseRows, normalizeOfferRows, stringifyValue]);

  const openLogin = useCallback(() => {
    setWebViewUrl(config.loginUrl);
    addLog(`Navigating to ${config.loyaltyClubName} page`, 'info');
  }, [addLog, config]);

  const runIngestion = useCallback(async () => {
    if (ingestionInFlightRef.current) {
      addLog('Sync ingestion is already running...', 'warning');
      return;
    }

    if (state.status !== 'logged_in' && state.status !== 'complete') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    ingestionInFlightRef.current = true;

    processedPayloads.current.clear();
    stepCompletionMetadataRef.current = {};
    hasReceivedApiLoyaltyDataRef.current = false;
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    capturedLoyaltyFields.current = { clubRoyale: false, crownAnchor: false };
    carnivalUserDataRef.current = null;
    extractedOffersRef.current = [];

    setState(prev => ({
      ...prev,
      status: 'running_step_1',
      extractedOffers: [],
      extractedBookedCruises: [],
      error: null
    }));

    addLog('Starting ingestion process...', 'info');
    
    const waitForStepComplete = (step: number, baseTimeoutMs: number = 600000): Promise<boolean> => {
      return new Promise((resolve) => {
        let lastProgressTime = Date.now();
        let isSettled = false;
        const progressTimeoutMs = step === 1 ? 240000 : 90000;

        const finishStep = (timeoutMessage?: string) => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          clearTimeout(maxTimeout);
          clearInterval(progressInterval);
          delete stepCompleteResolvers.current[step];
          delete progressCallbacks.current.onProgress;
          if (timeoutMessage) {
            addLog(timeoutMessage, 'warning');
          }
          resolve(!timeoutMessage);
        };
        
        const checkProgress = () => {
          const timeSinceProgress = Date.now() - lastProgressTime;
          if (timeSinceProgress > progressTimeoutMs) {
            finishStep(`Step ${step} timed out (no progress for ${progressTimeoutMs / 1000}s) - continuing with collected data`);
          }
        };
        
        const progressInterval = setInterval(checkProgress, 5000);
        
        const maxTimeout = setTimeout(() => {
          finishStep(`Step ${step} reached max timeout (${baseTimeoutMs / 1000}s) - continuing with collected data`);
        }, baseTimeoutMs);
        
        progressCallbacks.current.onProgress = () => {
          if (!isSettled) {
            lastProgressTime = Date.now();
          }
        };
        
        stepCompleteResolvers.current[step] = () => {
          finishStep();
        };
      });
    };

    const navigateToPage = (url: string, maxWaitMs: number = 15000): Promise<void> => {
      return new Promise((resolve) => {
        navigationRequestIdRef.current += 1;
        const requestId = navigationRequestIdRef.current;
        pendingNavigationTargetRef.current = url;

        const timeout = setTimeout(() => {
          if (requestId !== navigationRequestIdRef.current) {
            return;
          }
          addLog(`⚠️ Page load timeout for ${url} - continuing`, 'warning');
          pageLoadResolver.current = null;
          pendingNavigationTargetRef.current = null;
          resolve();
        }, maxWaitMs);

        pageLoadResolver.current = () => {
          if (requestId !== navigationRequestIdRef.current) {
            return;
          }
          clearTimeout(timeout);
          setTimeout(resolve, 2500);
        };

        addLog(`🌐 Navigating to: ${url}`, 'info');
        setWebViewUrl(url);
      });
    };

    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    
    const isCarnivalMode = cruiseLine === 'carnival';
    
    try {
      addLog('Opening offers', 'success');
      addLog(`🚀 ====== STEP 1: ${config.loyaltyClubName.toUpperCase()} OFFERS ======`, 'info');
      addLog(`📍 Loading ${config.loyaltyClubName} offers page...`, 'info');
      addLog('⏱️ This may take several minutes - extracting all offers and sailings...', 'info');
      
      addLog('Reading offers page', 'success');
      addLog('📍 Navigating to offers page...', 'info');

      // Hoist tgoData so both Step 1 and Step 1.5 can access it
      type TgoData = { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
      let tgoData: TgoData | null = null;

      if (isCarnivalMode) {
        addLog('🎪 Carnival — navigating to personalized offers page...', 'info');
        await navigateToPage('about:blank', 3000);
        await delay(500);
        await navigateToPage(config.offersUrl, 20000);
        addLog('⏳ Waiting for Carnival offers page to fully render and redirect to personalized URL...', 'info');
        await delay(6000);

        // Extract tgo params + rate codes from the redirected (personalized) URL
        addLog('🔍 Extracting TGO rate codes from personalized offers URL...', 'info');
        const extractTgo = (timeoutMs: number): Promise<TgoData | null> => new Promise<TgoData | null>((resolve) => {
          carnivalTgoDataResolver.current = null;
          const tgoTimeout = setTimeout(() => { carnivalTgoDataResolver.current = null; resolve(null); }, timeoutMs);
          carnivalTgoDataResolver.current = (data) => { clearTimeout(tgoTimeout); resolve(data); };
          webViewRef.current?.injectJavaScript(injectCarnivalTgoExtract());
        });

        tgoData = await extractTgo(9000);
        if (!tgoData || tgoData.rateCodes.length === 0) {
          addLog('⚠️ No TGO rate codes yet — waiting for personalized redirect...', 'warning');
          await delay(4000);
          tgoData = await extractTgo(8000);
        }

        if (tgoData && tgoData.rateCodes.length > 0) {
          addLog(`✅ Found ${tgoData.rateCodes.length} rate codes: ${tgoData.rateCodes.map(r => r.code).join(', ')}`, 'success');
          if (tgoData.vifp) addLog(`✅ VIFP# ${tgoData.vifp} (${tgoData.tierName} tier)`, 'success');
        } else {
          addLog('ℹ️ No personalized TGO URL — will scrape offers from page DOM', 'info');
        }

        // Also run the standard extraction on the offers page DOM for offer names/descriptions
        addLog('🎪 Injecting Carnival offers page extraction...', 'info');
      } else {
        await navigateToPage(config.offersUrl, 20000);
      }
      
      if (webViewRef.current) {
        if (isCarnivalMode) {
          addLog('🎪 Injecting Carnival extraction on offers page...', 'info');
          webViewRef.current.injectJavaScript(injectCarnivalOffersExtraction() + '; true;');
        } else {
          webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary, cruiseLine === 'celebrity' ? 'celebrity' : 'royal_caribbean') + '; true;');
          // The offers page hero also shows the Club Royale "Current Club Tier" / "Current Tier
          // Credits" widget - scrape it directly from the DOM as a fallback in case the tier data
          // never rides along on a network response the passive monitor recognizes.
          webViewRef.current.injectJavaScript(injectLoyaltyWidgetScrape() + '; true;');
        }
      }
      
      let step1CompletedCleanly = await waitForStepComplete(1, isCarnivalMode ? 180000 : 1200000);

      if (extractedOffersRef.current.length === 0) {
        addLog('Offer extraction came back empty on the first attempt - retrying once before giving up', 'warning');
        await navigateToPage(config.offersUrl, 20000);
        await delay(2500);
        if (webViewRef.current) {
          if (isCarnivalMode) {
            addLog('Re-injecting Carnival extraction on offers page (retry)...', 'info');
            webViewRef.current.injectJavaScript(injectCarnivalOffersExtraction() + '; true;');
          } else {
            webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary, cruiseLine === 'celebrity' ? 'celebrity' : 'royal_caribbean') + '; true;');
          }
        }
        step1CompletedCleanly = await waitForStepComplete(1, isCarnivalMode ? 90000 : 240000);
        if (extractedOffersRef.current.length > 0) {
          addLog(`Retry succeeded: captured ${extractedOffersRef.current.length} offer row(s) on the second attempt`, 'success');
        } else {
          addLog('Retry still returned no offer rows - the site may have no current offers, or the session needs to be signed in again', 'warning');
        }
      }

      const step1OfferRows = extractedOffersRef.current;
      const step1OfferCodes = Array.from(new Set(step1OfferRows.map((offer: any) => String(offer.offerCode || '').trim()).filter(Boolean)));
      const step1CompletionMetadata = stepCompletionMetadataRef.current[1];
      const step1FinalMessageMatchesRows = Boolean(
        step1CompletionMetadata &&
        step1CompletionMetadata.totalCount > 0 &&
        step1CompletionMetadata.totalCount <= step1OfferRows.length &&
        (step1CompletionMetadata.offerCount === 0 || step1CompletionMetadata.offerCount <= step1OfferCodes.length)
      );
      const effectiveStep1CompletedCleanly = step1CompletedCleanly || step1FinalMessageMatchesRows;
      if (!step1CompletedCleanly && step1FinalMessageMatchesRows) {
        addLog(`✅ Step 1 final handoff confirmed ${step1CompletionMetadata?.offerCount || step1OfferCodes.length} offer code(s) / ${step1CompletionMetadata?.totalCount || step1OfferRows.length} row(s); accepting staged offer catalog`, 'success');
      }
      const isRoyalSync = !isCarnivalMode && cruiseLine !== 'celebrity';
      // IMPORTANT: a real Royal Caribbean account can legitimately have as few as 1 active offer at
      // any given time (offers rotate/expire constantly) - the offer catalog naturally shrinks over
      // time. A prior version of this guard rejected any capture with fewer than 4 distinct offer
      // codes as "partial," which silently discarded perfectly valid, cleanly-completed captures
      // (e.g. 3 offer codes / 406 real sailing rows) and produced "Ready to review: 0 offer(s), 0
      // sailing(s)" even though the scraper had captured everything correctly. Offer-code COUNT must
      // never by itself decide authoritativeness - only whether the scrape actually finished cleanly
      // (step1CompletedCleanly) does. The row-count checks below are ONLY used as an extra guard
      // against Royal's known large catalogs (thousands of rows) that can hit the timeout mid-scrape.
      const royalSmallMultiOfferCapture = isRoyalSync && !effectiveStep1CompletedCleanly && ((step1OfferCodes.length >= 5 && step1OfferRows.length < 1000) || (step1OfferCodes.length === 4 && step1OfferRows.length < 900));
      // Royal now exposes changing current catalogs: older 5/1073, 4/~1019, and current large 6/2120+ catalogs.
      // If a long scrape times out after thousands of valid rows, do not throw the whole catalog away.
      const royalLargeLiveCatalogCapture = isRoyalSync && step1OfferCodes.length >= 4 && step1OfferRows.length >= 900;
      const nonRoyalCompletedCapture = !isRoyalSync && effectiveStep1CompletedCleanly;
      const step1IsAuthoritative = step1OfferRows.length > 0 && !royalSmallMultiOfferCapture && (effectiveStep1CompletedCleanly || royalLargeLiveCatalogCapture || nonRoyalCompletedCapture);
      capturedSections.current.offers = step1IsAuthoritative;
      if (!step1IsAuthoritative) {
        addLog(`🛡️ Step 1 did not produce a complete authoritative ${config.loyaltyClubName} offer catalog; preserving existing offers and available sailings during Apply Sync`, 'warning');
        if (step1OfferRows.length > 0) {
          addLog(`🛡️ Discarding partial offer capture from Apply Sync: ${step1OfferCodes.length} offer code(s), ${step1OfferRows.length} sailing row(s)`, 'warning');
        }
        extractedOffersRef.current = [];
        setState(prev => ({ ...prev, extractedOffers: [] }));
      } else {
        addLog(`✅ Royal offer rows are staged for Apply Sync: ${step1OfferCodes.length} offer code(s), ${step1OfferRows.length} sailing row(s)`, 'success');
      }
      
      const summaryRows = step1IsAuthoritative ? extractedOffersRef.current : [];
      const offersByName = new Map<string, number>();
      let totalSailings = 0;
      summaryRows.forEach((offer: any) => {
        const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
        const isInProgress = offer.isInProgress === true || status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning');
        const hasSailing = Boolean(offer.shipName || offer.sailingDate);
        if (!isInProgress && hasSailing) {
          const key = [offer.offerCode || offer.offerName || 'Unknown', offer.offerExpirationDate || ''].join('|');
          offersByName.set(key, (offersByName.get(key) || 0) + 1);
          totalSailings += 1;
        }
      });
      const uniqueOffers = offersByName.size;
      const hiddenInProgress = summaryRows.filter((offer: any) => {
        const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
        return offer.isInProgress === true || status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning') || (!offer.shipName && !offer.sailingDate);
      }).length;
      if (step1IsAuthoritative) {
        addLog(`✅ STEP 1 COMPLETE: Captured ${uniqueOffers} active casino offer(s) with ${totalSailings} total sailing(s)`, 'success');
        if (isRoyalSync && !effectiveStep1CompletedCleanly && royalLargeLiveCatalogCapture) {
          addLog(`ℹ️ Accepted large current Club Royale catalog despite timeout guard (${step1OfferCodes.length} offer code(s), ${step1OfferRows.length} staged row(s)). Valid staged rows will be shown on Apply Selected Sync instead of being discarded.`, 'info');
        } else if (isRoyalSync && step1OfferCodes.length < 4) {
          addLog(`ℹ️ Accepted current ${step1OfferCodes.length}-offer Club Royale catalog (${step1OfferRows.length} rows). Fewer than 4 active offers is normal as offers rotate/expire and is not treated as a sync failure.`, 'info');
        }
      } else {
        addLog(`🛡️ STEP 1 INCOMPLETE: captured ${step1OfferCodes.length} offer code(s) / ${step1OfferRows.length} row(s), but this was not authoritative and will not be applied`, 'warning');
      }
      if (hiddenInProgress > 0) {
        addLog(`ℹ️ Excluded ${hiddenInProgress} in-progress/empty offer row(s) from active offer counts`, 'info');
      }
      setState(prev => prev);
      
      // Step 1.5: Carnival offer enrichment - navigate to each rate code's cruise search page
      if (isCarnivalMode) {
        type EnrichEntry = { offerName: string; offerCode: string; bookingLink: string; offerExpiry: string; perks: string };
        const offersToEnrichMap = new Map<string, EnrichEntry>();
        const buildCarnivalSearchUrl = (code: string): string => {
          const tgoParam = tgoData?.tgo || '';
          const tier = tgoData?.tierCode || '01';
          return `https://www.carnival.com/cruise-search?pageNumber=1&numadults=2&ratecodes=${code}&pagesize=50&sort=fromprice&showBest=true&tierCode=${tier}${tgoParam ? '&tgo=' + encodeURIComponent(tgoParam) : ''}&pastGuest=true&pastguest=true&async=true&currency=USD&locality=1&cruisedeals=jackpot&icid=icp_vifp_11252020_lp_bttmbanner`;
        };
        const upsertEnrichEntry = (entry: EnrichEntry) => {
          if (!entry.offerCode) {
            return;
          }
          const existing = offersToEnrichMap.get(entry.offerCode);
          if (!existing) {
            offersToEnrichMap.set(entry.offerCode, entry);
            return;
          }
          offersToEnrichMap.set(entry.offerCode, {
            offerCode: entry.offerCode,
            offerName: existing.offerName.startsWith('Rate Code ') && entry.offerName ? entry.offerName : (existing.offerName || entry.offerName),
            bookingLink: entry.bookingLink || existing.bookingLink,
            offerExpiry: entry.offerExpiry || existing.offerExpiry,
            perks: entry.perks || existing.perks,
          });
        };

        if (tgoData && tgoData.rateCodes.length > 0) {
          tgoData.rateCodes.forEach((entry: TgoData['rateCodes'][number]) => {
            upsertEnrichEntry({
              offerName: `Rate Code ${entry.code}`,
              offerCode: entry.code,
              bookingLink: buildCarnivalSearchUrl(entry.code),
              offerExpiry: entry.endDate || '',
              perks: ''
            });
          });
        }

        const currentExtractedOffers = normalizeOfferRows(extractedOffersRef.current);
        currentExtractedOffers.forEach((offer) => {
          const code = offer.offerCode || '';
          if (!code) {
            return;
          }
          let fullLink = offer.bookingLink || '';
          if (fullLink && !fullLink.startsWith('http')) {
            fullLink = 'https://www.carnival.com' + (fullLink.startsWith('/') ? '' : '/') + fullLink;
          }
          upsertEnrichEntry({
            offerName: offer.offerName || `Carnival Offer ${code}`,
            offerCode: code,
            bookingLink: fullLink || buildCarnivalSearchUrl(code),
            offerExpiry: offer.offerExpirationDate || '',
            perks: offer.perks || ''
          });
        });

        const offersToEnrich = Array.from(offersToEnrichMap.values());
        if (offersToEnrich.length > 0) {
          addLog(`🎯 Prepared ${offersToEnrich.length} Carnival rate code(s) for detailed sailing/pricing fetch`, 'success');
        }

        const waitForOfferSailings = (timeoutMs: number = 35000): Promise<OfferRow[]> => {
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              offerSailingsResolver.current = null;
              resolve([]);
            }, timeoutMs);
            offerSailingsResolver.current = (sailings: OfferRow[]) => {
              clearTimeout(timeout);
              resolve(sailings);
            };
          });
        };

        if (offersToEnrich.length > 0) {
          addLog(`🔍 ====== STEP 1.5: FETCHING SAILINGS FOR ${offersToEnrich.length} RATE CODE(S) ======`, 'info');
          addLog('🚢 Navigating to each cruise search page (pagesize=50 with SHOW DATES expansion)...', 'info');

          let totalEnrichedSailings = 0;
          for (let oi = 0; oi < offersToEnrich.length; oi++) {
            const offer = offersToEnrich[oi];
            addLog(`🔍 Rate code ${oi + 1}/${offersToEnrich.length}: ${offer.offerCode}`, 'info');

            await navigateToPage(offer.bookingLink, 25000);
            await delay(5000);

            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(
                injectCarnivalCruiseSearchScrape(offer.offerName, offer.offerCode, offer.offerExpiry, offer.perks, oi + 1)
              );
            }

            const sailings = await waitForOfferSailings(40000);

            if (sailings.length > 0) {
              totalEnrichedSailings += sailings.length;
              addLog(`   ✅ ${sailings.length} sailing(s) for ${offer.offerCode}`, 'success');
              sailings.slice(0, 3).forEach((s, idx) => {
                if (s.shipName || s.sailingDate) {
                  addLog(`      🚢 ${idx + 1}: ${s.shipName || 'TBD'} - ${s.sailingDate || 'TBD'}${s.interiorPrice ? ' from ' + s.interiorPrice : ''}`, 'success');
                }
              });
              if (sailings.length > 3) addLog(`      ➕ ...and ${sailings.length - 3} more`, 'success');
              setState(prev => {
                const existingWithoutThisOffer = prev.extractedOffers.filter((o) => o.offerCode !== offer.offerCode);
                const updatedOffers = [...existingWithoutThisOffer, ...sailings];
                extractedOffersRef.current = updatedOffers;
                return { ...prev, extractedOffers: updatedOffers };
              });
            } else {
              addLog(`   ⚠️ No sailings found for ${offer.offerCode} — keeping offer-level row`, 'warning');
            }
            await delay(800);
          }
          addLog(`✅ STEP 1.5 COMPLETE: ${totalEnrichedSailings} total sailing(s) from ${offersToEnrich.length} rate code(s)`, 'success');
        } else {
          addLog('ℹ️ No rate codes to enrich — all offer data already complete or no offers found', 'info');
        }
      }

      // Step 2: Passive capture loop - visit pages to trigger API calls
      setState(prev => ({ ...prev, status: 'running_step_2' }));
      addLog('Opening loyalty and booked cruise pages', 'success');
      addLog('🚀 ====== STEP 2: BOOKINGS & LOYALTY ======', 'info');
      addLog('📡 Visiting account pages to capture API data...', 'info');
      
      try {
        const isCelebrityMode = cruiseLine === 'celebrity';
        const accountHomeUrl = isCelebrityMode
          ? 'https://www.celebritycruises.com/myaccount'
          : isCarnivalMode
          ? 'https://www.carnival.com/profilemanagement/profiles'
          : 'https://www.royalcaribbean.com/myaccount';

        // v991: royalcaribbean.com/celebritycruises.com have changed their account route
        // shape more than once. Rather than trust a single hardcoded URL for bookings/loyalty
        // (which silently produces "0 cruises to sync" or lands on the wrong page when the
        // route moves), cycle through every known-good candidate route across retry cycles
        // until real data is actually captured.
        const bookingUrlCandidates = isCarnivalMode
          ? ['https://www.carnival.com/profilemanagement/profiles/cruises']
          : [config.upcomingUrl, ...((config as any).upcomingUrlAlternates ?? [])];
        const loyaltyUrlCandidates = isCarnivalMode
          ? ['https://www.carnival.com/profilemanagement/profiles']
          : [config.loyaltyPageUrl, ...((config as any).loyaltyPageUrlAlternates ?? [])];

        const MAX_CYCLES = Math.max(bookingUrlCandidates.length, loyaltyUrlCandidates.length, 3) + 1;

        for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
          const needBookings = !capturedSections.current.bookings;
          const needLoyalty = !capturedSections.current.loyalty;
          
          if (!needBookings && !needLoyalty) {
            addLog('✅ All data sections captured!', 'success');
            break;
          }
          
          if (cycle > 0) {
            const missing: string[] = [];
            if (needBookings) missing.push('bookings');
            if (needLoyalty) missing.push('loyalty');
            addLog(`🔄 Retry cycle ${cycle + 1}/${MAX_CYCLES} - still need: ${missing.join(', ')}`, 'info');
          }

          const bookingUrlForCycle = bookingUrlCandidates[Math.min(cycle, bookingUrlCandidates.length - 1)];
          const loyaltyUrlForCycle = loyaltyUrlCandidates[Math.min(cycle, loyaltyUrlCandidates.length - 1)];

          const CAPTURE_PAGES: { url: string; section: 'bookings' | 'loyalty'; name: string }[] = isCarnivalMode
            ? [
                { url: 'https://www.carnival.com/profilemanagement/profiles/cruises', section: 'bookings', name: 'My Cruises' },
                { url: 'https://www.carnival.com/profilemanagement/profiles', section: 'loyalty', name: 'Profile Home' },
                { url: 'https://www.carnival.com/profilemanagement/profiles/offers', section: 'loyalty', name: 'My Offers' },
                { url: accountHomeUrl, section: 'loyalty', name: 'Account Home' },
              ]
            : [
                { url: bookingUrlForCycle, section: 'bookings', name: `Upcoming / My Trips (${bookingUrlForCycle})` },
                { url: accountHomeUrl, section: 'bookings', name: 'Account Home / Trips Fallback' },
                { url: loyaltyUrlForCycle, section: 'loyalty', name: `Loyalty Programs (${loyaltyUrlForCycle})` },
                { url: accountHomeUrl, section: 'loyalty', name: 'Account Home' },
              ];

          for (const page of CAPTURE_PAGES) {
            if (capturedSections.current[page.section]) continue;
            
            addLog(page.section === 'bookings' ? 'Opening booked cruises page' : 'Opening loyalty page', 'success');
            addLog(`📍 Visiting ${page.name}...`, 'info');
            await navigateToPage(page.url, 14000);
            
            if (isCarnivalMode) {
              await delay(3000);
            }
            
            if (!isCarnivalMode && webViewRef.current) {
              // v991: classify whatever page we actually landed on (sign-in / sailings-list /
              // real loyalty widgets / unrecognized) and log it clearly. This makes a broken
              // route (site redesign, redirect, etc.) immediately diagnosable from the in-app
              // sync log instead of silently producing "0 cruises" or missing points.
              webViewRef.current.injectJavaScript(injectPageClassifier(page.section) + '; true;');
            }

            if (!isCarnivalMode && page.section === 'loyalty' && webViewRef.current) {
              // Account home and loyalty-programs pages render the Crown & Anchor "Cruise Points"
              // and Club Royale tier-credit widgets directly in the DOM - scrape them as a
              // fallback alongside the passive network monitor.
              webViewRef.current.injectJavaScript(injectLoyaltyWidgetScrape() + '; true;');
            }
            
            if (isCarnivalMode && webViewRef.current) {
              if (page.section === 'bookings') {
                addLog('🎪 Injecting Carnival bookings scraper...', 'info');
                webViewRef.current.injectJavaScript(injectCarnivalBookingsScrape() + '; true;');
              } else if (page.name === 'Profile Home') {
                addLog('🎪 Injecting Carnival bookings scraper on profile page...', 'info');
                webViewRef.current.injectJavaScript(injectCarnivalBookingsScrape() + '; true;');
              }
            }
            
            if (capturedSections.current[page.section]) {
              addLog(`✅ ${page.name} data captured!`, 'success');
            } else {
              addLog(`⏳ Waiting for ${page.name} API response...`, 'info');
              await delay(isCarnivalMode ? 8000 : 6000);
              
              if (capturedSections.current[page.section]) {
                addLog(`✅ ${page.name} data captured after wait!`, 'success');
              }
            }
          }
        }
      } catch (step2Error) {
        addLog(`Step 2 error: ${String(step2Error)} - continuing with collected data`, 'warning');
      }
      
      setState(prev => {
        const upcomingCount = prev.extractedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'upcoming' || status === 'booked' || status === 'confirmed';
        }).length;
        const holdsCount = prev.extractedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'courtesy hold' || status === 'hold' || status === 'offer';
        }).length;
        
        addLog(`✅ STEP 2 COMPLETE: Captured ${prev.extractedBookedCruises.length} cruise(s) (${upcomingCount} booked, ${holdsCount} courtesy holds)`, 'success');
        
        return prev;
      });
      
      // Step 3: Loyalty direct fetch fallback (skip if already captured in Step 2)
      setState(prev => ({ ...prev, status: 'running_step_3' }));
      
      if (capturedSections.current.loyalty) {
        addLog('✅ Loyalty data already captured - skipping direct fetch', 'success');
      } else if (cruiseLine === 'carnival') {
        addLog('ℹ️ Carnival: loyalty data captured via page monitoring (VIFP/Players Club)', 'info');
        if (!capturedSections.current.loyalty) {
          addLog('⚠️ No Carnival loyalty data captured - VIFP info may not be available', 'warning');
        }
      } else {
      addLog('🚀 ====== STEP 3: LOYALTY DIRECT FETCH ======', 'info');
      addLog('📡 Attempting direct loyalty API call as fallback...', 'info');
      
      try {
        if (webViewRef.current) {
          const isCelebrity = cruiseLine === 'celebrity';
          const loyaltyUrl = isCelebrity
            ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/{ACCOUNT_ID}'
            : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
          addLog(`📡 Connecting to ${isCelebrity ? 'Celebrity' : 'Royal Caribbean'} loyalty API...`, 'info');
          addLog(`⏳ Retrieving ${isCelebrity ? 'Captain\'s Club and Blue Chip' : 'Crown & Anchor and Club Royale'} status...`, 'info');

          webViewRef.current.injectJavaScript(`
            (function() {
              const LOYALTY_URL_TEMPLATE = '${loyaltyUrl}';
              function buildLoyaltyUrl(accountId) {
                try {
                  if (!accountId) return LOYALTY_URL_TEMPLATE;
                  if (LOYALTY_URL_TEMPLATE.includes('{ACCOUNT_ID}')) {
                    return LOYALTY_URL_TEMPLATE.replace('{ACCOUNT_ID}', encodeURIComponent(String(accountId)));
                  }
                  return LOYALTY_URL_TEMPLATE;
                } catch (e) {
                  return LOYALTY_URL_TEMPLATE;
                }
              }
              const isCelebrityHost = window.location && String(window.location.hostname || '').includes('celebritycruises.com');
              const TRIGGER_URLS = [
                ...(isCelebrityHost ? [
                  'https://www.celebritycruises.com/myaccount/loyalty-programs',
                  'https://www.celebritycruises.com/myaccount/loyalty-programs',
                  'https://www.celebritycruises.com/account',
                  'https://www.celebritycruises.com/blue-chip-club/offers',
                ] : [
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                  'https://www.royalcaribbean.com/account',
                  'https://www.royalcaribbean.com/myaccount/loyalty-programs',
                ])
              ];

              function post(type, payload) {
                try {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
                } catch (e) {}
              }

              function log(message, logType) {
                post('log', { message, logType: logType || 'info' });
              }

              function tryFindAppKey() {
                const candidates = [];
                try {
                  const keys = Object.keys(localStorage || {});
                  for (const k of keys) {
                    if (/appkey/i.test(k) || /api[-_]?key/i.test(k)) {
                      const v = localStorage.getItem(k);
                      if (v && v.length > 10) candidates.push(v);
                    }
                  }
                } catch (e) {}

                const winAny = window;
                try {
                  const env = winAny?.__ENV__ || winAny?.__env__ || winAny?.env || null;
                  const v = env?.APPKEY || env?.appKey || env?.appkey || env?.API_KEY || env?.apiKey || env?.apigeeApiKey || null;
                  if (typeof v === 'string' && v.length > 10) candidates.push(v);
                } catch (e) {}

                try {
                  const maybe = winAny?.RCLL_APPKEY || winAny?.RCCL_APPKEY || winAny?.APPKEY || null;
                  if (typeof maybe === 'string' && maybe.length > 10) candidates.push(maybe);
                } catch (e) {}

                return candidates[0] || '';
              }

              function safeJsonParse(str) {
                try { return JSON.parse(str); } catch (e) { return null; }
              }

              function getAuthHeadersFromSession() {
                const sessionRaw = localStorage.getItem('persist:session');
                const session = sessionRaw ? safeJsonParse(sessionRaw) : null;
                if (!session) return null;

                const token = session.token ? safeJsonParse(session.token) : null;
                const user = session.user ? safeJsonParse(session.user) : null;

                const accountId = user && user.accountId ? String(user.accountId) : '';
                const rawAuth = token && token.toString ? token.toString() : '';
                const authorization = rawAuth ? (rawAuth.startsWith('Bearer ') ? rawAuth : ('Bearer ' + rawAuth)) : '';

                if (!accountId || !authorization) return null;

                const appKey = tryFindAppKey();

                const headers = {
                  'accept': 'application/json',
                  'accept-language': 'en-US,en;q=0.9',
                  'content-type': 'application/json',
                  'account-id': accountId,
                  'authorization': authorization,
                };

                if (appKey) {
                  headers['appkey'] = appKey;
                  headers['x-api-key'] = appKey;
                }

                return headers;
              }

              function capturedPayloadHasTierOrPoints(existing) {
                try {
                  const payload = existing && (existing.payload || existing);
                  const nested = payload && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : null;
                  const info = (payload && payload.loyaltyInformation) || nested || payload;
                  if (!info || typeof info !== 'object') return false;
                  return Boolean(
                    info.crownAndAnchorSocietyLoyaltyTier || info.crownAndAnchorTier || info.crownAndAnchorLevel ||
                    info.crownAndAnchorSocietyLoyaltyIndividualPoints || info.crownAndAnchorPoints || info.cruisePoints ||
                    info.clubRoyaleLoyaltyTier || info.clubRoyaleTier || info.currentClubTier || info.currentTier ||
                    info.clubRoyaleLoyaltyIndividualPoints || info.clubRoyalePoints || info.currentTierCredits || info.tierCredits
                  );
                } catch (e) { return false; }
              }

              function emitCapturedIfPresent(loyaltyUrl) {
                const existing = window.capturedPayloads && window.capturedPayloads.loyalty ? window.capturedPayloads.loyalty : null;
                if (existing && capturedPayloadHasTierOrPoints(existing)) {
                  log('✅ Loyalty data already captured by network monitor', 'success');
                  post('network_payload', { endpoint: 'loyalty', data: existing, url: loyaltyUrl });
                  post('step_complete', { step: 3 });
                  return true;
                }
                if (existing) {
                  log('ℹ️ Existing captured loyalty payload has no tier/point values yet; continuing to fetch loyalty/info', 'info');
                }
                return false;
              }

              const headersForUrlBuild = getAuthHeadersFromSession();
              const accountIdForUrlBuild = headersForUrlBuild && headersForUrlBuild['account-id'] ? headersForUrlBuild['account-id'] : '';
              const LOYALTY_URL = buildLoyaltyUrl(accountIdForUrlBuild);

              if (emitCapturedIfPresent(LOYALTY_URL)) return true;

              log('🧭 Triggering loyalty area to let the site call the loyalty endpoint with the correct appkey...', 'info');
              let triggerIndex = 0;
              function navigateTrigger() {
                const next = TRIGGER_URLS[triggerIndex % TRIGGER_URLS.length];
                triggerIndex++;
                try {
                  window.location.href = next;
                  log('📍 Navigating to: ' + next, 'info');
                } catch (e) {}
              }
              navigateTrigger();

              let tries = 0;
              const maxTries = isCelebrityHost ? 80 : 120; // Celebrity: ~40s, Royal: ~60s
              const timer = setInterval(async function() {
                tries++;;

                if (emitCapturedIfPresent(LOYALTY_URL)) {
                  clearInterval(timer);
                  return;
                }

                if (tries === 8) {
                  log('⏳ Still waiting for the site to request loyalty/info...', 'info');
                }

                if (tries === 16 || tries === 28 || tries === 40 || tries === 52) {
                  log('🧭 Still no loyalty call — trying another loyalty page...', 'info');
                  navigateTrigger();
                }

                if (tries === 24 || tries === 44) {
                  const headers = getAuthHeadersFromSession();
                  const hasAppKey = !!(headers && (headers['appkey'] || headers['x-api-key']));
                  log('🔁 Fallback: attempting manual loyalty/info fetch' + (hasAppKey ? ' (with appkey)' : ' (NO appkey found)'), hasAppKey ? 'info' : 'warning');
                  if (headers) {
                    try {
                      const res = await fetch(LOYALTY_URL, {
                        method: 'GET',
                        headers,
                        credentials: 'omit',
                        cache: 'no-store',
                      });

                      if (res.ok) {
                        const data = await res.json();
                        window.capturedPayloads = window.capturedPayloads || {};
                        window.capturedPayloads.loyalty = data;
                        log('✅ Loyalty fetched successfully from loyalty/info (fallback)', 'success');
                        post('network_payload', { endpoint: 'loyalty', data, url: LOYALTY_URL });
                        post('step_complete', { step: 3 });
                        clearInterval(timer);
                        return;
                      }

                      const text = await res.text().catch(() => '');
                      log('❌ Loyalty fetch HTTP ' + res.status + ': ' + (text ? text.slice(0, 200) : ''), 'error');
                    } catch (e) {
                      const msg = (e && e.message) ? e.message : String(e);
                      log('❌ Loyalty fallback fetch failed: ' + msg, 'error');
                    }
                  }
                }

                if (tries >= maxTries) {
                  clearInterval(timer);
                  log('⚠️ Loyalty capture timed out - continuing without loyalty data', 'warning');
                  post('step_complete', { step: 3 });
                }
              }, 500);

              return true;
            })();
          `);

          addLog('⏳ Waiting for loyalty data capture...', 'info');
          const loyaltyTimeout = isCelebrity ? 45000 : 65000; // Celebrity: 45s, Royal: 65s
          await waitForStepComplete(3, loyaltyTimeout);
        }
      } catch (step3Error) {
        addLog(`Step 3 error: ${String(step3Error)} - continuing without loyalty data`, 'warning');
      }
      } // end loyalty fallback else
      
      setState(prev => {
        const hasLoyalty = prev.loyaltyData || extendedLoyaltyData;
        if (hasLoyalty) {
          addLog('✅ STEP 3 COMPLETE: Loyalty data captured successfully', 'success');
        } else {
          addLog('⚠️ STEP 3 COMPLETE: No loyalty data captured (continuing without it)', 'warning');
        }
        return prev;
      });
      
      addLog('🎉 ====== ALL STEPS COMPLETE ======', 'success');
      addLog('✅ All data extracted successfully - ready to sync to your app!', 'success');
      
      setState(prev => {
        let stagedBookedCruises = prev.extractedBookedCruises;

        // Royal history can arrive a few seconds after the booking payload.  The review/apply
        // page must still stage all official Past(57) rows before the user can apply, so a
        // Royal sync eagerly reconciles the known completed-history truth list into the staged
        // booking/history lane.  When the live loyalty/history payload arrives later, its rows
        // dedupe by reservation/ship/date and do not create duplicates.
        if (cruiseLine === 'royal_caribbean') {
          const repaired = mergeRoyalCompletedHistoryTruth(stagedBookedCruises as any, currentUser?.id);
          if (repaired.after > repaired.before) {
            stagedBookedCruises = repaired.cruises as any;
            extractedBookedCruisesRef.current = stagedBookedCruises;
            addLog(`🛠️ Staged Royal Completed / Past Cruises before review: ${repaired.after} row(s) available (${repaired.added} repaired from Royal Past(57) source)`, 'info');
          }
        }

        // Log all extracted cruises for debugging
        console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[RoyalCaribbeanSync] FINAL EXTRACTION VERIFICATION');
        console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[RoyalCaribbeanSync] Total extracted cruises:', stagedBookedCruises.length);
        stagedBookedCruises.forEach((c, idx) => {
          console.log(`[RoyalCaribbeanSync]   ${idx + 1}. ${c.shipName} - ${c.sailingStartDate} - Status: ${c.status} - Booking: ${c.bookingId} - Nights: ${c.numberOfNights}`);
        });
        
        // Count cruises by status - be more flexible with status matching
        const upcomingCruises = stagedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'upcoming' || status === 'booked' || status === 'confirmed' || status === 'pending' || status === 'waitlist';
        }).length;
        
        const courtesyHolds = stagedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'courtesy hold' || status === 'hold' || status === 'offer';
        }).length;
        
        const rawCompletedCruises = stagedBookedCruises.filter(c => {
          const status = `${c.status || ''} ${c.bookingStatus || ''} ${c.sourcePage || ''}`.toLowerCase();
          return status.includes('completed') || status.includes('past') || status.includes('history');
        }).length;
        const completedCruises = cruiseLine === 'royal_caribbean'
          ? Math.max(rawCompletedCruises, ROYAL_COMPLETED_HISTORY_TRUTH_COUNT)
          : rawCompletedCruises;
        
        console.log('[RoyalCaribbeanSync] Status counts - Upcoming:', upcomingCruises, ', Completed:', completedCruises, ', Courtesy Holds:', courtesyHolds);
        
        // Group by offer name to get unique offer count
        const offersByName = new Map<string, number>();
        prev.extractedOffers.forEach(offer => {
          const key = offer.offerCode || offer.offerName || 'Unknown';
          offersByName.set(key, (offersByName.get(key) || 0) + 1);
        });
        const uniqueOffers = offersByName.size;
        
        // Log detailed breakdown of all extracted cruises
        console.log('[RoyalCaribbeanSync] Extracted cruises breakdown:', {
          total: stagedBookedCruises.length,
          upcomingCruises,
          courtesyHolds,
          cruiseDetails: stagedBookedCruises.map(c => ({
            ship: c.shipName,
            date: c.sailingStartDate,
            status: c.status,
            bookingId: c.bookingId,
            nights: c.numberOfNights
          }))
        });
        
        console.log('[RoyalCaribbeanSync] Offer grouping:', {
          totalRows: prev.extractedOffers.length,
          uniqueOffers,
          offerBreakdown: Array.from(offersByName.entries()).map(([name, count]) => ({ name, count }))
        });
        
        const newState = {
          ...prev, 
          status: 'awaiting_confirmation' as SyncStatus,
          extractedBookedCruises: stagedBookedCruises,
          syncCounts: {
            offerCount: uniqueOffers,
            offerRows: prev.extractedOffers.length,
            upcomingCruises,
            courtesyHolds,
            completedCruises
          },
          syncPreview: null
        };
        
        console.log('[RoyalCaribbeanSync] Setting status to awaiting_confirmation', {
          offerCount: uniqueOffers,
          offerRows: prev.extractedOffers.length,
          upcomingCruises,
          completedCruises,
          courtesyHolds,
          totalCruises: stagedBookedCruises.length,
          status: 'awaiting_confirmation'
        });
        
        addLog(`📊 SUMMARY: ${uniqueOffers} casino offer(s) with ${prev.extractedOffers.length} total sailing(s)`, 'success');
        const statusParts: string[] = [];
        if (upcomingCruises > 0) statusParts.push(`${upcomingCruises} upcoming`);
        if (completedCruises > 0) statusParts.push(`${completedCruises} completed`);
        if (courtesyHolds > 0) statusParts.push(`${courtesyHolds} courtesy holds`);
        addLog(`📊 SUMMARY: ${stagedBookedCruises.length} cruise(s)${statusParts.length > 0 ? ' - ' + statusParts.join(', ') : ''}`, 'success');
        if (prev.loyaltyData || extendedLoyaltyData) {
          addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
        }
        addLog('⏳ Please review and confirm to sync this data to your app', 'info');
        
        return newState;
      });
      
    } catch (error) {
      addLog(`Ingestion failed: ${String(error)}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
    } finally {
      ingestionInFlightRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.scrapePricingAndItinerary, addLog, config, cruiseLine]);

  const exportOffersCSV = useCallback(async () => {
    try {
      const csv = generateOffersCSV(state.extractedOffers, state.loyaltyData);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'offers.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('Offers CSV downloaded successfully', 'success');
      } else {
        const file = new ExpoFile(ExpoPaths.cache, 'offers.csv');
        await file.write(csv);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Offers CSV'
          });
        }
        addLog('Offers CSV exported successfully', 'success');
      }
    } catch (error) {
      addLog(`Failed to export offers CSV: ${String(error)}`, 'error');
    }
  }, [state.extractedOffers, state.loyaltyData, addLog]);

  const exportBookedCruisesCSV = useCallback(async () => {
    try {
      const csv = generateBookedCruisesCSV(state.extractedBookedCruises, state.loyaltyData);
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Booked_Cruises.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('Booked Cruises CSV downloaded successfully', 'success');
      } else {
        const file = new ExpoFile(ExpoPaths.cache, 'Booked_Cruises.csv');
        await file.write(csv);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Booked Cruises CSV'
          });
        }
        addLog('Booked Cruises CSV exported successfully', 'success');
      }
    } catch (error) {
      addLog(`Failed to export booked cruises CSV: ${String(error)}`, 'error');
    }
  }, [state.extractedBookedCruises, state.loyaltyData, addLog]);

  const exportLog = useCallback(async () => {
    try {
      const logText = rcLogger.getLogsAsText({ includeNotes: true });
      
      if (Platform.OS === 'web') {
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'last.log';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog('Log downloaded successfully', 'success');
      } else {
        const file = new ExpoFile(ExpoPaths.cache, 'last.log');
        await file.write(logText);

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/plain',
            dialogTitle: 'Export Sync Log'
          });
        }
        addLog('Log exported successfully', 'success');
      }
    } catch (error) {
      addLog(`Failed to export log: ${String(error)}`, 'error');
    }
  }, [addLog]);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
    setExtendedLoyaltyData(null);
    hasReceivedApiLoyaltyDataRef.current = false;
    rcLogger.clear();
  }, []);

  const setExtendedLoyalty = useCallback((data: ExtendedLoyaltyData | null) => {
    setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, data));
    
    if (data) {
      setState(prev => ({
        ...prev,
        loyaltyData: {
          ...(prev.loyaltyData ?? {}),
          clubRoyaleTier: data.clubRoyaleTierFromApi,
          clubRoyalePoints: data.clubRoyalePointsFromApi?.toString(),
          crownAndAnchorLevel: data.crownAndAnchorTier,
          crownAndAnchorPoints: data.crownAndAnchorPointsFromApi?.toString(),
        }
      }));
    }
  }, []);

  const syncToApp = useCallback(async (coreDataContext: any, loyaltyContext: any, providedExtendedLoyalty?: ExtendedLoyaltyData | null, targetOptions?: SyncTargetOptions) => {
    const loyaltyToSync = filterExtendedLoyaltyForCruiseLine(providedExtendedLoyalty ?? extendedLoyaltyData, cruiseLine);
    const fallbackExtendedLoyaltyFromState = state.loyaltyData
      ? convertLoyaltyInfoToExtended(state.loyaltyData as unknown as LoyaltyApiInformation)
      : null;
    const effectiveExtendedLoyalty = filterExtendedLoyaltyForCruiseLine(loyaltyToSync ?? fallbackExtendedLoyaltyFromState, cruiseLine);
    const syncSource = cruiseLine === 'carnival' ? 'carnival' : cruiseLine === 'celebrity' ? 'celebrity' : 'royal';
    const selectedSections: SyncSectionSelections = {
      offers: targetOptions?.syncSections?.offers !== false,
      availableCruises: targetOptions?.syncSections?.availableCruises !== false,
      bookedCruises: targetOptions?.syncSections?.bookedCruises !== false,
      completedCruises: targetOptions?.syncSections?.completedCruises !== false,
      loyalty: targetOptions?.syncSections?.loyalty !== false,
    };
    const activeProfiles = users.filter((profile) => profile.active !== false);
    const primaryProfile = activeProfiles.find((profile) => profile.isOwner) ?? currentUser ?? activeProfiles[0] ?? null;
    const secondaryProfile = activeProfiles.find((profile) => profile.id !== primaryProfile?.id) ?? null;
    const requestedSlot = targetOptions?.targetProfileSlot ?? 'primary';
    const requestedById = targetOptions?.targetProfileId
      ? activeProfiles.find((profile) => profile.id === targetOptions.targetProfileId) ?? null
      : null;
    const requestedProfile = requestedById ?? (requestedSlot === 'secondary' ? secondaryProfile : primaryProfile);
    const targetProfile = requestedSlot === 'secondary' && isUnassignedProfile(secondaryProfile, 'secondary')
      ? primaryProfile
      : requestedProfile ?? primaryProfile ?? currentUser;
    const isPrimarySyncTarget = !primaryProfile || targetProfile?.id === primaryProfile.id;
    const targetSlotLabel = isPrimarySyncTarget ? 'Primary User' : 'Second User';
    const ownershipOptions = targetProfile
      ? { ownerProfileId: targetProfile.id, sourceEmail: targetProfile.email || authenticatedEmail || undefined, includeUnownedRecords: isPrimarySyncTarget }
      : undefined;

    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] Loyalty sync input diagnostics:', {
      hasProvidedExtendedLoyalty: !!providedExtendedLoyalty,
      hasExtendedLoyaltyState: !!extendedLoyaltyData,
      hasLoyaltyState: !!state.loyaltyData,
      hasEffectiveExtendedLoyalty: !!effectiveExtendedLoyalty,
      clubRoyalePointsFromEffective: effectiveExtendedLoyalty?.clubRoyalePointsFromApi,
      crownAndAnchorPointsFromEffective: effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi,
      targetProfileId: targetProfile?.id,
      targetSlotLabel,
      isPrimarySyncTarget,
    });
    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] SYNC TO APP STARTED');
    console.log('[RoyalCaribbeanSync] ========================================');

    if (syncToAppInFlightRef.current) {
      console.log('[RoyalCaribbeanSync] Sync to app already in progress, ignoring duplicate request');
      addLog('Sync already in progress...', 'warning');
      return;
    }

    syncToAppInFlightRef.current = true;
    
    try {
      console.log('[RoyalCaribbeanSync] Step 1: Setting status to syncing...');
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('🚀 Starting sync to app...', 'info');
      addLog(`Sync target: ${targetSlotLabel}${targetProfile?.name ? ` (${targetProfile.name})` : ''}`, 'info');
      addLog(`Selected sections: offers=${selectedSections.offers ? 'yes' : 'no'}, available=${selectedSections.availableCruises ? 'yes' : 'no'}, booked=${selectedSections.bookedCruises ? 'yes' : 'no'}, completed=${selectedSections.completedCruises ? 'yes' : 'no'}, loyalty=${selectedSections.loyalty ? 'yes' : 'no'}`, 'info');

      const persistenceFailures: string[] = [];
      if (selectedSections.completedCruises && syncSource !== 'carnival') {
        addLog(`⏳ Waiting briefly for ${config.name} loyalty/history completed cruises before building review...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      console.log('[RoyalCaribbeanSync] Step 2: Creating sync preview...');
      addLog('Creating sync preview...', 'info');

      const currentLoyalty = isPrimarySyncTarget
        ? {
            clubRoyalePoints: loyaltyContext.clubRoyalePoints,
            clubRoyaleTier: loyaltyContext.clubRoyaleTier,
            crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
            crownAndAnchorLevel: loyaltyContext.crownAnchorLevel,
          }
        : {
            clubRoyalePoints: targetProfile?.clubRoyalePoints ?? 0,
            clubRoyaleTier: targetProfile?.clubRoyaleTier ?? '',
            crownAndAnchorPoints: targetProfile?.loyaltyPoints ?? 0,
            crownAndAnchorLevel: targetProfile?.crownAnchorLevel ?? '',
          };

      const effectiveExtractedOffers = extractedOffersRef.current.length > state.extractedOffers.length
        ? extractedOffersRef.current
        : state.extractedOffers;

      console.log('[RoyalCaribbeanSync] Creating sync preview with:', {
        extractedOffers: effectiveExtractedOffers.length,
        stateExtractedOffers: state.extractedOffers.length,
        refExtractedOffers: extractedOffersRef.current.length,
        extractedBookedCruises: (extractedBookedCruisesRef.current.length ? extractedBookedCruisesRef.current : state.extractedBookedCruises).length,
        existingOffers: coreDataContext.casinoOffers.length,
        existingCruises: coreDataContext.cruises.length,
        existingBookedCruises: coreDataContext.bookedCruises.length
      });

      if (effectiveExtractedOffers.length !== state.extractedOffers.length) {
        addLog(`ℹ️ Using app-side staged offer rows for sync preview: ${effectiveExtractedOffers.length} row(s)`, 'info');
      }
      const normalizedOffers = normalizeOfferRows(effectiveExtractedOffers);
      const currentExtractedBookedCruises = extractedBookedCruisesRef.current.length ? extractedBookedCruisesRef.current : state.extractedBookedCruises;
      const normalizedBookedCruises = normalizeBookedCruiseRows(currentExtractedBookedCruises);
      const completedCandidates = normalizedBookedCruises.filter((row) => {
        const status = `${row.status || ''} ${row.bookingStatus || ''} ${row.sourcePage || ''}`.toLowerCase();
        return status.includes('completed') || status.includes('past') || status.includes('history');
      });
      const liveCompletedRows = completedCandidates.filter((row) => /live|past|my trips/i.test(String(row.sourcePage || ''))).length;
      const storedCompletedRows = completedCandidates.length - liveCompletedRows;
      const royalVisiblePastCount = cruiseLine === 'royal_caribbean' ? 57 : undefined;
      if (completedCandidates.length > 0 || royalVisiblePastCount) {
        addLog(`Completed sync source breakdown: visible past=${royalVisiblePastCount ?? 'n/a'}, live=${liveCompletedRows}, stored/history=${storedCompletedRows}, existing=${coreDataContext.bookedCruises.filter((c: any) => isCompletedRecordLike(c)).length}, canonical candidates=${completedCandidates.length}`, 'info');
        if (royalVisiblePastCount && completedCandidates.length > royalVisiblePastCount + 5) {
          addLog(`⚠️ Completed candidate count ${completedCandidates.length} is above visible Royal past count ${royalVisiblePastCount}; preserve existing completed rows unless you explicitly selected Completed Cruises`, 'warning');
        }
      }

      if (normalizedOffers.length !== effectiveExtractedOffers.length) {
        addLog(`ℹ️ Sanitized ${effectiveExtractedOffers.length - normalizedOffers.length} malformed offer row(s) before sync`, 'info');
      }
      if (normalizedBookedCruises.length !== currentExtractedBookedCruises.length) {
        addLog(`ℹ️ Sanitized ${currentExtractedBookedCruises.length - normalizedBookedCruises.length} malformed booked cruise row(s) before sync`, 'info');
      }

      const preview = createSyncPreview(
        normalizedOffers,
        normalizedBookedCruises,
        state.loyaltyData,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        currentLoyalty,
        syncSource,
        ownershipOptions
      );

      console.log('[RoyalCaribbeanSync] Sync preview created successfully');

      const counts = calculateSyncCounts(preview);
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      const previewCompletedCount = [...preview.bookedCruises.new, ...preview.bookedCruises.updates.map(u => u.updated), ...preview.bookedCruises.unchanged].filter((c: any) => isCompletedRecordLike(c)).length;
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');
      addLog(`Preview: ${previewCompletedCount} completed/past cruise(s) staged`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      const authoritativeOfferRows = normalizedOffers.filter((offer) => {
        const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
        const isIncompleteFallback =
          offer.isInProgress === true ||
          status.includes('in progress') ||
          status.includes('pending') ||
          status.includes('processing') ||
          status.includes('earning') ||
          status.includes('fallback extraction incomplete') ||
          (!offer.offerCode?.trim() && !offer.offerName?.trim()) ||
          (offer.offerName?.trim().toLowerCase() === 'unknown offer' && !offer.offerCode?.trim());
        return !isIncompleteFallback;
      });
      const offerRowsWithSailings = authoritativeOfferRows.filter((offer) => Boolean(offer.shipName?.trim() || offer.sailingDate?.trim()));
      const allowOfferRemoval = selectedSections.offers && authoritativeOfferRows.length > 0;
      const allowCruiseRemoval = selectedSections.availableCruises && offerRowsWithSailings.length > 0;
      const allowBookedCruiseRemoval = (selectedSections.bookedCruises || selectedSections.completedCruises) && normalizedBookedCruises.length > 0;

      if (!allowOfferRemoval) {
        addLog(`⚠️ No authoritative ${config.loyaltyClubName} offer rows were captured, so existing offers and available sailings will be preserved`, 'warning');
      } else if (!allowCruiseRemoval) {
        addLog(`⚠️ ${config.loyaltyClubName} offers were captured without sailing detail, so existing available sailings will be preserved`, 'warning');
      }
      if (!allowBookedCruiseRemoval) {
        addLog(`⚠️ No booked cruise rows were captured for ${config.name}, so existing booked cruises will be preserved`, 'warning');
      }

      addLog('Applying sync...', 'info');
      let { offers: rawOffers, cruises: rawCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        syncSource,
        {
          allowOfferRemoval,
          allowCruiseRemoval,
          allowBookedCruiseRemoval,
          targetOwnerProfileId: targetProfile?.id,
          includeUnownedRecords: isPrimarySyncTarget,
        }
      );

      console.log('[RoyalCaribbeanSync] Running data healing pass...');
      let { cruises: finalCruises, offers: finalOffers, report: healingReport } = healImportedData(rawCruises, rawOffers);
      if (!allowOfferRemoval) {
        finalOffers = coreDataContext.casinoOffers;
        addLog(`🛡️ Preserving ${finalOffers.length} existing offer record(s); ${selectedSections.offers ? 'no authoritative new offer payload was captured' : 'offer sync was not selected'}`, 'warning');
      }
      if (!allowCruiseRemoval) {
        finalCruises = coreDataContext.cruises;
        addLog(`🛡️ Preserving ${finalCruises.length} existing available cruise record(s); ${selectedSections.availableCruises ? 'no authoritative new sailing payload was captured' : 'available cruise sync was not selected'}`, 'warning');
      }
      if (!allowBookedCruiseRemoval) {
        finalBookedCruises = coreDataContext.bookedCruises;
        addLog(`🛡️ Preserving ${finalBookedCruises.length} existing booked/completed cruise record(s); ${(selectedSections.bookedCruises || selectedSections.completedCruises) ? 'no authoritative booking/history payload was captured' : 'booked/completed sync was not selected'}`, 'warning');
      } else if (!selectedSections.completedCruises) {
        const existingCompleted = coreDataContext.bookedCruises.filter((c: any) => isCompletedRecordLike(c));
        finalBookedCruises = finalBookedCruises.filter((c: any) => !isCompletedRecordLike(c)).concat(existingCompleted);
        addLog(`🛡️ Completed cruises not selected; preserved ${existingCompleted.length} existing completed row(s)`, 'warning');
      } else if (!selectedSections.bookedCruises) {
        const existingActive = coreDataContext.bookedCruises.filter((c: any) => !isCompletedRecordLike(c));
        const syncedCompleted = finalBookedCruises.filter((c: any) => isCompletedRecordLike(c));
        finalBookedCruises = existingActive.concat(syncedCompleted);
        addLog(`🛡️ Booked/upcoming cruises not selected; preserved ${existingActive.length} active existing row(s)`, 'warning');
      }
      console.log('[RoyalCaribbeanSync] Data healing:', {
        cruisesHealed: healingReport.cruisesHealed,
        offersHealed: healingReport.offersHealed,
        fieldsFixed: healingReport.fieldsFixed.length,
      });
      if (healingReport.fieldsFixed.length > 0) {
        addLog(`Data healing fixed ${healingReport.fieldsFixed.length} field(s)`, 'info');
      }

      if (syncSource === 'royal' && selectedSections.completedCruises) {
        const repairResult = mergeRoyalCompletedHistoryTruth(finalBookedCruises, targetProfile?.id);
        if (repairResult.added > 0) {
          finalBookedCruises = repairResult.cruises;
          addLog(`🛠️ Royal completed history repaired from ${repairResult.before} to ${repairResult.after} row(s) using Royal Past(57) source-of-truth reconciliation`, 'info');
        }
      }

      const finalActiveBookedCruises = finalBookedCruises.filter(cruise => isActiveBookedCruise(cruise));
      const finalCourtesyHolds = finalBookedCruises.filter(cruise => isCourtesyHoldCruise(cruise));

      console.log('[RoyalCaribbeanSync] Sync applied. Final counts:', {
        offers: finalOffers.length,
        cruises: finalCruises.length,
        bookedCruises: finalBookedCruises.length,
        activeBookedCruises: finalActiveBookedCruises.length,
        courtesyHolds: finalCourtesyHolds.length,
      });

      console.log('[RoyalCaribbeanSync] Step: Persisting offers...');
      addLog(`Setting ${finalOffers.length} total offers in app`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setCasinoOffers()...');
        await coreDataContext.setCasinoOffers(finalOffers);
        console.log('[RoyalCaribbeanSync] setCasinoOffers() completed');
        addLog('✅ Offers persisted to storage', 'success');
      } catch (offerError) {
        const offerErrorMessage = offerError instanceof Error ? offerError.message : String(offerError);
        console.error('[RoyalCaribbeanSync] Error persisting offers:', offerError);
        persistenceFailures.push(`offers (${offerErrorMessage})`);
        addLog(`⚠️ Warning: Failed to persist offers: ${offerErrorMessage}`, 'warning');
      }

      console.log('[RoyalCaribbeanSync] Step: Persisting available cruises...');
      addLog(`Setting ${finalCruises.length} total available cruises in app`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setCruises()...');
        await coreDataContext.setCruises(finalCruises);
        console.log('[RoyalCaribbeanSync] setCruises() completed');
        addLog('✅ Available cruises persisted to storage', 'success');
      } catch (cruiseError) {
        const cruiseErrorMessage = cruiseError instanceof Error ? cruiseError.message : String(cruiseError);
        console.error('[RoyalCaribbeanSync] Error persisting cruises:', cruiseError);
        persistenceFailures.push(`available cruises (${cruiseErrorMessage})`);
        addLog(`⚠️ Warning: Failed to persist cruises: ${cruiseErrorMessage}`, 'warning');
      }

      console.log('[RoyalCaribbeanSync] Step: Persisting booked cruises...');
      const finalCompletedCruises = finalBookedCruises.filter((c: any) => isCompletedRecordLike(c));
      if (syncSource === 'royal' && selectedSections.completedCruises && finalCompletedCruises.length < ROYAL_COMPLETED_HISTORY_TRUTH_COUNT) {
        addLog(`⚠️ Royal completed history final count is ${finalCompletedCruises.length}; expected ${ROYAL_COMPLETED_HISTORY_TRUTH_COUNT}. A repair was attempted, so review duplicate/status keys if this persists.`, 'warning');
      }
      addLog(`Setting ${finalActiveBookedCruises.length} active booked cruise(s) and ${finalCompletedCruises.length} completed cruise(s) in app (${finalBookedCruises.length} total including history)`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setBookedCruises()...');
        await coreDataContext.setBookedCruises(finalBookedCruises);
        console.log('[RoyalCaribbeanSync] setBookedCruises() completed');
        addLog('✅ Booked cruises persisted to storage', 'success');
      } catch (bookedError) {
        const bookedErrorMessage = bookedError instanceof Error ? bookedError.message : String(bookedError);
        console.error('[RoyalCaribbeanSync] Error persisting booked cruises:', bookedError);
        persistenceFailures.push(`booked cruises (${bookedErrorMessage})`);
        addLog(`⚠️ Warning: Failed to persist booked cruises: ${bookedErrorMessage}`, 'warning');
      }

      if (persistenceFailures.length > 0) {
        throw new Error(`Sync could not persist required data: ${persistenceFailures.join('; ')}`);
      }

      if (selectedSections.loyalty && syncSource === 'royal' && isPrimarySyncTarget && preview.loyalty) {
        try {
          if (preview.loyalty.clubRoyalePoints.changed) {
            addLog(`Updating Club Royale points: ${preview.loyalty.clubRoyalePoints.current} → ${preview.loyalty.clubRoyalePoints.synced}`, 'info');
            await loyaltyContext.setManualClubRoyalePoints(preview.loyalty.clubRoyalePoints.synced);
          }
          
          if (preview.loyalty.crownAndAnchorPoints.changed) {
            addLog(`Updating Crown & Anchor points: ${preview.loyalty.crownAndAnchorPoints.current} → ${preview.loyalty.crownAndAnchorPoints.synced}`, 'info');
            await loyaltyContext.setManualCrownAnchorPoints(preview.loyalty.crownAndAnchorPoints.synced);
          }
        } catch (loyaltyError) {
          console.error('[RoyalCaribbeanSync] Error updating loyalty points:', loyaltyError);
          addLog(`⚠️ Warning: Failed to update loyalty points: ${String(loyaltyError)}`, 'warning');
        }
      } else if (!selectedSections.loyalty) {
        addLog('🛡️ Loyalty sync was not selected; preserving existing loyalty/profile values', 'warning');
      } else if (syncSource !== 'carnival' && !isPrimarySyncTarget) {
        addLog('Secondary profile selected — loyalty totals will be saved to that profile only', 'info');
      }
      
      if (selectedSections.loyalty && syncSource !== 'carnival' && isPrimarySyncTarget && effectiveExtendedLoyalty && loyaltyContext.setExtendedLoyaltyData) {
        try {
          addLog('Syncing extended loyalty data...', 'info');
          
          if (syncSource === 'royal' && effectiveExtendedLoyalty.clubRoyalePointsFromApi !== undefined) {
            addLog(`  → Club Royale: ${effectiveExtendedLoyalty.clubRoyaleTierFromApi || 'N/A'} - ${effectiveExtendedLoyalty.clubRoyalePointsFromApi.toLocaleString()} points`, 'info');
          }
          if (syncSource === 'royal' && effectiveExtendedLoyalty.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`  → Crown & Anchor: ${effectiveExtendedLoyalty.crownAndAnchorTier || 'N/A'} - ${effectiveExtendedLoyalty.crownAndAnchorPointsFromApi} points`, 'info');
          }
          if (effectiveExtendedLoyalty.captainsClubPoints !== undefined && effectiveExtendedLoyalty.captainsClubPoints > 0) {
            addLog(`  → Captain's Club: ${effectiveExtendedLoyalty.captainsClubTier || 'N/A'} - ${effectiveExtendedLoyalty.captainsClubPoints} points`, 'info');
          }
          if (effectiveExtendedLoyalty.celebrityBlueChipPoints !== undefined && effectiveExtendedLoyalty.celebrityBlueChipPoints > 0) {
            addLog(`  → Blue Chip Club: ${effectiveExtendedLoyalty.celebrityBlueChipTier || 'N/A'} - ${effectiveExtendedLoyalty.celebrityBlueChipPoints} points`, 'info');
          }
          
          await loyaltyContext.setExtendedLoyaltyData(effectiveExtendedLoyalty);
          addLog('Extended loyalty data synced successfully', 'success');
        } catch (extLoyaltyError) {
          console.error('[RoyalCaribbeanSync] Error syncing extended loyalty:', extLoyaltyError);
          addLog(`⚠️ Warning: Failed to sync extended loyalty data: ${String(extLoyaltyError)}`, 'warning');
        }
      } else if (syncSource !== 'carnival' && !effectiveExtendedLoyalty) {
        addLog('⚠️ No extended loyalty payload available at sync time', 'warning');
      }

      // Sync user profile data: name from passenger data + loyalty numbers/tiers
      if (selectedSections.loyalty && syncSource !== 'carnival' && targetProfile && updateUserProfile) {
        try {
          const profileUpdates: Record<string, unknown> = {};

          // Extract name from first booked cruise's primary passenger (rawBooking first, then top-level)
          const firstExtracted = state.extractedBookedCruises[0] as any;
          const rawBooking = firstExtracted?.rawBooking;
          const primaryPassenger =
            rawBooking?.passengers?.[0] ??
            rawBooking?.passengersInStateroom?.[0] ??
            firstExtracted?.passengers?.[0] ??
            firstExtracted?.passengersInStateroom?.[0];
          if (primaryPassenger?.firstName || primaryPassenger?.lastName) {
            const fullName = [primaryPassenger.firstName, primaryPassenger.lastName]
              .filter((s: string | undefined) => typeof s === 'string' && s.trim().length > 0)
              .join(' ')
              .trim();
            if (fullName.length > 1) {
              profileUpdates.name = fullName;
              profileUpdates.displayName = fullName;
              addLog(`  → Name: ${fullName}`, 'info');
            }
          }

          // Extract Crown & Anchor number from extended loyalty data
          if (syncSource === 'royal') {
            const syncedClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi ?? (state.loyaltyData?.clubRoyalePoints ? parseInt(String(state.loyaltyData.clubRoyalePoints).replace(/,/g, ''), 10) : undefined);
            if (typeof syncedClubRoyalePoints === 'number' && Number.isFinite(syncedClubRoyalePoints)) {
              profileUpdates.clubRoyalePoints = syncedClubRoyalePoints;
              addLog(`  → Club Royale points: ${syncedClubRoyalePoints.toLocaleString()}`, 'info');
            }

            const syncedClubRoyaleTier = effectiveExtendedLoyalty?.clubRoyaleTierFromApi ?? state.loyaltyData?.clubRoyaleTier;
            if (syncedClubRoyaleTier && syncedClubRoyaleTier.trim().length > 0) {
              profileUpdates.clubRoyaleTier = syncedClubRoyaleTier.trim();
              addLog(`  → Club Royale tier: ${syncedClubRoyaleTier.trim()}`, 'info');
            }

            const cAndAId = effectiveExtendedLoyalty?.crownAndAnchorId;
            if (cAndAId && cAndAId.trim().length > 0) {
              profileUpdates.crownAnchorNumber = cAndAId.trim();
              profileUpdates.royalCaribbeanNumber = cAndAId.trim();
              addLog(`  → Crown & Anchor #: ${cAndAId.trim()}`, 'info');
            }

            const syncedCrownAnchorPoints = effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi ?? (state.loyaltyData?.crownAndAnchorPoints ? parseInt(String(state.loyaltyData.crownAndAnchorPoints).replace(/,/g, ''), 10) : undefined);
            if (typeof syncedCrownAnchorPoints === 'number' && Number.isFinite(syncedCrownAnchorPoints)) {
              profileUpdates.loyaltyPoints = syncedCrownAnchorPoints;
              addLog(`  → Crown & Anchor points: ${syncedCrownAnchorPoints.toLocaleString()}`, 'info');
            }

            const cAndALevel = effectiveExtendedLoyalty?.crownAndAnchorTier;
            if (cAndALevel && cAndALevel.trim().length > 0) {
              profileUpdates.crownAnchorLevel = cAndALevel.trim();
              addLog(`  → Crown & Anchor level: ${cAndALevel.trim()}`, 'info');
            }
          }

          // Sync Celebrity loyalty numbers to user profile only during Celebrity sync.
          if (syncSource === 'celebrity' && effectiveExtendedLoyalty) {
            if (typeof effectiveExtendedLoyalty.captainsClubPoints === 'number') {
              profileUpdates.celebrityCaptainsClubPoints = effectiveExtendedLoyalty.captainsClubPoints;
              addLog(`  → Captain's Club points: ${effectiveExtendedLoyalty.captainsClubPoints}`, 'info');
            }
            if (effectiveExtendedLoyalty.captainsClubId) {
              profileUpdates.celebrityCaptainsClubNumber = effectiveExtendedLoyalty.captainsClubId;
            }
            if (typeof effectiveExtendedLoyalty.celebrityBlueChipPoints === 'number') {
              profileUpdates.celebrityBlueChipPoints = effectiveExtendedLoyalty.celebrityBlueChipPoints;
              addLog(`  → Blue Chip points: ${effectiveExtendedLoyalty.celebrityBlueChipPoints}`, 'info');
            }
            if (effectiveExtendedLoyalty.celebrityBlueChipTier) {
              profileUpdates.celebrityBlueChipTier = effectiveExtendedLoyalty.celebrityBlueChipTier;
              addLog(`  → Blue Chip tier: ${effectiveExtendedLoyalty.celebrityBlueChipTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyTier) {
              profileUpdates.silverseaVenetianTier = effectiveExtendedLoyalty.venetianSocietyTier;
              addLog(`  → Venetian Society tier: ${effectiveExtendedLoyalty.venetianSocietyTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyMemberNumber) {
              profileUpdates.silverseaVenetianNumber = effectiveExtendedLoyalty.venetianSocietyMemberNumber;
            }
          }

          if (syncSource === 'royal') {
            profileUpdates.preferredBrand = 'royal';
          } else if (syncSource === 'celebrity') {
            profileUpdates.preferredBrand = 'celebrity';
          }

          if (Object.keys(profileUpdates).length > 0) {
            addLog(`Syncing ${targetSlotLabel.toLowerCase()} profile from loyalty data...`, 'info');
            await updateUserProfile(targetProfile.id, profileUpdates as any);
            addLog(`✅ ${targetSlotLabel} profile updated from sync`, 'success');
          } else {
            addLog('ℹ️ No passenger or loyalty profile fields found to update', 'info');
          }
        } catch (profileSyncError) {
          console.error('[RoyalCaribbeanSync] Error syncing user profile:', profileSyncError);
          addLog(`⚠️ Could not sync user profile data: ${String(profileSyncError)}`, 'warning');
        }
      }

      if (typeof coreDataContext.syncToBackend === 'function') {
        if (!isCloudBackupEnabled()) {
          addLog('Local-first mode: cloud backup skipped after Apply Sync', 'info');
        } else {
          try {
            const selectedDataHash = `${finalOffers.length}:${finalCruises.length}:${finalBookedCruises.length}:${selectedSections.offers}-${selectedSections.availableCruises}-${selectedSections.bookedCruises}-${selectedSections.completedCruises}-${selectedSections.loyalty}`;
            addLog(`Flushing merged cruise data to backend once after Apply Sync (datasetHash ${selectedDataHash})...`, 'info');
            await coreDataContext.syncToBackend();
            addLog('✅ Backend sync completed for merged cruise data', 'success');
          } catch (backendSyncError) {
            console.error('[RoyalCaribbeanSync] Error syncing merged data to backend:', backendSyncError);
            addLog(`⚠️ Warning: Failed to sync merged data to backend: ${String(backendSyncError)}`, 'warning');
          }
        }
      }

      if (cruiseLine === 'carnival' && carnivalUserDataRef.current) {
        try {
          const carnivalData = carnivalUserDataRef.current;
          addLog('Syncing Carnival VIFP loyalty data to user profile...', 'info');
          console.log('[CarnivalSync] Writing Carnival loyalty to user profile:', carnivalData);

          if (currentUser && updateUserProfile) {
            console.log('[CarnivalSync] Using UserProvider.updateUser for userId:', currentUser.id);
            await updateUserProfile(currentUser.id, {
              carnivalVifpNumber: carnivalData.vifpNumber,
              carnivalVifpTier: carnivalData.vifpTier,
              preferredBrand: 'carnival',
            });
            console.log('[CarnivalSync] Carnival loyalty data saved via UserProvider');
          } else {
            console.warn('[CarnivalSync] No currentUser available, falling back to direct AsyncStorage write');
            const scopedUsersKey = getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail);
            const scopedCurrentUserKey = getUserScopedKey(ALL_STORAGE_KEYS.CURRENT_USER, authenticatedEmail);
            const usersRaw = await AsyncStorage.getItem(scopedUsersKey);
            const storedCurrentUserId = await AsyncStorage.getItem(scopedCurrentUserKey);
            if (usersRaw && storedCurrentUserId) {
              const parsedUsers = JSON.parse(usersRaw) as unknown;
              if (Array.isArray(parsedUsers)) {
                const updatedUsers = parsedUsers.map((u: any) =>
                  u?.id === storedCurrentUserId
                    ? {
                        ...u,
                        carnivalVifpNumber: carnivalData.vifpNumber,
                        carnivalVifpTier: carnivalData.vifpTier,
                        preferredBrand: 'carnival',
                        updatedAt: new Date().toISOString(),
                      }
                    : u
                );
                await AsyncStorage.setItem(scopedUsersKey, JSON.stringify(updatedUsers));
                console.log('[CarnivalSync] Carnival loyalty data written to scoped user storage');
              } else {
                console.warn('[CarnivalSync] Scoped users payload is not an array, skipping fallback VIFP write');
                addLog('⚠️ Stored user profile data was invalid, so VIFP data could not be saved automatically', 'warning');
              }
            } else {
              console.warn('[CarnivalSync] No users found in scoped storage, cannot save VIFP data');
              addLog('⚠️ No user profile found to save VIFP data', 'warning');
            }
          }

          addLog(`✅ Carnival VIFP synced: ${carnivalData.vifpTier} tier, VIFP# ${carnivalData.vifpNumber || 'N/A'}`, 'success');
        } catch (carnivalLoyaltyError) {
          console.error('[CarnivalSync] Error syncing Carnival loyalty to profile:', carnivalLoyaltyError);
          addLog(`⚠️ Warning: Failed to sync Carnival loyalty: ${String(carnivalLoyaltyError)}`, 'warning');
        }
      }

      console.log('[RoyalCaribbeanSync] Setting status to complete...');
      addLog('✅ Data synced successfully to app!', 'success');
      
      // Set complete status immediately - don't wait for refresh
      setState(prev => ({ 
        ...prev, 
        status: 'complete',
        lastSyncTimestamp: new Date().toISOString(),
        syncCounts: {
          offerCount: prev.syncCounts?.offerCount ?? 0,
          offerRows: prev.syncCounts?.offerRows ?? 0,
          upcomingCruises: finalActiveBookedCruises.length,
          courtesyHolds: finalCourtesyHolds.length,
          completedCruises: finalCompletedCruises.length
        }
      }));
      
      // NOTE: Do NOT call refreshData() here.
      // The data is already correctly set in state and persisted to AsyncStorage by
      // setCasinoOffers/setCruises/setBookedCruises above.
      // Calling refreshData() triggers loadFromBackend() which fetches STALE data
      // from the server (syncToBackend hasn't completed yet) and overwrites the
      // just-synced correct local data, causing incorrect counts.
      console.log('[RoyalCaribbeanSync] Sync complete - skipping refreshData to avoid stale backend overwrite');
      
      console.log('[RoyalCaribbeanSync] ========================================');
      console.log('[RoyalCaribbeanSync] SYNC TO APP COMPLETED SUCCESSFULLY!');
      console.log('[RoyalCaribbeanSync] ========================================');
    } catch (error) {
      console.error('[RoyalCaribbeanSync] ========================================');
      console.error('[RoyalCaribbeanSync] SYNC ERROR:', error);
      console.error('[RoyalCaribbeanSync] ========================================');
      if (error instanceof Error) {
        console.error('[RoyalCaribbeanSync] Error name:', error.name);
        console.error('[RoyalCaribbeanSync] Error message:', error.message);
        console.error('[RoyalCaribbeanSync] Error stack:', error.stack);
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[RoyalCaribbeanSync] Setting status to error...');
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
      addLog(`❌ Sync failed: ${errorMessage}`, 'error');
      addLog('Please try again or contact support if the issue persists', 'error');
    } finally {
      syncToAppInFlightRef.current = false;
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, extendedLoyaltyData, addLog, cruiseLine, authenticatedEmail, currentUser, users, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows]);

  const cancelSync = useCallback(() => {
    ingestionInFlightRef.current = false;
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog]);

  

  return useMemo(() => ({
    state,
    webViewRef,
    cruiseLine,
    setCruiseLine,
    config,
    openLogin,
    runIngestion,
    exportOffersCSV,
    exportBookedCruisesCSV,
    exportLog,
    resetState,
    syncToApp,
    cancelSync,
    handleWebViewMessage,
    addLog,
    extendedLoyaltyData,
    setExtendedLoyalty,
    staySignedIn,
    toggleStaySignedIn,
    webViewUrl,
    onPageLoaded
  }), [
    state, webViewRef, cruiseLine, setCruiseLine, config, openLogin, runIngestion,
    exportOffersCSV, exportBookedCruisesCSV, exportLog, resetState, syncToApp,
    cancelSync, handleWebViewMessage, addLog, extendedLoyaltyData, setExtendedLoyalty,
    staySignedIn, toggleStaySignedIn, webViewUrl, onPageLoaded
  ]);
});

export function CarnivalSyncProvider({ children }: { children: ReactNode }) {
  return (
    <InitialCruiseLineContext.Provider value="carnival">
      <RoyalCaribbeanSyncProvider>{children}</RoyalCaribbeanSyncProvider>
    </InitialCruiseLineContext.Provider>
  );
}
