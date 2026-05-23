import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect, useContext, createContext, useMemo, ReactNode } from 'react';
import { WebView } from 'react-native-webview';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getUserScopedKey, ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';
import { useUser } from './UserProvider';
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
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape, injectCarnivalTgoExtract } from '@/lib/carnival/carnivalOffersExtraction';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import { parseCasinoOffersPayload } from '@/lib/royalCaribbean/offerPayloadParser';
import { healImportedData } from '@/lib/dataHealing';
import { isActiveBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';

export type CruiseLine = 'royal_caribbean' | 'celebrity' | 'carnival';

export const CRUISE_LINE_CONFIG = {
  royal_caribbean: {
    name: 'Royal Caribbean',
    loginUrl: 'https://www.royalcaribbean.com/club-royale',
    offersUrl: 'https://www.royalcaribbean.com/club-royale/offers',
    upcomingUrl: 'https://www.royalcaribbean.com/myaccount',
    holdsUrl: 'https://www.royalcaribbean.com/account/courtesy-holds',
    loyaltyClubName: 'Club Royale',
    loyaltyPageUrl: 'https://www.royalcaribbean.com/account/loyalty-programs',
  },
  celebrity: {
    name: 'Celebrity Cruises',
    loginUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    offersUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    upcomingUrl: 'https://www.celebritycruises.com/account/upcoming-cruises',
    holdsUrl: 'https://www.celebritycruises.com/account/courtesy-holds',
    loyaltyClubName: 'Blue Chip Club',
    loyaltyPageUrl: 'https://www.celebritycruises.com/account/loyalty',
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


function normalizeRoyalCompactDate(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}${compact[2]}${compact[3]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return raw;
}

function getRoyalLoyaltyHistorySailings(data: any): any[] {
  const payload = data?.payload || data?.data || data;
  const candidates = [
    payload?.sailings,
    payload?.sailingHistory,
    payload?.cruiseHistory,
    payload?.completedSailings,
    payload?.pastSailings,
    payload?.pastCruises,
    payload?.completedCruises,
    payload?.history,
    data?.sailings,
    data?.sailingHistory,
    data?.cruiseHistory,
    data?.completedSailings,
    data?.pastSailings,
    data?.pastCruises,
    data?.completedCruises,
    data?.payload?.sailings,
    data?.data?.sailings,
  ];

  const isPlausibleSailing = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    const ship = item.shipCode || item.ship || item.shipCd || item.shipName || item.shipDescription || item.shipDisplayName || item.shipLongName || item.vesselName;
    const date = item.sailDate || item.departureDate || item.startDate || item.sailingDate || item.date || item.voyageStartDate || item.embarkDate || item.embarkationDate;
    return Boolean(ship && date);
  };

  const normalizeArray = (candidate: any): any[] => Array.isArray(candidate) ? candidate.filter(isPlausibleSailing) : [];

  for (const candidate of candidates) {
    const rows = normalizeArray(candidate);
    if (rows.length > 0) return rows;
  }

  // Royal has changed this payload shape multiple times. The old successful sync
  // worked because it captured a nested loyalty/cruise history array, not because
  // it was always located at payload.sailings. Walk the whole payload and keep the
  // largest array that looks like real ship/date sailing history.
  const seen = new Set<any>();
  let best: any[] = [];
  const walk = (value: any, depth: number = 0) => {
    if (!value || depth > 9 || seen.has(value)) return;
    if (typeof value === 'object') seen.add(value);
    if (Array.isArray(value)) {
      const rows = normalizeArray(value);
      if (rows.length > best.length) best = rows;
      value.forEach((child) => walk(child, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        const lower = key.toLowerCase();
        if (
          lower.includes('sailing') ||
          lower.includes('cruise') ||
          lower.includes('history') ||
          lower.includes('loyalty') ||
          lower.includes('past') ||
          lower.includes('completed') ||
          lower === 'payload' ||
          lower === 'data' ||
          lower === 'items' ||
          lower === 'results'
        ) {
          walk(child, depth + 1);
        }
      });
    }
  };
  walk(data);
  return best;
}

function convertRoyalLoyaltyHistorySailingsToCompletedRows(sailings: any[]): BookedCruiseRow[] {
  const RC_SHIP_CODE_MAP: Record<string, string> = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
    'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
    'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
    'LB': 'Liberty of the Seas', 'LE': 'Legend of the Seas', 'MJ': 'Majesty of the Seas',
    'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas',
    'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas',
    'RD': 'Radiance of the Seas', 'RH': 'Rhapsody of the Seas', 'SE': 'Serenade of the Seas',
    'SP': 'Spectrum of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas',
    'MN': 'Monarch of the Seas', 'MA': 'Majesty of the Seas', 'ST': 'Star of the Seas'
  };
  const prettyShip = (ship: string): string => ship ? ship.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf\b/g, 'of') : '';
  return sailings.map((sailing: any, index: number) => {
    const shipCode = String(sailing.shipCode || sailing.ship || sailing.shipCd || '').trim().toUpperCase();
    const shipName = prettyShip(String(sailing.shipName || sailing.shipDescription || sailing.shipDisplayName || sailing.shipLongName || RC_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship')));
    const sailDate = normalizeRoyalCompactDate(sailing.sailDate || sailing.departureDate || sailing.startDate || sailing.sailingDate || sailing.date || sailing.voyageStartDate);
    const cabinCategory = String(sailing.stateroomCategoryCode || sailing.categoryCode || sailing.cabinCategory || sailing.stateroomType || sailing.roomType || '').trim();
    const cabinNumber = String(sailing.stateroomNumber || sailing.cabinNumber || sailing.roomNumber || sailing.cabin || '').trim();
    const bookingId = String(sailing.bookingId || sailing.reservationId || sailing.reservationNumber || sailing.confirmationNumber || `completed_${shipCode || shipName}_${sailDate}_${index}`).trim();
    return {
      rawBooking: sailing,
      sourcePage: 'Completed',
      shipName,
      shipCode: shipCode || undefined,
      cruiseTitle: sailing.cruiseTitle || sailing.itineraryName || sailing.packageDescription || 'Completed Cruise',
      sailingStartDate: sailDate,
      sailingEndDate: normalizeRoyalCompactDate(sailing.endDate || sailing.returnDate || sailing.sailingEndDate || sailing.voyageEndDate),
      sailingDates: sailDate,
      itinerary: String(sailing.itinerary || sailing.itineraryName || sailing.destination || sailing.packageDescription || '').trim(),
      departurePort: String(sailing.departurePort || sailing.homePort || sailing.embarkPort || sailing.embarkationPort || '').trim(),
      arrivalPort: String(sailing.arrivalPort || sailing.debarkPort || '').trim(),
      cabinType: cabinCategory,
      cabinCategory,
      cabinNumberOrGTY: cabinNumber || 'GTY',
      deckNumber: String(sailing.deckNumber || '').trim(),
      bookingId,
      numberOfGuests: String(sailing.numberOfGuests || sailing.guestCount || '1'),
      numberOfNights: Number(sailing.numberOfNights || sailing.nights || sailing.duration || sailing.nightCount || 0) || 0,
      daysToGo: '',
      status: 'Completed',
      loyaltyLevel: '',
      loyaltyPoints: String(sailing.points || sailing.cruisePoints || sailing.pointValue || sailing.tierCredits || ''),
      paidInFull: undefined,
      balanceDue: undefined,
      musterStation: undefined,
      holdExpiration: undefined,
      bookingStatus: 'Completed',
      packageCode: String(sailing.packageCode || '').trim(),
      passengerStatus: String(sailing.passengerStatus || '').trim(),
      stateroomNumber: cabinNumber,
      stateroomCategoryCode: cabinCategory,
      stateroomType: cabinCategory,
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
  const { currentUser, updateUser: updateUserProfile } = useUser();
  const carnivalUserDataRef = useRef<{ vifpNumber: string; vifpTier: string; firstName: string; lastName: string } | null>(null);
  const extractedOffersRef = useRef<OfferRow[]>([]);
  const extractedBookedCruisesRef = useRef<BookedCruiseRow[]>([]);
  const webViewRef = useRef<WebView | null>(null);
  const hasReceivedApiLoyaltyDataRef = useRef(false);
  const lastAuthenticatedEmailRef = useRef<string | null>(authenticatedEmail);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  const capturedSections = useRef({ offers: false, bookings: false, loyalty: false });
  const pageLoadResolver = useRef<((loadedUrl?: string) => void) | null>(null);
  const offerSailingsResolver = useRef<((sailings: OfferRow[]) => void) | null>(null);
  const carnivalPageCheckResolver = useRef<((onOffers: boolean) => void) | null>(null);
  const carnivalTgoDataResolver = useRef<((data: { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> }) => void) | null>(null);
  const navigationRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  const syncToAppInFlightRef = useRef<boolean>(false);
  const ingestionInFlightRef = useRef<boolean>(false);
  const completedCruisesSyncInProgressRef = useRef<boolean>(false);
  const cachedRoyalLoyaltyHistoryPayloadRef = useRef<any | null>(null);
  const logFlushScheduledRef = useRef<boolean>(false);
  const providerMountedRef = useRef<boolean>(true);
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];
  const [webViewUrl, setWebViewUrl] = useState<string>(CRUISE_LINE_CONFIG[initialCruiseLine].loginUrl);

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
        sailingDate: stringifyValue(row.sailingDate),
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

      const normalizeTextKey = (text: string | undefined): string => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const normalizeDateKey = (text: string | undefined): string => {
        const raw = String(text || '').trim();
        if (!raw) return '';
        const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
        const mdY = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
        if (mdY) {
          const year = mdY[3].length === 2 ? `20${mdY[3]}` : mdY[3];
          return `${year}-${mdY[1].padStart(2, '0')}-${mdY[2].padStart(2, '0')}`;
        }
        const parsed = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
          return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        }
        return normalizeTextKey(raw);
      };
      const normalizedOfferCode = normalizeTextKey(normalizedRow.offerCode || normalizedRow.offerName);
      const dedupeKey = [
        // Real offer-row uniqueness is Offer Code + Ship + Sail Date + Itinerary + Cabin + Guests.
        // Do NOT include sourcePage, offerName, expiration, or offerType here: those can vary
        // between DOM/network/payload sweeps and were inflating counts (e.g. 201 -> 255 / 54 -> 108).
        normalizedOfferCode,
        normalizeTextKey(normalizedRow.shipName),
        normalizeDateKey(normalizedRow.sailingDate),
        normalizeTextKey(normalizedRow.itinerary),
        normalizeTextKey(normalizedRow.cabinType),
        normalizeTextKey(normalizedRow.numberOfGuests),
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
        sailingStartDate: stringifyValue(row.sailingStartDate),
        sailingEndDate: stringifyValue(row.sailingEndDate),
        sailingDates: stringifyValue(row.sailingDates) || stringifyValue(row.sailingStartDate),
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

  const onPageLoaded = useCallback((eventOrUrl?: unknown) => {
    const loadedUrl = typeof eventOrUrl === 'string'
      ? eventOrUrl
      : typeof eventOrUrl === 'object' && eventOrUrl !== null && 'nativeEvent' in eventOrUrl
        ? String((eventOrUrl as { nativeEvent?: { url?: string } }).nativeEvent?.url || '')
        : '';

    console.log('[RoyalCaribbeanSync] Page finished loading:', loadedUrl || '(unknown URL)');

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
  }, [matchesNavigationTarget]);

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
            console.log(`[RoyalCaribbeanSync] Batch received: ${batch.length} items, total now: ${newOffers.length}`);
            
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
            extractedBookedCruisesRef.current = newCruises;
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
          
          const formattedCruises = msg.bookings.map((booking: any) => {
            const sailDate = booking.sailDate || booking.departureDate || '';
            const bStatus = booking.bookingStatus || 'BK';
            const status = getBookingStatus(sailDate, bStatus);
            let shipName = booking.shipName || '';
            if (!shipName && booking.shipCode) {
              shipName = isCarnivalBookings ? `Carnival ${booking.shipCode}` : `${booking.shipCode} of the Seas`;
            }
            const nights = booking.numberOfNights || booking.duration || 0;
            return {
              rawBooking: booking,
              sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
              shipName,
              shipCode: booking.shipCode || '',
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
              extractedBookedCruises: (() => {
                const newCruises = [...prev.extractedBookedCruises, ...deduped];
                extractedBookedCruisesRef.current = newCruises;
                return newCruises;
              })()
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
          const converted = convertLoyaltyInfoToExtended(loyaltyInfo, '');
          setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, converted));
          hasReceivedApiLoyaltyDataRef.current = true;
          
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              clubRoyaleTier: converted.clubRoyaleTierFromApi,
              clubRoyalePoints: converted.clubRoyalePointsFromApi?.toString(),
              crownAndAnchorLevel: converted.crownAndAnchorTier,
              crownAndAnchorPoints: converted.crownAndAnchorPointsFromApi?.toString(),
            }
          }));
          
          capturedSections.current.loyalty = true;
          addLog('✅ Captured loyalty data from Royal Caribbean API', 'success');
          if (converted.clubRoyalePointsFromApi !== undefined) {
            addLog(`   🎰 Club Royale Status`, 'success');
            addLog(`   📊 Tier: "${converted.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
          }
          if (converted.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`   ⚓ Crown & Anchor Society`, 'success');
            addLog(`   📊 Level: "${converted.crownAndAnchorTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.crownAndAnchorPointsFromApi.toLocaleString()}`, 'success');
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
        const converted = convertLoyaltyInfoToExtended(extData, msg.accountId);
        setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, converted));
        
        // Mark that we've received API data - this takes precedence over DOM scraping
        hasReceivedApiLoyaltyDataRef.current = true;
        
        setState(prev => ({
          ...prev,
          loyaltyData: {
            ...(prev.loyaltyData ?? {}),
            clubRoyaleTier: converted.clubRoyaleTierFromApi,
            clubRoyalePoints: converted.clubRoyalePointsFromApi?.toString(),
            crownAndAnchorLevel: converted.crownAndAnchorTier,
            crownAndAnchorPoints: converted.crownAndAnchorPointsFromApi?.toString(),
          }
        }));
        
        capturedSections.current.loyalty = true;
        addLog('✅ Captured loyalty data from API (authoritative source)', 'success');
        if (converted.clubRoyalePointsFromApi !== undefined) {
          addLog(`   🎰 Club Royale Status`, 'success');
          addLog(`   📊 Tier: "${converted.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.clubRoyalePointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (converted.crownAndAnchorPointsFromApi !== undefined) {
          addLog(`   ⚓ Crown & Anchor Society`, 'success');
          addLog(`   📊 Level: "${converted.crownAndAnchorTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.crownAndAnchorPointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (converted.captainsClubPoints !== undefined && converted.captainsClubPoints > 0) {
          addLog(`   🌟 Captain's Club Status`, 'success');
          addLog(`   📊 Tier: "${converted.captainsClubTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.captainsClubPoints ?? 0).toLocaleString()}`, 'success');
        }
        if (converted.celebrityBlueChipPoints !== undefined && converted.celebrityBlueChipPoints > 0) {
          addLog(`   🎲 Blue Chip Club Status`, 'success');
          addLog(`   📊 Tier: "${converted.celebrityBlueChipTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.celebrityBlueChipPoints ?? 0).toLocaleString()}`, 'success');
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
        
        if (endpoint === 'offers' && data && cruiseLine !== 'carnival') {
          addLog('📦 Processing captured casino offers API payload...', 'info');
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

        if (endpoint === 'royalLoyaltyHistory' && data) {
          // OLD WORKING BEHAVIOR RESTORED:
          // The original successful sync captured the full Royal past-cruise history
          // as part of the normal Step 1-4 flow when the loyalty-history payload appeared.
          // Do NOT ignore this payload during Sync Now; cache it and merge the completed
          // rows into extractedBookedCruises immediately. The separate button can still
          // replay the same cached payload later.
          cachedRoyalLoyaltyHistoryPayloadRef.current = data;
          addLog('📦 Processing captured Royal Caribbean loyalty history sailings...', 'info');
          const sailings = getRoyalLoyaltyHistorySailings(data);
          if (sailings.length > 0) {
            const completedRows = convertRoyalLoyaltyHistorySailingsToCompletedRows(sailings).filter(isCompletedBookedCruiseRow);
            setState(prev => {
              const existingKeys = new Set(prev.extractedBookedCruises.map(c => `${c.bookingId}|${c.shipName}|${c.sailingStartDate}`));
              const deduped = completedRows.filter(c => !existingKeys.has(`${c.bookingId}|${c.shipName}|${c.sailingStartDate}`));
              const newCruises = [...prev.extractedBookedCruises, ...deduped];
              extractedBookedCruisesRef.current = newCruises;
              return { ...prev, extractedBookedCruises: newCruises };
            });
            capturedSections.current.bookings = true;
            addLog(`✅ Captured ${completedRows.length} completed/past cruise(s) from loyalty history sailings`, 'success');
            completedRows.forEach((c) => {
              addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${c.numberOfNights || 0} nights) [Completed]`, 'success');
            });
            if (progressCallbacks.current.onProgress) progressCallbacks.current.onProgress();
          } else {
            addLog('⚠️ Loyalty history payload had no sailings array', 'warning');
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
          
          function findBookingArrayDeep(value: any, depth: number = 0): any[] | null {
            if (!value || depth > 6) return null;
            if (Array.isArray(value)) {
              if (value.some((x: any) => x && typeof x === 'object' && (x.shipCode || x.shipName || x.sailDate || x.departureDate || x.bookingId || x.reservationId))) return value;
              for (const item of value) {
                const found = findBookingArrayDeep(item, depth + 1);
                if (found) return found;
              }
              return null;
            }
            if (typeof value !== 'object') return null;
            const preferredKeys = ['profileBookings', 'sailingInfo', 'pastCruises', 'completedCruises', 'cruises', 'bookings', 'reservations', 'items', 'data', 'payload'];
            for (const key of preferredKeys) {
              if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findBookingArrayDeep(value[key], depth + 1);
                if (found) return found;
              }
            }
            for (const key of Object.keys(value)) {
              const found = findBookingArrayDeep(value[key], depth + 1);
              if (found) return found;
            }
            return null;
          }

          // Royal Caribbean API structure: data.payload.sailingInfo / profileBookings, plus newer past/completed shapes
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
          } else if (data.payload && Array.isArray((data.payload as any).pastCruises)) {
            bookings = (data.payload as any).pastCruises;
            addLog(`📦 Processing ${bookings.length} past cruise booking(s) from API response...`, 'info');
          } else if (data.payload && Array.isArray((data.payload as any).completedCruises)) {
            bookings = (data.payload as any).completedCruises;
            addLog(`📦 Processing ${bookings.length} completed cruise booking(s) from API response...`, 'info');
          } else {
            const deepBookings = findBookingArrayDeep(data);
            if (deepBookings) {
              bookings = deepBookings;
              addLog(`📦 Processing ${bookings.length} booking(s) from nested API response...`, 'info');
            } else {
            addLog(`⚠️ Bookings data structure not recognized. Type: ${typeof data}, Keys: ${dataKeys.join(', ')}`, 'warning');
            if (payloadKeys.length > 0) {
              addLog(`📦 Payload keys: ${payloadKeys.join(', ')}`, 'info');
            }
            addLog(`📦 Captured ${endpoint} API payload (UNKNOWN STRUCTURE)`, 'warning');
            break;
            }
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
            
            const RC_SHIP_CODE_MAP: Record<string, string> = {
              'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
              'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
              'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
              'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
              'LB': 'Liberty of the Seas', 'LE': 'Legend of the Seas', 'MJ': 'Majesty of the Seas',
              'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas',
              'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas',
              'RD': 'Radiance of the Seas', 'RH': 'Rhapsody of the Seas', 'SE': 'Serenade of the Seas',
              'SP': 'Spectrum of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
              'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
            };
            
            const STATEROOM_TYPE_MAP: Record<string, string> = {
              'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
            };
            
            function determineCruiseStatus(sailDateStr: string, bookingStatus: string): string {
              const rawStatus = String(bookingStatus || '').toLowerCase();
              if (rawStatus.includes('past') || rawStatus.includes('completed') || rawStatus === 'pc') return 'Completed';
              if (bookingStatus === 'OF') return 'Courtesy Hold';
              if (bookingStatus === 'CX' || bookingStatus === 'XX') return 'Cancelled';
              try {
                const raw = String(sailDateStr || '').trim();
                let sailDate = new Date(raw);
                if (isNaN(sailDate.getTime())) {
                  const ymd = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
                  if (ymd) sailDate = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
                }
                if (isNaN(sailDate.getTime())) {
                  const mdy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/);
                  if (mdy) sailDate = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
                }
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
              } else {
                shipName = booking.shipName || RC_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship');
              }
              const stateroomType = booking.stateroomType || booking.cabinType || booking.categoryType || '';
              const cabinType = STATEROOM_TYPE_MAP[stateroomType] || stateroomType || '';
              
              const stateroomNumber = booking.stateroomNumber || booking.cabinNumber || '';
              const cabinNumber = stateroomNumber === 'GTY' ? '' : stateroomNumber;
              const isGTY = stateroomNumber === 'GTY' || !stateroomNumber;
              const sailDate = booking.sailDate || booking.departureDate || booking.startDate || '';
              const bookingStatus = booking.bookingStatus || booking.status || booking.tripStatus || booking.sailingStatus || booking.reservationStatus || 'BK';
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
              const newCruises = [...prev.extractedBookedCruises, ...deduped];
              extractedBookedCruisesRef.current = newCruises;
              return {
                ...prev,
                extractedBookedCruises: newCruises
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
              const newOffers = [...prev.extractedOffers, ...offerRows];
              extractedOffersRef.current = newOffers;
              return { ...prev, extractedOffers: newOffers };
            });
            capturedSections.current.offers = true;
            addLog('Captured ' + String(offerRows.length) + ' Carnival VIFP offer(s)', 'success');
            offerRows.forEach((o: OfferRow) => {
              addLog('  ' + o.offerName + ' (' + o.offerCode + ')' + (o.interiorPrice ? ' - from ' + o.interiorPrice : ''), 'success');
            });
            if (stepCompleteResolvers.current[1]) {
              stepCompleteResolvers.current[1]();
              delete stepCompleteResolvers.current[1];
            }
          }
        }
        
        if (endpoint === 'loyalty' && data) {
          addLog('Processing captured Loyalty API payload...', 'info');

          // The old successful Sync Now path picked up completed cruises from Royal's
          // loyalty/history payload while normal loyalty traffic was being captured.
          // Do not limit this to the exact /guestAccounts/loyalty/history/ URL because
          // Royal has also returned the history array nested inside broader loyalty payloads.
          const historySailings = getRoyalLoyaltyHistorySailings(data);
          if (historySailings.length > 0) {
            cachedRoyalLoyaltyHistoryPayloadRef.current = data;
            addLog(`📦 Loyalty payload contains ${historySailings.length} completed/past sailing candidate(s); parsing now`, 'success');
            const completedRows = convertRoyalLoyaltyHistorySailingsToCompletedRows(historySailings).filter(isCompletedBookedCruiseRow);
            if (completedRows.length > 0) {
              setState(prev => {
                const existingKeys = new Set(prev.extractedBookedCruises.map(c => `${c.bookingId}|${c.shipName}|${c.sailingStartDate}`));
                const deduped = completedRows.filter(c => !existingKeys.has(`${c.bookingId}|${c.shipName}|${c.sailingStartDate}`));
                const newCruises = [...prev.extractedBookedCruises, ...deduped];
                extractedBookedCruisesRef.current = newCruises;
                return { ...prev, extractedBookedCruises: newCruises };
              });
              capturedSections.current.bookings = true;
              addLog(`✅ Captured ${completedRows.length} completed/past cruise(s) from loyalty history sailings`, 'success');
              completedRows.forEach((c) => {
                addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${c.numberOfNights || 0} nights) [Completed]`, 'success');
              });
              if (progressCallbacks.current.onProgress) progressCallbacks.current.onProgress();
              if (typeof url === 'string' && url.includes('/guestAccounts/loyalty/history/')) {
                return;
              }
            } else {
              addLog(`⚠️ Loyalty history candidates were present but none passed completed-date validation`, 'warning');
            }
          }

          console.log('[RoyalCaribbeanSync] Loyalty data structure:', JSON.stringify(data).substring(0, 500));
          
          const loyaltyPayload = data.payload || data;
          const loyaltyInfo = loyaltyPayload.loyaltyInformation || loyaltyPayload;
          const accountId = loyaltyPayload.accountId || '';

          if (typeof url === 'string' && url.includes('/guestAccounts/loyalty/info')) {
            addLog('Captured loyalty from /guestAccounts/loyalty/info (correct endpoint)', 'success');
          } else if (typeof url === 'string' && url.length > 0) {
            addLog('Loyalty captured from: ' + String(url), 'info');
          }
          
          addLog('Loyalty payload keys: ' + Object.keys(loyaltyPayload).join(', '), 'info');
          
          const convertedLoyalty = convertLoyaltyInfoToExtended(loyaltyInfo, accountId);
          setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, convertedLoyalty));
          hasReceivedApiLoyaltyDataRef.current = true;
          
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              clubRoyaleTier: convertedLoyalty.clubRoyaleTierFromApi,
              clubRoyalePoints: convertedLoyalty.clubRoyalePointsFromApi?.toString(),
              crownAndAnchorLevel: convertedLoyalty.crownAndAnchorTier,
              crownAndAnchorPoints: convertedLoyalty.crownAndAnchorPointsFromApi?.toString(),
            }
          }));
          
          capturedSections.current.loyalty = true;
          addLog('✅ Captured loyalty data from network capture', 'success');
          if (convertedLoyalty.clubRoyalePointsFromApi !== undefined) {
            addLog(`   🎰 Club Royale Status`, 'success');
            addLog(`   📊 Tier: "${convertedLoyalty.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${convertedLoyalty.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
          }
          if (convertedLoyalty.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`   ⚓ Crown & Anchor Society`, 'success');
            addLog(`   📊 Level: "${convertedLoyalty.crownAndAnchorTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${convertedLoyalty.crownAndAnchorPointsFromApi.toLocaleString()}`, 'success');
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
    hasReceivedApiLoyaltyDataRef.current = false;
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    carnivalUserDataRef.current = null;
    extractedOffersRef.current = [];
    extractedBookedCruisesRef.current = [];

    setState(prev => ({
      ...prev,
      status: 'running_step_1',
      extractedOffers: [],
      extractedBookedCruises: [],
      error: null
    }));

    addLog('Starting ingestion process...', 'info');
    
    const waitForStepComplete = (step: number, baseTimeoutMs: number = 600000): Promise<void> => {
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
          resolve();
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
      addLog(`🚀 ====== STEP 1: ${config.loyaltyClubName.toUpperCase()} OFFERS ======`, 'info');
      addLog(`📍 Loading ${config.loyaltyClubName} offers page...`, 'info');
      addLog('⏱️ This may take several minutes - extracting all offers and sailings...', 'info');
      
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
          webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary) + '; true;');
        }
      }
      
      await waitForStepComplete(1, isCarnivalMode ? 180000 : 900000);
      capturedSections.current.offers = extractedOffersRef.current.length > 0;
      if (!capturedSections.current.offers) {
        addLog(`⚠️ Step 1 finished without any ${config.loyaltyClubName} offer rows - existing ${config.loyaltyClubName} data will be preserved during sync`, 'warning');
      }
      
      setState(prev => {
        const normalizedExtractedOffers = normalizeOfferRows(prev.extractedOffers);
        if (normalizedExtractedOffers.length !== prev.extractedOffers.length) {
          extractedOffersRef.current = normalizedExtractedOffers;
        }
        const offersByName = new Map<string, number>();
        let totalSailings = 0;
        normalizedExtractedOffers.forEach(offer => {
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
        const hiddenInProgress = normalizedExtractedOffers.filter(offer => {
          const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
          return offer.isInProgress === true || status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning') || (!offer.shipName && !offer.sailingDate);
        }).length;
        
        addLog(`✅ STEP 1 COMPLETE: Captured ${uniqueOffers} active casino offer(s) with ${totalSailings} total sailing(s)`, 'success');
        if (hiddenInProgress > 0) {
          addLog(`ℹ️ Excluded ${hiddenInProgress} in-progress/empty offer row(s) from active offer counts`, 'info');
        }
        
        return normalizedExtractedOffers.length === prev.extractedOffers.length
          ? prev
          : { ...prev, extractedOffers: normalizedExtractedOffers };
      });
      
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
      addLog('🚀 ====== STEP 2: BOOKINGS & LOYALTY ======', 'info');
      addLog('📡 Visiting account pages to capture API data...', 'info');
      
      try {
        const isCelebrityMode = cruiseLine === 'celebrity';
        const accountHomeUrl = isCelebrityMode
          ? 'https://www.celebritycruises.com/account'
          : isCarnivalMode
          ? 'https://www.carnival.com/profilemanagement/profiles'
          : 'https://www.royalcaribbean.com/myaccount';
        const CAPTURE_PAGES: { url: string; section: 'bookings' | 'loyalty'; name: string }[] = isCarnivalMode
          ? [
              { url: 'https://www.carnival.com/profilemanagement/profiles/cruises', section: 'bookings', name: 'My Cruises' },
              { url: 'https://www.carnival.com/profilemanagement/profiles', section: 'loyalty', name: 'Profile Home' },
              { url: 'https://www.carnival.com/profilemanagement/profiles/offers', section: 'loyalty', name: 'My Offers' },
              { url: accountHomeUrl, section: 'loyalty', name: 'Account Home' },
            ]
          : [
              { url: config.upcomingUrl, section: 'bookings', name: 'Upcoming Cruises' },
              { url: config.holdsUrl, section: 'bookings', name: 'Courtesy Holds' },
              { url: config.loyaltyPageUrl, section: 'loyalty', name: 'Loyalty Programs' },
              { url: accountHomeUrl, section: 'loyalty', name: 'Account Home' },
            ];
        
        const MAX_CYCLES = 3;
        
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
          
          for (const page of CAPTURE_PAGES) {
            if (capturedSections.current[page.section]) continue;
            
            addLog(`📍 Visiting ${page.name}...`, 'info');
            await navigateToPage(page.url, 18000);
            
            if (isCarnivalMode) {
              await delay(3000);
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

        // Restore the pre-button behavior that made completed cruises work:
        // Always give Royal's loyalty-history page a chance to fire the
        // /guestAccounts/loyalty/history/{accountId}?loyaltyNumber=... payload,
        // even when ordinary loyalty info was already captured earlier from another page.
        // The previous early break skipped this page and therefore missed the 55 past cruises.
        if (!isCarnivalMode && !isCelebrityMode && cruiseLine === 'royal_caribbean') {
          addLog('📍 Probing Loyalty Programs page for Royal past-cruise history payload...', 'info');
          await navigateToPage(config.loyaltyPageUrl, 22000);
          await delay(12000);
          if (cachedRoyalLoyaltyHistoryPayloadRef.current) {
            const historyCount = getRoyalLoyaltyHistorySailings(cachedRoyalLoyaltyHistoryPayloadRef.current).length;
            addLog(`✅ Royal loyalty-history probe captured ${historyCount} completed sailing(s)`, historyCount > 0 ? 'success' : 'info');
          } else {
            addLog('⚠️ Royal loyalty-history probe did not expose the completed-cruise payload on this pass', 'warning');
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
                  'https://www.celebritycruises.com/account/loyalty',
                  'https://www.celebritycruises.com/account/loyalty-programs',
                  'https://www.celebritycruises.com/account',
                  'https://www.celebritycruises.com/blue-chip-club/offers',
                ] : [
                  'https://www.royalcaribbean.com/account/loyalty-programs',
                  'https://www.royalcaribbean.com/account/loyalty-programs/club-royale',
                  'https://www.royalcaribbean.com/account/loyalty-programs/crown-anchor-society',
                  'https://www.royalcaribbean.com/account/loyalty-programs/loyalty-match',
                  'https://www.royalcaribbean.com/account/loyalty',
                  'https://www.royalcaribbean.com/account',
                  'https://www.royalcaribbean.com/myaccount',
                  'https://www.royalcaribbean.com/account/loyalty-program',
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

              function emitCapturedIfPresent(loyaltyUrl) {
                const existing = window.capturedPayloads && window.capturedPayloads.loyalty ? window.capturedPayloads.loyalty : null;
                if (existing) {
                  log('✅ Loyalty data already captured by network monitor', 'success');
                  post('network_payload', { endpoint: 'loyalty', data: existing, url: loyaltyUrl });
                  post('step_complete', { step: 3 });
                  return true;
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
        const normalizedExtractedOffers = normalizeOfferRows(prev.extractedOffers);
        if (normalizedExtractedOffers.length !== prev.extractedOffers.length) {
          extractedOffersRef.current = normalizedExtractedOffers;
        }
        // Log all extracted cruises for debugging
        console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[RoyalCaribbeanSync] FINAL EXTRACTION VERIFICATION');
        console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[RoyalCaribbeanSync] Total extracted cruises:', prev.extractedBookedCruises.length);
        prev.extractedBookedCruises.forEach((c, idx) => {
          console.log(`[RoyalCaribbeanSync]   ${idx + 1}. ${c.shipName} - ${c.sailingStartDate} - Status: ${c.status} - Booking: ${c.bookingId} - Nights: ${c.numberOfNights}`);
        });
        
        // Count cruises by status - be more flexible with status matching
        const upcomingCruises = prev.extractedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'upcoming' || status === 'booked' || status === 'confirmed' || status === 'pending' || status === 'waitlist';
        }).length;
        
        const courtesyHolds = prev.extractedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'courtesy hold' || status === 'hold' || status === 'offer';
        }).length;
        
        const completedCruises = prev.extractedBookedCruises.filter(c => {
          const status = (c.status || '').toLowerCase();
          return status === 'completed' || status === 'past';
        }).length;
        
        console.log('[RoyalCaribbeanSync] Status counts - Upcoming:', upcomingCruises, ', Completed:', completedCruises, ', Courtesy Holds:', courtesyHolds);
        
        // Group by offer name/code to get unique offer count and per-offer sailing/cruise counts
        const offersByName = new Map<string, { offerName: string; offerCode?: string; cruiseCount: number }>();
        normalizedExtractedOffers.forEach(offer => {
          const key = offer.offerCode || offer.offerName || 'Unknown';
          const existing = offersByName.get(key) || {
            offerName: offer.offerName || offer.offerCode || 'Unknown Offer',
            offerCode: offer.offerCode || undefined,
            cruiseCount: 0,
          };
          if (offer.shipName || offer.sailingDate) {
            existing.cruiseCount += 1;
          }
          offersByName.set(key, existing);
        });
        const offerBreakdown = Array.from(offersByName.values());
        const uniqueOffers = offerBreakdown.length;
        
        // Log detailed breakdown of all extracted cruises
        console.log('[RoyalCaribbeanSync] Extracted cruises breakdown:', {
          total: prev.extractedBookedCruises.length,
          upcomingCruises,
          courtesyHolds,
          cruiseDetails: prev.extractedBookedCruises.map(c => ({
            ship: c.shipName,
            date: c.sailingStartDate,
            status: c.status,
            bookingId: c.bookingId,
            nights: c.numberOfNights
          }))
        });
        
        console.log('[RoyalCaribbeanSync] Offer grouping:', {
          totalRows: normalizedExtractedOffers.length,
          uniqueOffers,
          offerBreakdown
        });
        
        const newState = {
          ...prev, 
          status: 'awaiting_confirmation' as SyncStatus,
          syncCounts: {
            offerCount: uniqueOffers,
            offerRows: normalizedExtractedOffers.length,
            upcomingCruises,
            courtesyHolds,
            completedCruises,
            offerBreakdown
          },
          syncPreview: null
        };
        
        console.log('[RoyalCaribbeanSync] Setting status to awaiting_confirmation', {
          offerCount: uniqueOffers,
          offerRows: normalizedExtractedOffers.length,
          upcomingCruises,
          courtesyHolds,
          completedCruises,
          totalCruises: prev.extractedBookedCruises.length,
          status: 'awaiting_confirmation'
        });
        
        addLog(`📊 SUMMARY: ${uniqueOffers} casino offer(s) with ${normalizedExtractedOffers.length} total row(s)`, 'success');
        offerBreakdown.forEach((offer) => {
          addLog(`   • ${offer.offerName}${offer.offerCode ? ` (${offer.offerCode})` : ''}: ${offer.cruiseCount} cruise(s)`, offer.cruiseCount > 0 ? 'success' : 'warning');
        });
        const statusParts: string[] = [];
        if (upcomingCruises > 0) statusParts.push(`${upcomingCruises} upcoming`);
        if (completedCruises > 0) statusParts.push(`${completedCruises} completed`);
        if (courtesyHolds > 0) statusParts.push(`${courtesyHolds} courtesy holds`);
        addLog(`📊 SUMMARY: ${prev.extractedBookedCruises.length} cruise(s)${statusParts.length > 0 ? ' - ' + statusParts.join(', ') : ''}`, 'success');
        if (prev.loyaltyData || extendedLoyaltyData) {
          addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
        }
        addLog('⏳ Please review and confirm to sync this data to your app', 'info');
        
        return normalizedExtractedOffers.length === prev.extractedOffers.length
          ? newState
          : { ...newState, extractedOffers: normalizedExtractedOffers };
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

  const syncToApp = useCallback(async (coreDataContext: any, loyaltyContext: any, providedExtendedLoyalty?: ExtendedLoyaltyData | null) => {
    const loyaltyToSync = providedExtendedLoyalty ?? extendedLoyaltyData;
    const fallbackExtendedLoyaltyFromState = state.loyaltyData
      ? convertLoyaltyInfoToExtended(state.loyaltyData as unknown as LoyaltyApiInformation)
      : null;
    const effectiveExtendedLoyalty = loyaltyToSync ?? fallbackExtendedLoyaltyFromState;
    const syncSource = cruiseLine === 'carnival' ? 'carnival' : cruiseLine === 'celebrity' ? 'celebrity' : 'royal';

    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] Loyalty sync input diagnostics:', {
      hasProvidedExtendedLoyalty: !!providedExtendedLoyalty,
      hasExtendedLoyaltyState: !!extendedLoyaltyData,
      hasLoyaltyState: !!state.loyaltyData,
      hasEffectiveExtendedLoyalty: !!effectiveExtendedLoyalty,
      clubRoyalePointsFromEffective: effectiveExtendedLoyalty?.clubRoyalePointsFromApi,
      crownAndAnchorPointsFromEffective: effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi,
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

      const persistenceFailures: string[] = [];
      
      console.log('[RoyalCaribbeanSync] Step 2: Creating sync preview...');
      addLog('Creating sync preview...', 'info');

      const currentLoyalty = {
        clubRoyalePoints: loyaltyContext.clubRoyalePoints,
        clubRoyaleTier: loyaltyContext.clubRoyaleTier,
        crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
        crownAndAnchorLevel: loyaltyContext.crownAnchorLevel
      };

      console.log('[RoyalCaribbeanSync] Creating sync preview with:', {
        extractedOffers: state.extractedOffers.length,
        extractedBookedCruises: state.extractedBookedCruises.length,
        existingOffers: coreDataContext.casinoOffers.length,
        existingCruises: coreDataContext.cruises.length,
        existingBookedCruises: coreDataContext.bookedCruises.length
      });

      const normalizedOffers = normalizeOfferRows(state.extractedOffers);
      const normalizedBookedCruises = normalizeBookedCruiseRows(state.extractedBookedCruises);
      const syncOfferBreakdownMap = new Map<string, { offerName: string; offerCode?: string; cruiseCount: number }>();
      normalizedOffers.forEach((offer) => {
        const key = offer.offerCode || offer.offerName || 'Unknown';
        const current = syncOfferBreakdownMap.get(key) || {
          offerName: offer.offerName || offer.offerCode || 'Unknown Offer',
          offerCode: offer.offerCode || undefined,
          cruiseCount: 0,
        };
        if (offer.shipName || offer.sailingDate) current.cruiseCount += 1;
        syncOfferBreakdownMap.set(key, current);
      });
      const syncOfferBreakdown = Array.from(syncOfferBreakdownMap.values());

      if (normalizedOffers.length !== state.extractedOffers.length) {
        addLog(`ℹ️ Sanitized ${state.extractedOffers.length - normalizedOffers.length} malformed offer row(s) before sync`, 'info');
      }
      if (normalizedBookedCruises.length !== state.extractedBookedCruises.length) {
        addLog(`ℹ️ Sanitized ${state.extractedBookedCruises.length - normalizedBookedCruises.length} malformed booked cruise row(s) before sync`, 'info');
      }

      const preview = createSyncPreview(
        normalizedOffers,
        normalizedBookedCruises,
        state.loyaltyData,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        currentLoyalty,
        syncSource
      );

      console.log('[RoyalCaribbeanSync] Sync preview created successfully');

      const counts = calculateSyncCounts(preview);
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      syncOfferBreakdown.forEach((offer) => {
        addLog(`Preview: ${offer.offerName}${offer.offerCode ? ` (${offer.offerCode})` : ''} includes ${offer.cruiseCount} cruise(s)`, offer.cruiseCount > 0 ? 'info' : 'warning');
      });
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      const isCompletedOnlySync = normalizedOffers.length === 0 && normalizedBookedCruises.length > 0 && normalizedBookedCruises.every((cruise) => isCompletedBookedCruiseRow(cruise));
      const allowOfferRemoval = normalizedOffers.length > 0;
      const allowCruiseRemoval = normalizedOffers.some(offer => Boolean(offer.shipName || offer.sailingDate));
      // Completed-only sync must never delete/replace the active upcoming booking portfolio.
      // It is an additive/update operation against completed history only.
      const allowBookedCruiseRemoval = normalizedBookedCruises.length > 0 && !isCompletedOnlySync;

      if (isCompletedOnlySync) {
        addLog('ℹ️ Completed-cruise-only sync detected; existing upcoming cruises will be preserved', 'info');
      }

      if (!allowOfferRemoval) {
        addLog(`⚠️ No ${config.loyaltyClubName} offer rows were captured, so existing offers and available sailings will be preserved`, 'warning');
      }
      if (!allowCruiseRemoval) {
        addLog(`⚠️ Offer cards were captured but no ship/date sailing rows were captured; preserving existing available cruises instead of overwriting them with zero`, 'warning');
      }
      if (!allowBookedCruiseRemoval) {
        addLog(`⚠️ No booked cruise rows were captured for ${config.name}, so existing booked cruises will be preserved`, 'warning');
      }

      addLog('Applying sync...', 'info');
      const { offers: rawOffers, cruises: rawCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        syncSource,
        {
          allowOfferRemoval,
          allowCruiseRemoval,
          allowBookedCruiseRemoval,
        }
      );

      console.log('[RoyalCaribbeanSync] Running data healing pass...');
      const { cruises: finalCruises, offers: finalOffers, report: healingReport } = healImportedData(rawCruises, rawOffers);
      console.log('[RoyalCaribbeanSync] Data healing:', {
        cruisesHealed: healingReport.cruisesHealed,
        offersHealed: healingReport.offersHealed,
        fieldsFixed: healingReport.fieldsFixed.length,
      });
      if (healingReport.fieldsFixed.length > 0) {
        addLog(`Data healing fixed ${healingReport.fieldsFixed.length} field(s)`, 'info');
      }

      const finalActiveBookedCruises = finalBookedCruises.filter(cruise => isActiveBookedCruise(cruise));
      const finalCourtesyHolds = finalBookedCruises.filter(cruise => isCourtesyHoldCruise(cruise));
      const finalCompletedBookedCruises = finalBookedCruises.filter(cruise => !isActiveBookedCruise(cruise) && !isCourtesyHoldCruise(cruise));

      console.log('[RoyalCaribbeanSync] Sync applied. Final counts:', {
        offers: finalOffers.length,
        cruises: finalCruises.length,
        bookedCruises: finalBookedCruises.length,
        activeBookedCruises: finalActiveBookedCruises.length,
        courtesyHolds: finalCourtesyHolds.length,
        completedBookedCruises: finalCompletedBookedCruises.length,
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
      addLog(`Setting ${finalActiveBookedCruises.length} active booked cruise(s) and ${finalCompletedBookedCruises.length} completed cruise(s) in app (${finalBookedCruises.length} total including history)`, 'info');
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

      if (syncSource !== 'carnival' && preview.loyalty) {
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
      }
      
      if (syncSource !== 'carnival' && effectiveExtendedLoyalty && loyaltyContext.setExtendedLoyaltyData) {
        try {
          addLog('Syncing extended loyalty data...', 'info');
          
          if (effectiveExtendedLoyalty.clubRoyalePointsFromApi !== undefined) {
            addLog(`  → Club Royale: ${effectiveExtendedLoyalty.clubRoyaleTierFromApi || 'N/A'} - ${effectiveExtendedLoyalty.clubRoyalePointsFromApi.toLocaleString()} points`, 'info');
          }
          if (effectiveExtendedLoyalty.crownAndAnchorPointsFromApi !== undefined) {
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
      } else if (syncSource !== 'carnival') {
        addLog('⚠️ No extended loyalty payload available at sync time', 'warning');
      }

      // Sync user profile data: name from passenger data + loyalty numbers/tiers
      if (syncSource !== 'carnival' && currentUser && updateUserProfile) {
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
              addLog(`  → Name: ${fullName}`, 'info');
            }
          }

          // Extract Crown & Anchor number from extended loyalty data
          const cAndAId = effectiveExtendedLoyalty?.crownAndAnchorId;
          if (cAndAId && cAndAId.trim().length > 0) {
            profileUpdates.crownAnchorNumber = cAndAId.trim();
            addLog(`  → Crown & Anchor #: ${cAndAId.trim()}`, 'info');
          }

          const cAndALevel = effectiveExtendedLoyalty?.crownAndAnchorTier;
          if (cAndALevel && cAndALevel.trim().length > 0) {
            profileUpdates.crownAnchorLevel = cAndALevel.trim();
            addLog(`  → Crown & Anchor level: ${cAndALevel.trim()}`, 'info');
          }

          // Sync Celebrity loyalty numbers to user profile
          if (effectiveExtendedLoyalty) {
            if (typeof effectiveExtendedLoyalty.captainsClubPoints === 'number') {
              profileUpdates.celebrityCaptainsClubPoints = effectiveExtendedLoyalty.captainsClubPoints;
              addLog(`  → Captain's Club points: ${effectiveExtendedLoyalty.captainsClubPoints}`, 'info');
            }
            if (typeof effectiveExtendedLoyalty.celebrityBlueChipPoints === 'number') {
              profileUpdates.celebrityBlueChipPoints = effectiveExtendedLoyalty.celebrityBlueChipPoints;
              addLog(`  → Blue Chip points: ${effectiveExtendedLoyalty.celebrityBlueChipPoints}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyTier) {
              profileUpdates.silverseaVenetianTier = effectiveExtendedLoyalty.venetianSocietyTier;
              addLog(`  → Venetian Society tier: ${effectiveExtendedLoyalty.venetianSocietyTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyMemberNumber) {
              profileUpdates.silverseaVenetianNumber = effectiveExtendedLoyalty.venetianSocietyMemberNumber;
            }
          }

          if (Object.keys(profileUpdates).length > 0) {
            addLog('Syncing user profile from loyalty data...', 'info');
            await updateUserProfile(currentUser.id, profileUpdates as any);
            addLog('✅ User profile updated from sync', 'success');
          } else {
            addLog('ℹ️ No passenger or loyalty profile fields found to update', 'info');
          }
        } catch (profileSyncError) {
          console.error('[RoyalCaribbeanSync] Error syncing user profile:', profileSyncError);
          addLog(`⚠️ Could not sync user profile data: ${String(profileSyncError)}`, 'warning');
        }
      }

      if (typeof coreDataContext.syncToBackend === 'function') {
        try {
          addLog('Flushing merged cruise data to backend...', 'info');
          await coreDataContext.syncToBackend();
          addLog('✅ Backend sync completed for merged cruise data', 'success');
        } catch (backendSyncError) {
          console.error('[RoyalCaribbeanSync] Error syncing merged data to backend:', backendSyncError);
          addLog(`⚠️ Warning: Failed to sync merged data to backend: ${String(backendSyncError)}`, 'warning');
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
          offerCount: finalOffers.length,
          offerRows: finalCruises.length,
          upcomingCruises: finalActiveBookedCruises.length,
          courtesyHolds: finalCourtesyHolds.length,
          completedCruises: finalCompletedBookedCruises.length,
          offerBreakdown: syncOfferBreakdown
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
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, extendedLoyaltyData, addLog, cruiseLine, authenticatedEmail, currentUser, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows]);


  const isCompletedBookedCruiseRow = useCallback((cruise: BookedCruiseRow): boolean => {
    const status = `${cruise.status || ''} ${cruise.sourcePage || ''} ${(cruise as any).bookingStatus || ''}`.toLowerCase();
    const sailDateValue = cruise.sailingStartDate || cruise.sailingDates;
    if (sailDateValue) {
      const raw = String(sailDateValue).trim();
      let sailDate = new Date(raw);
      if (Number.isNaN(sailDate.getTime())) {
        const ymd = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
        if (ymd) sailDate = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      }
      if (Number.isNaN(sailDate.getTime())) {
        const mdy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/);
        if (mdy) sailDate = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
      }
      if (!Number.isNaN(sailDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        sailDate.setHours(0, 0, 0, 0);
        if (sailDate >= today) return false; // hard guard: future sailings can never be completed
        return true;
      }
    }
    return status.includes('completed') || status.includes('past') || status.includes('sail history') || status.includes('sailed');
  }, []);

  const runCompletedCruisesSync = useCallback(async (coreDataContext: any) => {
    if (ingestionInFlightRef.current || syncToAppInFlightRef.current) {
      addLog('Another sync is already running...', 'warning');
      return;
    }
    if (state.status !== 'logged_in' && state.status !== 'complete') {
      addLog('Cannot sync completed cruises: user not logged in', 'error');
      return;
    }
    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    ingestionInFlightRef.current = true;
    completedCruisesSyncInProgressRef.current = true;
    processedPayloads.current.clear();
    extractedBookedCruisesRef.current = [];
    setState(prev => ({
      ...prev,
      status: 'running_step_2',
      extractedBookedCruises: [],
      error: null,
      syncPreview: null,
      syncCounts: null,
    }));

    const finishCompletedCruisesFromPayload = (payload: any, sourceLabel: string): boolean => {
      const sailings = getRoyalLoyaltyHistorySailings(payload);
      if (sailings.length === 0) {
        return false;
      }

      const completedRows = convertRoyalLoyaltyHistorySailingsToCompletedRows(sailings).filter(isCompletedBookedCruiseRow);
      if (completedRows.length === 0) {
        addLog(`⚠️ ${sourceLabel} contained ${sailings.length} sailing candidate(s), but none were completed/past after future-date validation`, 'warning');
        return false;
      }
      const preview = createSyncPreview(
        [],
        completedRows,
        null,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        {},
        cruiseLine === 'celebrity' ? 'celebrity' : 'royal'
      );
      setState(prev => ({
        ...prev,
        status: 'awaiting_confirmation' as SyncStatus,
        extractedOffers: [],
        extractedBookedCruises: completedRows,
        syncPreview: preview,
        syncCounts: {
          offerCount: 0,
          offerRows: 0,
          upcomingCruises: 0,
          courtesyHolds: 0,
          completedCruises: completedRows.length,
        }
      }));
      extractedBookedCruisesRef.current = completedRows;
      addLog(`✅ Captured ${completedRows.length} completed/past cruise(s) from ${sourceLabel}`, 'success');
      completedRows.forEach((c, idx) => {
        addLog(`   ✅ Completed ${idx + 1}: ${c.shipName} - ${c.sailingStartDate} (${c.numberOfNights || 'N/A'} nights)`, 'success');
      });
      addLog(`📊 SUMMARY: ${completedRows.length} past/completed cruise(s) found`, 'success');
      addLog(`⏳ Found ${completedRows.length} past cruises. Please review and confirm to sync them to your app.`, 'info');
      addLog('✅ COMPLETED CRUISES CAPTURE COMPLETE: awaiting Yes/No confirmation', 'success');
      return true;
    };

    const navigateToPage = (url: string, maxWaitMs: number = 18000): Promise<void> => {
      return new Promise((resolve) => {
        navigationRequestIdRef.current += 1;
        const requestId = navigationRequestIdRef.current;
        pendingNavigationTargetRef.current = url;
        const timeout = setTimeout(() => {
          if (requestId !== navigationRequestIdRef.current) return;
          addLog(`⚠️ Page load timeout for ${url} - continuing`, 'warning');
          pageLoadResolver.current = null;
          pendingNavigationTargetRef.current = null;
          resolve();
        }, maxWaitMs);
        pageLoadResolver.current = () => {
          if (requestId !== navigationRequestIdRef.current) return;
          clearTimeout(timeout);
          setTimeout(resolve, 2500);
        };
        addLog(`🌐 Navigating to: ${url}`, 'info');
        setWebViewUrl(url);
      });
    };

    const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));


    const existingCompletedRowsFromCore = (): BookedCruiseRow[] => {
      try {
        const rows = ((coreDataContext?.bookedCruises || []) as any[])
          .filter((c: any) => {
            const rowLike: any = {
              status: c.status || c.completionState,
              sourcePage: c.sourcePage,
              sailingStartDate: c.sailDate || c.sailingStartDate,
              sailingDates: c.sailDate || c.sailingDates,
              bookingStatus: c.bookingStatus,
            };
            return isCompletedBookedCruiseRow(rowLike as BookedCruiseRow);
          })
          .map((c: any) => ({
            sourcePage: 'Completed',
            shipName: c.shipName || '',
            shipCode: c.shipCode || '',
            cruiseTitle: c.cruiseTitle || c.itineraryName || c.destination || 'Completed Cruise',
            sailingStartDate: c.sailDate || c.sailingStartDate || '',
            sailingEndDate: c.returnDate || c.sailingEndDate || '',
            sailingDates: c.sailDate || c.sailingDates || '',
            itinerary: c.itineraryName || c.destination || '',
            departurePort: c.departurePort || '',
            arrivalPort: c.arrivalPort || '',
            cabinType: c.cabinType || c.category || '',
            cabinCategory: c.cabinCategory || '',
            cabinNumberOrGTY: c.cabinNumber || c.stateroomNumber || '',
            deckNumber: c.deckNumber || '',
            bookingId: String(c.bookingId || c.reservationNumber || ''),
            numberOfGuests: String(c.guests || c.numberOfGuests || 1),
            numberOfNights: String(c.nights || c.numberOfNights || ''),
            daysToGo: '0',
            status: 'Completed',
            holdExpiration: '',
            loyaltyLevel: '',
            loyaltyPoints: '',
            paidInFull: '',
            balanceDue: '',
            musterStation: '',
            bookingStatus: 'Completed',
            packageCode: c.packageCode || '',
            passengerStatus: c.passengerStatus || '',
            stateroomNumber: c.stateroomNumber || c.cabinNumber || '',
            stateroomCategoryCode: c.stateroomCategoryCode || c.cabinCategory || '',
            stateroomType: c.stateroomType || c.cabinType || '',
          } as unknown as BookedCruiseRow));
        return rows;
      } catch {
        return [];
      }
    };

    try {
      addLog('🚢 ====== COMPLETED CRUISES SYNC ======', 'info');
      // Start from only already-known completed rows from the current extraction.
      // Do not let stale upcoming rows from a prior Sync Now run bleed into the completed-only flow.
      const seedCompletedRows = normalizeBookedCruiseRows(extractedBookedCruisesRef.current).filter(isCompletedBookedCruiseRow);
      extractedBookedCruisesRef.current = seedCompletedRows;
      if (seedCompletedRows.length > 0) {
        addLog(`📦 Seeded completed-only sync with ${seedCompletedRows.length} completed row(s) already captured in this session`, 'info');
      }
      if (cachedRoyalLoyaltyHistoryPayloadRef.current) {
        addLog('📦 Replaying previously captured loyalty-history payload before touching My Account...', 'info');
        if (finishCompletedCruisesFromPayload(cachedRoyalLoyaltyHistoryPayloadRef.current, 'cached Royal loyalty-history payload')) {
          return;
        }
        addLog('⚠️ Cached loyalty-history payload did not contain a sailings array; continuing to live capture', 'warning');
      }

      addLog('📍 Visiting Royal loyalty page first to trigger the old working loyalty-history payload...', 'info');
      await navigateToPage('https://www.royalcaribbean.com/account/loyalty-programs', 18000);
      await delay(7000);
      if (cachedRoyalLoyaltyHistoryPayloadRef.current) {
        addLog('📦 Loyalty page produced a loyalty-history payload; parsing it now...', 'success');
        if (finishCompletedCruisesFromPayload(cachedRoyalLoyaltyHistoryPayloadRef.current, 'live Royal loyalty-history payload')) {
          return;
        }
      }

      addLog('📍 Visiting Royal Caribbean My Account for past cruises...', 'info');
      await navigateToPage('https://www.royalcaribbean.com/myaccount', 22000);
      await delay(3000);

      webViewRef.current.injectJavaScript(`
        (function() {
          function log(message, type) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
          }
          function clickLikeUser(el) {
            if (!el) return false;
            try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
            try { ['pointerdown','mousedown','mouseup','click'].forEach(function(t){ el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window})); }); } catch(e) {}
            try { if (typeof el.click === 'function') el.click(); } catch(e) {}
            return true;
          }
          function findButton(re) {
            return Array.prototype.slice.call(document.querySelectorAll('button,a,[role="button"],[role="tab"]')).find(function(el) {
              var text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g,' ').trim().toLowerCase();
              return text && text.length < 80 && re.test(text);
            });
          }
          try {
            log('🔎 Completed cruise sync v8.6.3: opening View All, then explicitly switching to Past Sailings before extraction...', 'info');
            function findByText(re) { return findButton(re); }
            function allClickable() { return Array.prototype.slice.call(document.querySelectorAll('button,a,[role="button"],[role="tab"],li,div,span')).filter(function(el) {
              var text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g,' ').trim().toLowerCase();
              return text && text.length < 120;
            }); }
            function findLoose(re) { return allClickable().find(function(el) {
              var text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g,' ').trim().toLowerCase();
              return re.test(text);
            }); }
            function scrollTrips() {
              try { window.scrollBy(0, Math.max(500, window.innerHeight || 700)); } catch(e) {}
              Array.prototype.slice.call(document.querySelectorAll('main,section,div,[role="tabpanel"],[class*="trip" i],[class*="cruise" i]')).forEach(function(el){
                try { if (el.scrollHeight > el.clientHeight + 80) el.scrollTop = el.scrollHeight; } catch(e) {}
              });
            }
            function clickViewAll() {
              var viewAll = findByText(/view\s*all|show\s*all|all\s*cruises|all\s*sailings|my\s*cruises/);
              if (viewAll) { clickLikeUser(viewAll); log('✅ Clicked View All cruises control', 'success'); return true; }
              log('⚠️ View All cruises control not found on this pass', 'warning');
              return false;
            }
            function clickPast() {
              var past = findByText(/past\s*sailings|past\s*cruises|completed\s*sailings|completed\s*cruises|sailing\s*history|cruise\s*history|^past(\s*\(\d+\))?$|^completed(\s*\(\d+\))?$/) ||
                         findLoose(/past\s*sailings|past\s*cruises|completed\s*sailings|completed\s*cruises|sailing\s*history|cruise\s*history|^past(\s*\(\d+\))?$|^completed(\s*\(\d+\))?$/);
              if (past) {
                clickLikeUser(past);
                log('✅ Clicked Past Sailings / Completed cruises control', 'success');
                try { window.__easySeasPastSailingsActivated = true; } catch(e) {}
                return true;
              }
              return false;
            }
            clickViewAll();
            var attempts = 0;
            var timer = setInterval(function() {
              attempts += 1;
              if (attempts === 2 || attempts === 5) clickViewAll();
              scrollTrips();
              if (clickPast()) { clearInterval(timer); return; }
              if (attempts >= 12) {
                clearInterval(timer);
                log('⚠️ Past Sailings control not found after repeated View All/scroll attempts; scraping visible page and captured API payloads only', 'warning');
              }
            }, 1500);
          } catch (e) {
            log('⚠️ Completed cruises click helper failed: ' + (e && e.message ? e.message : String(e)), 'warning');
          }
          true;
        })();
      `);

      webViewRef.current.injectJavaScript(`
        (function() {
          function post(msg){ try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
          function log(message, type){ post({ type:'log', message: message, logType: type || 'info' }); }
          function firstString() {
            for (var i=0;i<arguments.length;i++) {
              var v = arguments[i];
              if (v === null || v === undefined) continue;
              if (typeof v === 'number' && isFinite(v)) return String(v);
              if (typeof v === 'string' && v.trim()) return v.trim();
            }
            return '';
          }
          function deepFind(obj, keys, depth) {
            if (!obj || depth > 6) return '';
            if (typeof obj !== 'object') return '';
            for (var i=0;i<keys.length;i++) {
              var k = keys[i];
              if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim()) return String(obj[k]).trim();
            }
            if (Array.isArray(obj)) {
              for (var a=0;a<obj.length;a++) { var av = deepFind(obj[a], keys, depth+1); if (av) return av; }
            } else {
              var names = Object.keys(obj);
              for (var n=0;n<names.length;n++) { var ov = deepFind(obj[names[n]], keys, depth+1); if (ov) return ov; }
            }
            return '';
          }
          async function fetchCompletedFromLoyaltyHistory() {
            try {
              var captured = window.capturedPayloads || {};
              var loyalty = captured.loyalty || captured.loyaltyData || captured.extendedLoyalty || {};
              var payload = loyalty.payload || loyalty.data || loyalty;
              var allPayloads = [payload, loyalty, captured, window.capturedRequestHeaders || {}];
              var accountId = '';
              var loyaltyNumber = '';
              for (var pi=0; pi<allPayloads.length && !accountId; pi++) {
                accountId = firstString(allPayloads[pi].accountId, allPayloads[pi].guestAccountId, allPayloads[pi].accountID) || deepFind(allPayloads[pi], ['accountId','guestAccountId','accountID'], 0);
              }
              for (var li=0; li<allPayloads.length && !loyaltyNumber; li++) {
                loyaltyNumber = firstString(
                  allPayloads[li].loyaltyNumber,
                  allPayloads[li].crownAndAnchorNumber,
                  allPayloads[li].crownAnchorNumber,
                  allPayloads[li].crownAndAnchorId,
                  allPayloads[li].loyaltyId
                ) || deepFind(allPayloads[li], ['loyaltyNumber','crownAndAnchorNumber','crownAnchorNumber','crownAndAnchorId','loyaltyId'], 0);
              }
              if (!accountId) {
                var html = document.documentElement ? document.documentElement.innerHTML : '';
                var accountMatch = html.match(/accountId[\"']?\s*[:=]\s*[\"']?([A-Z0-9]{5,})/i) || html.match(/guestAccountId[\"']?\s*[:=]\s*[\"']?([A-Z0-9]{5,})/i);
                if (accountMatch) accountId = accountMatch[1];
              }
              if (!accountId) {
                var injectedAccountId = '${String((extendedLoyaltyData as any)?.accountId || (extendedLoyaltyData as any)?.guestAccountId || (currentUser as any)?.accountId || (currentUser as any)?.guestAccountId || '').replace(/[^0-9A-Za-z_-]/g, '')}';
                if (injectedAccountId) accountId = injectedAccountId;
              }
              if (!loyaltyNumber) {
                var injectedLoyaltyNumber = '${String((extendedLoyaltyData as any)?.crownAndAnchorId || (extendedLoyaltyData as any)?.crownAnchorNumber || (extendedLoyaltyData as any)?.crownAndAnchorNumber || (extendedLoyaltyData as any)?.loyaltyNumber || (currentUser as any)?.crownAnchorNumber || (currentUser as any)?.crownAndAnchorNumber || '').replace(/[^0-9A-Za-z]/g, '')}';
                if (injectedLoyaltyNumber) loyaltyNumber = injectedLoyaltyNumber;
              }
              if (!loyaltyNumber) {
                var txt = document.body ? (document.body.innerText || document.body.textContent || '') : '';
                var lm = txt.match(/(?:Crown\s*&\s*Anchor|Club\s*Royale)\s*#?\s*(\d{6,})/i) || txt.match(/#\s*(\d{6,})/);
                if (lm) loyaltyNumber = lm[1];
              }
              if (!accountId || !loyaltyNumber) {
                log('⚠️ Direct completed history fetch skipped: missing accountId or loyaltyNumber (accountId=' + (accountId || 'missing') + ', loyaltyNumber=' + (loyaltyNumber ? 'present' : 'missing') + ')', 'warning');
                return;
              }
              var url = 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/history/' + encodeURIComponent(accountId) + '?loyaltyNumber=' + encodeURIComponent(loyaltyNumber);
              log('📡 Fetching completed cruises directly from loyalty history endpoint', 'info');
              function safeJsonParseLocal(str) { try { return JSON.parse(str); } catch(e) { return null; } }
              function tryFindAppKeyLocal() {
                try {
                  var keys = Object.keys(localStorage || {});
                  for (var ki=0; ki<keys.length; ki++) {
                    var k = keys[ki];
                    if (/appkey/i.test(k) || /api[-_]?key/i.test(k)) {
                      var v = localStorage.getItem(k);
                      if (v && v.length > 10) return v;
                    }
                  }
                } catch(e) {}
                try {
                  var winAny = window;
                  var env = winAny.__ENV__ || winAny.__env__ || winAny.env || {};
                  var envKey = env.APPKEY || env.appKey || env.appkey || env.API_KEY || env.apiKey || env.apigeeApiKey || winAny.RCLL_APPKEY || winAny.RCCL_APPKEY || winAny.APPKEY || '';
                  if (typeof envKey === 'string' && envKey.length > 10) return envKey;
                } catch(e) {}
                return '';
              }
              function getAuthHeadersFromSessionLocal(accountIdParam) {
                try {
                  var sessionRaw = localStorage.getItem('persist:session');
                  var session = sessionRaw ? safeJsonParseLocal(sessionRaw) : null;
                  var token = session && session.token ? safeJsonParseLocal(session.token) : null;
                  var user = session && session.user ? safeJsonParseLocal(session.user) : null;
                  var rawAuth = token && token.toString ? token.toString() : '';
                  var authorization = rawAuth ? (rawAuth.indexOf('Bearer ') === 0 ? rawAuth : ('Bearer ' + rawAuth)) : '';
                  var sessionAccountId = user && user.accountId ? String(user.accountId) : '';
                  var headers = { 'accept': 'application/json', 'accept-language': 'en-US,en;q=0.9', 'content-type': 'application/json' };
                  if (accountIdParam || sessionAccountId) headers['account-id'] = accountIdParam || sessionAccountId;
                  if (authorization) headers['authorization'] = authorization;
                  var appKey = tryFindAppKeyLocal();
                  if (appKey) { headers['appkey'] = appKey; headers['x-api-key'] = appKey; }
                  return headers;
                } catch(e) { return null; }
              }
              var headers = getAuthHeadersFromSessionLocal(accountId) || { 'accept': 'application/json' };
              if ((window.capturedRequestHeaders||{}).apiKey) headers['x-api-key'] = window.capturedRequestHeaders.apiKey;
              if ((window.capturedRequestHeaders||{}).authorization) headers['authorization'] = window.capturedRequestHeaders.authorization;
              if ((window.capturedRequestHeaders||{}).accountId) headers['account-id'] = window.capturedRequestHeaders.accountId;
              var resp = await fetch(url, { method: 'GET', credentials: 'include', headers: headers });
              log('📡 Completed history endpoint status: ' + resp.status, resp.ok ? 'success' : 'warning');
              if (!resp.ok) return;
              var data = await resp.json();
              post({ type:'network_capture', endpoint:'royalLoyaltyHistory', data:data, url:url });
            } catch(e) {
              log('⚠️ Direct completed history fetch failed: ' + (e && e.message ? e.message : String(e)), 'warning');
            }
          }
          setTimeout(fetchCompletedFromLoyaltyHistory, 2500);
          true;
        })();
      `);

      addLog('⏳ Waiting for completed/past bookings API payload and visible page rows...', 'info');
      await delay(22000);
      if (cachedRoyalLoyaltyHistoryPayloadRef.current) {
        addLog('📦 Loyalty-history payload appeared during completed sync; parsing before DOM fallback...', 'success');
        if (finishCompletedCruisesFromPayload(cachedRoyalLoyaltyHistoryPayloadRef.current, 'completed-sync captured Royal loyalty-history payload')) {
          return;
        }
      }

      // DOM fallback: if Royal renders completed cruises without exposing a clean API payload, scrape the visible history cards.
      webViewRef.current.injectJavaScript(`
        (function() {
          function post(msg){ try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
          function log(message, type){ post({ type:'log', message: message, logType: type || 'info' }); }
          function clean(s){ return String(s || '').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
          function monthDateToYmd(s){
            s = clean(s);
            var d = new Date(s);
            if (!isNaN(d.getTime())) return String(d.getFullYear()) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
            var m = s.match(/(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/); if (m) return m[1] + m[2].padStart(2,'0') + m[3].padStart(2,'0');
            return s;
          }
          try {
            var text = document.body ? document.body.innerText || document.body.textContent || '' : '';
            var lines = text.split(/\n+/).map(clean).filter(Boolean);
            var shipRe = /([A-Z][A-Za-z' .-]+ of the Seas)/;
            var dateRe = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}|20\d{2}[-\/]?\d{1,2}[-\/]?\d{1,2}|\d{1,2}[\/-]\d{1,2}[\/-]20\d{2}/i;
            var rows = [];
            var seen = {};
            for (var i=0; i<lines.length; i++) {
              var win = lines.slice(Math.max(0,i-3), Math.min(lines.length, i+9)).join(' | ');
              var sm = win.match(shipRe);
              var dm = win.match(dateRe);
              if (!sm || !dm) continue;
              var before = lines.slice(Math.max(0,i-8), i+1).join(' ').toLowerCase();
              var after = lines.slice(i, Math.min(lines.length, i+12)).join(' ').toLowerCase();
              var context = before + ' ' + after;
              var pastActivated = !!window.__easySeasPastSailingsActivated;
              var parsedDate = new Date(dm[0]);
              if (isNaN(parsedDate.getTime())) { var ymdm = String(dm[0]).match(/^(20\d{2})(\d{2})(\d{2})$/); if (ymdm) parsedDate = new Date(Number(ymdm[1]), Number(ymdm[2])-1, Number(ymdm[3])); }
              if (!isNaN(parsedDate.getTime())) { var today = new Date(); today.setHours(0,0,0,0); parsedDate.setHours(0,0,0,0); if (parsedDate >= today) continue; }
              if (!(context.indexOf('past') >= 0 || context.indexOf('completed') >= 0 || context.indexOf('history') >= 0 || context.indexOf('sailed') >= 0 || (!isNaN(parsedDate.getTime()) && parsedDate < new Date()))) continue;
              var nights = (win.match(/(\d{1,2})\s*(?:night|nt)/i) || [,''])[1];
              var bookingId = (win.match(/(?:booking|reservation|confirmation)\s*(?:#|id|number)?\s*[:#]?\s*([A-Z0-9]{4,})/i) || [,''])[1];
              var cabin = (win.match(/(Interior|Ocean\s*View|Oceanview|Balcony|Suite|GTY)/i) || [,''])[1];
              var key = sm[1] + '|' + dm[0] + '|' + bookingId;
              if (seen[key]) continue; seen[key] = true;
              rows.push({
                shipName: sm[1],
                shipCode: '',
                sailDate: monthDateToYmd(dm[0]),
                departureDate: monthDateToYmd(dm[0]),
                numberOfNights: nights || '',
                cruiseTitle: nights ? (nights + ' Night Cruise') : 'Completed Cruise',
                stateroomType: cabin || '',
                stateroomNumber: '',
                bookingId: bookingId || '',
                bookingStatus: 'Completed',
                status: 'Completed',
                sourcePage: 'Completed',
                rawDomText: win.substring(0,500)
              });
            }
            if (rows.length > 0) {
              log('✅ DOM fallback captured ' + rows.length + ' completed/past cruise row(s)', 'success');
              post({ type:'network_capture', endpoint:'upcomingCruises', data:{ completedCruises: rows }, url:'dom://royal/myaccount/completed' });
            } else {
              log('⚠️ DOM fallback found no completed cruise rows on the visible page', 'warning');
            }
          } catch(e) { log('⚠️ Completed DOM scrape failed: ' + (e && e.message ? e.message : String(e)), 'warning'); }
          true;
        })();
      `);
      await delay(5000);

      const normalizedRows = normalizeBookedCruiseRows(extractedBookedCruisesRef.current);
      const completedRows = normalizedRows.filter(isCompletedBookedCruiseRow);

      if (completedRows.length === 0) {
        const existingCompleted = existingCompletedRowsFromCore();
        if (existingCompleted.length > 0) {
          addLog(`📦 Reusing ${existingCompleted.length} completed cruise(s) already captured by Sync Now/app storage`, 'success');
          const preview = createSyncPreview(
            [],
            existingCompleted,
            null,
            coreDataContext.casinoOffers,
            coreDataContext.cruises,
            coreDataContext.bookedCruises,
            {},
            cruiseLine === 'celebrity' ? 'celebrity' : 'royal'
          );
          setState(prev => ({
            ...prev,
            status: 'awaiting_confirmation' as SyncStatus,
            extractedOffers: [],
            extractedBookedCruises: existingCompleted,
            syncPreview: preview,
            syncCounts: {
              offerCount: 0,
              offerRows: 0,
              upcomingCruises: 0,
              courtesyHolds: 0,
              completedCruises: existingCompleted.length,
            }
          }));
          extractedBookedCruisesRef.current = existingCompleted;
          addLog(`📊 SUMMARY: ${existingCompleted.length} past/completed cruise(s) found`, 'success');
          addLog(`⏳ Found ${existingCompleted.length} past cruises. Please review and confirm to sync them to your app.`, 'info');
          addLog('✅ COMPLETED CRUISES CAPTURE COMPLETE: awaiting Yes/No confirmation', 'success');
          return;
        }
        addLog(`⚠️ No completed cruises were captured. Captured ${normalizedRows.length} booking row(s), but none were marked completed/past.`, 'warning');
        setState(prev => ({ ...prev, status: 'complete' }));
        return;
      }

      addLog(`✅ Captured ${completedRows.length} completed cruise(s)`, 'success');
      completedRows.forEach((c, idx) => {
        addLog(`   ✅ Completed ${idx + 1}: ${c.shipName} - ${c.sailingStartDate} (${c.numberOfNights || 'N/A'} nights)`, 'success');
      });

      const preview = createSyncPreview(
        [],
        completedRows,
        null,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        {},
        cruiseLine === 'celebrity' ? 'celebrity' : 'royal'
      );
      setState(prev => ({
        ...prev,
        status: 'awaiting_confirmation' as SyncStatus,
        extractedOffers: [],
        extractedBookedCruises: completedRows,
        syncPreview: preview,
        syncCounts: {
          offerCount: 0,
          offerRows: 0,
          upcomingCruises: 0,
          courtesyHolds: 0,
          completedCruises: completedRows.length,
        }
      }));
      extractedBookedCruisesRef.current = completedRows;
      addLog(`📊 SUMMARY: ${completedRows.length} past/completed cruise(s) found`, 'success');
      addLog(`⏳ Found ${completedRows.length} past cruises. Please review and confirm to sync them to your app.`, 'info');
      addLog('✅ COMPLETED CRUISES CAPTURE COMPLETE: awaiting Yes/No confirmation', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
      addLog(`❌ Completed cruises sync failed: ${errorMessage}`, 'error');
    } finally {
      completedCruisesSyncInProgressRef.current = false;
      ingestionInFlightRef.current = false;
    }
  }, [addLog, state.status, normalizeBookedCruiseRows, isCompletedBookedCruiseRow, cruiseLine, currentUser, extendedLoyaltyData]);

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
    runCompletedCruisesSync,
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
    state, webViewRef, cruiseLine, setCruiseLine, config, openLogin, runIngestion, runCompletedCruisesSync,
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
