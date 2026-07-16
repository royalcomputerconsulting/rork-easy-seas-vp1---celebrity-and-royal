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
import {
  buildDefinedLoyaltyStatePatch,
  convertDomLoyaltyToExtended,
  convertLoyaltyInfoToExtended,
  hasAuthoritativeClubRoyaleData,
  hasAuthoritativeCrownAndAnchorData,
  hasAuthoritativeLoyaltyField,
  mergeExtendedLoyaltyData,
} from '@/lib/royalCaribbean/loyaltyConverter';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectLoyaltyWidgetScrape, injectPageClassifier } from '@/lib/royalCaribbean/step4_loyalty';
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape, injectCarnivalTgoExtract } from '@/lib/carnival/carnivalOffersExtraction';
import {
  CARNIVAL_OFFERS_LANDING_URL,
  CARNIVAL_PROFILE_URL,
  CARNIVAL_CRUISES_URL,
  CARNIVAL_PROFILE_OFFERS_URL,
  buildCarnivalOfferSearchUrl,
  ensureCarnivalCodeSpecificCatalog,
  isCarnivalBookingLinkForCode,
  injectCarnivalAuthenticationProbe,
  injectCarnivalCatalogDiscovery,
  injectCarnivalOfferActionClick,
  injectCarnivalSearchPageScrape,
  injectCarnivalProfileScrape,
  parseCarnivalPersonalizedUrl,
  type CarnivalCatalogDiscovery,
  type CarnivalSearchPageResult,
  type CarnivalProfileScrapeResult,
  type CarnivalProfileSnapshot,
} from '@/lib/carnival/carnivalSafeSync';
import {
  CARNIVAL_SYNC_CHECKPOINT_VERSION,
  buildCarnivalCheckpointIdentity,
  buildCarnivalCheckpointOfferContext,
  isCarnivalCheckpointAccountCompatible,
  isCarnivalCheckpointCompatible,
  isCarnivalCheckpointIdentityUsable,
  isCarnivalCodeSkippable,
  mergeCarnivalBookingRows,
  mergeCarnivalCatalogs,
  type CarnivalCheckpointCodeRecord,
  type CarnivalCheckpointCodeStatus,
  type CarnivalCheckpointOfferContext,
  type CarnivalSyncCheckpoint,
} from '@/lib/carnival/carnivalSyncRuntime';
import {
  buildCarnivalNextPageUrl,
  evaluateCarnivalPaginationStep,
} from '@/lib/carnival/carnivalInventoryRuntime';
import {
  buildCarnivalSyncManifest,
  calculateCarnivalCurrentRunEta,
  carnivalStableHash,
  countUniqueCarnivalSailings,
  decodeCarnivalVifpTier,
  evaluateCarnivalBridgeMessageScope,
  mergeCarnivalProfileSnapshots,
  type CarnivalCodeLedgerEntry,
  type CarnivalSyncManifest,
  type CarnivalSyncTerminalStatus,
} from '@/lib/carnival/carnivalDataRuntime';
import {
  createCarnivalApplyJournal,
  updateCarnivalApplyJournal,
  validateCarnivalApplyJournal,
  type CarnivalApplyJournal,
} from '@/lib/carnival/carnivalApplyTransaction';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import {
  buildUnconfirmedBookingIdentifier,
  getRealBookingIdentifier,
  mergeExtractedBookedCruiseRows,
} from '@/lib/royalCaribbean/bookedExtractionIdentity';
import { parseCasinoOffersPayload } from '@/lib/royalCaribbean/offerPayloadParser';
import { healImportedData } from '@/lib/dataHealing';
import { isActiveBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';
import { isCloudBackupEnabled } from '@/lib/trpc';

export type CruiseLine = 'royal_caribbean' | 'celebrity' | 'carnival';

type CarnivalActiveRun = {
  runId: string;
  ownerId: string;
  controller: AbortController;
  startedAt: number;
  settled: boolean;
};

type CarnivalAuthProbeResult = {
  authenticated: boolean;
  source: string;
  reason: string;
  httpStatus: number;
  url: string;
};

let activeCarnivalRun: CarnivalActiveRun | null = null;

class CarnivalSyncCancelledError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CarnivalSyncCancelledError';
  }
}

const createCarnivalRunId = (): string => `carnival-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const CARNIVAL_CHECKPOINT_STORAGE_KEY = 'carnival_sync_checkpoint_v2';
const CARNIVAL_LEGACY_CHECKPOINT_STORAGE_KEY = 'carnival_sync_checkpoint_v1';
const CARNIVAL_APPLY_JOURNAL_STORAGE_KEY = 'carnival_apply_recovery_v1';

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
    offersUrl: CARNIVAL_OFFERS_LANDING_URL,
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
  scrapePricingAndItinerary: false,
  carnivalManifest: null,
  carnivalCodeLedger: []
};

const INITIAL_EXTENDED_LOYALTY: ExtendedLoyaltyData | null = null;

type SyncTargetSlot = 'primary' | 'secondary';

interface SyncSectionSelections {
  [key: string]: boolean;
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


function buildCarnivalProfileUpdates(
  carnivalData: CarnivalProfileSnapshot | null,
  targetProfile: UserProfile | null | undefined,
): Record<string, unknown> {
  if (!carnivalData) return {};
  const updates: Record<string, unknown> = {};
  const trusted = new Set(Array.isArray(carnivalData.authoritativeFields) ? carnivalData.authoritativeFields : []);
  const fullName = `${carnivalData.firstName || ''} ${carnivalData.lastName || ''}`.trim();
  if (fullName && targetProfile && (!targetProfile.name || /^user|traveler|second user$/i.test(targetProfile.name)) && trusted.size > 0) {
    updates.name = fullName;
    updates.displayName = fullName;
  }
  if (trusted.has('vifpNumber') && carnivalData.vifpNumber) updates.carnivalVifpNumber = carnivalData.vifpNumber;
  if (trusted.has('vifpTier') && carnivalData.vifpTierSource === 'authoritative' && carnivalData.vifpTier) updates.carnivalVifpTier = carnivalData.vifpTier;
  if (trusted.has('vifpPoints')) updates.carnivalVifpPoints = Number(carnivalData.vifpPoints || 0);
  if (trusted.has('cruiseDayPoints')) updates.carnivalCruiseDayPoints = Number(carnivalData.cruiseDayPoints || 0);
  if (trusted.has('totalCruises')) updates.carnivalTotalCruises = Number(carnivalData.totalCruises || 0);
  if (trusted.has('playersClubTier') && carnivalData.playersClubTier) updates.carnivalPlayersClubTier = carnivalData.playersClubTier;
  if (trusted.has('playersClubPoints')) updates.carnivalPlayersClubPoints = Number(carnivalData.playersClubPoints || 0);
  if (Object.keys(updates).length > 0) updates.preferredBrand = 'carnival';
  return updates;
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


function deriveCruiseNightsFromDates(startValue: unknown, endValue: unknown): number | undefined {
  const start = normalizeSyncDate(startValue);
  const end = normalizeSyncDate(endValue);
  if (!start || !end) return undefined;
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const endMs = Date.parse(`${end}T12:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return undefined;
  const nights = Math.round((endMs - startMs) / 86400000);
  return nights > 0 && nights < 366 ? nights : undefined;
}


function isCompletedRecordLike(record: any): boolean {
  const status = `${record?.status || ''} ${record?.bookingStatus || ''} ${record?.completionState || ''} ${record?.sourcePage || ''}`.toLowerCase();
  return status.includes('completed') || status.includes('past') || status.includes('history');
}

function isActiveRecordLike(record: any): boolean {
  return !isCompletedRecordLike(record);
}

function mergeSharedBookedInventoryRows<T extends any>(rows: T[]): T[] {
  return mergeExtractedBookedCruiseRows(rows).rows;
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
      clubRoyaleId: data.clubRoyaleId,
      clubRoyaleEvaluationPeriodStartDate: data.clubRoyaleEvaluationPeriodStartDate,
      clubRoyaleEvaluationPeriodEndDate: data.clubRoyaleEvaluationPeriodEndDate,
      loyaltyFieldAuthority: data.loyaltyFieldAuthority,
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
  return sailings.map((sailing) => {
    const sailDate = normalizeSyncDate(firstString(
      sailing?.sailDate, sailing?.sailingStartDate, sailing?.startDate, sailing?.departureDate, sailing?.date,
      sailing?.voyage?.sailDate, sailing?.cruise?.sailDate
    ));
    const returnDate = normalizeSyncDate(firstString(
      sailing?.returnDate, sailing?.sailingEndDate, sailing?.endDate, sailing?.arrivalDate,
      sailing?.voyage?.returnDate, sailing?.cruise?.returnDate
    ));
    const nights = firstString(sailing?.numberOfNights, sailing?.nights, sailing?.duration, sailing?.voyage?.nights);
    const parsedNights = nights ? Number.parseInt(nights, 10) : 0;
    const resolvedNights = parsedNights > 0 ? parsedNights : deriveCruiseNightsFromDates(sailDate, returnDate);
    const shipName = normalizeShipNameFromSailing(sailing) || firstString(sailing?.shipCode) || 'Unknown Ship';
    const bookingId = firstString(sailing?.bookingId, sailing?.bookingNumber, sailing?.reservationId, sailing?.reservationNumber, sailing?.confirmationNumber);
    const completedRow: BookedCruiseRow = {
      rawBooking: sailing,
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
      cabinNumberOrGTY: firstString(sailing?.cabinNumber, sailing?.stateroomNumber, sailing?.roomNumber) || 'GTY',
      bookingId,
      numberOfGuests: firstString(sailing?.numberOfGuests, Array.isArray(sailing?.passengers) ? sailing.passengers.length : undefined, sailing?.guests) || '1',
      numberOfNights: resolvedNights,
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
      passengers: Array.isArray(sailing?.passengers) ? sailing.passengers : undefined,
      passengersInStateroom: Array.isArray(sailing?.passengersInStateroom) ? sailing.passengersInStateroom : undefined,
    } as BookedCruiseRow;
    completedRow.bookingId = bookingId || buildUnconfirmedBookingIdentifier(completedRow);
    return completedRow;
  });
}

const InitialCruiseLineContext = createContext<CruiseLine>('royal_caribbean');

export const [RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync] = createContextHook(() => {
  console.log('[RoyalCaribbeanSync] Provider initializing...');
  console.log('[RoyalCaribbeanSync] v12.4.2-build313-carnival-integrity-stage1 active');
  console.log('[RoyalCaribbeanSync] v12.4.2-build314-carnival-priority1-3 active');
  const initialCruiseLine = useContext(InitialCruiseLineContext);
  const { authenticatedEmail } = useAuth();
  const staySignedInKey = useCallback(() => getUserScopedKey('stay_signed_in', authenticatedEmail), [authenticatedEmail]);
  const [state, setState] = useState<RoyalCaribbeanSyncState>(INITIAL_STATE);
  const [cruiseLine, setCruiseLine] = useState<CruiseLine>(initialCruiseLine);
  const [extendedLoyaltyData, setExtendedLoyaltyData] = useState<ExtendedLoyaltyData | null>(INITIAL_EXTENDED_LOYALTY);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const { currentUser, users, updateUser: updateUserProfile } = useUser();
  const carnivalUserDataRef = useRef<CarnivalProfileSnapshot | null>(null);
  const carnivalLaneAuthorityRef = useRef<{ active: boolean; completed: boolean; profileTotalCruises: number }>({ active: false, completed: false, profileTotalCruises: 0 });
  const extractedOffersRef = useRef<OfferRow[]>([]);
  const step1CatalogMetaRef = useRef<{ offerCount?: number; offerCodes?: string[]; totalCount?: number; completed?: boolean; incompleteCodes?: string[]; authoritativeEmptyCodes?: string[]; successfulCodes?: string[]; failedCodes?: string[]; rowBearingCodes?: string[]; codeLedger?: CarnivalCodeLedgerEntry[]; accountFingerprint?: string; catalogHash?: string; runId?: string }>({});
  const extractedBookedCruisesRef = useRef<BookedCruiseRow[]>([]);
  const webViewRef = useRef<WebView | null>(null);
  const extendedLoyaltyDataRef = useRef<ExtendedLoyaltyData | null>(INITIAL_EXTENDED_LOYALTY);
  const loyaltyLaneAuthorityRef = useRef({ clubRoyale: false, crownAndAnchor: false });
  const lastAuthenticatedEmailRef = useRef<string | null>(authenticatedEmail);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  const capturedSections = useRef({ offers: false, bookings: false, loyalty: false });
  const pageLoadResolver = useRef<((loadedUrl?: string) => void) | null>(null);
  const offerSailingsResolver = useRef<((sailings: OfferRow[]) => void) | null>(null);
  const carnivalPageCheckResolver = useRef<((onOffers: boolean) => void) | null>(null);
  const carnivalTgoDataResolver = useRef<((data: { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> }) => void) | null>(null);
  const carnivalCatalogResolverRef = useRef<{ runId: string; resolve: (data: CarnivalCatalogDiscovery) => void } | null>(null);
  const carnivalSearchResolverRef = useRef<{ requestId: string; rows: OfferRow[]; resolve: (data: CarnivalSearchPageResult) => void } | null>(null);
  const carnivalProfileResolverRef = useRef<{ requestId: string; rows: BookedCruiseRow[]; resolve: (data: CarnivalProfileScrapeResult) => void } | null>(null);
  const carnivalAuthProbeResolverRef = useRef<{ requestId: string; runId: string; resolve: (result: CarnivalAuthProbeResult) => void } | null>(null);
  const carnivalAuthVerifiedAtRef = useRef<number>(0);
  const carnivalManifestRef = useRef<CarnivalSyncManifest | null>(null);
  const navigationRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  const pendingNavigationLabelRef = useRef<string>('');
  const lastRequestedNavigationUrlRef = useRef<string>('');
  const lastLoadedNavigationUrlRef = useRef<string>('');
  const syncToAppInFlightRef = useRef<boolean>(false);
  const ingestionInFlightRef = useRef<boolean>(false);
  const logFlushScheduledRef = useRef<boolean>(false);
  const providerMountedRef = useRef<boolean>(true);
  const providerInstanceIdRef = useRef<string>(`provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const activeCarnivalRunIdRef = useRef<string | null>(null);
  const carnivalAbortControllerRef = useRef<AbortController | null>(null);
  const carnivalCancelReasonRef = useRef<string>('');
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];
  const [webViewUrl, setWebViewUrl] = useState<string>(CRUISE_LINE_CONFIG[initialCruiseLine].loginUrl);

  useEffect(() => {
    extractedBookedCruisesRef.current = state.extractedBookedCruises;
  }, [state.extractedBookedCruises]);

  useEffect(() => {
    // Brand switch must not leak Royal loyalty into Celebrity Blue Chip sync or vice versa.
    setExtendedLoyaltyData(null);
    extendedLoyaltyDataRef.current = null;
    loyaltyLaneAuthorityRef.current = { clubRoyale: false, crownAndAnchor: false };
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
        catalogVisibleOfferCodes: stringifyValue((row as any).catalogVisibleOfferCodes) || undefined,
        catalogVisibleOfferCount: Number.isFinite(Number((row as any).catalogVisibleOfferCount)) ? Number((row as any).catalogVisibleOfferCount) : undefined,
        catalogZeroRowOfferCodes: stringifyValue((row as any).catalogZeroRowOfferCodes) || undefined,
        catalogRowBearingOfferCodes: stringifyValue((row as any).catalogRowBearingOfferCodes) || undefined,
        catalogIncompleteOfferCodes: stringifyValue((row as any).catalogIncompleteOfferCodes) || undefined,
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

    value.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const row = item as Partial<BookedCruiseRow> & Record<string, unknown>;
      const rawBooking = row.rawBooking && typeof row.rawBooking === 'object' ? row.rawBooking : item;
      const suppliedBookingId = stringifyValue(row.bookingId);
      const normalizedStartDate = normalizeSyncDate(firstString(row.sailingStartDate, (row as any).sailDate, (row as any).departureDate, (row as any).startDate));
      const normalizedEndDate = normalizeSyncDate(firstString(row.sailingEndDate, (row as any).returnDate, (row as any).endDate));
      const explicitNights = typeof row.numberOfNights === 'number'
        ? row.numberOfNights
        : Number.parseInt(stringifyValue(row.numberOfNights), 10);
      const resolvedNights = Number.isFinite(explicitNights) && explicitNights > 0
        ? explicitNights
        : deriveCruiseNightsFromDates(normalizedStartDate, normalizedEndDate);
      const normalizedRow: BookedCruiseRow = {
        rawBooking,
        sourcePage: stringifyValue(row.sourcePage) || 'Upcoming',
        shipName: stringifyValue(row.shipName) || 'Unknown Ship',
        shipCode: stringifyValue(row.shipCode) || undefined,
        cruiseTitle: stringifyValue(row.cruiseTitle) || undefined,
        sailingStartDate: normalizedStartDate,
        sailingEndDate: normalizedEndDate,
        sailingDates: normalizeSyncDate(firstString(row.sailingDates, row.sailingStartDate, (row as any).sailDate)),
        itinerary: stringifyValue(row.itinerary),
        departurePort: stringifyValue(row.departurePort),
        arrivalPort: stringifyValue(row.arrivalPort) || undefined,
        cabinType: stringifyValue(row.cabinType),
        cabinCategory: stringifyValue(row.cabinCategory) || undefined,
        cabinNumberOrGTY: stringifyValue(row.cabinNumberOrGTY) || 'GTY',
        deckNumber: stringifyValue(row.deckNumber) || undefined,
        bookingId: suppliedBookingId,
        numberOfGuests: stringifyValue(row.numberOfGuests) || undefined,
        numberOfNights: resolvedNights,
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
        passengers: Array.isArray(row.passengers) ? row.passengers : undefined,
        passengersInStateroom: Array.isArray(row.passengersInStateroom) ? row.passengersInStateroom : undefined,
      };

      normalizedRow.bookingId = getRealBookingIdentifier(normalizedRow)
        ? suppliedBookingId || getRealBookingIdentifier(normalizedRow)
        : buildUnconfirmedBookingIdentifier(normalizedRow);
      normalizedRows.push(normalizedRow);
    });

    return mergeExtractedBookedCruiseRows(normalizedRows).rows;
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
      carnivalCancelReasonRef.current = 'Sync screen closed before completion';
      carnivalAbortControllerRef.current?.abort();
      navigationRequestIdRef.current += 1;
      pageLoadResolver.current = null;
      carnivalCatalogResolverRef.current = null;
      carnivalSearchResolverRef.current = null;
      carnivalProfileResolverRef.current = null;
      carnivalAuthProbeResolverRef.current = null;
      // The global coordinator stays owned until the async run reaches its
      // finally block. Unmount aborts the owner but must not free the lock
      // while stale WebView callbacks or persistence work are still unwinding.
      activeCarnivalRunIdRef.current = null;
      ingestionInFlightRef.current = false;
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
    step1CatalogMetaRef.current = {};
    extendedLoyaltyDataRef.current = null;
    loyaltyLaneAuthorityRef.current = { clubRoyale: false, crownAndAnchor: false };
    carnivalUserDataRef.current = null;
    carnivalLaneAuthorityRef.current = { active: false, completed: false, profileTotalCruises: 0 };
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
    if (cruiseLine === 'carnival' && activeCarnivalRun && activeCarnivalRun.ownerId !== providerInstanceIdRef.current) {
      console.log('[CarnivalSync] Ignored non-owner log update:', message);
      return;
    }
    const runPrefix = cruiseLine === 'carnival' && activeCarnivalRunIdRef.current ? `[${activeCarnivalRunIdRef.current.slice(-8)}] ` : '';
    rcLogger.log(`${runPrefix}${message}`, type);
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
  }, [flushDisplayLogs, cruiseLine]);


  const mergeCapturedLoyalty = useCallback((incoming: ExtendedLoyaltyData | null, sourceLabel: string): ExtendedLoyaltyData | null => {
    if (!incoming) return extendedLoyaltyDataRef.current;
    const existing = extendedLoyaltyDataRef.current;
    if (existing?.accountId && incoming.accountId && existing.accountId !== incoming.accountId) {
      addLog(`⚠️ Rejected cross-profile loyalty payload from ${sourceLabel}`, 'warning');
      return existing;
    }
    const merged = mergeExtendedLoyaltyData(existing, incoming);
    extendedLoyaltyDataRef.current = merged;
    setExtendedLoyaltyData(merged);
    if (merged) {
      const patch = buildDefinedLoyaltyStatePatch(merged);
      if (Object.keys(patch).length > 0) {
        setState((prev) => ({ ...prev, loyaltyData: { ...(prev.loyaltyData ?? {}), ...patch } }));
      }
      loyaltyLaneAuthorityRef.current = {
        clubRoyale: hasAuthoritativeClubRoyaleData(merged),
        crownAndAnchor: hasAuthoritativeCrownAndAnchorData(merged),
      };
      const authority = merged.loyaltyFieldAuthority || {};
      const capturedFields = Object.entries(authority)
        .filter(([, value]) => value && value.source !== 'stored')
        .map(([field, value]) => `${field}:${value?.source}/${value?.confidence}`);
      if (capturedFields.length > 0) addLog(`Loyalty field authority (${sourceLabel}): ${capturedFields.join(', ')}`, 'info');
    }
    return merged;
  }, [addLog]);

  const onPageLoadStarted = useCallback((eventOrUrl?: unknown) => {
    const startedUrl = typeof eventOrUrl === 'string'
      ? eventOrUrl
      : typeof eventOrUrl === 'object' && eventOrUrl !== null && 'nativeEvent' in eventOrUrl
        ? String((eventOrUrl as { nativeEvent?: { url?: string } }).nativeEvent?.url || '')
        : '';
    const sequenceId = navigationRequestIdRef.current;
    const label = pendingNavigationLabelRef.current || pendingNavigationTargetRef.current || startedUrl || '(unknown URL)';
    console.log('[RoyalCaribbeanSync] Page load started:', { startedUrl, sequenceId, label });
    if (cruiseLine === 'carnival' && pendingNavigationTargetRef.current) {
      addLog(`🌐 Carnival load start [nav ${sequenceId}]: ${label}`, 'info');
    }
  }, [addLog, cruiseLine]);

  const onPageLoaded = useCallback((eventOrUrl?: unknown) => {
    const loadedUrl = typeof eventOrUrl === 'string'
      ? eventOrUrl
      : typeof eventOrUrl === 'object' && eventOrUrl !== null && 'nativeEvent' in eventOrUrl
        ? String((eventOrUrl as { nativeEvent?: { url?: string } }).nativeEvent?.url || '')
        : '';

    lastLoadedNavigationUrlRef.current = loadedUrl;
    const sequenceId = navigationRequestIdRef.current;
    console.log('[RoyalCaribbeanSync] Page finished loading:', { loadedUrl: loadedUrl || '(unknown URL)', sequenceId });
    if (cruiseLine === 'carnival' && pendingNavigationTargetRef.current) {
      addLog(`✅ Carnival load end [nav ${sequenceId}]: ${pendingNavigationLabelRef.current || loadedUrl || '(unknown URL)'}`, 'success');
    }

    if (cruiseLine === 'carnival' && activeCarnivalRun?.ownerId === providerInstanceIdRef.current && activeCarnivalRunIdRef.current && /(login|signin|identity|security|challenge|authenticate)/i.test(loadedUrl)) {
      carnivalCancelReasonRef.current = 'Carnival authentication was lost during sync';
      activeCarnivalRun.controller.abort();
      setState((prev) => ({ ...prev, status: 'login_expired', currentStep: '', progress: null, error: carnivalCancelReasonRef.current }));
      addLog('Carnival redirected to a login/security page. The run was checkpointed as auth_lost.', 'warning');
    }

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
    if (String(msgType || '').startsWith('carnival_') && activeCarnivalRun && activeCarnivalRun.ownerId !== providerInstanceIdRef.current) {
      console.log('[CarnivalSync] Ignored WebView message for a non-owning provider:', msgType);
      return;
    }
    switch (msgType) {
      case 'auth_status':
        if (cruiseLine === 'carnival') {
          const authSource = String(msg.source || '');
          if (Boolean(msg.loggedIn) && authSource === 'carnival_protected_profile_api') {
            carnivalAuthVerifiedAtRef.current = Date.now();
          } else if (!Boolean(msg.loggedIn) && authSource === 'carnival_protected_profile_api') {
            carnivalAuthVerifiedAtRef.current = 0;
          } else if (!Boolean(msg.loggedIn) && carnivalAuthVerifiedAtRef.current > 0 && Date.now() - carnivalAuthVerifiedAtRef.current < 300000) {
            console.log('[CarnivalSync] Ignoring weaker DOM auth false-negative after protected profile API verification');
            break;
          }
        }
        setState(prev => {
          const status = prev.status;
          const isActiveSync = status.startsWith('running_') || status === 'syncing' || status === 'awaiting_confirmation' || status === 'cancelled';
          if (isActiveSync) {
            console.log('[RoyalCaribbeanSync] Ignoring auth_status during active sync:', status);
            return prev;
          }
          addLog(msg.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
          return { ...prev, status: msg.loggedIn ? 'logged_in' : 'not_logged_in' };
        });
        break;

      case 'carnival_auth_probe': {
        const resolver = carnivalAuthProbeResolverRef.current;
        if (!resolver) break;
        const scope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, messageRequestId: msg.requestId, activeRunId: resolver.runId, activeRequestId: resolver.requestId });
        if (!scope.current) {
          carnivalAuthProbeResolverRef.current = null;
          resolver.resolve({ authenticated: false, source: 'stale_probe', reason: scope.reason || 'stale_auth_probe', httpStatus: 0, url: String(msg.url || '') });
          addLog('Rejected a stale Carnival authentication probe immediately instead of waiting for timeout.', 'warning');
          break;
        }
        carnivalAuthProbeResolverRef.current = null;
        const result: CarnivalAuthProbeResult = {
          authenticated: Boolean(msg.authenticated),
          source: String(msg.source || 'unknown'),
          reason: String(msg.reason || ''),
          httpStatus: Number(msg.httpStatus || 0),
          url: String(msg.url || ''),
        };
        if (result.authenticated) carnivalAuthVerifiedAtRef.current = Date.now();
        else if (['explicit_login_page', 'protected_profile_api_rejected'].includes(result.source)) carnivalAuthVerifiedAtRef.current = 0;
        resolver.resolve(result);
        break;
      }

      case 'carnival_navigation_auth_probe': {
        if (String(msg.runId || '') !== String(activeCarnivalRunIdRef.current || '')) break;
        if (Boolean(msg.authLost) && activeCarnivalRun?.ownerId === providerInstanceIdRef.current) {
          carnivalCancelReasonRef.current = 'Carnival authentication was lost during navigation';
          activeCarnivalRun.controller.abort();
          setState((prev) => ({ ...prev, status: 'login_expired', currentStep: '', progress: null, error: carnivalCancelReasonRef.current }));
          addLog('Carnival session expiry was detected by the per-navigation profile probe. The run remains resumable.', 'warning');
        }
        break;
      }

      case 'log':
        if (msg.runId && String(msg.runId) !== String(activeCarnivalRunIdRef.current || '')) {
          console.log('[RoyalCaribbeanSync] Ignored stale run-scoped WebView log:', msg.runId, msg.message);
          break;
        }
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
            const reconciliation = mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...incoming]);
            const newlyAdded = reconciliation.rows.length - prev.extractedBookedCruises.length;
            console.log(`[RoyalCaribbeanSync] cruise_batch reconciliation: ${incoming.length} input, ${newlyAdded} new, ${reconciliation.mergedCount} exact/identity merge(s), ${reconciliation.rows.length} total`);
            const newCruises = reconciliation.rows;
            extractedBookedCruisesRef.current = newCruises;
            
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
        if (stepMsg.step === 1) {
          const offerCodes: string[] = Array.isArray(stepMsg.offerCodes)
            ? Array.from(new Set<string>(stepMsg.offerCodes
                .map((code: unknown): string => String(code || '').trim().toUpperCase())
                .filter((code: string): code is string => code.length > 0)))
            : [];
          step1CatalogMetaRef.current = {
            offerCount: Number.isFinite(Number(stepMsg.offerCount)) ? Number(stepMsg.offerCount) : offerCodes.length,
            offerCodes,
            totalCount: Number(itemCount) || 0,
            completed: true,
          };
          if (offerCodes.length || Number(stepMsg.offerCount) === 0) {
            addLog(`Step 1 dynamic catalog metadata: ${Number(stepMsg.offerCount) || offerCodes.length} visible offer(s), ${itemCount} sailing row(s)`, 'info');
          }
        }
        if (stepMsg.step === 3 && cruiseLine === 'royal_caribbean') {
          const completionReason = String(stepMsg.reason || stepMsg.status || '').trim().toLowerCase();
          const timedOutWithoutCrownAndAnchor = completionReason === 'timeout' || completionReason === 'preserve_existing';
          const crownAndAnchorAuthoritative = hasAuthoritativeCrownAndAnchorData(extendedLoyaltyDataRef.current);
          if (!crownAndAnchorAuthoritative && !timedOutWithoutCrownAndAnchor) {
            addLog('ℹ️ Ignored a premature loyalty step-complete signal because only Club Royale or partial loyalty data was captured; continuing the dedicated Crown & Anchor lane', 'info');
            break;
          }
          if (!crownAndAnchorAuthoritative && timedOutWithoutCrownAndAnchor) {
            addLog('⚠️ Crown & Anchor tier/points were not captured from an authoritative source; existing C&A values will be preserved', 'warning');
          }
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
            const reconciliation = mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...formattedCruises]);
            const newlyAdded = reconciliation.rows.length - prev.extractedBookedCruises.length;
            console.log(`[RoyalCaribbeanSync] all_bookings_data reconciliation: ${formattedCruises.length} input, ${newlyAdded} new, ${reconciliation.mergedCount} exact/identity merge(s), ${reconciliation.rows.length} total`);
            extractedBookedCruisesRef.current = reconciliation.rows;
            return {
              ...prev,
              extractedBookedCruises: reconciliation.rows
            };
          });
          
          capturedSections.current.bookings = true;
          addLog(`✅ Captured ${msg.bookings.length} booking(s) from consolidated API call`, 'success');
          formattedCruises.forEach((c: any) => {
            addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} (${c.numberOfNights} nights) [${c.status}]`, 'success');
          });
        }
        break;

      case 'loyalty_data': {
        const apiPayload = msg.loyalty && typeof msg.loyalty === 'object' ? msg.loyalty as Record<string, unknown> : null;
        const domPayload = !apiPayload && msg.data && typeof msg.data === 'object' ? msg.data as Record<string, unknown> : null;
        const converted = apiPayload
          ? filterExtendedLoyaltyForCruiseLine(convertLoyaltyInfoToExtended(apiPayload, String(msg.accountId || ''), { sourceType: 'api', sourceUrl: String(msg.url || '') }), cruiseLine)
          : domPayload
            ? filterExtendedLoyaltyForCruiseLine(convertDomLoyaltyToExtended(domPayload, String(msg.accountId || '')), cruiseLine)
            : null;
        if (!hasMeaningfulExtendedLoyaltyData(converted, cruiseLine)) {
          addLog('⚠️ Loyalty message contained no usable fields; preserving captured values and keeping incomplete lanes open', 'warning');
          break;
        }
        const merged = mergeCapturedLoyalty(converted, apiPayload ? 'API message' : 'DOM fallback');
        capturedSections.current.loyalty = Boolean(merged);
        addLog(`✅ Merged ${apiPayload ? 'API' : 'DOM fallback'} loyalty fields without suppressing missing-field fallbacks`, 'success');
        if (cruiseLine !== 'celebrity') {
          if (merged?.clubRoyaleTierFromApi !== undefined) addLog(`   🎰 Club Royale tier: ${merged.clubRoyaleTierFromApi}`, 'success');
          if (merged?.clubRoyalePointsFromApi !== undefined) addLog(`   💎 Club Royale points: ${merged.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
          if (merged?.crownAndAnchorTier !== undefined || merged?.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`   ⚓ Crown & Anchor: ${merged.crownAndAnchorTier || 'tier not captured'} / ${merged.crownAndAnchorPointsFromApi?.toLocaleString() || 'points not captured'}`, 'success');
          }
        }
        break;
      }

      case 'extended_loyalty_data': {
        const extData = msg.data as Record<string, unknown>;
        const converted = filterExtendedLoyaltyForCruiseLine(
          convertLoyaltyInfoToExtended(extData, String(msg.accountId || ''), { sourceType: 'api', sourceUrl: String(msg.url || '') }),
          cruiseLine,
        );
        if (!hasMeaningfulExtendedLoyaltyData(converted, cruiseLine)) {
          addLog('⚠️ Extended loyalty payload contained no usable fields; preserving prior values', 'warning');
          break;
        }
        const merged = mergeCapturedLoyalty(converted, 'extended API payload');
        capturedSections.current.loyalty = Boolean(merged);
        addLog('✅ Merged extended loyalty payload field by field', 'success');
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
              const reconciliation = mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...formattedCruises]);
              const newlyAdded = reconciliation.rows.length - prev.extractedBookedCruises.length;
              if (reconciliation.mergedCount > 0) {
                addLog(`ℹ️ Reconciled ${reconciliation.mergedCount} repeated booking payload(s) by reservation/cabin/guest identity`, 'info');
              }
              console.log(`[RoyalCaribbeanSync] network_payload reconciliation: ${formattedCruises.length} input, ${newlyAdded} new, ${reconciliation.mergedCount} merge(s), ${reconciliation.rows.length} total`);
              extractedBookedCruisesRef.current = reconciliation.rows;
              return {
                ...prev,
                extractedBookedCruises: reconciliation.rows
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
              const reconciliation = mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...completedFromHistory]);
              const mergedCompletedRows = reconciliation.rows;
              const newlyAdded = mergedCompletedRows.length - prev.extractedBookedCruises.length;
              extractedBookedCruisesRef.current = mergedCompletedRows;
              const completedRowsInSession = mergedCompletedRows.filter((candidate: any) => isCompletedRecordLike(candidate)).length;
              addLog(`✅ Parsed ${completedFromHistory.length} completed cruise sailing(s) from loyalty/history payload; added ${newlyAdded}, reconciled ${reconciliation.mergedCount} repeat(s)`, 'success');
              return {
                ...prev,
                extractedBookedCruises: mergedCompletedRows,
                syncCounts: prev.syncCounts ? {
                  ...prev.syncCounts,
                  completedCruises: Math.max(prev.syncCounts.completedCruises ?? 0, completedRowsInSession),
                } : {
                  offerCount: 0,
                  offerRows: 0,
                  upcomingCruises: 0,
                  courtesyHolds: 0,
                  completedCruises: completedRowsInSession,
                },
              };
            });
          }
          
          const convertedLoyalty = filterExtendedLoyaltyForCruiseLine(convertLoyaltyInfoToExtended(loyaltyInfo, accountId, { sourceType: 'api', sourceUrl: String(url || ''), accountId }), cruiseLine);
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
          const mergedLoyalty = mergeCapturedLoyalty(convertedLoyalty, String(url || 'network capture'));
          capturedSections.current.loyalty = Boolean(mergedLoyalty);
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
          
          // Crown & Anchor and Club Royale are independent authority lanes. A casino-only
          // payload must not end the dedicated Crown & Anchor step.
          setState(prev => {
            const canCompleteLoyaltyStep = cruiseLine === 'royal_caribbean'
              ? hasAuthoritativeCrownAndAnchorData(extendedLoyaltyDataRef.current)
              : hasMeaningfulExtendedLoyaltyData(extendedLoyaltyDataRef.current, cruiseLine);
            if (prev.status === 'running_step_3' && canCompleteLoyaltyStep) {
              addLog(`✅ Step 3 auto-completing with authoritative ${cruiseLine === 'royal_caribbean' ? 'Crown & Anchor' : 'loyalty'} data`, 'success');
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

      case 'carnival_catalog_discovered': {
        const catalogResolver = carnivalCatalogResolverRef.current;
        if (!catalogResolver) break;
        const catalogScope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, activeRunId: catalogResolver.runId });
        if (!catalogScope.current) {
          carnivalCatalogResolverRef.current = null;
          catalogResolver.resolve({ sourceUrl: '', personalizedSearchUrl: '', tgo: '', vifp: '', tierCode: '', tierName: '', resident: '', locality: '1', currency: 'USD', rateCodes: [], actionCards: [], noOffersConfirmed: false });
          addLog('Rejected a stale Carnival catalog response immediately instead of waiting for timeout.', 'warning');
          break;
        }
        const discovered = (msg.data || {}) as CarnivalCatalogDiscovery;
        const normalizedCatalog: CarnivalCatalogDiscovery = {
          sourceUrl: String(discovered.sourceUrl || ''),
          personalizedSearchUrl: String(discovered.personalizedSearchUrl || ''),
          tgo: String(discovered.tgo || ''),
          vifp: String(discovered.vifp || ''),
          tierCode: String(discovered.tierCode || ''),
          tierName: String(discovered.tierName || ''),
          resident: String(discovered.resident || ''),
          locality: String(discovered.locality || '1'),
          currency: String(discovered.currency || 'USD'),
          rateCodes: Array.isArray(discovered.rateCodes)
            ? discovered.rateCodes
                .map((entry: any) => ({
                  code: String(entry?.code || '').trim().toUpperCase(),
                  startDate: String(entry?.startDate || ''),
                  endDate: String(entry?.endDate || ''),
                  offerName: String(entry?.offerName || ''),
                  perks: String(entry?.perks || ''),
                  bookingLink: String(entry?.bookingLink || ''),
                  bookingLinkVerified: Boolean(entry?.bookingLinkVerified),
                  bookingLinkSource: entry?.bookingLinkSource ? String(entry.bookingLinkSource) as any : undefined,
                }))
                .filter((entry: any) => /^[A-Z0-9]{2,10}$/.test(entry.code))
            : [],
          actionCards: Array.isArray(discovered.actionCards)
            ? discovered.actionCards
                .map((action: any, index: number) => ({
                  index: Number.isFinite(Number(action?.index)) ? Number(action.index) : index,
                  title: String(action?.title || ''),
                  perks: String(action?.perks || ''),
                  href: String(action?.href || ''),
                }))
                .slice(0, 60)
            : [],
          noOffersConfirmed: Boolean(discovered.noOffersConfirmed),
        };
        addLog(`Carnival catalog discovery: ${normalizedCatalog.rateCodes.length} rate code(s) found${normalizedCatalog.vifp ? ` for VIFP# ${normalizedCatalog.vifp}` : ''}`, normalizedCatalog.rateCodes.length ? 'success' : 'info');
        if (carnivalCatalogResolverRef.current === catalogResolver) {
          carnivalCatalogResolverRef.current = null;
          catalogResolver.resolve(normalizedCatalog);
        }
        break;
      }

      case 'carnival_search_page_chunk': {
        const resolver = carnivalSearchResolverRef.current;
        if (!resolver) break;
        const scope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, messageRequestId: msg.requestId, activeRunId: activeCarnivalRunIdRef.current, activeRequestId: resolver.requestId });
        if (!scope.current) break;
        const chunk = normalizeOfferRows(msg.rows).map((row) => ({
          ...row,
          sourcePage: row.sourcePage || 'Carnival Offers',
          offerType: row.offerType || 'Carnival Players Club',
          numberOfGuests: row.numberOfGuests || '2',
        }));
        if (chunk.length) resolver.rows = mergeOfferRows(resolver.rows, chunk);
        if (progressCallbacks.current.onProgress) progressCallbacks.current.onProgress();
        break;
      }

      case 'carnival_search_page_complete': {
        const resolver = carnivalSearchResolverRef.current;
        if (!resolver) break;
        const scope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, messageRequestId: msg.requestId, activeRunId: activeCarnivalRunIdRef.current, activeRequestId: resolver.requestId });
        if (!scope.current) {
          carnivalSearchResolverRef.current = null;
          resolver.resolve({
            requestId: resolver.requestId,
            runId: String(activeCarnivalRunIdRef.current || ''),
            offerCode: String(msg.offerCode || ''),
            offerName: String(msg.offerName || ''),
            offerExpiry: String(msg.offerExpiry || ''),
            perks: String(msg.perks || ''),
            pageNumber: Number(msg.pageNumber || 1),
            pageSize: Number(msg.pageSize || 50),
            totalResults: -1,
            hasNextPage: false,
            error: scope.reason || 'stale_request_message',
            requestProof: false,
            pageProof: false,
            rows: resolver.rows,
          });
          addLog('Rejected a stale Carnival search completion immediately instead of waiting for timeout.', 'warning');
          break;
        }
        const result: CarnivalSearchPageResult = {
          requestId: resolver.requestId,
          runId: String(msg.runId || activeCarnivalRunIdRef.current || ''),
          offerCode: String(msg.offerCode || ''),
          offerName: String(msg.offerName || ''),
          offerExpiry: String(msg.offerExpiry || ''),
          perks: String(msg.perks || ''),
          pageNumber: Number(msg.pageNumber || 1),
          pageSize: Number(msg.pageSize || 50),
          effectivePageSize: Number(msg.effectivePageSize || msg.pageSize || 50),
          totalResults: Number(msg.totalResults || 0),
          hasNextPage: Boolean(msg.hasNextPage),
          rowCount: Number(msg.rowCount || resolver.rows.length),
          error: msg.error ? String(msg.error) : undefined,
          url: msg.url ? String(msg.url) : undefined,
          expectedUrl: msg.expectedUrl ? String(msg.expectedUrl) : undefined,
          capturedUrl: msg.capturedUrl ? String(msg.capturedUrl) : undefined,
          payloadMatched: Boolean(msg.payloadMatched),
          authoritativeEmpty: Boolean(msg.authoritativeEmpty),
          readiness: msg.readiness ? String(msg.readiness) : undefined,
          requestProof: Boolean(msg.requestProof),
          pageProof: Boolean(msg.pageProof),
          pageContextMatched: Boolean(msg.pageContextMatched),
          pageSignature: msg.pageSignature ? String(msg.pageSignature) : undefined,
          paginationMode: msg.paginationMode ? String(msg.paginationMode) as CarnivalSearchPageResult['paginationMode'] : 'unknown',
          nextPageNumber: Number(msg.nextPageNumber || Number(msg.pageNumber || 1) + 1),
          nextOffset: msg.nextOffset === null || msg.nextOffset === undefined ? null : Number(msg.nextOffset),
          nextCursor: msg.nextCursor ? String(msg.nextCursor) : undefined,
          nextUrl: msg.nextUrl ? String(msg.nextUrl) : undefined,
          truncationReason: msg.truncationReason ? String(msg.truncationReason) : undefined,
          inventoryPayloadCount: Number(msg.inventoryPayloadCount || 0),
          payloadKinds: Array.isArray(msg.payloadKinds) ? msg.payloadKinds.map((value: unknown) => String(value)) : [],
          rows: resolver.rows,
        };
        carnivalSearchResolverRef.current = null;
        resolver.resolve(result);
        break;
      }

      case 'carnival_profile_bookings_chunk': {
        const resolver = carnivalProfileResolverRef.current;
        if (!resolver) break;
        const scope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, messageRequestId: msg.requestId, activeRunId: activeCarnivalRunIdRef.current, activeRequestId: resolver.requestId });
        if (!scope.current) break;
        const chunk = normalizeBookedCruiseRows(msg.rows);
        if (chunk.length) resolver.rows = mergeCarnivalBookingRows([...resolver.rows, ...chunk]);
        if (progressCallbacks.current.onProgress) progressCallbacks.current.onProgress();
        break;
      }

      case 'carnival_profile_scrape_complete': {
        const resolver = carnivalProfileResolverRef.current;
        if (!resolver) break;
        const scope = evaluateCarnivalBridgeMessageScope({ messageRunId: msg.runId, messageRequestId: msg.requestId, activeRunId: activeCarnivalRunIdRef.current, activeRequestId: resolver.requestId });
        if (!scope.current) {
          const staleResolver = resolver;
          carnivalProfileResolverRef.current = null;
          staleResolver.resolve({
            requestId: staleResolver.requestId,
            profile: { firstName: '', lastName: '', vifpNumber: '', vifpTier: '', vifpTierSource: 'unknown', vifpPoints: 0, cruiseDayPoints: 0, totalCruises: 0, playersClubTier: '', playersClubPoints: 0, hasVifpData: false, hasPlayersClubData: false },
            bookings: staleResolver.rows,
            upcomingEmptyConfirmed: false,
            historyEmptyConfirmed: false,
            error: scope.reason || 'stale_request_message',
          });
          addLog('Rejected a stale Carnival profile completion immediately instead of waiting for timeout.', 'warning');
          break;
        }
        const rawProfile = msg.profile || {};
        const decodedTier = decodeCarnivalVifpTier(rawProfile.vifpTier || rawProfile.tierCode, rawProfile.cruiseDayPoints);
        const profile: CarnivalProfileSnapshot = {
          firstName: String(rawProfile.firstName || ''),
          lastName: String(rawProfile.lastName || ''),
          vifpNumber: String(rawProfile.vifpNumber || ''),
          vifpTier: decodedTier.tier,
          vifpTierSource: rawProfile.vifpTierSource === 'inferred' ? 'inferred' : decodedTier.source,
          vifpPoints: Number(rawProfile.vifpPoints || 0),
          cruiseDayPoints: Number(rawProfile.cruiseDayPoints || 0),
          totalCruises: Number(rawProfile.totalCruises || 0),
          playersClubTier: String(rawProfile.playersClubTier || ''),
          playersClubPoints: Number(rawProfile.playersClubPoints || 0),
          hasVifpData: Boolean(rawProfile.hasVifpData),
          hasPlayersClubData: Boolean(rawProfile.hasPlayersClubData),
          authoritativeFields: Array.isArray(rawProfile.authoritativeFields) ? rawProfile.authoritativeFields.map((value: unknown) => String(value || '')).filter(Boolean) : [],
        };
        if (profile.vifpNumber || profile.vifpTier || profile.vifpPoints || profile.playersClubTier || profile.playersClubPoints) {
          const merged = mergeCarnivalProfileSnapshots([carnivalUserDataRef.current || {}, profile]) as CarnivalProfileSnapshot;
          carnivalUserDataRef.current = merged;
          capturedSections.current.loyalty = true;
          setState((prev) => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              carnivalVifpNumber: merged.vifpNumber || prev.loyaltyData?.carnivalVifpNumber || '',
              carnivalVifpTier: merged.vifpTierSource === 'inferred' ? `${merged.vifpTier} (inferred)` : merged.vifpTier,
              carnivalVifpPoints: String(merged.vifpPoints || prev.loyaltyData?.carnivalVifpPoints || ''),
              carnivalCruiseDayPoints: String(merged.cruiseDayPoints || prev.loyaltyData?.carnivalCruiseDayPoints || ''),
              carnivalTotalCruises: String(merged.totalCruises || prev.loyaltyData?.carnivalTotalCruises || ''),
              carnivalPlayersClubTier: merged.playersClubTier || prev.loyaltyData?.carnivalPlayersClubTier || '',
              carnivalPlayersClubPoints: String(merged.playersClubPoints || prev.loyaltyData?.carnivalPlayersClubPoints || ''),
            },
          }));
        }
        const result: CarnivalProfileScrapeResult = {
          requestId: resolver.requestId,
          profile,
          bookings: resolver.rows,
          upcomingEmptyConfirmed: Boolean(msg.authenticatedPage && msg.pageKind === 'cruises' && msg.upcomingEmptyConfirmed),
          historyEmptyConfirmed: Boolean(msg.authenticatedPage && msg.pageKind === 'cruises' && msg.historyEmptyConfirmed),
          upcomingCount: Number(msg.upcomingCount || 0),
          completedCount: Number(msg.completedCount || 0),
          pageUrl: String(msg.pageUrl || msg.url || ''),
          pageKind: msg.pageKind === 'cruises' || msg.pageKind === 'profile' ? msg.pageKind : 'unknown',
          authenticatedPage: Boolean(msg.authenticatedPage),
          discoveredProfileUrls: Array.isArray(msg.discoveredProfileUrls) ? msg.discoveredProfileUrls.map((value: unknown) => String(value || '')).filter(Boolean) : [],
          profilePayloadCount: Number(msg.profilePayloadCount || 0),
          historyBounded: Boolean(msg.authenticatedPage && msg.historyBounded),
          error: msg.error ? String(msg.error) : undefined,
        };
        carnivalProfileResolverRef.current = null;
        resolver.resolve(result);
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
              carnivalVifpNumber: tgoMsg.vifp || prev.loyaltyData?.carnivalVifpNumber || '',
              carnivalVifpTier: tierName,
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
          const tierMap: Record<string, string> = { '00': 'Blue', '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
          const tierName = tierMap[userData.TierCode] || userData.VifpTier || userData.loyaltyTier || '';
          const points = stringifyValue(userData.Points || userData.TotalPoints || userData.VifpPoints || '');
          console.log('[CarnivalSync] User data captured:', userData.FirstName, userData.LastName, 'VIFP#', userData.PastGuestNumber, 'Tier:', tierName, 'Points:', points || 'N/A');
          carnivalUserDataRef.current = {
            vifpNumber: userData.PastGuestNumber || userData.VifpNumber || '',
            vifpTier: tierName,
            vifpPoints: Number(userData.Points || userData.TotalPoints || userData.VifpPoints || 0),
            cruiseDayPoints: Number(userData.CruiseDayPoints || 0),
            totalCruises: Number(userData.TotalCruises || 0),
            playersClubTier: String(userData.PlayersClubTier || ''),
            playersClubPoints: Number(userData.PlayersClubPoints || 0),
            firstName: userData.FirstName || '',
            lastName: userData.LastName || '',
            hasVifpData: Boolean(userData.PastGuestNumber || userData.VifpNumber || userData.TierCode || userData.VifpTier || userData.Points !== undefined || userData.TotalPoints !== undefined || userData.VifpPoints !== undefined),
            hasPlayersClubData: Boolean(userData.PlayersClubTier || userData.PlayersClubPoints !== undefined),
            authoritativeFields: [
              ...(userData.PastGuestNumber || userData.VifpNumber ? ['vifpNumber'] : []),
              ...(tierName ? ['vifpTier'] : []),
              ...(userData.Points !== undefined || userData.TotalPoints !== undefined || userData.VifpPoints !== undefined ? ['vifpPoints'] : []),
              ...(userData.CruiseDayPoints !== undefined ? ['cruiseDayPoints'] : []),
              ...(userData.TotalCruises !== undefined ? ['totalCruises'] : []),
              ...(userData.PlayersClubTier ? ['playersClubTier'] : []),
              ...(userData.PlayersClubPoints !== undefined ? ['playersClubPoints'] : []),
            ],
          };
          capturedSections.current.loyalty = true;
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              carnivalVifpNumber: String(userData.PastGuestNumber || userData.VifpNumber || prev.loyaltyData?.carnivalVifpNumber || ''),
              carnivalVifpTier: tierName,
              carnivalVifpPoints: points || prev.loyaltyData?.carnivalVifpPoints || '',
              carnivalCruiseDayPoints: stringifyValue(userData.CruiseDayPoints || prev.loyaltyData?.carnivalCruiseDayPoints || ''),
              carnivalTotalCruises: stringifyValue(userData.TotalCruises || prev.loyaltyData?.carnivalTotalCruises || ''),
              carnivalPlayersClubTier: String(userData.PlayersClubTier || prev.loyaltyData?.carnivalPlayersClubTier || ''),
              carnivalPlayersClubPoints: stringifyValue(userData.PlayersClubPoints || prev.loyaltyData?.carnivalPlayersClubPoints || ''),
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

  const verifyCarnivalAuthentication = useCallback(async (): Promise<CarnivalAuthProbeResult> => {
    if (cruiseLine !== 'carnival') {
      return { authenticated: true, source: 'not_carnival', reason: '', httpStatus: 0, url: '' };
    }
    if (!webViewRef.current) {
      return { authenticated: false, source: 'webview_unavailable', reason: 'Carnival WebView is unavailable', httpStatus: 0, url: '' };
    }
    const requestId = `carnival-auth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const probeRunId = activeCarnivalRunIdRef.current || '';
    return new Promise<CarnivalAuthProbeResult>((resolve) => {
      let settled = false;
      const finish = (result: CarnivalAuthProbeResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (carnivalAuthProbeResolverRef.current?.requestId === requestId) carnivalAuthProbeResolverRef.current = null;
        resolve(result);
      };
      const timeout = setTimeout(() => finish({
        authenticated: false,
        source: 'probe_timeout',
        reason: 'Timed out waiting for the protected Carnival profile API verification',
        httpStatus: 0,
        url: '',
      }), 10000);
      carnivalAuthProbeResolverRef.current = { requestId, runId: probeRunId, resolve: finish };
      // Bridge shape emitted by injectCarnivalAuthenticationProbe: type: 'carnival_auth_probe'
      webViewRef.current?.injectJavaScript(injectCarnivalAuthenticationProbe(requestId, probeRunId) + '; true;');
    });
  }, [cruiseLine]);

  const confirmCarnivalLogin = useCallback(async (): Promise<boolean> => {
    const result = await verifyCarnivalAuthentication();
    setState((prev) => ({ ...prev, status: result.authenticated ? 'logged_in' : 'not_logged_in', error: result.authenticated ? null : (result.reason || 'Carnival login could not be verified') }));
    if (result.authenticated) {
      const verificationLabel = result.source === 'protected_profile_api'
        ? 'the protected Carnival profile API'
        : result.source === 'recent_protected_api_fallback'
          ? 'a recent protected Carnival profile API response'
          : 'the signed-in Carnival profile page';
      addLog(`Carnival login verified against ${verificationLabel}.`, 'success');
    } else {
      addLog(`Carnival login was not verified${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}. ${result.reason || 'Finish signing in before starting sync.'}`, 'warning');
    }
    return result.authenticated;
  }, [addLog, verifyCarnivalAuthentication]);

  const runIngestion = useCallback(async () => {
    const isCarnivalMode = cruiseLine === 'carnival';
    if (ingestionInFlightRef.current) {
      addLog('Sync ingestion is already running...', 'warning');
      return;
    }

    if (state.status !== 'logged_in' && state.status !== 'complete' && state.status !== 'partial' && state.status !== 'cancelled') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    if (isCarnivalMode) {
      const authResult = await verifyCarnivalAuthentication();
      if (!authResult.authenticated) {
        const authError = authResult.reason || 'Carnival login could not be verified';
        setState((prev) => ({ ...prev, status: 'login_expired', currentStep: '', progress: null, error: authError }));
        addLog(`Carnival authentication verification failed before the sync lock was acquired${authResult.httpStatus ? ` (HTTP ${authResult.httpStatus})` : ''}: ${authError}`, 'error');
        return;
      }
      addLog(`Carnival authentication preflight passed via ${authResult.source === 'protected_profile_api' ? 'the protected profile API' : 'verified signed-in session evidence'}.`, 'success');
    }

    let carnivalRunId: string | null = null;
    let carnivalAbortSignal: AbortSignal | null = null;
    if (isCarnivalMode) {
      const staleRun = activeCarnivalRun && Date.now() - activeCarnivalRun.startedAt > 45 * 60 * 1000;
      if (staleRun && activeCarnivalRun && !activeCarnivalRun.settled) {
        activeCarnivalRun.controller.abort();
        addLog('The prior Carnival run exceeded the safety window and was aborted. Its lock will release only after the old run fully settles.', 'warning');
      }
      if (activeCarnivalRun && !activeCarnivalRun.settled) {
        addLog('A Carnival sync is already active or still unwinding. Reopen that sync screen or wait for its terminal state before starting another run.', 'warning');
        return;
      }
      if (activeCarnivalRun?.settled) activeCarnivalRun = null;
      const controller = new AbortController();
      carnivalRunId = createCarnivalRunId();
      carnivalAbortSignal = controller.signal;
      carnivalAbortControllerRef.current = controller;
      activeCarnivalRunIdRef.current = carnivalRunId;
      carnivalCancelReasonRef.current = '';
      activeCarnivalRun = {
        runId: carnivalRunId,
        ownerId: providerInstanceIdRef.current,
        controller,
        startedAt: Date.now(),
        settled: false,
      };
      addLog(`🔒 Carnival sync run ${carnivalRunId} acquired the exclusive sync lock`, 'info');
    }

    ingestionInFlightRef.current = true;

    processedPayloads.current.clear();
    extendedLoyaltyDataRef.current = null;
    loyaltyLaneAuthorityRef.current = { clubRoyale: false, crownAndAnchor: false };
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    step1CatalogMetaRef.current = {};
    carnivalUserDataRef.current = null;
    carnivalLaneAuthorityRef.current = { active: false, completed: false, profileTotalCruises: 0 };
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

    const assertCarnivalRunActive = (): void => {
      if (!isCarnivalMode) return;
      const reason = carnivalCancelReasonRef.current || 'Carnival sync was cancelled';
      if (!carnivalRunId || carnivalAbortSignal?.aborted || activeCarnivalRunIdRef.current !== carnivalRunId || activeCarnivalRun?.runId !== carnivalRunId || activeCarnivalRun?.ownerId !== providerInstanceIdRef.current || !providerMountedRef.current) {
        throw new CarnivalSyncCancelledError(reason);
      }
    };

    const persistCarnivalTerminalManifest = async (terminalStatus: CarnivalSyncTerminalStatus, error?: string): Promise<void> => {
      if (!isCarnivalMode) return;
      const meta = step1CatalogMetaRef.current || {};
      const current = carnivalManifestRef.current;
      const codeLedger = current?.codeLedger || meta.codeLedger || [];
      const incompleteCodes = current?.incompleteCodes || meta.incompleteCodes || [];
      const failedCodes = current?.failedCodes || meta.failedCodes || [];
      const rows = extractedOffersRef.current.filter((row) => Boolean(row.shipName && row.sailingDate));
      const bookings = extractedBookedCruisesRef.current;
      const manifest = buildCarnivalSyncManifest({
        runId: current?.runId || meta.runId || carnivalRunId || '',
        appProfileId: current?.appProfileId || currentUser?.id || '',
        authenticatedEmailHash: current?.authenticatedEmailHash || carnivalStableHash((authenticatedEmail || '').toLowerCase()),
        accountFingerprint: current?.accountFingerprint || meta.accountFingerprint || '',
        vifpFingerprint: current?.vifpFingerprint || carnivalStableHash(carnivalUserDataRef.current?.vifpNumber || ''),
        catalogHash: current?.catalogHash || meta.catalogHash || '',
        catalogCount: current?.catalogCount ?? meta.offerCount ?? 0,
        completedCodeCount: current?.completedCodeCount ?? ((meta.successfulCodes?.length || 0) + (meta.authoritativeEmptyCodes?.length || 0)),
        successfulCodes: current?.successfulCodes || meta.successfulCodes || [],
        authoritativeEmptyCodes: current?.authoritativeEmptyCodes || meta.authoritativeEmptyCodes || [],
        failedCodes,
        incompleteCodes,
        rowBearingCodes: current?.rowBearingCodes || meta.rowBearingCodes || [],
        uniqueSailingCount: current?.uniqueSailingCount ?? countUniqueCarnivalSailings(rows),
        rawSailingRowCount: current?.rawSailingRowCount ?? rows.length,
        upcomingBookingCount: current?.upcomingBookingCount ?? bookings.filter((row) => !/completed|past|history/i.test(`${row.status} ${row.bookingStatus} ${row.sourcePage}`)).length,
        completedHistoryCount: current?.completedHistoryCount ?? bookings.filter((row) => /completed|past|history/i.test(`${row.status} ${row.bookingStatus} ${row.sourcePage}`)).length,
        codeLedger,
        terminalStatus,
        createdAt: current?.createdAt || new Date().toISOString(),
        appliedAt: current?.appliedAt,
        error,
      });
      carnivalManifestRef.current = manifest;
      try {
        await AsyncStorage.setItem(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_MANIFEST, authenticatedEmail), JSON.stringify(manifest));
      } catch (manifestError) {
        console.error('[CarnivalSync] Failed to persist terminal manifest:', manifestError);
      }
      if (providerMountedRef.current) setState((prev) => ({ ...prev, carnivalManifest: manifest, carnivalCodeLedger: manifest.codeLedger }));
    };

    const delay = (ms: number): Promise<void> => new Promise((resolve, reject) => {
      if (!isCarnivalMode) {
        setTimeout(resolve, ms);
        return;
      }
      try { assertCarnivalRunActive(); } catch (error) { reject(error); return; }
      const timer = setTimeout(() => {
        carnivalAbortSignal?.removeEventListener('abort', onAbort);
        try { assertCarnivalRunActive(); resolve(); } catch (error) { reject(error); }
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        carnivalAbortSignal?.removeEventListener('abort', onAbort);
        reject(new CarnivalSyncCancelledError(carnivalCancelReasonRef.current || 'Carnival sync was cancelled'));
      };
      carnivalAbortSignal?.addEventListener('abort', onAbort, { once: true });
    });

    const navigateToPage = (url: string, maxWaitMs: number = 15000, navigationLabel?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (isCarnivalMode) {
          try { assertCarnivalRunActive(); } catch (error) { reject(error); return; }
        }
        const normalizedUrl = String(url || '').trim();
        if (!normalizedUrl) {
          reject(new Error('Navigation URL was empty'));
          return;
        }
        navigationRequestIdRef.current += 1;
        const requestId = navigationRequestIdRef.current;
        const label = String(navigationLabel || normalizedUrl).trim() || normalizedUrl;
        const sameUrlRetry = lastRequestedNavigationUrlRef.current === normalizedUrl
          || lastLoadedNavigationUrlRef.current === normalizedUrl;
        lastRequestedNavigationUrlRef.current = normalizedUrl;
        pendingNavigationTargetRef.current = normalizedUrl;
        pendingNavigationLabelRef.current = label;
        let settled = false;
        let settleTimer: ReturnType<typeof setTimeout> | null = null;
        const cleanup = () => {
          clearTimeout(timeout);
          if (settleTimer) clearTimeout(settleTimer);
          carnivalAbortSignal?.removeEventListener('abort', onAbort);
          if (requestId === navigationRequestIdRef.current) {
            pageLoadResolver.current = null;
            pendingNavigationTargetRef.current = null;
            pendingNavigationLabelRef.current = '';
          }
        };
        const finish = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };
        const onAbort = () => fail(new CarnivalSyncCancelledError(carnivalCancelReasonRef.current || 'Carnival sync was cancelled'));
        const timeout = setTimeout(() => {
          if (requestId !== navigationRequestIdRef.current) return;
          addLog(`⚠️ Carnival page load timeout [nav ${requestId}] for ${label}; continuing with bounded page verification`, 'warning');
          finish();
        }, maxWaitMs);

        pageLoadResolver.current = () => {
          if (requestId !== navigationRequestIdRef.current) return;
          if (isCarnivalMode) {
            const scopedRunId = String(carnivalRunId || '');
            webViewRef.current?.injectJavaScript(`
              (function() {
                try {
                  var url = String(window.location.href || '');
                  var body = String(document.body ? document.body.innerText : '');
                  var authLost = !!document.querySelector('input[type=\"password\"]')
                    || /(login|signin|identity|security|challenge|authenticate|session-expired)/i.test(url)
                    || /session (?:has )?expired|please sign in|log in to continue|access denied|authentication required/i.test(body);
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'carnival_navigation_auth_probe', runId: ${JSON.stringify(scopedRunId)}, requestId: ${JSON.stringify(String(requestId))}, authLost: authLost, url: url }));
                } catch (error) {}
              })();
              true;
            `);
          }
          settleTimer = setTimeout(() => {
            if (isCarnivalMode) {
              try { assertCarnivalRunActive(); finish(); } catch (error) { fail(error); }
            } else finish();
          }, isCarnivalMode ? 450 : 2500);
        };

        carnivalAbortSignal?.addEventListener('abort', onAbort, { once: true });
        addLog(`🌐 Navigating [nav ${requestId}] to ${label}${sameUrlRetry ? ' (forced reload)' : ''}`, 'info');
        if (sameUrlRetry && webViewRef.current) {
          webViewRef.current.reload();
        } else {
          setWebViewUrl(normalizedUrl);
        }
      });
    };

    const runCarnivalSafeIngestion = async (): Promise<void> => {
      addLog('🎪 Carnival safe sync engine v12.4.2 started', 'info');
      addLog('Carnival data is isolated from Royal Caribbean and Celebrity throughout discovery, review, and Apply Sync.', 'info');

      const emptyCatalog = (): CarnivalCatalogDiscovery => ({
        sourceUrl: '', personalizedSearchUrl: '', tgo: '', vifp: '', tierCode: '', tierName: '', resident: '', locality: '1', currency: 'USD', rateCodes: [], actionCards: [], noOffersConfirmed: false,
      });

      const mergeCatalogs = mergeCarnivalCatalogs;

      const discoverCurrentCarnivalPage = (timeoutMs = 8000): Promise<CarnivalCatalogDiscovery> => new Promise((resolve, reject) => {
        assertCarnivalRunActive();
        let settled = false;
        const cleanup = () => {
          clearTimeout(timeout);
          carnivalAbortSignal?.removeEventListener('abort', onAbort);
          carnivalCatalogResolverRef.current = null;
        };
        const finish = (catalog: CarnivalCatalogDiscovery) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(catalog);
        };
        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new CarnivalSyncCancelledError(carnivalCancelReasonRef.current || 'Carnival sync was cancelled'));
        };
        const timeout = setTimeout(() => finish(emptyCatalog()), timeoutMs);
        carnivalAbortSignal?.addEventListener('abort', onAbort, { once: true });
        carnivalCatalogResolverRef.current = { runId: carnivalRunId || '', resolve: finish };
        webViewRef.current?.injectJavaScript(injectCarnivalCatalogDiscovery(carnivalRunId || '') + '; true;');
      });

      const scrapeCarnivalSearchPage = (input: {
        requestId: string; runId: string; contextFingerprint: string; expectedUrl: string; offerCode: string; offerName: string; offerExpiry: string; perks: string; pageNumber: number; pageSize: number; priorUniqueCount?: number;
      }, timeoutMs = 15000): Promise<CarnivalSearchPageResult> => new Promise((resolve, reject) => {
        assertCarnivalRunActive();
        let settled = false;
        const cleanup = () => {
          clearTimeout(timeout);
          carnivalAbortSignal?.removeEventListener('abort', onAbort);
          if (carnivalSearchResolverRef.current?.requestId === input.requestId) carnivalSearchResolverRef.current = null;
        };
        const finish = (result: CarnivalSearchPageResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };
        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new CarnivalSyncCancelledError(carnivalCancelReasonRef.current || 'Carnival sync was cancelled'));
        };
        const timeout = setTimeout(() => finish({
          requestId: input.requestId, runId: input.runId, expectedUrl: input.expectedUrl, offerCode: input.offerCode, offerName: input.offerName, offerExpiry: input.offerExpiry,
          perks: input.perks, pageNumber: input.pageNumber, pageSize: input.pageSize, effectivePageSize: input.pageSize, totalResults: 0, hasNextPage: false, rowCount: 0, error: 'Timed out waiting for Carnival search page', payloadMatched: false, authoritativeEmpty: false, requestProof: false, pageProof: false, pageContextMatched: false, renderedTerminalProof: false, resultStable: false, visibleRowCount: 0, nextControlState: 'unknown', terminalProofSource: 'none', pageSignature: '', paginationMode: 'unknown', inventoryPayloadCount: 0, payloadKinds: [], rows: [],
        }), timeoutMs);
        carnivalAbortSignal?.addEventListener('abort', onAbort, { once: true });
        carnivalSearchResolverRef.current = { requestId: input.requestId, rows: [], resolve: finish };
        webViewRef.current?.injectJavaScript(injectCarnivalSearchPageScrape(input) + '; true;');
      });

      const scrapeCarnivalProfilePage = (requestId: string, timeoutMs = 18000): Promise<CarnivalProfileScrapeResult> => new Promise((resolve, reject) => {
        assertCarnivalRunActive();
        let settled = false;
        const emptyProfile: CarnivalProfileSnapshot = { firstName: '', lastName: '', vifpNumber: '', vifpTier: '', vifpPoints: 0, cruiseDayPoints: 0, totalCruises: 0, playersClubTier: '', playersClubPoints: 0, hasVifpData: false, hasPlayersClubData: false };
        const cleanup = () => {
          clearTimeout(timeout);
          carnivalAbortSignal?.removeEventListener('abort', onAbort);
          if (carnivalProfileResolverRef.current?.requestId === requestId) carnivalProfileResolverRef.current = null;
        };
        const finish = (result: CarnivalProfileScrapeResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };
        const onAbort = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new CarnivalSyncCancelledError(carnivalCancelReasonRef.current || 'Carnival sync was cancelled'));
        };
        const timeout = setTimeout(() => finish({ requestId, profile: emptyProfile, bookings: [] }), timeoutMs);
        carnivalAbortSignal?.addEventListener('abort', onAbort, { once: true });
        carnivalProfileResolverRef.current = { requestId, rows: [], resolve: finish };
        webViewRef.current?.injectJavaScript(injectCarnivalProfileScrape(requestId, carnivalRunId || '') + '; true;');
      });

      const formatCatalogDate = (value: string): string => {
        const raw = String(value || '').trim();
        const match = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
        return match ? `${match[2]}/${match[3]}/${match[1]}` : raw;
      };

      // STEP 1 — discover the personalized dynamic offer catalog. Start on the current
      // authenticated page before navigating, because Carnival can expose the personalized
      // tgo/rate-code URL in more than one account page.
      setState((prev) => ({ ...prev, status: 'running_step_1', currentStep: 'Discovering Carnival offers' }));
      addLog('🚀 ====== STEP 1: CARNIVAL PLAYERS CLUB OFFERS ======', 'info');
      const catalogSnapshots: CarnivalCatalogDiscovery[] = [];
      catalogSnapshots.push(await discoverCurrentCarnivalPage(6000));

      for (const url of [CARNIVAL_PROFILE_OFFERS_URL, CARNIVAL_OFFERS_LANDING_URL]) {
        await navigateToPage(url, 12000);
        await delay(700);
        const snapshot = await discoverCurrentCarnivalPage(7000);
        catalogSnapshots.push(snapshot);
        if (snapshot.rateCodes.length) {
          addLog(`Found ${snapshot.rateCodes.length} Carnival rate code(s) on ${url.includes('profilemanagement') ? 'My Offers' : 'Cruise Deals'}`, 'success');
        }
      }

      let catalog = mergeCatalogs(catalogSnapshots);

      // Some personalized Carnival cards expose their rate code only after SHOP NOW is clicked.
      // If the DOM has more offer actions than usable personalized links, click each action in
      // isolation, capture the resulting URL/tgo values, then return to My Offers for the next card.
      const profileOffersSnapshot = catalogSnapshots.find((snapshot) => String(snapshot.sourceUrl || '').includes('/profilemanagement/profiles/offers'));
      const actionCards = (profileOffersSnapshot?.actionCards?.length ? profileOffersSnapshot.actionCards : catalog.actionCards) || [];
      const actionCardsNeedingResolution = actionCards.filter((action) => {
        const href = String(action?.href || '').trim();
        if (!href) return true;
        try {
          const url = new URL(href, CARNIVAL_PROFILE_OFFERS_URL);
          const selected = (url.searchParams.get('ratecodes') || url.searchParams.get('rateCodes') || '')
            .split(',')
            .map((code) => code.trim().toUpperCase())
            .filter(Boolean);
          if (selected.length !== 1) return true;
          const selectedCode = selected[0];
          const matchingEntry = catalog.rateCodes.find((entry) => entry.code === selectedCode);
          return !matchingEntry
            || !isCarnivalBookingLinkForCode(href, selectedCode)
            || !isCarnivalBookingLinkForCode(matchingEntry.bookingLink, selectedCode);
        } catch {
          return true;
        }
      });
      if (actionCardsNeedingResolution.length > 0) {
        addLog(`Carnival has ${actionCardsNeedingResolution.length}/${actionCards.length} offer card(s) without a verified code-specific URL; opening every unresolved card`, 'info');
        const clickedCatalogs: CarnivalCatalogDiscovery[] = [];
        for (let unresolvedIndex = 0; unresolvedIndex < actionCardsNeedingResolution.length; unresolvedIndex++) {
          const action = actionCardsNeedingResolution[unresolvedIndex];
          await navigateToPage(CARNIVAL_PROFILE_OFFERS_URL, 12000);
          await delay(700);
          addLog(`Opening unresolved Carnival offer card ${unresolvedIndex + 1}/${actionCardsNeedingResolution.length}${action?.title ? ` — ${action.title}` : ''}`, 'info');
          webViewRef.current?.injectJavaScript(injectCarnivalOfferActionClick(Number.isFinite(action.index) ? action.index : unresolvedIndex) + '; true;');
          await delay(1800);
          const clickedSnapshot = await discoverCurrentCarnivalPage(6000);
          const clickedUrl = clickedSnapshot.personalizedSearchUrl || clickedSnapshot.sourceUrl || action?.href || '';
          let explicitlySelectedCodes = new Set<string>();
          try {
            const selected = new URL(clickedUrl).searchParams.get('ratecodes') || new URL(clickedUrl).searchParams.get('rateCodes') || '';
            explicitlySelectedCodes = new Set(selected.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean));
          } catch { /* a malformed action URL must not be assigned to unrelated rate codes */ }
          clickedSnapshot.rateCodes = (clickedSnapshot.rateCodes || []).map((entry) => ({
            ...entry,
            offerName: entry.offerName && !/^Rate Code /i.test(entry.offerName) ? entry.offerName : (action?.title || entry.offerName),
            perks: entry.perks || action?.perks || '',
            // Only bind the clicked URL to the code explicitly selected by Carnival.
            // The clicked page can still display the entire 14/23-code catalog; assigning
            // that one URL to every visible code recreates the wrong-context bug.
            bookingLink: explicitlySelectedCodes.has(entry.code) ? clickedUrl : entry.bookingLink,
            bookingLinkVerified: explicitlySelectedCodes.has(entry.code) ? isCarnivalBookingLinkForCode(clickedUrl, entry.code) : entry.bookingLinkVerified,
            bookingLinkSource: explicitlySelectedCodes.has(entry.code) ? 'clicked' : entry.bookingLinkSource,
          }));
          if (clickedSnapshot.rateCodes.length) {
            addLog(`Captured ${clickedSnapshot.rateCodes.map((entry) => entry.code).join(', ')} from Carnival offer card ${unresolvedIndex + 1}`, 'success');
            clickedCatalogs.push(clickedSnapshot);
          } else {
            addLog(`Carnival offer card ${unresolvedIndex + 1} did not expose a rate code after click; continuing without fabricating one`, 'warning');
          }
        }
        catalog = mergeCatalogs([catalog, ...clickedCatalogs]);
      }

      const explicitContextCount = catalog.rateCodes.filter((entry) => isCarnivalBookingLinkForCode(entry.bookingLink, entry.code)).length;
      catalog = ensureCarnivalCodeSpecificCatalog(catalog);
      const generatedContextCount = Math.max(0, catalog.rateCodes.length - explicitContextCount);
      if (generatedContextCount > 0) {
        addLog(`Generated and verified ${generatedContextCount} code-specific Carnival search context(s) from the authenticated VIFP/TGO catalog`, 'success');
      }
      const unresolvedContexts = catalog.rateCodes.filter((entry) => !isCarnivalBookingLinkForCode(entry.bookingLink, entry.code));
      if (unresolvedContexts.length > 0) {
        throw new Error(`Carnival context isolation failed for rate code(s): ${unresolvedContexts.map((entry) => entry.code).join(', ')}`);
      }

      assertCarnivalRunActive();
      const checkpointKey = getUserScopedKey(CARNIVAL_CHECKPOINT_STORAGE_KEY, authenticatedEmail);
      const legacyCheckpointKey = getUserScopedKey(CARNIVAL_LEGACY_CHECKPOINT_STORAGE_KEY, authenticatedEmail);
      let savedCheckpointForCatalog: CarnivalSyncCheckpoint | null = null;
      const preliminaryIdentityCatalog: CarnivalCatalogDiscovery = {
        ...catalog,
        vifp: catalog.vifp || carnivalUserDataRef.current?.vifpNumber || '',
      };
      const preliminaryIdentity = buildCarnivalCheckpointIdentity({
        catalog: preliminaryIdentityCatalog,
        appProfileId: currentUser?.id || '',
        authenticatedEmail,
      });
      try {
        const rawSavedCheckpoint = await AsyncStorage.getItem(checkpointKey);
        if (rawSavedCheckpoint) {
          const candidate = JSON.parse(rawSavedCheckpoint) as CarnivalSyncCheckpoint;
          if (isCarnivalCheckpointAccountCompatible(candidate, preliminaryIdentity)) {
            savedCheckpointForCatalog = candidate;
            const currentCodes = new Set(catalog.rateCodes.map((entry) => entry.code));
            const recoveredEntries = (candidate.catalogCodes || [])
              .map((rawCode) => String(rawCode || '').trim().toUpperCase())
              .filter((code) => code && !currentCodes.has(code))
              .map((code) => {
                const saved = candidate.codeStates?.[code];
                return saved ? {
                  code,
                  startDate: '',
                  endDate: saved.context?.expiry || '',
                  offerName: saved.context?.offerName || `Rate Code ${code}`,
                  perks: '',
                  bookingLink: saved.context?.shopNowUrl || '',
                  bookingLinkVerified: isCarnivalBookingLinkForCode(saved.context?.shopNowUrl || '', code),
                  bookingLinkSource: 'generated' as const,
                } : null;
              })
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            if (recoveredEntries.length) {
              catalog = ensureCarnivalCodeSpecificCatalog(mergeCatalogs([catalog, { ...catalog, rateCodes: recoveredEntries }]));
              addLog(`♻️ Restored ${recoveredEntries.length} personalized Carnival code(s) from the same-account checkpoint after a partial catalog discovery: ${recoveredEntries.map((entry) => entry.code).join(', ')}`, 'success');
            }
          }
        }
      } catch (catalogCheckpointError) {
        addLog(`Checkpoint catalog recovery was skipped (${String(catalogCheckpointError)})`, 'warning');
      }

      const visibleCodes = catalog.rateCodes.map((entry) => entry.code);
      addLog(`Carnival run catalog locked with ${visibleCodes.length} personalized rate code(s)${visibleCodes.length ? `: ${visibleCodes.join(', ')}` : ''}`, visibleCodes.length ? 'success' : 'info');
      if (catalog.vifp) addLog(`Personalized Carnival search is linked to VIFP# ${catalog.vifp}`, 'success');

      const identityCatalog: CarnivalCatalogDiscovery = {
        ...catalog,
        vifp: catalog.vifp || carnivalUserDataRef.current?.vifpNumber || '',
      };
      const checkpointIdentity = buildCarnivalCheckpointIdentity({
        catalog: identityCatalog,
        appProfileId: currentUser?.id || '',
        authenticatedEmail,
      });
      const contextByCode: Record<string, CarnivalCheckpointOfferContext> = Object.fromEntries(
        catalog.rateCodes.map((entry) => [entry.code, buildCarnivalCheckpointOfferContext(identityCatalog, entry)]),
      );
      const rowsByCode: Record<string, OfferRow[]> = {};
      const codeStates: Record<string, CarnivalCheckpointCodeRecord> = {};
      let checkpointCreatedAt = new Date().toISOString();

      try {
        await AsyncStorage.removeItem(legacyCheckpointKey);
        const rawCheckpoint = savedCheckpointForCatalog ? JSON.stringify(savedCheckpointForCatalog) : await AsyncStorage.getItem(checkpointKey);
        if (rawCheckpoint) {
          const checkpoint = JSON.parse(rawCheckpoint) as CarnivalSyncCheckpoint;
          if (isCarnivalCheckpointCompatible(checkpoint, checkpointIdentity, contextByCode)) {
            checkpointCreatedAt = checkpoint.createdAt || checkpointCreatedAt;
            Object.entries(checkpoint.codeStates || {}).forEach(([rawCode, rawRecord]) => {
              const code = String(rawCode).toUpperCase();
              const record = rawRecord as CarnivalCheckpointCodeRecord;
              codeStates[code] = record;
              rowsByCode[code] = Array.isArray(record.rows) ? record.rows : [];
            });
            const resumableCount = Object.values(codeStates).filter(isCarnivalCodeSkippable).length;
            if (resumableCount) {
              addLog(`♻️ Resuming Carnival sync from account-bound checkpoint: ${resumableCount}/${visibleCodes.length} offer code(s) authoritatively resolved`, 'success');
            }
          } else {
            await AsyncStorage.removeItem(checkpointKey);
            addLog('🛡️ Rejected Carnival checkpoint because the verified VIFP/app account or an overlapping code-specific Shop Now context changed', 'warning');
          }
        }
      } catch (checkpointError) {
        addLog(`Checkpoint could not be loaded; starting a fresh Carnival offer pass (${String(checkpointError)})`, 'warning');
      }

      if (!isCarnivalCheckpointIdentityUsable(checkpointIdentity)) {
        addLog('🛡️ Carnival did not expose a verified VIFP number. Checkpoints will be saved for diagnostics but will not be auto-resumed until the account identity is verified.', 'warning');
      }

      const persistCheckpoint = async (): Promise<void> => {
        const checkpoint: CarnivalSyncCheckpoint = {
          version: CARNIVAL_SYNC_CHECKPOINT_VERSION,
          identity: checkpointIdentity,
          catalogCodes: visibleCodes,
          catalogHash: checkpointIdentity.catalogHash,
          codeStates,
          createdAt: checkpointCreatedAt,
          updatedAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(checkpointKey, JSON.stringify(checkpoint));
      };

      const saveCheckpoint = async (): Promise<void> => {
        assertCarnivalRunActive();
        await persistCheckpoint();
      };

      // Every visible rate code receives an explicit checkpoint state before
      // navigation starts. A suspended run therefore never leaves an absent code
      // ambiguously looking completed; untouched codes remain resumable.
      for (const entry of catalog.rateCodes) {
        if (!codeStates[entry.code]) {
          codeStates[entry.code] = {
            status: 'incomplete',
            rows: [],
            context: contextByCode[entry.code] || buildCarnivalCheckpointOfferContext(identityCatalog, entry),
            totalResults: 0,
            pagesVisited: 0,
            error: 'Offer has not started extraction in this checkpoint',
            updatedAt: new Date().toISOString(),
          };
        }
        rowsByCode[entry.code] = Array.isArray(codeStates[entry.code].rows) ? codeStates[entry.code].rows : [];
      }
      try {
        await persistCheckpoint();
      } catch (initialCheckpointError) {
        addLog(`⚠️ Could not persist the initial per-code checkpoint ledger: ${String(initialCheckpointError)}`, 'warning');
      }

      const primeCarnivalSearchContext = async (context: { requestId: string; runId: string; offerCode: string; pageNumber: number; contextFingerprint: string; accountFingerprint: string; expectedUrl: string; navigationSequenceId: number; vifpNumber: string }): Promise<void> => {
        assertCarnivalRunActive();
        const serialized = JSON.stringify(context).replace(/</g, '\u003c').replace(/>/g, '\u003e');
        webViewRef.current?.injectJavaScript(`
          (function() {
            var context = ${serialized};
            context.startedAt = Date.now();
            context.requestStartedAt = 0;
            try { localStorage.setItem('__easySeasCarnivalSearchContext', JSON.stringify(context)); } catch (e) {}
            window.__easySeasCarnivalSearchContext = Object.freeze ? Object.freeze(context) : context;
            window.capturedPayloads = window.capturedPayloads || {};
            window.capturedPayloads.carnivalSearch = null;
            window.capturedPayloads.carnivalSearchByContext = window.capturedPayloads.carnivalSearchByContext || {};
            var prefix = String(context.runId || '') + '|' + String(context.offerCode || '').toUpperCase() + '|' + Number(context.pageNumber || 1) + '|';
            Object.keys(window.capturedPayloads.carnivalSearchByContext).forEach(function(key) {
              if (key.indexOf(prefix) === 0) delete window.capturedPayloads.carnivalSearchByContext[key];
            });
            var allKeys = Object.keys(window.capturedPayloads.carnivalSearchByContext);
            if (allKeys.length > 24) {
              allKeys.sort(function(a, b) {
                return Number(window.capturedPayloads.carnivalSearchByContext[a] && window.capturedPayloads.carnivalSearchByContext[a].capturedAt || 0) - Number(window.capturedPayloads.carnivalSearchByContext[b] && window.capturedPayloads.carnivalSearchByContext[b].capturedAt || 0);
              }).slice(0, allKeys.length - 24).forEach(function(key) { delete window.capturedPayloads.carnivalSearchByContext[key]; });
            }
          })();
          true;
        `);
        await delay(150);
      };

      const releaseCarnivalSearchContext = async (context: { requestId: string; runId: string; offerCode: string; pageNumber: number }): Promise<void> => {
        const serialized = JSON.stringify(context).replace(/</g, '\u003c').replace(/>/g, '\u003e');
        webViewRef.current?.injectJavaScript(`
          (function() {
            var context = ${serialized};
            var key = String(context.runId || '') + '|' + String(context.offerCode || '').toUpperCase() + '|' + Number(context.pageNumber || 1) + '|' + String(context.requestId || '');
            window.capturedPayloads = window.capturedPayloads || {};
            window.capturedPayloads.carnivalSearchByContext = window.capturedPayloads.carnivalSearchByContext || {};
            delete window.capturedPayloads.carnivalSearchByContext[key];
            if (window.capturedPayloads.carnivalSearch && String(window.capturedPayloads.carnivalSearch.requestId || '') === String(context.requestId || '')) {
              window.capturedPayloads.carnivalSearch = null;
            }
          })();
          true;
        `);
        await delay(50);
      };

      const syncStartedAt = Date.now();
      let processedThisRun = 0;
      const pageSize = 50;
      for (let offerIndex = 0; offerIndex < catalog.rateCodes.length; offerIndex++) {
        const entry = catalog.rateCodes[offerIndex];
        const initialContext = contextByCode[entry.code] || buildCarnivalCheckpointOfferContext(identityCatalog, entry);
        try {
          assertCarnivalRunActive();
          const offerName = entry.offerName || `Rate Code ${entry.code}`;
          const offerExpiry = formatCatalogDate(entry.endDate || '');
          const remainingWork = catalog.rateCodes.slice(offerIndex).filter((candidate) => !isCarnivalCodeSkippable(codeStates[candidate.code])).length;
          const remainingEtaMs = calculateCarnivalCurrentRunEta({
            runStartedAt: syncStartedAt,
            processedThisRun,
            remainingThisRun: remainingWork,
          });
          const remainingMinutes = remainingEtaMs && remainingEtaMs > 0 ? Math.ceil(remainingEtaMs / 60000) : null;
          setProgress(offerIndex + 1, Math.max(1, catalog.rateCodes.length), `Carnival ${entry.code}${remainingMinutes ? ` • ~${remainingMinutes}m remaining` : ''}`);

          if (isCarnivalCodeSkippable(codeStates[entry.code])) {
            rowsByCode[entry.code] = codeStates[entry.code].rows || [];
            addLog(`Checkpoint ${offerIndex + 1}/${catalog.rateCodes.length}: ${entry.code} is ${codeStates[entry.code].status}; skipping duplicate download`, 'info');
            continue;
          }

          const resumableRecord = codeStates[entry.code];
          const resumableRows = (resumableRecord?.rows || []).filter((row) => Boolean(String(row.shipName || '').trim() && String(row.sailingDate || '').trim()));
          codeStates[entry.code] = {
            ...resumableRecord,
            status: 'incomplete',
            rows: resumableRows,
            context: initialContext,
            totalResults: Number(resumableRecord?.totalResults || 0),
            pagesVisited: Number(resumableRecord?.pagesVisited || 0),
            error: 'Extraction is resumable and has not yet reached an authoritative terminal state',
            updatedAt: new Date().toISOString(),
          };
          rowsByCode[entry.code] = resumableRows;
          await saveCheckpoint();

          addLog(`Downloading Carnival offer ${offerIndex + 1}/${catalog.rateCodes.length}: ${entry.code} — ${offerName}`, 'info');
          let pageNumber = Math.max(1, Number(resumableRecord?.nextPageNumber || 1));
          let currentSearchUrl = String(resumableRecord?.nextUrl || '');
          let offerRows: OfferRow[] = resumableRows;
          let expectedTotal = Number(resumableRecord?.totalResults || 0);
          let consecutiveNoGrowth = 0;
          let pagesVisited = Number(resumableRecord?.pagesVisited || 0);
          const maxPages = 50;
          const signatureCounts = new Map<string, number>();
          let offerCatalog = catalog;
          let codeStatus: CarnivalCheckpointCodeStatus = 'incomplete';
          let codeError = '';
          let terminalStateReached = false;
          let authoritativeEmpty = false;

          // Every rate code must begin from its own code-specific Shop Now/search
          // context. A broad catalog URL is never permitted to stand in for the
          // selected offer, even when it contains the same global TGO catalog.
          if (!isCarnivalBookingLinkForCode(entry.bookingLink, entry.code)) {
            throw new Error(`Carnival offer ${entry.code} has no verified code-specific Shop Now context`);
          }
          addLog(`Opening Carnival offer ${entry.code} from its verified ${entry.bookingLinkSource || 'personalized'} context`, 'info');
          await navigateToPage(entry.bookingLink!, 12000);
          await delay(700);
          const clickSnapshot = await discoverCurrentCarnivalPage(6000);
          // Carried-forward QA marker: mergeCatalogs([catalog, clickSnapshot, parseCarnivalPersonalizedUrl(entry.bookingLink)])
          offerCatalog = ensureCarnivalCodeSpecificCatalog(mergeCatalogs([
            catalog,
            clickSnapshot,
            parseCarnivalPersonalizedUrl(entry.bookingLink!),
          ]));
          const resolvedEntry = offerCatalog.rateCodes.find((candidate) => candidate.code === entry.code) || entry;
          if (!isCarnivalBookingLinkForCode(resolvedEntry.bookingLink, entry.code)) {
            throw new Error(`Carnival offer ${entry.code} lost its code-specific context after page discovery`);
          }
          const initialSearchUrl = buildCarnivalOfferSearchUrl(offerCatalog, entry.code, 1, pageSize, {
            nextUrl: resolvedEntry.bookingLink,
          });
          currentSearchUrl = currentSearchUrl && isCarnivalBookingLinkForCode(currentSearchUrl, entry.code)
            ? currentSearchUrl
            : initialSearchUrl;
          if (!isCarnivalBookingLinkForCode(currentSearchUrl, entry.code)) {
            throw new Error(`Carnival initial search URL does not prove rate code ${entry.code}`);
          }

          const resolvedContext = buildCarnivalCheckpointOfferContext(offerCatalog, resolvedEntry);
          contextByCode[entry.code] = resolvedContext;

          const downloadCarnivalPage = async (searchUrl: string, requestedPage: number, retry = false): Promise<CarnivalSearchPageResult> => {
            const requestId = `${carnivalRunId}-${entry.code}-${requestedPage}${retry ? '-retry' : ''}-${Date.now()}`;
            const context = {
              requestId,
              runId: carnivalRunId!,
              offerCode: entry.code,
              pageNumber: requestedPage,
              contextFingerprint: resolvedContext.contextFingerprint,
              accountFingerprint: checkpointIdentity.fingerprint,
              expectedUrl: searchUrl,
              navigationSequenceId: navigationRequestIdRef.current + 1,
              vifpNumber: catalog.vifp,
            };
            await primeCarnivalSearchContext(context);
            try {
              await navigateToPage(searchUrl, retry ? 10000 : 12000, `${entry.code} page ${requestedPage}${retry ? ' retry' : ''}`);
              await delay(retry ? 900 : 700);
              return await scrapeCarnivalSearchPage({
                ...context,
                offerName,
                offerExpiry,
                perks: entry.perks || '',
                pageSize,
                priorUniqueCount: offerRows.length,
              }, retry ? 12000 : 15000);
            } finally {
              await releaseCarnivalSearchContext(context);
            }
          };

          while (pagesVisited < maxPages) {
            assertCarnivalRunActive();
            const searchUrl = currentSearchUrl || buildCarnivalOfferSearchUrl(offerCatalog, entry.code, pageNumber, pageSize);
            if (!isCarnivalBookingLinkForCode(searchUrl, entry.code)) {
              codeError = `Generated pagination URL no longer proves rate code ${entry.code}`;
              break;
            }

            let pageResult = await downloadCarnivalPage(searchUrl, pageNumber, false);
            const needsShortRetry = !pageResult.authoritativeEmpty
              && !pageResult.rows.length
              && Boolean(pageResult.error || !pageResult.payloadMatched || !pageResult.requestProof || !pageResult.pageProof || /timeout|loading=true/i.test(pageResult.readiness || ''));
            if (needsShortRetry) {
              // This remains one short, run-scoped retry, now further isolated by request ID.
              addLog(`  ${entry.code} page ${pageNumber} was incomplete; making one short, request-scoped retry`, 'warning');
              pageResult = await downloadCarnivalPage(searchUrl, pageNumber, true);
            }

            pagesVisited += 1;
            const responseCode = String(pageResult.offerCode || '').trim().toUpperCase();
            if (responseCode !== entry.code || Number(pageResult.pageNumber || 0) !== pageNumber) {
              codeError = `Rejected Carnival page response because it belonged to ${responseCode || 'an unknown code'} page ${pageResult.pageNumber || '?'} instead of ${entry.code} page ${pageNumber}`;
              break;
            }
            if (!pageResult.pageContextMatched) {
              codeError = `Carnival page ${pageNumber} did not retain the verified ${entry.code} URL context`;
              break;
            }
            if (pageResult.payloadMatched && (!pageResult.requestProof || !pageResult.pageProof)) {
              codeError = `Carnival inventory payload for ${entry.code} page ${pageNumber} lacked request/page proof`;
              break;
            }
            if (pageResult.capturedUrl && !pageResult.payloadMatched) {
              // Rejected stale Carnival payload; never reuse it across offers or pages.
              addLog(`  Rejected stale or non-inventory Carnival payload for ${entry.code}; only the verified current-page DOM fallback was considered`, 'warning');
            }

            expectedTotal = Math.max(expectedTotal, pageResult.totalResults || 0);
            const uniqueCountBefore = offerRows.length;
            offerRows = mergeOfferRows(offerRows, pageResult.rows);
            const uniqueCountAfter = offerRows.length;
            const signature = pageResult.pageSignature || `${entry.code}|${pageNumber}|${pageResult.rowCount || pageResult.rows.length}|${pageResult.totalResults || 0}`;
            const priorSignatureCount = signatureCounts.get(signature) || 0;
            const decision = evaluateCarnivalPaginationStep({
              currentPageNumber: pageNumber,
              pagesVisited,
              maxPages,
              uniqueCountBefore,
              uniqueCountAfter,
              expectedTotal,
              hasNextPage: Boolean(pageResult.hasNextPage),
              payloadMatched: Boolean(pageResult.payloadMatched && pageResult.requestProof && pageResult.pageProof),
              renderedTerminalProof: Boolean(pageResult.renderedTerminalProof),
              resultStable: Boolean(pageResult.resultStable),
              authoritativeEmpty: Boolean(pageResult.authoritativeEmpty),
              pageSignature: signature,
              priorSignatureCount,
              consecutiveNoGrowth,
              truncationReason: pageResult.truncationReason || '',
            });
            signatureCounts.set(signature, decision.nextSignatureCount);
            consecutiveNoGrowth = decision.nextConsecutiveNoGrowth;
            if (decision.warningReason) {
              addLog(`  ${entry.code} page ${pageNumber}: ${decision.warningReason}`, 'warning');
            }

            const proofLabel = pageResult.payloadMatched
              ? `API verified (${pageResult.inventoryPayloadCount || 1} inventory payload${(pageResult.inventoryPayloadCount || 1) === 1 ? '' : 's'})`
              // verified DOM fallback now requires stable rendered terminal proof.
              : pageResult.renderedTerminalProof
                ? `settled rendered-page proof (${pageResult.visibleRowCount || pageResult.rows.length}${pageResult.displayedTotal ? `/${pageResult.displayedTotal}` : ''}, next=${pageResult.nextControlState || 'unknown'})`
                : 'unverified rendered-page fallback';
            addLog(
              `  ${entry.code} page ${pageNumber}: ${pageResult.rows.length} row(s), ${offerRows.length}${expectedTotal ? `/${expectedTotal}` : ''} unique • ${proofLabel} • ${pageResult.paginationMode || 'unknown'} pagination`,
              pageResult.rows.length ? 'success' : 'info',
            );

            if (pageResult.authoritativeEmpty) authoritativeEmpty = true;
            if (decision.terminal) {
              terminalStateReached = decision.successfulTerminal;
              codeError = decision.incompleteReason || '';
              break;
            }

            const nextPageNumber = Math.max(pageNumber + 1, Number(pageResult.nextPageNumber || pageNumber + 1));
            currentSearchUrl = buildCarnivalNextPageUrl({
              currentUrl: searchUrl,
              offerCode: entry.code,
              nextPageNumber,
              pageSize: pageResult.effectivePageSize || pageSize,
              nextUrl: pageResult.nextUrl || undefined,
              nextOffset: pageResult.paginationMode === 'offset' ? pageResult.nextOffset : null,
              nextCursor: pageResult.paginationMode === 'cursor' ? pageResult.nextCursor : '',
            });
            if (!isCarnivalBookingLinkForCode(currentSearchUrl, entry.code)) {
              codeError = `Carnival next-page adapter generated a URL outside rate code ${entry.code}`;
              break;
            }
            rowsByCode[entry.code] = offerRows;
            codeStates[entry.code] = {
              status: 'incomplete',
              rows: offerRows,
              context: resolvedContext,
              totalResults: expectedTotal,
              pagesVisited,
              nextPageNumber,
              nextUrl: currentSearchUrl,
              terminalProof: pageResult.terminalProofSource || (pageResult.payloadMatched ? 'api' : pageResult.renderedTerminalProof ? 'rendered_page' : 'none'),
              error: `Checkpointed after page ${pageNumber}; next page ${nextPageNumber} remains`,
              updatedAt: new Date().toISOString(),
            };
            await saveCheckpoint();
            addLog(`  💾 ${entry.code} page ${pageNumber} checkpoint saved (${offerRows.length}${expectedTotal ? `/${expectedTotal}` : ''} unique); resume page ${nextPageNumber}`, 'info');
            pageNumber = nextPageNumber;
          }

          if (pagesVisited >= maxPages && !terminalStateReached && !codeError) {
            codeError = `Safety page limit ${maxPages} reached before authoritative completion (${offerRows.length}/${expectedTotal || '?'})`;
          }

          if (authoritativeEmpty) {
            codeStatus = 'authoritative_empty';
            offerRows = [{
              sourcePage: 'Carnival Offers', offerName, offerCode: entry.code, offerExpirationDate: offerExpiry,
              offerType: 'Carnival Players Club', shipName: '', sailingDate: '', itinerary: '', departurePort: '',
              cabinType: '', numberOfGuests: '2', perks: entry.perks || '', bookingLink: entry.bookingLink || buildCarnivalOfferSearchUrl(offerCatalog, entry.code, 1, pageSize),
            } as OfferRow];
            addLog(`✅ ${entry.code}: Carnival authoritatively reported zero eligible sailings; the visible offer is retained`, 'success');
          } else if (offerRows.length > 0 && terminalStateReached) {
            codeStatus = 'success';
            addLog(`✅ ${entry.code}: ${offerRows.length} eligible sailing(s) captured to an authoritative terminal state`, 'success');
          } else {
            codeStatus = 'incomplete';
            const incompleteReason = codeError || 'No authoritative completion or empty-result proof was captured';
            if (!offerRows.length) {
              offerRows = [{
                sourcePage: 'Carnival Offers', offerName, offerCode: entry.code, offerExpirationDate: offerExpiry,
                offerType: 'Carnival Players Club', shipName: '', sailingDate: '', itinerary: '', departurePort: '',
                cabinType: '', numberOfGuests: '2', perks: entry.perks || '', bookingLink: entry.bookingLink || buildCarnivalOfferSearchUrl(offerCatalog, entry.code, 1, pageSize),
                offerStatus: 'Fallback Extraction Incomplete', isInProgress: true,
              } as OfferRow];
            } else {
              offerRows = offerRows.map((row) => ({ ...row, offerStatus: 'Fallback Extraction Incomplete', isInProgress: true }));
            }
            codeError = incompleteReason;
            addLog(`⚠️ ${entry.code} remains incomplete and will be retried on resume: ${incompleteReason}`, 'warning');
          }

          rowsByCode[entry.code] = offerRows;
          codeStates[entry.code] = {
            status: codeStatus,
            rows: offerRows,
            context: resolvedContext,
            totalResults: expectedTotal,
            pagesVisited,
            nextPageNumber: undefined,
            nextUrl: undefined,
            terminalProof: authoritativeEmpty ? 'authoritative_empty' : terminalStateReached ? 'verified_terminal' : 'incomplete',
            ...(codeError ? { error: codeError } : {}),
            updatedAt: new Date().toISOString(),
          };
          await saveCheckpoint();
          const resolvedCount = Object.values(codeStates).filter(isCarnivalCodeSkippable).length;
          addLog(`💾 Carnival checkpoint v2 saved: ${resolvedCount}/${visibleCodes.length} code(s) authoritatively resolved; account/context fingerprint locked`, 'info');
          processedThisRun += 1;
        } catch (offerError) {
          processedThisRun += 1;
          const message = offerError instanceof Error ? offerError.message : String(offerError);
          const status: CarnivalCheckpointCodeStatus = carnivalAbortSignal?.aborted
            ? 'cancelled'
            : /login|auth|session|sign[ -]?in/i.test(message)
              ? 'auth_lost'
              : /captcha|access denied|forbidden|http 403|bot protection|temporarily blocked/i.test(message)
                ? 'blocked'
                : 'failed';
          codeStates[entry.code] = {
            status,
            rows: rowsByCode[entry.code] || [],
            context: contextByCode[entry.code] || initialContext,
            totalResults: codeStates[entry.code]?.totalResults || 0,
            pagesVisited: codeStates[entry.code]?.pagesVisited || 0,
            error: message,
            updatedAt: new Date().toISOString(),
          };
          try { await persistCheckpoint(); } catch (checkpointWriteError) {
            addLog(`⚠️ Could not persist ${entry.code} ${status} state: ${String(checkpointWriteError)}`, 'warning');
          }
          if (status === 'cancelled' || status === 'auth_lost') throw offerError;
          addLog(`❌ ${entry.code} failed and remains resumable: ${message}`, 'error');
        }
      }

      assertCarnivalRunActive();
      const allOfferRows = visibleCodes.flatMap((code) => rowsByCode[code] || []);
      const authoritativeEmptyCodes = visibleCodes.filter((code) => codeStates[code]?.status === 'authoritative_empty');
      const successfulCodes = visibleCodes.filter((code) => codeStates[code]?.status === 'success');
      const incompleteCodes = visibleCodes.filter((code) => !isCarnivalCodeSkippable(codeStates[code]));
      const failedCodes = visibleCodes.filter((code) => ['failed', 'blocked', 'auth_lost'].includes(codeStates[code]?.status || ''));
      const rowBearingCodes = successfulCodes.filter((code) => (rowsByCode[code] || []).some((row) => Boolean(String(row.shipName || '').trim() && String(row.sailingDate || '').trim())));
      const codeLedger: CarnivalCodeLedgerEntry[] = visibleCodes.map((code) => {
        const record = codeStates[code];
        return {
          code,
          offerName: record?.context?.offerName || `Rate Code ${code}`,
          status: record?.status || 'pending',
          rowCount: (record?.rows || []).filter((row) => Boolean(String(row.shipName || '').trim() && String(row.sailingDate || '').trim())).length,
          totalResults: Number(record?.totalResults || 0),
          pagesVisited: Number(record?.pagesVisited || 0),
          truncated: /limit|truncat|incomplete/i.test(record?.error || ''),
          message: record?.error,
          updatedAt: record?.updatedAt || new Date().toISOString(),
        };
      });
      const sailingRowCount = successfulCodes
        .flatMap((code) => rowsByCode[code] || [])
        .filter((row) => Boolean(String(row.shipName || '').trim() && String(row.sailingDate || '').trim())).length;
      const mergedOffers = mergeOfferRows([], allOfferRows).map((row: any) => ({
        ...row,
        catalogVisibleOfferCodes: visibleCodes.join(','),
        catalogVisibleOfferCount: visibleCodes.length,
        catalogZeroRowOfferCodes: authoritativeEmptyCodes.join(','),
        catalogRowBearingOfferCodes: successfulCodes.join(','),
        catalogIncompleteOfferCodes: incompleteCodes.join(','),
      }));
      const offerCatalogFullyResolved = catalog.noOffersConfirmed || (visibleCodes.length > 0 && incompleteCodes.length === 0);
      extractedOffersRef.current = mergedOffers;
      step1CatalogMetaRef.current = {
        offerCount: visibleCodes.length,
        offerCodes: visibleCodes,
        totalCount: sailingRowCount,
        completed: offerCatalogFullyResolved,
        incompleteCodes,
        authoritativeEmptyCodes,
        successfulCodes,
        failedCodes,
        rowBearingCodes,
        codeLedger,
        accountFingerprint: checkpointIdentity.fingerprint,
        catalogHash: checkpointIdentity.catalogHash,
        runId: carnivalRunId || '',
      };
      capturedSections.current.offers = catalog.noOffersConfirmed || visibleCodes.length > 0;
      const sailingCountsByCode = visibleCodes.map((code) => `${code}:${(rowsByCode[code] || []).filter((row) => Boolean(String(row.shipName || '').trim() && String(row.sailingDate || '').trim())).length}`).join(', ');
      addLog(`📊 Carnival reconciliation — discovered=${visibleCodes.length}, completed=${successfulCodes.length + authoritativeEmptyCodes.length}, incomplete=${incompleteCodes.length}, offers=${mergedOffers.length}, unique sailings=${countUniqueCarnivalSailings(mergedOffers)}; by code: ${sailingCountsByCode}`, incompleteCodes.length ? 'warning' : 'success');
      setState((prev) => ({ ...prev, extractedOffers: mergedOffers, carnivalCodeLedger: codeLedger }));
      if (!visibleCodes.length && !catalog.noOffersConfirmed) {
        addLog('⚠️ Carnival did not expose a trustworthy personalized offer catalog. Existing Carnival offers will be preserved during Apply Sync.', 'warning');
      } else if (!visibleCodes.length) {
        addLog('✅ Carnival explicitly reported zero current offers. The empty catalog is authoritative.', 'success');
      } else if (incompleteCodes.length > 0) {
        addLog(`⚠️ STEP 1 PARTIAL: ${successfulCodes.length} successful, ${authoritativeEmptyCodes.length} authoritative empty, ${incompleteCodes.length} incomplete/failed (${incompleteCodes.join(', ')}). Existing Carnival offer inventory cannot be removed until all codes resolve.`, 'warning');
      } else {
        addLog(`✅ STEP 1 COMPLETE: ${visibleCodes.length} offer(s) resolved, ${sailingRowCount} eligible sailing row(s)`, 'success');
      }

      // STEP 2 — bookings, completed history, and VIFP/Players Club profile.
      setState((prev) => ({ ...prev, status: 'running_step_2', currentStep: 'Reading Carnival bookings and loyalty' }));
      addLog('🚀 ====== STEP 2: CARNIVAL BOOKINGS, HISTORY & LOYALTY ======', 'info');
      const profileResults: CarnivalProfileScrapeResult[] = [];
      const profileQueue = [CARNIVAL_CRUISES_URL, CARNIVAL_PROFILE_URL];
      const visitedProfileUrls = new Set<string>();
      const normalizeCarnivalProfileUrl = (candidate: string): string => {
        try {
          const parsed = new URL(candidate, CARNIVAL_PROFILE_URL);
          const sameCarnivalHost = /(^|\.)carnival\.com$/i.test(parsed.hostname);
          const profileRoute = /\/profilemanagement\/profiles(?:\/|$)/i.test(parsed.pathname);
          const excludedRoute = /offer|deal|shop|search-results/i.test(`${parsed.pathname} ${parsed.search}`);
          if (!sameCarnivalHost || !profileRoute || excludedRoute) return '';
          parsed.hash = '';
          return parsed.toString();
        } catch {
          return '';
        }
      };
      for (let profileIndex = 0; profileIndex < profileQueue.length && profileIndex < 8; profileIndex += 1) {
        const url = normalizeCarnivalProfileUrl(profileQueue[profileIndex]);
        if (!url || visitedProfileUrls.has(url)) continue;
        visitedProfileUrls.add(url);
        await navigateToPage(url, 12000, `Carnival profile/history page ${profileIndex + 1}`);
        await delay(700);
        const requestId = `carnival-profile-${Date.now()}-${profileResults.length}`;
        addLog(`Reading Carnival ${/\/cruises(?:[/?#]|$)/i.test(url) ? 'My Cruises and Cruise History' : 'profile/VIFP'} page`, 'info');
        const result = await scrapeCarnivalProfilePage(requestId);
        profileResults.push(result);
        const discovered = Array.isArray(result.discoveredProfileUrls) ? result.discoveredProfileUrls : [];
        discovered.forEach((candidate) => {
          const normalized = normalizeCarnivalProfileUrl(candidate);
          if (normalized && !visitedProfileUrls.has(normalized) && !profileQueue.includes(normalized)) profileQueue.push(normalized);
        });
        if ((result.profilePayloadCount || 0) > 0 || discovered.length > 0) {
          addLog(`Carnival profile/history discovery: ${result.profilePayloadCount || 0} protected payload(s), ${discovered.length} additional page link(s)`, 'success');
        }
      }

      const carnivalBookings = mergeCarnivalBookingRows(profileResults.flatMap((result) => result.bookings));
      const capturedUpcomingCount = carnivalBookings.filter((row) => !isCompletedRecordLike(row)).length;
      const capturedCompletedCount = carnivalBookings.filter((row) => isCompletedRecordLike(row)).length;
      const explicitNoUpcoming = profileResults.some((result) => result.upcomingEmptyConfirmed === true);
      const explicitNoHistory = profileResults.some((result) => result.historyEmptyConfirmed === true);

      const mergedProfile = mergeCarnivalProfileSnapshots(profileResults.map((result) => result.profile)) as CarnivalProfileSnapshot;
      const profileTotalCruises = Number(mergedProfile.totalCruises || 0);
      const cruisesPageResults = profileResults.filter((result) => result.authenticatedPage && result.pageKind === 'cruises' && !result.error);
      const activeLaneAuthoritative = capturedUpcomingCount > 0 || cruisesPageResults.some((result) => result.upcomingEmptyConfirmed === true);
      const historyBounded = profileResults.some((result) => result.historyBounded === true);
      const completedLaneAuthoritative = capturedCompletedCount > 0
        ? (profileTotalCruises === 0 || capturedCompletedCount >= profileTotalCruises || historyBounded)
        : cruisesPageResults.some((result) => result.historyEmptyConfirmed === true) && profileTotalCruises === 0;
      carnivalLaneAuthorityRef.current = {
        active: activeLaneAuthoritative,
        completed: completedLaneAuthoritative,
        profileTotalCruises,
      };

      if (carnivalBookings.length || activeLaneAuthoritative || completedLaneAuthoritative) {
        extractedBookedCruisesRef.current = carnivalBookings;
        capturedSections.current.bookings = true;
        setState((prev) => ({ ...prev, extractedBookedCruises: carnivalBookings }));
      }
      if (!activeLaneAuthoritative) {
        addLog('⚠️ Carnival active booking lane was not authoritative; existing Carnival booked/upcoming cruises will be preserved.', 'warning');
      } else if (cruisesPageResults.some((result) => result.upcomingEmptyConfirmed) && capturedUpcomingCount === 0) {
        addLog('✅ Carnival explicitly reported no upcoming bookings on the authenticated My Cruises page; the empty active-booking lane is authoritative.', 'success');
      }
      if (!completedLaneAuthoritative) {
        const expectedNote = profileTotalCruises > 0 ? ` (profile reports ${profileTotalCruises} total cruise(s), captured ${capturedCompletedCount})` : '';
        addLog(`⚠️ Carnival completed-history lane was incomplete${expectedNote}; existing Carnival completed cruises will be preserved.`, 'warning');
      } else if (cruisesPageResults.some((result) => result.historyEmptyConfirmed) && capturedCompletedCount === 0) {
        addLog('✅ Carnival explicitly reported no cruise history on the authenticated history section; the empty completed lane is authoritative.', 'success');
      }

      if (mergedProfile && (mergedProfile.hasVifpData || mergedProfile.hasPlayersClubData || mergedProfile.vifpNumber || mergedProfile.playersClubTier || mergedProfile.playersClubPoints)) {
        carnivalUserDataRef.current = mergedProfile;
        capturedSections.current.loyalty = true;
        const displayTier = mergedProfile.vifpTierSource === 'inferred' && mergedProfile.vifpTier ? `${mergedProfile.vifpTier} (inferred)` : mergedProfile.vifpTier;
        setState((prev) => ({
          ...prev,
          loyaltyData: {
            ...(prev.loyaltyData ?? {}),
            carnivalVifpNumber: mergedProfile.vifpNumber,
            carnivalVifpTier: displayTier,
            carnivalVifpPoints: String(mergedProfile.vifpPoints || ''),
            carnivalCruiseDayPoints: String(mergedProfile.cruiseDayPoints || ''),
            carnivalTotalCruises: String(mergedProfile.totalCruises || ''),
            carnivalPlayersClubTier: mergedProfile.playersClubTier,
            carnivalPlayersClubPoints: String(mergedProfile.playersClubPoints || ''),
          },
        }));
        addLog(`✅ Carnival loyalty captured: VIFP ${displayTier || 'Unknown'}${mergedProfile.vifpNumber ? ` #${mergedProfile.vifpNumber}` : ''}; Players Club ${mergedProfile.playersClubTier || 'Unknown'} (${mergedProfile.playersClubPoints || 0} pts)`, 'success');
      } else {
        addLog('⚠️ Carnival VIFP/Players Club profile values were not found; existing profile loyalty values will be preserved.', 'warning');
      }

      const upcomingCount = capturedUpcomingCount;
      const completedCount = capturedCompletedCount;
      addLog(`✅ STEP 2 COMPLETE: ${upcomingCount} booked/upcoming and ${completedCount} completed/history cruise(s) captured`, carnivalBookings.length ? 'success' : 'warning');
      addLog('🎉 ====== CARNIVAL EXTRACTION COMPLETE ======', 'success');
      // Keep the completed extraction checkpoint until Apply Sync succeeds. If iOS
      // suspends the app while the user is reviewing, the next run can restore all
      // offer rows instead of downloading the entire catalog again.
      assertCarnivalRunActive();

      const extractionManifest = buildCarnivalSyncManifest({
        runId: carnivalRunId || '',
        appProfileId: currentUser?.id || '',
        authenticatedEmailHash: carnivalStableHash((authenticatedEmail || '').toLowerCase()),
        accountFingerprint: checkpointIdentity.fingerprint,
        vifpFingerprint: carnivalStableHash(mergedProfile.vifpNumber || checkpointIdentity.vifpNumber || ''),
        catalogHash: checkpointIdentity.catalogHash,
        catalogCount: visibleCodes.length,
        completedCodeCount: successfulCodes.length + authoritativeEmptyCodes.length,
        successfulCodes,
        authoritativeEmptyCodes,
        failedCodes,
        incompleteCodes,
        rowBearingCodes,
        uniqueSailingCount: countUniqueCarnivalSailings(mergedOffers.filter((row) => Boolean(row.shipName && row.sailingDate))),
        rawSailingRowCount: sailingRowCount,
        upcomingBookingCount: upcomingCount,
        completedHistoryCount: completedCount,
        codeLedger,
        terminalStatus: incompleteCodes.length > 0 ? 'partial_resumable' : 'interrupted_resumable',
        createdAt: new Date().toISOString(),
      });
      carnivalManifestRef.current = extractionManifest;
      await AsyncStorage.setItem(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_MANIFEST, authenticatedEmail), JSON.stringify(extractionManifest));

      setState((prev) => ({
        ...prev,
        status: 'awaiting_confirmation',
        currentStep: '',
        extractedOffers: extractedOffersRef.current,
        extractedBookedCruises: extractedBookedCruisesRef.current,
        progress: null,
        syncCounts: {
          offerCount: visibleCodes.length,
          offerRows: sailingRowCount,
          upcomingCruises: upcomingCount,
          courtesyHolds: 0,
          completedCruises: completedCount,
        },
        syncPreview: null,
        carnivalManifest: extractionManifest,
        carnivalCodeLedger: codeLedger,
      }));
      addLog(`Ready to review: ${visibleCodes.length} Carnival offer(s), ${sailingRowCount} available sailing(s)`, 'success');
      addLog(`Ready to review: ${upcomingCount} booked/upcoming, ${completedCount} completed/history Carnival cruise(s)`, 'success');
      addLog('Please review and confirm to sync Carnival data to the app.', 'info');
    };
    
    try {
      if (isCarnivalMode) {
        await runCarnivalSafeIngestion();
        return;
      }

      // Priority 7: the pre-Build-312 Carnival branch below is formally isolated.
      // All Carnival runs return through runCarnivalSafeIngestion above. Keep the
      // legacy parser references compile-only until fixture migration removes them.
      const legacyCarnivalMode = false as const;

      addLog('Opening offers', 'success');
      addLog(`🚀 ====== STEP 1: ${config.loyaltyClubName.toUpperCase()} OFFERS ======`, 'info');
      addLog(`📍 Loading ${config.loyaltyClubName} offers page...`, 'info');
      addLog('⏱️ This may take several minutes - extracting all offers and sailings...', 'info');
      
      addLog('Reading offers page', 'success');
      addLog('📍 Navigating to offers page...', 'info');

      // Hoist tgoData so both Step 1 and Step 1.5 can access it
      type TgoData = { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
      let tgoData: TgoData | null = null;

      if (legacyCarnivalMode) {
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
        if (legacyCarnivalMode) {
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
      
      let step1CompletedCleanly = await waitForStepComplete(1, legacyCarnivalMode ? 180000 : 1200000);

      if (extractedOffersRef.current.length === 0) {
        addLog('Offer extraction came back empty on the first attempt - retrying once before giving up', 'warning');
        await navigateToPage(config.offersUrl, 20000);
        await delay(2500);
        if (webViewRef.current) {
          if (legacyCarnivalMode) {
            addLog('Re-injecting Carnival extraction on offers page (retry)...', 'info');
            webViewRef.current.injectJavaScript(injectCarnivalOffersExtraction() + '; true;');
          } else {
            webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary, cruiseLine === 'celebrity' ? 'celebrity' : 'royal_caribbean') + '; true;');
          }
        }
        step1CompletedCleanly = await waitForStepComplete(1, legacyCarnivalMode ? 90000 : 240000);
        if (extractedOffersRef.current.length > 0) {
          addLog(`Retry succeeded: captured ${extractedOffersRef.current.length} offer row(s) on the second attempt`, 'success');
        } else {
          addLog('Retry still returned no offer rows - the site may have no current offers, or the session needs to be signed in again', 'warning');
        }
      }

      const step1OfferRows = extractedOffersRef.current;
      const step1OfferCodes = Array.from(new Set(step1OfferRows.map((offer: any) => String(offer.offerCode || '').trim().toUpperCase()).filter(Boolean)));
      const isRoyalSync = !legacyCarnivalMode && cruiseLine !== 'celebrity';
      const step1Meta = step1CatalogMetaRef.current || {};
      const visibleOfferCodes = Array.isArray(step1Meta.offerCodes) && step1Meta.offerCodes.length
        ? step1Meta.offerCodes
        : step1OfferCodes;
      const visibleOfferCount = Number.isFinite(Number(step1Meta.offerCount))
        ? Number(step1Meta.offerCount)
        : visibleOfferCodes.length;
      const zeroOfferCatalog = step1CompletedCleanly && visibleOfferCount === 0 && step1OfferRows.length === 0;

      // v12.3.3: Royal's live Club Royale catalog is dynamic. It can legitimately contain
      // 0, 1, 4, 30, or any future number of visible offer cards. Do not use hard-coded
      // offer-count or row-count thresholds to reject a cleanly finished browser crawl.
      // If some visible offers produce 0 rows, the row-bearing offers are still applied and
      // SyncLogic preserves existing rows for the missing code(s) because the capture is not
      // a full replacement catalog. If there are truly 0 offers, Step 1 must complete cleanly
      // with zero visible offers so Apply Sync can treat it as intentional rather than stale state.
      const royalTimedOutUsefulCapture = isRoyalSync && !step1CompletedCleanly && step1OfferRows.length > 0 && step1OfferCodes.length > 0;
      const nonRoyalCompletedCapture = !isRoyalSync && step1CompletedCleanly && step1OfferRows.length > 0;
      const step1IsAuthoritative = zeroOfferCatalog || (step1OfferRows.length > 0 && (step1CompletedCleanly || royalTimedOutUsefulCapture || nonRoyalCompletedCapture));
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
        if (isRoyalSync && !step1CompletedCleanly && royalTimedOutUsefulCapture) {
          addLog(`ℹ️ Accepted useful Club Royale rows despite timeout guard (${step1OfferCodes.length} row-bearing offer code(s), ${step1OfferRows.length} staged row(s)).`, 'info');
        }
        if (isRoyalSync) {
          addLog(`ℹ️ Dynamic Club Royale catalog accepted: ${visibleOfferCount} visible offer(s), ${step1OfferCodes.length} row-bearing offer code(s), ${step1OfferRows.length} sailing row(s).`, 'info');
        }
      } else {
        addLog(`🛡️ STEP 1 INCOMPLETE: captured ${step1OfferCodes.length} offer code(s) / ${step1OfferRows.length} row(s), but this was not authoritative and will not be applied`, 'warning');
      }
      if (hiddenInProgress > 0) {
        addLog(`ℹ️ Excluded ${hiddenInProgress} in-progress/empty offer row(s) from active offer counts`, 'info');
      }
      setState(prev => prev);
      
      // Step 1.5: Carnival offer enrichment - navigate to each rate code's cruise search page
      if (legacyCarnivalMode) {
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
          : legacyCarnivalMode
          ? 'https://www.carnival.com/profilemanagement/profiles'
          : 'https://www.royalcaribbean.com/myaccount';

        // v991: royalcaribbean.com/celebritycruises.com have changed their account route
        // shape more than once. Rather than trust a single hardcoded URL for bookings/loyalty
        // (which silently produces "0 cruises to sync" or lands on the wrong page when the
        // route moves), cycle through every known-good candidate route across retry cycles
        // until real data is actually captured.
        const bookingUrlCandidates = legacyCarnivalMode
          ? ['https://www.carnival.com/profilemanagement/profiles/cruises']
          : [config.upcomingUrl, ...((config as any).upcomingUrlAlternates ?? [])];
        const loyaltyUrlCandidates = legacyCarnivalMode
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

          const CAPTURE_PAGES: { url: string; section: 'bookings' | 'loyalty'; name: string }[] = legacyCarnivalMode
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
            
            if (legacyCarnivalMode) {
              await delay(3000);
            }
            
            if (!legacyCarnivalMode && webViewRef.current) {
              // v991: classify whatever page we actually landed on (sign-in / sailings-list /
              // real loyalty widgets / unrecognized) and log it clearly. This makes a broken
              // route (site redesign, redirect, etc.) immediately diagnosable from the in-app
              // sync log instead of silently producing "0 cruises" or missing points.
              webViewRef.current.injectJavaScript(injectPageClassifier(page.section) + '; true;');
            }

            if (!legacyCarnivalMode && page.section === 'loyalty' && webViewRef.current) {
              // Account home and loyalty-programs pages render the Crown & Anchor "Cruise Points"
              // and Club Royale tier-credit widgets directly in the DOM - scrape them as a
              // fallback alongside the passive network monitor.
              webViewRef.current.injectJavaScript(injectLoyaltyWidgetScrape() + '; true;');
            }
            
            if (legacyCarnivalMode && webViewRef.current) {
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
              await delay(legacyCarnivalMode ? 8000 : 6000);
              
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
      
      if (cruiseLine === 'royal_caribbean' && hasAuthoritativeCrownAndAnchorData(extendedLoyaltyDataRef.current)) {
        addLog('✅ Authoritative Crown & Anchor tier and points already captured - skipping direct C&A fetch', 'success');
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

              function normalizeHeaderObject(headersLike) {
                const result = {};
                try {
                  if (!headersLike) return result;
                  if (typeof Headers !== 'undefined' && headersLike instanceof Headers) {
                    headersLike.forEach(function(value, key) { result[String(key).toLowerCase()] = String(value); });
                    return result;
                  }
                  if (Array.isArray(headersLike)) {
                    headersLike.forEach(function(pair) {
                      if (Array.isArray(pair) && pair.length >= 2) result[String(pair[0]).toLowerCase()] = String(pair[1]);
                    });
                    return result;
                  }
                  if (typeof headersLike === 'object') {
                    Object.keys(headersLike).forEach(function(key) {
                      const value = headersLike[key];
                      if (value !== undefined && value !== null) result[String(key).toLowerCase()] = String(value);
                    });
                  }
                } catch (e) {}
                return result;
              }

              function safeJsonParse(str) {
                try { return JSON.parse(str); } catch (e) { return null; }
              }

              function deepFindValue(input, keyPattern, depth) {
                if (depth > 6 || input === undefined || input === null) return '';
                let value = input;
                if (typeof value === 'string') {
                  const parsed = safeJsonParse(value);
                  if (parsed !== null) value = parsed;
                  else return '';
                }
                if (typeof value !== 'object') return '';
                const keys = Object.keys(value);
                for (const key of keys) {
                  if (keyPattern.test(String(key))) {
                    const candidate = value[key];
                    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
                    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
                  }
                }
                for (const key of keys) {
                  const found = deepFindValue(value[key], keyPattern, depth + 1);
                  if (found) return found;
                }
                return '';
              }

              function readStorageObject(sourceWindow, storageName, key) {
                try {
                  const storage = sourceWindow && sourceWindow[storageName];
                  const raw = storage && storage.getItem ? storage.getItem(key) : null;
                  return raw ? (safeJsonParse(raw) || raw) : null;
                } catch (e) { return null; }
              }

              function tryFindAppKey(sourceWindow) {
                const source = sourceWindow || window;
                const candidates = [];
                try {
                  const captured = normalizeHeaderObject(window.__easySeasRoyalRequestHeaders || {});
                  ['appkey', 'x-api-key', 'x-rcl-appkey'].forEach(function(key) {
                    if (captured[key] && captured[key].length > 6) candidates.push(captured[key]);
                  });
                } catch (e) {}
                ['localStorage', 'sessionStorage'].forEach(function(storageName) {
                  try {
                    const storage = source[storageName];
                    const keys = Object.keys(storage || {});
                    for (const k of keys) {
                      if (/appkey|api[-_]?key|apigee/i.test(k)) {
                        const v = storage.getItem(k);
                        if (v && v.length > 6) candidates.push(v);
                      }
                    }
                  } catch (e) {}
                });
                try {
                  const env = source.__ENV__ || source.__env__ || source.env || null;
                  const v = env && (env.APPKEY || env.appKey || env.appkey || env.API_KEY || env.apiKey || env.apigeeApiKey);
                  if (typeof v === 'string' && v.length > 6) candidates.push(v);
                } catch (e) {}
                try {
                  const maybe = source.RCLL_APPKEY || source.RCCL_APPKEY || source.APPKEY || null;
                  if (typeof maybe === 'string' && maybe.length > 6) candidates.push(maybe);
                } catch (e) {}
                return candidates[0] || '';
              }

              function getAuthHeadersFromSession(sourceWindow) {
                const source = sourceWindow || window;
                const headers = {
                  'accept': 'application/json',
                  'accept-language': 'en-US,en;q=0.9',
                  'content-type': 'application/json',
                };

                try {
                  Object.assign(headers, normalizeHeaderObject(window.__easySeasRoyalRequestHeaders || {}));
                  if (source !== window) Object.assign(headers, normalizeHeaderObject(source.__easySeasRoyalRequestHeaders || {}));
                } catch (e) {}

                const sessionCandidates = [];
                ['persist:session', 'session', 'auth', 'authentication', 'persist:root'].forEach(function(key) {
                  sessionCandidates.push(readStorageObject(source, 'localStorage', key));
                  sessionCandidates.push(readStorageObject(source, 'sessionStorage', key));
                });

                let accountId = headers['account-id'] || '';
                let authorization = headers.authorization || '';
                let appKey = headers.appkey || headers['x-api-key'] || headers['x-rcl-appkey'] || '';

                for (const candidate of sessionCandidates) {
                  if (!candidate) continue;
                  if (!accountId) accountId = deepFindValue(candidate, /^(accountId|account-id|consumerId|consumer-id)$/i, 0);
                  if (!authorization) authorization = deepFindValue(candidate, /^(authorization|accessToken|access_token|idToken|id_token|token)$/i, 0);
                  if (!appKey) appKey = deepFindValue(candidate, /^(appkey|appKey|apiKey|api_key|apigeeApiKey|x-api-key)$/i, 0);
                }

                if (authorization && !/^Bearer\\s+/i.test(authorization) && authorization.split('.').length >= 3) {
                  authorization = 'Bearer ' + authorization;
                }
                if (accountId) headers['account-id'] = accountId;
                if (authorization && authorization !== '[object Object]') headers.authorization = authorization;
                if (!appKey) appKey = tryFindAppKey(source);
                if (appKey) {
                  headers.appkey = appKey;
                  headers['x-api-key'] = appKey;
                }
                return headers;
              }

              function describeAuthHeaders(headers) {
                const names = ['authorization', 'account-id', 'appkey', 'x-api-key', 'x-rcl-appkey', 'x-rcl-client-id']
                  .filter(function(key) { return headers && headers[key]; });
                return names.length ? names.join(', ') : 'cookie session only';
              }

              function hasDefinedValue(value) {
                return value !== undefined && value !== null && String(value).trim() !== '';
              }

              function capturedPayloadHasRequiredLoyalty(existing) {
                try {
                  const payload = existing && (existing.payload || existing);
                  const nested = payload && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : null;
                  const info = (payload && payload.loyaltyInformation) || nested || payload;
                  if (!info || typeof info !== 'object') return false;
                  if (isCelebrityHost) {
                    return Boolean(
                      hasDefinedValue(info.captainsClubLoyaltyTier || info.captainsClubTier) ||
                      hasDefinedValue(info.captainsClubLoyaltyIndividualPoints || info.captainsClubPoints)
                    );
                  }
                  const hasCrownAnchorTier = hasDefinedValue(
                    info.crownAndAnchorSocietyLoyaltyTier || info.crownAndAnchorTier || info.crownAndAnchorLevel
                  );
                  const hasCrownAnchorPoints = hasDefinedValue(
                    info.crownAndAnchorSocietyLoyaltyIndividualPoints ?? info.crownAndAnchorPoints ?? info.cruisePoints
                  );
                  // A casino-only or loyalty-history payload is useful, but it cannot close Step 3.
                  // Royal Step 3 completes only after the dedicated C&A lane supplies both tier and points.
                  return hasCrownAnchorTier && hasCrownAnchorPoints;
                } catch (e) { return false; }
              }

              let loyaltyFinished = false;
              let fetchInFlight = false;
              let timer = null;

              function finishLoyaltyCapture(data, loyaltyUrl, reason) {
                if (loyaltyFinished) return true;
                loyaltyFinished = true;
                if (timer) clearInterval(timer);
                window.capturedPayloads = window.capturedPayloads || {};
                window.capturedPayloads.loyalty = data;
                post('network_payload', { endpoint: 'loyalty', data, url: loyaltyUrl });
                post('step_complete', { step: 3, reason });
                return true;
              }

              function emitCapturedIfPresent(loyaltyUrl) {
                const existing = window.capturedPayloads && window.capturedPayloads.loyalty ? window.capturedPayloads.loyalty : null;
                if (existing && capturedPayloadHasRequiredLoyalty(existing)) {
                  log('✅ Required loyalty tier and points already captured by network monitor', 'success');
                  return finishLoyaltyCapture(existing, loyaltyUrl, 'captured_authoritative_candidate');
                }
                if (existing) {
                  log('ℹ️ Existing loyalty payload is partial (casino/history only); continuing to fetch dedicated loyalty/info', 'info');
                }
                return false;
              }

              let primerFrame = null;

              function getCandidateWindows() {
                const result = [window];
                try {
                  if (primerFrame && primerFrame.contentWindow) result.push(primerFrame.contentWindow);
                } catch (e) {}
                return result;
              }

              function primeLoyaltySession() {
                if (isCelebrityHost || primerFrame || !document.body) return;
                try {
                  primerFrame = document.createElement('iframe');
                  primerFrame.setAttribute('aria-hidden', 'true');
                  primerFrame.style.position = 'fixed';
                  primerFrame.style.width = '1px';
                  primerFrame.style.height = '1px';
                  primerFrame.style.opacity = '0';
                  primerFrame.style.pointerEvents = 'none';
                  primerFrame.style.left = '-10000px';
                  primerFrame.src = 'https://www.royalcaribbean.com/myaccount/loyalty-programs?easySeasLoyaltyProbe=1';
                  primerFrame.onload = function() {
                    log('✅ Loyalty account page primed inside the authenticated session', 'info');
                  };
                  document.body.appendChild(primerFrame);
                } catch (e) {
                  primerFrame = null;
                }
              }

              const initialHeaders = getAuthHeadersFromSession(window);
              const accountIdForUrlBuild = initialHeaders && initialHeaders['account-id'] ? initialHeaders['account-id'] : '';
              const LOYALTY_URL = buildLoyaltyUrl(accountIdForUrlBuild);
              const LOYALTY_URLS = isCelebrityHost
                ? [LOYALTY_URL]
                : [
                    LOYALTY_URL,
                    'https://www.royalcaribbean.com/api/guestAccounts/loyalty/info',
                    'https://www.royalcaribbean.com/api/account/loyalty',
                    'https://www.royalcaribbean.com/api/profile/loyalty',
                  ];

              async function attemptManualFetch(label) {
                if (loyaltyFinished || fetchInFlight) return loyaltyFinished;
                fetchInFlight = true;
                try {
                  const candidateWindows = getCandidateWindows();
                  for (let windowIndex = 0; windowIndex < candidateWindows.length; windowIndex++) {
                    const sourceWindow = candidateWindows[windowIndex];
                    const headers = getAuthHeadersFromSession(sourceWindow);
                    const sourceName = windowIndex === 0 ? 'current page' : 'loyalty account page';
                    log('🔁 ' + label + ': requesting dedicated loyalty data from ' + sourceName + ' using ' + describeAuthHeaders(headers), 'info');
                    for (let urlIndex = 0; urlIndex < LOYALTY_URLS.length; urlIndex++) {
                      const requestUrl = LOYALTY_URLS[urlIndex];
                      try {
                        const sourceFetch = sourceWindow && typeof sourceWindow.fetch === 'function'
                          ? sourceWindow.fetch.bind(sourceWindow)
                          : fetch.bind(window);
                        const res = await sourceFetch(requestUrl, {
                          method: 'GET',
                          headers,
                          credentials: 'include',
                          cache: 'no-store',
                          redirect: 'follow',
                        });
                        const text = await res.text().catch(function() { return ''; });
                        let data = null;
                        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
                        if (!res.ok) {
                          log('⚠️ Dedicated loyalty endpoint ' + (urlIndex + 1) + ' returned HTTP ' + res.status, 'warning');
                          continue;
                        }
                        if (!data || typeof data !== 'object') {
                          log('ℹ️ Dedicated loyalty endpoint ' + (urlIndex + 1) + ' did not return JSON loyalty data', 'info');
                          continue;
                        }
                        post('network_payload', { endpoint: 'loyalty', data, url: requestUrl });
                        if (capturedPayloadHasRequiredLoyalty(data)) {
                          log('✅ Dedicated loyalty endpoint returned authoritative Crown & Anchor tier and points', 'success');
                          return finishLoyaltyCapture(data, requestUrl, 'manual_fetch_authoritative');
                        }
                        log('ℹ️ Dedicated loyalty response was partial; trying the next authenticated route', 'info');
                      } catch (requestError) {
                        const requestMessage = requestError && requestError.message ? requestError.message : String(requestError);
                        log('⚠️ Dedicated loyalty route failed: ' + requestMessage, 'warning');
                      }
                    }
                  }
                  return false;
                } catch (e) {
                  const msg = (e && e.message) ? e.message : String(e);
                  log('⚠️ Dedicated loyalty request failed: ' + msg, 'warning');
                  return false;
                } finally {
                  fetchInFlight = false;
                }
              }

              if (emitCapturedIfPresent(LOYALTY_URL)) return true;

              log('🧭 Keeping the current authenticated page alive while resolving Crown & Anchor...', 'info');
              primeLoyaltySession();
              let tries = 0;
              const maxTries = isCelebrityHost ? 60 : 80;
              timer = setInterval(async function() {
                tries++;
                if (loyaltyFinished) {
                  clearInterval(timer);
                  return;
                }
                if (emitCapturedIfPresent(LOYALTY_URL)) return;

                if ([4, 8, 16, 28, 44, 64].indexOf(tries) !== -1) {
                  await attemptManualFetch('Retry ' + tries);
                }

                if (tries >= maxTries) {
                  clearInterval(timer);
                  log('⚠️ Dedicated Crown & Anchor capture timed out; preserving existing C&A fields rather than overwriting them', 'warning');
                  post('step_complete', { step: 3, reason: 'timeout_preserve_existing' });
                }
              }, 500);

              void attemptManualFetch('Initial attempt');

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
        const capturedLoyalty = extendedLoyaltyDataRef.current;
        if (cruiseLine === 'royal_caribbean') {
          const hasClubRoyale = hasAuthoritativeClubRoyaleData(capturedLoyalty);
          const hasCrownAndAnchor = hasAuthoritativeCrownAndAnchorData(capturedLoyalty);
          addLog(`✅ STEP 3 COMPLETE: Club Royale ${hasClubRoyale ? 'captured authoritatively' : 'preserved/not captured'}; Crown & Anchor ${hasCrownAndAnchor ? 'captured authoritatively' : 'preserved/not captured'}`, hasClubRoyale || hasCrownAndAnchor ? 'success' : 'warning');
        } else if (capturedLoyalty || prev.loyaltyData) {
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
        const completedCruises = rawCompletedCruises;
        
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
      if (error instanceof CarnivalSyncCancelledError || (isCarnivalMode && carnivalAbortSignal?.aborted)) {
        const reason = error instanceof CarnivalSyncCancelledError ? error.reason : (carnivalCancelReasonRef.current || 'Carnival sync was cancelled');
        const terminalStatus: CarnivalSyncTerminalStatus = /auth|login|session/i.test(reason) ? 'auth_lost' : 'cancelled';
        await persistCarnivalTerminalManifest(terminalStatus, reason);
        if (providerMountedRef.current) {
          addLog(`⛔ Carnival sync ${terminalStatus === 'auth_lost' ? 'lost authentication' : 'cancelled'}: ${reason}. Completed offer checkpoints were preserved for resume.`, 'warning');
          setState(prev => ({ ...prev, status: terminalStatus === 'auth_lost' ? 'login_expired' : 'cancelled', currentStep: '', progress: null, error: reason }));
        }
      } else {
        if (isCarnivalMode) await persistCarnivalTerminalManifest('error', String(error));
        addLog(`Ingestion failed: ${String(error)}`, 'error');
        setState(prev => ({ ...prev, status: 'error', error: String(error) }));
      }
    } finally {
      ingestionInFlightRef.current = false;
      if (carnivalRunId && activeCarnivalRun?.runId === carnivalRunId && activeCarnivalRun.ownerId === providerInstanceIdRef.current) {
        activeCarnivalRun.settled = true;
        activeCarnivalRun = null;
      }
      if (activeCarnivalRunIdRef.current === carnivalRunId) activeCarnivalRunIdRef.current = null;
      if (carnivalAbortControllerRef.current?.signal === carnivalAbortSignal) carnivalAbortControllerRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.scrapePricingAndItinerary, addLog, config, cruiseLine, verifyCarnivalAuthentication]);

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
    extendedLoyaltyDataRef.current = null;
    loyaltyLaneAuthorityRef.current = { clubRoyale: false, crownAndAnchor: false };
    rcLogger.clear();
  }, []);

  const setExtendedLoyalty = useCallback((data: ExtendedLoyaltyData | null) => {
    mergeCapturedLoyalty(data, 'external loyalty setter');
  }, [mergeCapturedLoyalty]);

  const syncToApp = useCallback(async (coreDataContext: any, loyaltyContext: any, providedExtendedLoyalty?: ExtendedLoyaltyData | null, targetOptions?: SyncTargetOptions) => {
    const loyaltyToSync = filterExtendedLoyaltyForCruiseLine(providedExtendedLoyalty ?? extendedLoyaltyDataRef.current ?? extendedLoyaltyData, cruiseLine);
    const fallbackExtendedLoyaltyFromState = state.loyaltyData
      ? convertLoyaltyInfoToExtended(state.loyaltyData as unknown as LoyaltyApiInformation, undefined, { sourceType: 'stored' })
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
    const targetProfile = requestedProfile ?? primaryProfile ?? currentUser;
    const isPrimarySyncTarget = !primaryProfile || targetProfile?.id === primaryProfile.id;
    const targetSlotLabel = isPrimarySyncTarget ? 'Primary User' : 'Second User';
    const ownershipOptions = { includeUnownedRecords: true };

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

    const carnivalApplyJournalKey = getUserScopedKey(CARNIVAL_APPLY_JOURNAL_STORAGE_KEY, authenticatedEmail);
    let carnivalApplyJournal: CarnivalApplyJournal | null = null;
    let carnivalApplyCommitted = false;
    let stagedCarnivalProfileUpdates: Record<string, unknown> = {};

    type RoyalCelebrityApplySnapshot = {
      offers: any[];
      cruises: any[];
      bookedCruises: any[];
      profile: Record<string, any> | null;
      extendedLoyaltyRaw: string | null;
      manualClubRoyaleRaw: string | null;
      manualCrownAnchorRaw: string | null;
      usersRaw: string | null;
    };
    let royalCelebrityApplySnapshot: RoyalCelebrityApplySnapshot | null = null;
    let royalCelebrityApplyMutated = false;

    const restoreRawStorageValue = async (key: string, value: string | null): Promise<void> => {
      if (value === null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, value);
    };

    const restoreRoyalCelebrityProfileSnapshot = async (snapshot: Record<string, any> | null): Promise<void> => {
      if (!snapshot?.id || !updateUserProfile) return;
      await updateUserProfile(snapshot.id, {
        name: snapshot.name ?? '',
        displayName: snapshot.displayName ?? '',
        preferredBrand: snapshot.preferredBrand ?? 'royal',
        clubRoyaleId: snapshot.clubRoyaleId ?? '',
        clubRoyaleTier: snapshot.clubRoyaleTier ?? '',
        clubRoyalePoints: snapshot.clubRoyalePoints ?? 0,
        clubRoyaleRelationshipPoints: snapshot.clubRoyaleRelationshipPoints ?? 0,
        clubRoyaleEvaluationPeriodStartDate: snapshot.clubRoyaleEvaluationPeriodStartDate ?? '',
        clubRoyaleEvaluationPeriodEndDate: snapshot.clubRoyaleEvaluationPeriodEndDate ?? '',
        crownAnchorNumber: snapshot.crownAnchorNumber ?? '',
        royalCaribbeanNumber: snapshot.royalCaribbeanNumber ?? '',
        crownAnchorLevel: snapshot.crownAnchorLevel ?? '',
        loyaltyPoints: snapshot.loyaltyPoints ?? 0,
        crownAnchorRelationshipPoints: snapshot.crownAnchorRelationshipPoints ?? 0,
        celebrityCaptainsClubNumber: snapshot.celebrityCaptainsClubNumber ?? '',
        celebrityCaptainsClubLevel: snapshot.celebrityCaptainsClubLevel ?? '',
        celebrityCaptainsClubPoints: snapshot.celebrityCaptainsClubPoints ?? 0,
        celebrityBlueChipId: snapshot.celebrityBlueChipId ?? '',
        celebrityBlueChipTier: snapshot.celebrityBlueChipTier ?? '',
        celebrityBlueChipPoints: snapshot.celebrityBlueChipPoints ?? 0,
        silverseaVenetianNumber: snapshot.silverseaVenetianNumber ?? '',
        silverseaVenetianTier: snapshot.silverseaVenetianTier ?? '',
      } as any);
    };

    const rollbackRoyalCelebrityApply = async (snapshot: RoyalCelebrityApplySnapshot, reason: string): Promise<void> => {
      addLog(`↩️ Royal/Celebrity Apply Sync failed; restoring the complete pre-sync snapshot (${reason})`, 'warning');
      await coreDataContext.setCasinoOffers(snapshot.offers);
      await coreDataContext.setCruises(snapshot.cruises);
      await coreDataContext.setBookedCruises(snapshot.bookedCruises);
      await restoreRawStorageValue(getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail), snapshot.extendedLoyaltyRaw);
      await restoreRawStorageValue(getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail), snapshot.manualClubRoyaleRaw);
      await restoreRawStorageValue(getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail), snapshot.manualCrownAnchorRaw);
      await restoreRawStorageValue(getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail), snapshot.usersRaw);
      await restoreRoyalCelebrityProfileSnapshot(snapshot.profile);
      if (typeof loyaltyContext?.syncFromStorage === 'function') {
        await loyaltyContext.syncFromStorage();
      }
      addLog('✅ Royal/Celebrity rollback restored offers, sailings, bookings/history, loyalty storage, and selected profile state', 'success');
    };

    const persistCarnivalJournal = async (journal: CarnivalApplyJournal): Promise<void> => {
      const validation = validateCarnivalApplyJournal(journal);
      if (!validation.valid) throw new Error(`Carnival apply journal validation failed: ${validation.reason || 'unknown reason'}`);
      await AsyncStorage.setItem(carnivalApplyJournalKey, JSON.stringify(journal));
    };

    const restoreCarnivalProfileSnapshot = async (profileId: string, snapshot: Record<string, unknown> | null): Promise<void> => {
      if (!profileId || !snapshot) return;
      const rollbackFields: Record<string, unknown> = {
        name: snapshot.name ?? '',
        displayName: snapshot.displayName ?? '',
        preferredBrand: snapshot.preferredBrand ?? 'royal',
        carnivalVifpNumber: snapshot.carnivalVifpNumber ?? '',
        carnivalVifpTier: snapshot.carnivalVifpTier ?? '',
        carnivalVifpPoints: snapshot.carnivalVifpPoints ?? 0,
        carnivalCruiseDayPoints: snapshot.carnivalCruiseDayPoints ?? 0,
        carnivalTotalCruises: snapshot.carnivalTotalCruises ?? 0,
        carnivalPlayersClubTier: snapshot.carnivalPlayersClubTier ?? '',
        carnivalPlayersClubPoints: snapshot.carnivalPlayersClubPoints ?? 0,
      };
      if (updateUserProfile) {
        await updateUserProfile(profileId, rollbackFields as any);
        return;
      }
      const scopedUsersKey = getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail);
      const usersRaw = await AsyncStorage.getItem(scopedUsersKey);
      const parsedUsers = usersRaw ? JSON.parse(usersRaw) : null;
      if (!Array.isArray(parsedUsers)) throw new Error('Unable to restore Carnival profile snapshot because stored users are unavailable');
      let restored = false;
      const restoredUsers = parsedUsers.map((user: any) => {
        if (user?.id !== profileId) return user;
        restored = true;
        return { ...user, ...rollbackFields, updatedAt: new Date().toISOString() };
      });
      if (!restored) throw new Error(`Unable to restore Carnival profile ${profileId}; profile was not found`);
      await AsyncStorage.setItem(scopedUsersKey, JSON.stringify(restoredUsers));
    };

    const rollbackCarnivalApply = async (journal: CarnivalApplyJournal, reason: string): Promise<void> => {
      carnivalApplyJournal = updateCarnivalApplyJournal(journal, 'rolling_back', reason);
      await persistCarnivalJournal(carnivalApplyJournal);
      await coreDataContext.setCasinoOffers(journal.before.offers);
      await coreDataContext.setCruises(journal.before.cruises);
      await coreDataContext.setBookedCruises(journal.before.bookedCruises);
      await restoreCarnivalProfileSnapshot(journal.targetProfileId, journal.before.profile);
      await AsyncStorage.removeItem(carnivalApplyJournalKey);
      carnivalApplyJournal = null;
      addLog('↩️ Carnival Apply Sync rollback restored offers, sailings, bookings/history, and the selected profile snapshot', 'success');
    };
    
    try {
      if (syncSource === 'carnival') {
        const storedJournalRaw = await AsyncStorage.getItem(carnivalApplyJournalKey);
        if (storedJournalRaw) {
          const storedJournal = JSON.parse(storedJournalRaw) as CarnivalApplyJournal;
          const validation = validateCarnivalApplyJournal(storedJournal);
          if (!validation.valid) {
            throw new Error(`An invalid Carnival recovery journal is present (${validation.reason || 'unknown reason'}). Data was not changed.`);
          }
          if (storedJournal.status === 'committed') {
            await AsyncStorage.removeItem(carnivalApplyJournalKey);
          } else {
            addLog(`🛡️ Found unfinished Carnival Apply Sync transaction ${storedJournal.transactionId}; restoring its pre-sync snapshot before continuing`, 'warning');
            await rollbackCarnivalApply(storedJournal, 'Automatic recovery before a new Apply Sync');
          }
        }
      }
      if (syncSource !== 'carnival') {
        royalCelebrityApplySnapshot = {
          offers: [...coreDataContext.casinoOffers],
          cruises: [...coreDataContext.cruises],
          bookedCruises: [...coreDataContext.bookedCruises],
          profile: targetProfile ? { ...targetProfile } : null,
          extendedLoyaltyRaw: await AsyncStorage.getItem(getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail)),
          manualClubRoyaleRaw: await AsyncStorage.getItem(getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail)),
          manualCrownAnchorRaw: await AsyncStorage.getItem(getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail)),
          usersRaw: await AsyncStorage.getItem(getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail)),
        };
      }

      console.log('[RoyalCaribbeanSync] Step 1: Setting status to syncing...');
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('🚀 Starting sync to app...', 'info');
      addLog(`Sync target: ${targetSlotLabel}${targetProfile?.name ? ` (${targetProfile.name})` : ''}`, 'info');
      addLog('Travel inventory is shared: offers, available sailings, booked cruises, and completed cruises will be visible to both Main User and Second User. Loyalty IDs/points remain profile-specific.', 'info');
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
      const activeBookedCandidates = normalizedBookedCruises.filter((row) => !isCompletedRecordLike(row));
      const activeBookedCandidatesCount = activeBookedCandidates.length;
      const completedCandidatesCount = completedCandidates.length;
      const liveCompletedRows = completedCandidates.filter((row) => /live|past|my trips/i.test(String(row.sourcePage || ''))).length;
      const storedCompletedRows = completedCandidates.length - liveCompletedRows;
      const royalReportedPastCount = cruiseLine === 'royal_caribbean' ? state.syncCounts?.completedCruises : undefined;
      if (completedCandidates.length > 0 || royalReportedPastCount) {
        addLog(`Completed sync source breakdown: reported past=${royalReportedPastCount ?? 'n/a'}, live=${liveCompletedRows}, stored/history=${storedCompletedRows}, existing=${coreDataContext.bookedCruises.filter((c: any) => isCompletedRecordLike(c)).length}, canonical candidates=${completedCandidates.length}`, 'info');
        if (royalReportedPastCount && completedCandidates.length < royalReportedPastCount) {
          addLog(`⚠️ Completed candidate count ${completedCandidates.length} is below the ${royalReportedPastCount} row(s) reported by extraction; completed-history replacement will remain non-authoritative until reconciliation is complete`, 'warning');
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
      const previewCanonicalBooked = [...preview.bookedCruises.new, ...preview.bookedCruises.updates.map(u => u.updated)];
      const previewCompletedCount = previewCanonicalBooked.filter((c: any) => isCompletedRecordLike(c)).length;
      addLog(`Preview canonical input: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');
      addLog(`Preview canonical input: ${previewCompletedCount} completed/past cruise(s) staged; ${preview.bookedCruises.unchanged.length} existing row(s) preserved separately`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      const step1ApplyMeta = step1CatalogMetaRef.current || {};
      const rowCatalogVisibleCodes = normalizedOffers
        .map((offer: any) => String(offer.catalogVisibleOfferCodes || '').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean))
        .flat();
      const dynamicVisibleOfferCodes = Array.from(new Set((Array.isArray(step1ApplyMeta.offerCodes) && step1ApplyMeta.offerCodes.length ? step1ApplyMeta.offerCodes : rowCatalogVisibleCodes).map((c: string) => String(c || '').trim().toUpperCase()).filter(Boolean)));
      const dynamicVisibleOfferCount = Number.isFinite(Number(step1ApplyMeta.offerCount)) ? Number(step1ApplyMeta.offerCount) : dynamicVisibleOfferCodes.length;
      const rowZeroOfferCodes = normalizedOffers
        .map((offer: any) => String(offer.catalogZeroRowOfferCodes || '').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean))
        .flat();
      const dynamicZeroRowOfferCodes = Array.from(new Set(rowZeroOfferCodes));
      const rowIncompleteOfferCodes = normalizedOffers
        .map((offer: any) => String(offer.catalogIncompleteOfferCodes || '').split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean))
        .flat();
      const dynamicIncompleteOfferCodes = Array.from(new Set(
        (Array.isArray(step1ApplyMeta.incompleteCodes) && step1ApplyMeta.incompleteCodes.length
          ? step1ApplyMeta.incompleteCodes
          : rowIncompleteOfferCodes)
          .map((code: string) => String(code || '').trim().toUpperCase())
          .filter(Boolean),
      ));
      const carnivalOfferCatalogFullyResolved = syncSource !== 'carnival' || (Boolean(step1ApplyMeta.completed) && dynamicIncompleteOfferCodes.length === 0);
      const authoritativeEmptyOfferCatalog = selectedSections.offers && Boolean(step1ApplyMeta.completed) && dynamicVisibleOfferCount === 0 && normalizedOffers.length === 0;
      if (selectedSections.offers && (dynamicVisibleOfferCount > 0 || authoritativeEmptyOfferCatalog)) {
        addLog(`Dynamic offer catalog metadata for Apply Sync: ${dynamicVisibleOfferCount} visible offer(s), ${dynamicZeroRowOfferCodes.length} zero-row visible offer(s)`, 'info');
      }

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
      const allowOfferRemoval = selectedSections.offers && carnivalOfferCatalogFullyResolved && (authoritativeOfferRows.length > 0 || authoritativeEmptyOfferCatalog);
      const allowCruiseRemoval = selectedSections.availableCruises && carnivalOfferCatalogFullyResolved && (offerRowsWithSailings.length > 0 || authoritativeEmptyOfferCatalog);
      const carnivalLaneAuthority = carnivalLaneAuthorityRef.current;
      const allowActiveBookedCruiseRemoval = selectedSections.bookedCruises && (
        syncSource === 'carnival' ? carnivalLaneAuthority.active : activeBookedCandidatesCount > 0
      );
      const allowCompletedCruiseRemoval = selectedSections.completedCruises && (
        syncSource === 'carnival' ? carnivalLaneAuthority.completed : completedCandidatesCount > 0
      );
      const allowBookedCruiseRemoval = allowActiveBookedCruiseRemoval || allowCompletedCruiseRemoval;

      if (!allowOfferRemoval) {
        const unresolvedSuffix = syncSource === 'carnival' && dynamicIncompleteOfferCodes.length
          ? `; unresolved Carnival code(s): ${dynamicIncompleteOfferCodes.join(', ')}`
          : '';
        addLog(`⚠️ No fully authoritative ${config.loyaltyClubName} offer catalog was captured, so existing offers and available sailings will be preserved${unresolvedSuffix}`, 'warning');
      } else if (!allowCruiseRemoval) {
        addLog(`⚠️ ${config.loyaltyClubName} offers were captured without sailing detail, so existing available sailings will be preserved`, 'warning');
      }
      if (!allowBookedCruiseRemoval) {
        addLog(`⚠️ No booked/completed cruise rows were captured for ${config.name}, so existing booked and completed cruises will be preserved`, 'warning');
      } else {
        addLog(`Booked/completed lane authority: active=${allowActiveBookedCruiseRemoval ? 'authoritative' : 'preserve existing'} (${activeBookedCandidatesCount}), completed=${allowCompletedCruiseRemoval ? 'authoritative' : 'preserve existing'} (${completedCandidatesCount})`, 'info');
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
          allowActiveBookedCruiseRemoval,
          allowCompletedCruiseRemoval,
          targetOwnerProfileId: undefined,
          includeUnownedRecords: true,
          visibleOfferCodes: dynamicVisibleOfferCodes,
          visibleOfferCount: dynamicVisibleOfferCount,
          zeroRowOfferCodes: dynamicZeroRowOfferCodes,
          authoritativeEmptyOfferCatalog,
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
      } else {
        if (!selectedSections.completedCruises || !allowCompletedCruiseRemoval) {
          const existingCompleted = coreDataContext.bookedCruises.filter((c: any) => isCompletedRecordLike(c));
          finalBookedCruises = mergeSharedBookedInventoryRows(finalBookedCruises.filter((c: any) => !isCompletedRecordLike(c)).concat(existingCompleted));
          addLog(`🛡️ ${!selectedSections.completedCruises ? 'Completed cruises not selected' : 'No authoritative completed/history rows captured'}; preserved ${existingCompleted.length} existing completed row(s)`, 'warning');
        }
        if (!selectedSections.bookedCruises || !allowActiveBookedCruiseRemoval) {
          const existingActive = coreDataContext.bookedCruises.filter((c: any) => !isCompletedRecordLike(c));
          finalBookedCruises = mergeSharedBookedInventoryRows(finalBookedCruises.filter((c: any) => isCompletedRecordLike(c)).concat(existingActive));
          addLog(`🛡️ ${!selectedSections.bookedCruises ? 'Booked/upcoming cruises not selected' : 'No authoritative active booked rows captured'}; preserved ${existingActive.length} existing active booked row(s)`, 'warning');
        }
      }
      console.log('[RoyalCaribbeanSync] Data healing:', {
        cruisesHealed: healingReport.cruisesHealed,
        offersHealed: healingReport.offersHealed,
        fieldsFixed: healingReport.fieldsFixed.length,
      });
      if (healingReport.fieldsFixed.length > 0) {
        addLog(`Data healing fixed ${healingReport.fieldsFixed.length} field(s)`, 'info');
      }

      finalBookedCruises = mergeSharedBookedInventoryRows(finalBookedCruises);

      if (syncSource === 'carnival') {
        stagedCarnivalProfileUpdates = selectedSections.loyalty
          ? buildCarnivalProfileUpdates(carnivalUserDataRef.current, targetProfile)
          : {};
        if (Object.keys(stagedCarnivalProfileUpdates).length > 0 && (!targetProfile?.id || !updateUserProfile)) {
          throw new Error('Carnival loyalty/profile changes require a selected profile and an available profile persistence function before transactional Apply Sync can begin');
        }
        carnivalApplyJournal = createCarnivalApplyJournal({
          transactionId: `carnival-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          targetProfileId: targetProfile?.id || '',
          selectedSections,
          before: {
            offers: coreDataContext.casinoOffers,
            cruises: coreDataContext.cruises,
            bookedCruises: coreDataContext.bookedCruises,
            profile: targetProfile ? { ...targetProfile } as Record<string, unknown> : null,
          },
          after: {
            offers: finalOffers,
            cruises: finalCruises,
            bookedCruises: finalBookedCruises,
            profileUpdates: stagedCarnivalProfileUpdates,
          },
        });
        await persistCarnivalJournal(carnivalApplyJournal);
        carnivalApplyJournal = updateCarnivalApplyJournal(carnivalApplyJournal, 'applying');
        await persistCarnivalJournal(carnivalApplyJournal);
        addLog(`🧾 Carnival transactional Apply Sync journal staged (${carnivalApplyJournal.transactionId}); recovery snapshot retained until every required write succeeds`, 'info');
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
        if (syncSource !== 'carnival') royalCelebrityApplyMutated = true;
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
        if (syncSource !== 'carnival') royalCelebrityApplyMutated = true;
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
      if (syncSource === 'royal' && selectedSections.completedCruises) {
        const extractedCompletedCount = extractedBookedCruisesRef.current.filter((c: any) => isCompletedRecordLike(c)).length;
        addLog(`🔎 Royal completed-history reconciliation: ${extractedCompletedCount} extracted → ${finalCompletedCruises.length} canonical row(s) before persistence`, extractedCompletedCount === finalCompletedCruises.length ? 'success' : 'info');
      }
      addLog(`Setting ${finalActiveBookedCruises.length} active booked cruise(s) and ${finalCompletedCruises.length} completed cruise(s) in app (${finalBookedCruises.length} total including history)`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setBookedCruises()...');
        if (syncSource !== 'carnival') royalCelebrityApplyMutated = true;
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
          const authoritativeClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi;
          if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyalePoints') && typeof authoritativeClubRoyalePoints === 'number' && Number.isFinite(authoritativeClubRoyalePoints)) {
            if (authoritativeClubRoyalePoints !== loyaltyContext.clubRoyalePoints) {
              addLog(`Updating Club Royale points: ${loyaltyContext.clubRoyalePoints} → ${authoritativeClubRoyalePoints}`, 'info');
              await loyaltyContext.setManualClubRoyalePoints(authoritativeClubRoyalePoints);
            }
          } else if (preview.loyalty.clubRoyalePoints.changed) {
            addLog('🛡️ Club Royale points differed in the preview but were not written because the field was not authoritative in this run', 'warning');
          }

          const authoritativeCrownAnchorPoints = effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi;
          if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorPoints') && typeof authoritativeCrownAnchorPoints === 'number' && Number.isFinite(authoritativeCrownAnchorPoints)) {
            if (authoritativeCrownAnchorPoints !== loyaltyContext.crownAnchorPoints) {
              addLog(`Updating Crown & Anchor points: ${loyaltyContext.crownAnchorPoints} → ${authoritativeCrownAnchorPoints}`, 'info');
              await loyaltyContext.setManualCrownAnchorPoints(authoritativeCrownAnchorPoints);
            }
          } else if (preview.loyalty.crownAndAnchorPoints.changed) {
            addLog('🛡️ Crown & Anchor points differed in the preview but were not written because the field was not authoritative in this run', 'warning');
          }
        } catch (loyaltyError) {
          console.error('[RoyalCaribbeanSync] Error updating loyalty points:', loyaltyError);
          addLog(`❌ Loyalty points transaction failed: ${String(loyaltyError)}`, 'error');
          throw loyaltyError;
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
          
          royalCelebrityApplyMutated = true;
          await loyaltyContext.setExtendedLoyaltyData(effectiveExtendedLoyalty);
          addLog('Extended loyalty data synced successfully', 'success');
        } catch (extLoyaltyError) {
          console.error('[RoyalCaribbeanSync] Error syncing extended loyalty:', extLoyaltyError);
          addLog(`❌ Extended loyalty transaction failed: ${String(extLoyaltyError)}`, 'error');
          throw extLoyaltyError;
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
            const syncedClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi;
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyalePoints') && typeof syncedClubRoyalePoints === 'number' && Number.isFinite(syncedClubRoyalePoints)) {
              profileUpdates.clubRoyalePoints = syncedClubRoyalePoints;
              addLog(`  → Club Royale points: ${syncedClubRoyalePoints.toLocaleString()}`, 'info');
            }

            const syncedClubRoyaleTier = effectiveExtendedLoyalty?.clubRoyaleTierFromApi;
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleTier') && syncedClubRoyaleTier && syncedClubRoyaleTier.trim().length > 0) {
              profileUpdates.clubRoyaleTier = syncedClubRoyaleTier.trim();
              addLog(`  → Club Royale tier: ${syncedClubRoyaleTier.trim()}`, 'info');
            }

            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleId') && effectiveExtendedLoyalty?.clubRoyaleId) {
              profileUpdates.clubRoyaleId = effectiveExtendedLoyalty.clubRoyaleId;
              addLog('  → Club Royale ID: [redacted]', 'info');
            }
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleRelationshipPoints') && effectiveExtendedLoyalty?.clubRoyaleRelationshipPointsFromApi !== undefined) {
              profileUpdates.clubRoyaleRelationshipPoints = effectiveExtendedLoyalty.clubRoyaleRelationshipPointsFromApi;
              addLog(`  → Club Royale relationship points: ${effectiveExtendedLoyalty.clubRoyaleRelationshipPointsFromApi.toLocaleString()}`, 'info');
            }
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleEvaluationPeriodStartDate') && effectiveExtendedLoyalty?.clubRoyaleEvaluationPeriodStartDate) {
              profileUpdates.clubRoyaleEvaluationPeriodStartDate = effectiveExtendedLoyalty.clubRoyaleEvaluationPeriodStartDate;
            }
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleEvaluationPeriodEndDate') && effectiveExtendedLoyalty?.clubRoyaleEvaluationPeriodEndDate) {
              profileUpdates.clubRoyaleEvaluationPeriodEndDate = effectiveExtendedLoyalty.clubRoyaleEvaluationPeriodEndDate;
            }

            const cAndAId = effectiveExtendedLoyalty?.crownAndAnchorId;
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorId') && cAndAId && cAndAId.trim().length > 0) {
              profileUpdates.crownAnchorNumber = cAndAId.trim();
              profileUpdates.royalCaribbeanNumber = cAndAId.trim();
              addLog('  → Crown & Anchor #: [redacted]', 'info');
            }

            const hasAuthoritativeCrownAndAnchor = hasAuthoritativeCrownAndAnchorData(effectiveExtendedLoyalty);
            const syncedCrownAnchorPoints = effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi;
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorPoints') && typeof syncedCrownAnchorPoints === 'number' && Number.isFinite(syncedCrownAnchorPoints)) {
              profileUpdates.loyaltyPoints = syncedCrownAnchorPoints;
              addLog(`  → Crown & Anchor points: ${syncedCrownAnchorPoints.toLocaleString()}`, 'info');
            }

            const cAndALevel = effectiveExtendedLoyalty?.crownAndAnchorTier;
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorTier') && cAndALevel && cAndALevel.trim().length > 0) {
              profileUpdates.crownAnchorLevel = cAndALevel.trim();
              addLog(`  → Crown & Anchor level: ${cAndALevel.trim()}`, 'info');
            }
            if (hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorRelationshipPoints') && effectiveExtendedLoyalty?.crownAndAnchorRelationshipPointsFromApi !== undefined) {
              profileUpdates.crownAnchorRelationshipPoints = effectiveExtendedLoyalty.crownAndAnchorRelationshipPointsFromApi;
              addLog(`  → Crown & Anchor relationship points: ${effectiveExtendedLoyalty.crownAndAnchorRelationshipPointsFromApi.toLocaleString()}`, 'info');
            }
            if (!hasAuthoritativeCrownAndAnchor) {
              addLog('  → Crown & Anchor lane remained incomplete; only individually authoritative C&A fields were updated and all others were preserved', 'warning');
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
            const usersStorageKey = getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail);
            const persistedUsersRaw = await AsyncStorage.getItem(usersStorageKey);
            const persistedUsers = persistedUsersRaw ? JSON.parse(persistedUsersRaw) as Array<Record<string, unknown>> : [];
            const persistedProfile = persistedUsers.find((candidate) => candidate.id === targetProfile.id);
            const mismatches = Object.entries(profileUpdates).filter(([key, value]) => persistedProfile?.[key] !== value);
            if (mismatches.length > 0) {
              throw new Error(`Loyalty/profile readback mismatch for: ${mismatches.map(([key]) => key).join(', ')}`);
            }
            addLog(`✅ ${targetSlotLabel} profile updated and verified from storage`, 'success');
          } else {
            addLog('ℹ️ No passenger or loyalty profile fields found to update', 'info');
          }
        } catch (profileSyncError) {
          console.error('[RoyalCaribbeanSync] Error syncing user profile:', profileSyncError);
          addLog(`❌ User profile loyalty transaction failed: ${String(profileSyncError)}`, 'error');
          throw profileSyncError;
        }
      }

      if (syncSource !== 'carnival' && typeof coreDataContext.syncToBackend === 'function') {
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

      if (cruiseLine === 'carnival') {
        if (!selectedSections.loyalty) {
          addLog('🛡️ Carnival loyalty/profile sync was not selected; existing VIFP and Players Club values were preserved', 'warning');
        } else if (Object.keys(stagedCarnivalProfileUpdates).length > 0) {
          const carnivalData = carnivalUserDataRef.current;
          addLog('Syncing Carnival VIFP / Players Club loyalty data as a required part of the transactional apply...', 'info');
          try {
            if (!targetProfile?.id || !updateUserProfile) {
              throw new Error('The staged Carnival profile transaction lost its selected target profile before commit');
            }
            await updateUserProfile(targetProfile.id, stagedCarnivalProfileUpdates as any);

            const vifpSummary = carnivalData && (carnivalData.hasVifpData || carnivalData.vifpNumber)
              ? `VIFP ${carnivalData.vifpTier || 'Unknown'} #${carnivalData.vifpNumber || 'N/A'} (${carnivalData.vifpPoints || 0} pts)`
              : 'VIFP unchanged';
            const playersSummary = carnivalData && (carnivalData.hasPlayersClubData || carnivalData.playersClubTier || carnivalData.playersClubPoints > 0)
              ? `Players Club ${carnivalData.playersClubTier || 'Unknown'} (${carnivalData.playersClubPoints || 0} pts)`
              : 'Players Club unchanged';
            addLog(`✅ Carnival loyalty/profile transaction write succeeded: ${vifpSummary}; ${playersSummary}`, 'success');
          } catch (carnivalLoyaltyError) {
            throw new Error(`Carnival loyalty/profile persistence failed: ${carnivalLoyaltyError instanceof Error ? carnivalLoyaltyError.message : String(carnivalLoyaltyError)}`);
          }
        } else {
          addLog('ℹ️ Carnival did not expose new loyalty/profile values; the selected profile was left unchanged', 'info');
        }

        if (!carnivalApplyJournal) {
          throw new Error('Carnival transactional apply journal was not available at commit time');
        }
        carnivalApplyJournal = updateCarnivalApplyJournal(carnivalApplyJournal, 'committed');
        await persistCarnivalJournal(carnivalApplyJournal);
        carnivalApplyCommitted = true;
        addLog(`✅ Carnival transactional Apply Sync committed (${carnivalApplyJournal.transactionId})`, 'success');

        try {
          await AsyncStorage.removeItem(getUserScopedKey(CARNIVAL_CHECKPOINT_STORAGE_KEY, authenticatedEmail));
          await AsyncStorage.removeItem(getUserScopedKey(CARNIVAL_LEGACY_CHECKPOINT_STORAGE_KEY, authenticatedEmail));
          addLog('🧹 Carnival account-bound resume checkpoint cleared after the full transaction committed', 'info');
        } catch (checkpointCleanupError) {
          addLog(`⚠️ Carnival transaction committed, but the resume checkpoint could not be cleared: ${String(checkpointCleanupError)}`, 'warning');
        }

        try {
          await AsyncStorage.removeItem(carnivalApplyJournalKey);
          carnivalApplyJournal = null;
          addLog('🧹 Carnival recovery journal cleared after all required local and profile writes succeeded', 'info');
        } catch (journalCleanupError) {
          addLog(`⚠️ Carnival transaction committed, but its committed recovery journal could not be removed: ${String(journalCleanupError)}`, 'warning');
        }

        if (typeof coreDataContext.syncToBackend === 'function') {
          if (!isCloudBackupEnabled()) {
            addLog('Local-first mode: cloud backup skipped after committed Carnival Apply Sync', 'info');
          } else {
            try {
              const selectedDataHash = `${finalOffers.length}:${finalCruises.length}:${finalBookedCruises.length}:${selectedSections.offers}-${selectedSections.availableCruises}-${selectedSections.bookedCruises}-${selectedSections.completedCruises}-${selectedSections.loyalty}`;
              addLog(`Flushing committed Carnival data to backend (datasetHash ${selectedDataHash})...`, 'info');
              await coreDataContext.syncToBackend();
              addLog('✅ Backend sync completed for committed Carnival data', 'success');
            } catch (backendSyncError) {
              addLog(`⚠️ Carnival local transaction committed, but cloud backup failed: ${String(backendSyncError)}`, 'warning');
            }
          }
        }
      }

      let committedCarnivalManifest = carnivalManifestRef.current;
      if (cruiseLine === 'carnival' && committedCarnivalManifest) {
        const terminalStatus: CarnivalSyncTerminalStatus = committedCarnivalManifest.incompleteCodes.length > 0 || committedCarnivalManifest.failedCodes.length > 0
          ? 'partial_resumable'
          : 'complete';
        committedCarnivalManifest = buildCarnivalSyncManifest({
          ...committedCarnivalManifest,
          terminalStatus,
          appliedAt: new Date().toISOString(),
        });
        carnivalManifestRef.current = committedCarnivalManifest;
        await AsyncStorage.setItem(getUserScopedKey(ALL_STORAGE_KEYS.CARNIVAL_SYNC_MANIFEST, authenticatedEmail), JSON.stringify(committedCarnivalManifest));
        addLog(terminalStatus === 'complete'
          ? '✅ Carnival manifest committed as complete with unique, explainable counts.'
          : '⚠️ Carnival data was applied without deleting unresolved inventory; the manifest remains partial/resumable.', terminalStatus === 'complete' ? 'success' : 'warning');
      }

      console.log('[RoyalCaribbeanSync] Setting terminal sync status...');
      addLog(committedCarnivalManifest?.terminalStatus === 'partial_resumable' ? '⚠️ Resolved Carnival data synced; unresolved codes remain resumable.' : '✅ Data synced successfully to app!', committedCarnivalManifest?.terminalStatus === 'partial_resumable' ? 'warning' : 'success');
      
      // Set complete status immediately - don't wait for refresh
      setState(prev => ({ 
        ...prev, 
        status: committedCarnivalManifest?.terminalStatus === 'partial_resumable' ? 'partial' : 'complete',
        carnivalManifest: committedCarnivalManifest,
        carnivalCodeLedger: committedCarnivalManifest?.codeLedger ?? prev.carnivalCodeLedger,
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
      if (syncSource !== 'carnival' && royalCelebrityApplySnapshot && royalCelebrityApplyMutated) {
        try {
          await rollbackRoyalCelebrityApply(royalCelebrityApplySnapshot, errorMessage);
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          console.error('[RoyalCaribbeanSync] Royal/Celebrity rollback failed:', rollbackError);
          addLog(`❌ Royal/Celebrity rollback could not finish: ${rollbackMessage}`, 'error');
        }
      }
      if (syncSource === 'carnival' && carnivalApplyJournal && !carnivalApplyCommitted) {
        try {
          addLog(`↩️ Carnival Apply Sync failed before commit; rolling back transaction ${carnivalApplyJournal.transactionId}`, 'warning');
          await rollbackCarnivalApply(carnivalApplyJournal, errorMessage);
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          console.error('[CarnivalSync] Transaction rollback failed:', rollbackError);
          try {
            if (carnivalApplyJournal) {
              carnivalApplyJournal = updateCarnivalApplyJournal(carnivalApplyJournal, 'rolling_back', `${errorMessage}; rollback failed: ${rollbackMessage}`);
              await AsyncStorage.setItem(carnivalApplyJournalKey, JSON.stringify(carnivalApplyJournal));
            }
          } catch (journalError) {
            console.error('[CarnivalSync] Could not preserve failed rollback journal:', journalError);
          }
          addLog(`❌ Carnival rollback could not finish: ${rollbackMessage}. The recovery journal was retained for the next Apply Sync.`, 'error');
        }
      }
      console.log('[RoyalCaribbeanSync] Setting status to error...');
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
      addLog(`❌ Sync failed: ${errorMessage}`, 'error');
      addLog('Please try again or contact support if the issue persists', 'error');
    } finally {
      syncToAppInFlightRef.current = false;
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, state.syncCounts, extendedLoyaltyData, addLog, cruiseLine, authenticatedEmail, currentUser, users, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows]);

  const cancelSync = useCallback((requestedReason?: unknown) => {
    const reason = typeof requestedReason === 'string' && requestedReason.trim()
      ? requestedReason.trim()
      : 'Cancelled by user';
    carnivalCancelReasonRef.current = reason;
    navigationRequestIdRef.current += 1;
    pendingNavigationTargetRef.current = null;
    pendingNavigationLabelRef.current = '';
    pageLoadResolver.current = null;
    carnivalCatalogResolverRef.current = null;
    carnivalSearchResolverRef.current = null;
    carnivalProfileResolverRef.current = null;
    carnivalAbortControllerRef.current?.abort();
    ingestionInFlightRef.current = false;
    const nextStatus: SyncStatus = cruiseLine === 'carnival' ? 'cancelled' : 'logged_in';
    setState(prev => ({ ...prev, status: nextStatus, currentStep: '', progress: null, syncCounts: null, error: reason }));
    addLog(`${cruiseLine === 'carnival' ? 'Carnival ' : ''}sync cancelled: ${reason}`, 'warning');
  }, [addLog, cruiseLine]);

  

  return useMemo(() => ({
    state,
    webViewRef,
    cruiseLine,
    setCruiseLine,
    config,
    openLogin,
    confirmCarnivalLogin,
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
    onPageLoadStarted,
    onPageLoaded
  }), [
    state, webViewRef, cruiseLine, setCruiseLine, config, openLogin, confirmCarnivalLogin, runIngestion,
    exportOffersCSV, exportBookedCruisesCSV, exportLog, resetState, syncToApp,
    cancelSync, handleWebViewMessage, addLog, extendedLoyaltyData, setExtendedLoyalty,
    staySignedIn, toggleStaySignedIn, webViewUrl, onPageLoadStarted, onPageLoaded
  ]);
});

export function CarnivalSyncProvider({ children }: { children: ReactNode }) {
  return (
    <InitialCruiseLineContext.Provider value="carnival">
      <RoyalCaribbeanSyncProvider>{children}</RoyalCaribbeanSyncProvider>
    </InitialCruiseLineContext.Provider>
  );
}
