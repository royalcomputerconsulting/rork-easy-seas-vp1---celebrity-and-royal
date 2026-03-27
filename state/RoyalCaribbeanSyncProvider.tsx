import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect, useContext, createContext, useMemo, ReactNode } from 'react';
import { WebView } from 'react-native-webview';
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
import { convertLoyaltyInfoToExtended } from '@/lib/royalCaribbean/loyaltyConverter';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape, injectCarnivalTgoExtract } from '@/lib/carnival/carnivalOffersExtraction';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import { healImportedData } from '@/lib/dataHealing';
import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

export type CruiseLine = 'royal_caribbean' | 'celebrity' | 'carnival';

export const CRUISE_LINE_CONFIG = {
  royal_caribbean: {
    name: 'Royal Caribbean',
    loginUrl: 'https://www.royalcaribbean.com/club-royale',
    offersUrl: 'https://www.royalcaribbean.com/club-royale/offers',
    upcomingUrl: 'https://www.royalcaribbean.com/account/upcoming-cruises',
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
    offersUrl: 'https://www.carnival.com/cruise-deals',
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
  scrapePricingAndItinerary: true
};

const INITIAL_EXTENDED_LOYALTY: ExtendedLoyaltyData | null = null;

const InitialCruiseLineContext = createContext<CruiseLine>('royal_caribbean');

interface SyncCoreDataContext {
  casinoOffers: CasinoOffer[];
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  setCasinoOffers: (offers: CasinoOffer[]) => Promise<void>;
  setCruises: (cruises: Cruise[]) => Promise<void>;
  setBookedCruises: (cruises: BookedCruise[]) => Promise<void>;
  syncToBackend?: () => Promise<void>;
}

interface SyncLoyaltyContext {
  clubRoyalePoints: number;
  clubRoyaleTier: string;
  crownAnchorPoints: number;
  crownAnchorLevel: string;
  setManualClubRoyalePoints?: (points: number) => Promise<void>;
  setManualCrownAnchorPoints?: (points: number) => Promise<void>;
  setExtendedLoyaltyData?: (data: ExtendedLoyaltyData) => Promise<void>;
}

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
  const webViewRef = useRef<WebView | null>(null);
  const hasReceivedApiLoyaltyDataRef = useRef(false);
  const lastAuthenticatedEmailRef = useRef<string | null>(authenticatedEmail);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  const capturedSections = useRef({ offers: false, bookings: false, loyalty: false });
  const pageLoadResolver = useRef<((loadedUrl?: string) => void) | null>(null);
  const offerSailingsResolver = useRef<{
    offerCode: string;
    requestId: number;
    collectedSailings: OfferRow[];
    resolve: (sailings: OfferRow[]) => void;
  } | null>(null);
  const carnivalPageCheckResolver = useRef<((onOffers: boolean) => void) | null>(null);
  const carnivalTgoDataResolver = useRef<((data: { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> }) => void) | null>(null);
  const carnivalOffersLinkResolver = useRef<((url: string) => void) | null>(null);
  const navigationRequestIdRef = useRef<number>(0);
  const offerSailingsRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  const syncToAppInFlightRef = useRef<boolean>(false);
  const logFlushScheduledRef = useRef<boolean>(false);
  const providerMountedRef = useRef<boolean>(true);
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];
  const [webViewUrl, setWebViewUrl] = useState<string>(CRUISE_LINE_CONFIG[initialCruiseLine].loginUrl);
  const stateRef = useRef<RoyalCaribbeanSyncState>(INITIAL_STATE);

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

  const createPayloadSignature = useCallback((value: unknown): string => {
    if (Array.isArray(value)) {
      const firstItem = value[0];
      const firstItemKeys = getObjectKeys(firstItem).slice(0, 8).join(',');
      return `array:${value.length}:${firstItemKeys}`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const topLevelKeys = Object.keys(record).sort().join(',');
      const payloadKeys = getObjectKeys(record.payload).slice(0, 8).sort().join(',');
      return `object:${topLevelKeys}:${payloadKeys}`;
    }

    return `${typeof value}:${stringifyValue(value).slice(0, 120)}`;
  }, [getObjectKeys, stringifyValue]);

  const truncateValue = useCallback((value: string, maxLength: number = 160): string => {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
  }, []);

  const createBookingSnapshot = useCallback((value: unknown): Record<string, string | number> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    const snapshot: Record<string, string | number> = {};

    const setStringField = (key: string, input: unknown) => {
      const normalized = truncateValue(stringifyValue(input));
      if (normalized) {
        snapshot[key] = normalized;
      }
    };

    const setNumericField = (key: string, input: unknown) => {
      if (typeof input === 'number' && Number.isFinite(input)) {
        snapshot[key] = input;
        return;
      }
      const normalized = truncateValue(stringifyValue(input));
      if (normalized) {
        snapshot[key] = normalized;
      }
    };

    const passengerCount = Array.isArray(record.passengers)
      ? record.passengers.length
      : Array.isArray(record.passengersInStateroom)
      ? record.passengersInStateroom.length
      : undefined;

    setStringField('bookingId', record.bookingId ?? record.confirmationNumber ?? record.reservationId);
    setStringField('shipName', record.shipName ?? record.ship);
    setStringField('shipCode', record.shipCode);
    setStringField('sailDate', record.sailDate ?? record.departureDate ?? record.startDate);
    setStringField('returnDate', record.endDate ?? record.returnDate);
    setStringField('bookingStatus', record.bookingStatus ?? record.status);
    setStringField('stateroomNumber', record.stateroomNumber ?? record.cabinNumber);
    setStringField('stateroomType', record.stateroomType ?? record.cabinType ?? record.categoryType);
    setStringField('departurePort', record.departurePort ?? record.homePort);
    setStringField('itinerary', record.itinerary ?? record.destination);
    setNumericField('numberOfNights', record.numberOfNights ?? record.duration);
    setNumericField('numberOfGuests', record.guestCount ?? record.numberOfGuests);
    setNumericField('balanceDue', record.balanceDueAmount ?? record.balanceDue ?? record.amountDue);

    if (typeof passengerCount === 'number' && Number.isFinite(passengerCount)) {
      snapshot.passengerCount = passengerCount;
    }

    return Object.keys(snapshot).length > 0 ? snapshot : undefined;
  }, [stringifyValue, truncateValue]);

  const getBookingDebugPreview = useCallback((value: unknown): string => {
    const snapshot = createBookingSnapshot(value);
    if (!snapshot) {
      return '[no booking snapshot]';
    }
    try {
      return JSON.stringify(snapshot);
    } catch {
      return '[booking snapshot unavailable]';
    }
  }, [createBookingSnapshot]);

  const normalizeOfferRows = useCallback((value: unknown): OfferRow[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedRows: OfferRow[] = [];
    const seenKeys = new Set<string>();

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
      };

      const dedupeKey = [
        normalizedRow.offerCode,
        normalizedRow.offerName,
        normalizedRow.shipName,
        normalizedRow.sailingDate,
        normalizedRow.bookingLink,
      ].join('|');

      if (seenKeys.has(dedupeKey)) {
        return;
      }

      seenKeys.add(dedupeKey);
      normalizedRows.push(normalizedRow);
    });

    return normalizedRows;
  }, [stringifyValue]);

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
        rawBooking: createBookingSnapshot(row.rawBooking),
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
  }, [createBookingSnapshot, stringifyValue]);

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
    stateRef.current = state;
  }, [state]);

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

  const clearPendingSyncWork = useCallback(() => {
    stepCompleteResolvers.current = {};
    progressCallbacks.current = {};
    pageLoadResolver.current = null;
    offerSailingsResolver.current = null;
    carnivalPageCheckResolver.current = null;
    carnivalTgoDataResolver.current = null;
    carnivalOffersLinkResolver.current = null;
    pendingNavigationTargetRef.current = null;
    navigationRequestIdRef.current += 1;
  }, []);

  const safeInjectJS = useCallback((script: string): boolean => {
    try {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
        return true;
      }
    } catch (e) {
      console.warn('[RoyalCaribbeanSync] safeInjectJS failed:', e);
    }
    return false;
  }, []);

  const sanitizeSyncArray = useCallback(<T extends Record<string, unknown>,>(value: unknown, label: string): T[] => {
    if (!Array.isArray(value)) {
      addLog(`⚠️ ${label} was not an array. Using an empty list instead.`, 'warning');
      return [];
    }

    const sanitized = value.filter((item) => item && typeof item === 'object') as T[];
    if (sanitized.length !== value.length) {
      addLog(`⚠️ Removed ${value.length - sanitized.length} invalid ${label.toLowerCase()} row(s) before sync`, 'warning');
    }
    return sanitized;
  }, [addLog]);

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
      case 'auth_status': {
        const status = stateRef.current.status;
        const isActiveSync = status.startsWith('running_') || status === 'syncing' || status === 'awaiting_confirmation';
        if (isActiveSync) {
          console.log('[RoyalCaribbeanSync] Ignoring auth_status during active sync:', status);
          break;
        }
        addLog(msg.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
        setState(prev => ({ ...prev, status: msg.loggedIn ? 'logged_in' : 'not_logged_in' }));
        break;
      }

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
          const offerName = batch[0]?.offerName || 'Unknown Offer';
          const offerCode = batch[0]?.offerCode || 'N/A';
          const sampleSailings = batch.slice(0, Math.min(3, batch.length));
          console.log(`[RoyalCaribbeanSync] Batch received: ${batch.length} items, total now: ${extractedOffersRef.current.length + batch.length}`);

          setState(prev => {
            const newOffers = [...prev.extractedOffers, ...batch];
            extractedOffersRef.current = newOffers;
            return {
              ...prev,
              extractedOffers: newOffers
            };
          });

          if (batch[0]?.offerName) {
            addLog(`✅ Captured casino offer "${offerName}" (Code: ${offerCode})`, 'success');
            addLog(`   📊 Captured ${batch.length} sailing(s) for this offer`, 'success');
            sampleSailings.forEach((sailing, idx) => {
              if (sailing.shipName && sailing.sailingDate) {
                addLog(`   🚢 Sailing ${idx + 1}: ${sailing.shipName} - ${sailing.sailingDate}`, 'success');
              }
            });
            if (batch.length > 3) {
              addLog(`   ➕ ...and ${batch.length - 3} more sailing(s)`, 'success');
            }
          }
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
          const existingBookedCruises = stateRef.current.extractedBookedCruises;
          const existingIds = new Set(existingBookedCruises.map(c => c.bookingId).filter(Boolean));
          const existingShipDates = new Set(existingBookedCruises.map(c => `${c.shipName}|${c.sailingStartDate}`));
          const deduped = incoming.filter(c => {
            if (c.bookingId && existingIds.has(c.bookingId)) return false;
            const key = `${c.shipName}|${c.sailingStartDate}`;
            if (existingShipDates.has(key)) return false;
            return true;
          });
          if (deduped.length < incoming.length) {
            console.log(`[RoyalCaribbeanSync] Deduped cruise_batch: ${incoming.length} -> ${deduped.length} (removed ${incoming.length - deduped.length} duplicates)`);
          }
          console.log(`[RoyalCaribbeanSync] Cruise batch received: ${deduped.length} items, total now: ${existingBookedCruises.length + deduped.length}`);

          setState(prev => ({
            ...prev,
            extractedBookedCruises: [...prev.extractedBookedCruises, ...deduped]
          }));

          capturedSections.current.bookings = true;
          addLog(`✅ Captured ${incoming.length} cruise booking(s)`, 'success');
          incoming.forEach((cruise, idx) => {
            const cabinInfo = cruise.cabinNumberOrGTY ? ` - Cabin ${cruise.cabinNumberOrGTY}` : '';
            const statusInfo = cruise.status ? ` [${cruise.status}]` : '';
            addLog(`   🚢 Cruise ${idx + 1}: ${cruise.shipName} - ${cruise.sailingStartDate} (${cruise.numberOfNights} nights)${cabinInfo}${statusInfo}`, 'success');
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

      case 'offer_sailings_chunk':
      case 'offer_sailings_result': {
        const sailingsMsg = message as {
          offerCode?: string;
          offerName?: string;
          sailings?: unknown;
          requestId?: number;
          isFinal?: boolean;
          chunkIndex?: number;
          totalChunks?: number;
        };
        const sailingsData = normalizeOfferRows(sailingsMsg.sailings);
        const pendingResolver = offerSailingsResolver.current;
        console.log(
          `[CarnivalSync] ${msgType}: ${sailingsData.length} sailings for ${sailingsMsg.offerName} (${sailingsMsg.offerCode}) request=${String(sailingsMsg.requestId ?? 'n/a')} chunk=${String(sailingsMsg.chunkIndex ?? 'n/a')}/${String(sailingsMsg.totalChunks ?? 'n/a')} final=${String(Boolean(sailingsMsg.isFinal))}`
        );
        if (pendingResolver) {
          const pendingOfferCode = pendingResolver.offerCode.trim().toUpperCase();
          const incomingOfferCode = stringifyValue(sailingsMsg.offerCode).trim().toUpperCase();
          const requestMatches = typeof sailingsMsg.requestId === 'number'
            ? sailingsMsg.requestId === pendingResolver.requestId
            : pendingOfferCode.length === 0 || incomingOfferCode.length === 0 || pendingOfferCode === incomingOfferCode;
          const codeMatches = pendingOfferCode.length === 0 || incomingOfferCode.length === 0 || pendingOfferCode === incomingOfferCode;

          if (requestMatches && codeMatches) {
            if (msgType === 'offer_sailings_chunk') {
              pendingResolver.collectedSailings = normalizeOfferRows([
                ...pendingResolver.collectedSailings,
                ...sailingsData,
              ]);
              if (sailingsMsg.isFinal) {
                pendingResolver.resolve(pendingResolver.collectedSailings);
                offerSailingsResolver.current = null;
              }
            } else {
              pendingResolver.resolve(sailingsData);
              offerSailingsResolver.current = null;
            }
          } else {
            console.log(
              `[CarnivalSync] Ignored stale ${msgType} for ${incomingOfferCode || 'unknown'} while waiting for ${pendingOfferCode || 'unknown'} request=${pendingResolver.requestId}`
            );
          }
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
              rawBooking: createBookingSnapshot(booking),
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
          const converted = convertLoyaltyInfoToExtended(loyaltyInfo, '');
          setExtendedLoyaltyData(converted);
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
        setExtendedLoyaltyData(converted);
        
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
        if (processedPayloads.current.size > 250) {
          const oldestPayloadKey = processedPayloads.current.values().next();
          if (!oldestPayloadKey.done) {
            processedPayloads.current.delete(oldestPayloadKey.value);
          }
        }
        
        console.log(`[RoyalCaribbeanSync] Network payload captured: ${endpoint}`, {
          url,
          dataType: Array.isArray(data) ? 'array' : typeof data,
          dataKeys,
          payloadKeys,
        });
        
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
            console.log(`[RoyalCaribbeanSync] First booking sample:`, getBookingDebugPreview(bookings[0]));
            console.log(`[RoyalCaribbeanSync] First booking keys:`, getObjectKeys(bookings[0]).slice(0, 20));
            
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
              } else {
                shipName = booking.shipName || RC_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship');
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
                rawBooking: createBookingSnapshot(booking),
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
            
            const existingBookedCruises = stateRef.current.extractedBookedCruises;
            const existingIds = new Set(existingBookedCruises.map(c => c.bookingId).filter(Boolean));
            const existingShipDates = new Set(existingBookedCruises.map(c => `${c.shipName}|${c.sailingStartDate}`));
            const dedupedCruises = formattedCruises.filter((c: any) => {
              if (c.bookingId && existingIds.has(c.bookingId)) return false;
              const shipDateKey = `${c.shipName}|${c.sailingStartDate}`;
              if (existingShipDates.has(shipDateKey)) return false;
              return true;
            });
            if (dedupedCruises.length < formattedCruises.length) {
              console.log(`[RoyalCaribbeanSync] Deduped network_payload bookings: ${formattedCruises.length} -> ${dedupedCruises.length}`);
              addLog(`ℹ️ Skipped ${formattedCruises.length - dedupedCruises.length} duplicate booking(s)`, 'info');
            }
            setState(prev => ({
              ...prev,
              extractedBookedCruises: [...prev.extractedBookedCruises, ...dedupedCruises]
            }));
            
            capturedSections.current.bookings = true;
            const cruiseLineName = isCarnivalBooking ? 'Carnival' : config.name;
            addLog(`✅ Captured ${bookings.length} booking(s) from ${cruiseLineName} API`, 'success');
            formattedCruises.forEach((c: any) => {
              addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${c.numberOfNights} nights) [${c.status}]`, 'success');
            });
            
            if (stateRef.current.status === 'running_step_2') {
              addLog(`✅ Step 2 auto-completing with ${bookings.length} bookings from network monitor`, 'success');
              if (stepCompleteResolvers.current[2]) {
                stepCompleteResolvers.current[2]();
                delete stepCompleteResolvers.current[2];
              }
            }
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
          let loyaltyPreview = '[unavailable]';
          try {
            loyaltyPreview = JSON.stringify(data).substring(0, 500);
          } catch {
            loyaltyPreview = '[unserializable loyalty payload]';
          }
          console.log('[RoyalCaribbeanSync] Loyalty data structure:', loyaltyPreview);
          
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
          setExtendedLoyaltyData(convertedLoyalty);
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
          
          if (stateRef.current.status === 'running_step_3') {
            addLog(`✅ Step 3 auto-completing with loyalty data from network monitor`, 'success');
            if (stepCompleteResolvers.current[3]) {
              stepCompleteResolvers.current[3]();
              delete stepCompleteResolvers.current[3];
            }
          }
        }
        break;
      }

      case 'carnival_offers_link': {
        const linkMsg = msg as { url: string };
        console.log('[CarnivalSync] Personalized offers link found:', linkMsg.url || '(none)');
        if (carnivalOffersLinkResolver.current) {
          carnivalOffersLinkResolver.current(linkMsg.url || '');
          carnivalOffersLinkResolver.current = null;
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
          const vifpNumber = stringifyValue(userData.PastGuestNumber || '');
          const vifpPoints = stringifyValue(
            userData.Points || userData.TotalPoints || userData.VifpPoints ||
            userData.CruiseDays || userData.cruiseDays || ''
          );
          console.log('[CarnivalSync] User data captured:', userData.FirstName, userData.LastName, 'VIFP#', vifpNumber, 'Tier:', tierName, 'Points:', vifpPoints || 'N/A');
          carnivalUserDataRef.current = {
            vifpNumber,
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
              crownAndAnchorPoints: vifpPoints || (prev.loyaltyData?.crownAndAnchorPoints ?? ''),
            }
          }));
          addLog(`✅ Carnival VIFP: ${tierName} tier (VIFP# ${vifpNumber || 'N/A'}${vifpPoints ? ` • ${vifpPoints} pts` : ''})`, 'success');
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
  }, [addLog, setProgress, cruiseLine, config.name, createBookingSnapshot, createPayloadSignature, getBookingDebugPreview, getObjectKeys, normalizeBookedCruiseRows, normalizeOfferRows, stringifyValue]);

  const openLogin = useCallback(() => {
    setWebViewUrl(config.loginUrl);
    addLog(`Navigating to ${config.loyaltyClubName} page`, 'info');
  }, [addLog, config]);

  const runIngestion = useCallback(async () => {
    const currentStatus = stateRef.current.status;
    if (currentStatus !== 'logged_in' && currentStatus !== 'complete') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (Platform.OS !== 'web' && !webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    processedPayloads.current.clear();
    hasReceivedApiLoyaltyDataRef.current = false;
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    carnivalUserDataRef.current = null;
    extractedOffersRef.current = [];
    clearPendingSyncWork();

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
        const progressTimeoutMs = 90000;
        
        const checkProgress = () => {
          const timeSinceProgress = Date.now() - lastProgressTime;
          if (timeSinceProgress > progressTimeoutMs) {
            delete stepCompleteResolvers.current[step];
            delete progressCallbacks.current.onProgress;
            addLog(`Step ${step} timed out (no progress for ${progressTimeoutMs / 1000}s) - continuing with collected data`, 'warning');
            resolve();
          }
        };
        
        const progressInterval = setInterval(checkProgress, 5000);
        
        const maxTimeout = setTimeout(() => {
          clearInterval(progressInterval);
          delete stepCompleteResolvers.current[step];
          delete progressCallbacks.current.onProgress;
          addLog(`Step ${step} reached max timeout (${baseTimeoutMs / 1000}s) - continuing with collected data`, 'warning');
          resolve();
        }, baseTimeoutMs);
        
        progressCallbacks.current.onProgress = () => {
          lastProgressTime = Date.now();
        };
        
        stepCompleteResolvers.current[step] = () => {
          clearTimeout(maxTimeout);
          clearInterval(progressInterval);
          delete progressCallbacks.current.onProgress;
          resolve();
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
      
      type TgoData = { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
      let tgoData: TgoData | null = null;

      if (isCarnivalMode) {
        addLog('🎪 Carnival — scanning profile page for personalized offers link...', 'info');
        await navigateToPage('about:blank', 3000);
        await delay(500);
        await navigateToPage('https://www.carnival.com/profilemanagement/profiles', 18000);
        await delay(3000);

        const findOffersLink = (timeoutMs: number): Promise<string> => new Promise<string>((resolve) => {
          carnivalOffersLinkResolver.current = null;
          const t = setTimeout(() => {
            carnivalOffersLinkResolver.current = null;
            resolve('');
          }, timeoutMs);
          carnivalOffersLinkResolver.current = (url: string) => {
            clearTimeout(t);
            resolve(url);
          };
          webViewRef.current?.injectJavaScript(`
            (function() {
              function post(type, payload) {
                try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch(e) {}
              }
              try {
                var links = document.querySelectorAll('a[href]');
                var best = '';
                for (var i = 0; i < links.length; i++) {
                  var href = links[i].href || '';
                  var raw = links[i].getAttribute('href') || '';
                  var full = href || (raw.startsWith('http') ? raw : ('https://www.carnival.com' + (raw.startsWith('/') ? '' : '/') + raw));
                  if (full && (full.includes('tgo=') || (full.includes('cruise-deals') && full.includes('vifp=')))) {
                    best = full;
                    break;
                  }
                }
                if (!best) {
                  var bodyHtml = document.body ? document.body.innerHTML : '';
                  var tgoMatch = bodyHtml.match(/href=["']([^"']*tgo=[^"']*)["']/i);
                  if (tgoMatch) {
                    var rawHref = tgoMatch[1];
                    best = rawHref.startsWith('http') ? rawHref : ('https://www.carnival.com' + (rawHref.startsWith('/') ? '' : '/') + rawHref);
                  }
                }
                post('carnival_offers_link', { url: best });
              } catch(e) {
                post('carnival_offers_link', { url: '' });
              }
            })();
            true;
          `);
        });

        let personalizedOffersUrl = await findOffersLink(8000);

        if (!personalizedOffersUrl) {
          addLog('ℹ️ Profile page: no TGO link found — trying carnival.com home...', 'info');
          await navigateToPage('https://www.carnival.com', 15000);
          await delay(3000);
          personalizedOffersUrl = await findOffersLink(6000);
        }

        if (personalizedOffersUrl) {
          addLog('✅ Found personalized offers URL with TGO parameters — navigating...', 'success');
          await navigateToPage(personalizedOffersUrl, 22000);
        } else {
          addLog('ℹ️ No personalized TGO URL found — navigating to cruise-deals directly', 'info');
          await navigateToPage(config.offersUrl, 22000);
        }

        addLog('⏳ Waiting for Carnival offers page to fully render...', 'info');
        await delay(6000);

        addLog('🔍 Extracting TGO rate codes from personalized offers URL...', 'info');
        const extractTgo = (timeoutMs: number): Promise<TgoData | null> => new Promise<TgoData | null>((resolve) => {
          carnivalTgoDataResolver.current = null;
          const tgoTimeout = setTimeout(() => {
            carnivalTgoDataResolver.current = null;
            resolve(null);
          }, timeoutMs);
          carnivalTgoDataResolver.current = (data) => {
            clearTimeout(tgoTimeout);
            resolve(data);
          };
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
          if (tgoData.vifp) {
            addLog(`✅ VIFP# ${tgoData.vifp} (${tgoData.tierName} tier)`, 'success');
          }
        } else {
          addLog('ℹ️ No personalized TGO URL — will scrape offers from page DOM', 'info');
        }

        addLog('🎪 Injecting Carnival offers page extraction...', 'info');
      } else {
        await navigateToPage(config.offersUrl, 20000);
      }
      
      if (isCarnivalMode) {
        addLog('🎪 Injecting Carnival extraction on offers page...', 'info');
        safeInjectJS(injectCarnivalOffersExtraction() + '; true;');
      } else {
        safeInjectJS(injectOffersExtraction(state.scrapePricingAndItinerary) + '; true;');
      }
      
      await waitForStepComplete(1, isCarnivalMode ? 180000 : 900000);
      capturedSections.current.offers = extractedOffersRef.current.length > 0;
      if (!capturedSections.current.offers) {
        addLog('⚠️ Step 1 finished without any Carnival offer rows - existing Carnival offers will be preserved during sync', 'warning');
      }
      
      const latestOffers = extractedOffersRef.current;
      const offersByName = new Map<string, number>();
      latestOffers.forEach(offer => {
        const key = offer.offerName || offer.offerCode || 'Unknown';
        offersByName.set(key, (offersByName.get(key) || 0) + 1);
      });
      const uniqueOffers = offersByName.size;
      const totalSailings = latestOffers.length;
      addLog(`✅ STEP 1 COMPLETE: Captured ${uniqueOffers} casino offer(s) with ${totalSailings} total sailing(s)`, 'success');
      
      if (isCarnivalMode) {
        type EnrichEntry = { offerName: string; offerCode: string; bookingLink: string; offerExpiry: string; perks: string };
        const offersToEnrichMap = new Map<string, EnrichEntry>();
        const buildCarnivalSearchUrl = (code: string): string => {
          const tgoParam = tgoData?.tgo || '';
          const tier = tgoData?.tierCode || '01';
          return `https://www.carnival.com/cruise-search?pageNumber=1&numadults=2&rateCodes=${code}&pageSize=50&sort=fromprice&showBest=true&tierCode=${tier}${tgoParam ? '&tgo=' + encodeURIComponent(tgoParam) : ''}&pastGuest=true&pastguest=true&async=true&currency=USD&locality=1&cruisedeals=jackpot`;
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

        const waitForOfferSailings = (
          offerCode: string,
          timeoutMs: number = 35000
        ): { requestId: number; promise: Promise<OfferRow[]> } => {
          offerSailingsRequestIdRef.current += 1;
          const requestId = offerSailingsRequestIdRef.current;
          const promise = new Promise<OfferRow[]>((resolve) => {
            const timeout = setTimeout(() => {
              if (offerSailingsResolver.current?.requestId === requestId) {
                offerSailingsResolver.current = null;
              }
              resolve([]);
            }, timeoutMs);
            offerSailingsResolver.current = {
              offerCode,
              requestId,
              collectedSailings: [],
              resolve: (sailings: OfferRow[]) => {
                clearTimeout(timeout);
                resolve(sailings);
              }
            };
          });
          return { requestId, promise };
        };

        if (offersToEnrich.length > 0) {
          addLog(`✅ STEP 1.5: SKIPPING cruise-by-cruise fetch for ${offersToEnrich.length} rate code(s) — cruises will open on Carnival.com instead`, 'success');
          addLog(`🔗 Each offer will link directly to its Carnival cruise search page when tapped in the app`, 'info');

          for (const offer of offersToEnrich) {
            const currentOffers = extractedOffersRef.current;
            const hasOfferRow = currentOffers.some(o => o.offerCode === offer.offerCode);
            if (!hasOfferRow) {
              const offerLevelRow: OfferRow = {
                sourcePage: 'Offers',
                offerName: offer.offerName,
                offerCode: offer.offerCode,
                offerExpirationDate: offer.offerExpiry || '',
                offerType: 'VIFP Club',
                shipName: '',
                sailingDate: '',
                itinerary: '',
                departurePort: '',
                cabinType: '',
                numberOfGuests: '2',
                perks: offer.perks || '',
                loyaltyLevel: '',
                loyaltyPoints: '',
                bookingLink: offer.bookingLink,
              };
              setState(prev => {
                const updated = [...prev.extractedOffers, offerLevelRow];
                extractedOffersRef.current = updated;
                return { ...prev, extractedOffers: updated };
              });
              addLog(`   🔗 ${offer.offerCode}: ${offer.offerName} → will open on Carnival.com`, 'success');
            }
          }
        } else {
          addLog('ℹ️ No rate codes found — all offer data already complete or no offers found', 'info');
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
          : 'https://www.royalcaribbean.com/account';
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
            
            if (isCarnivalMode) {
              if (page.section === 'bookings') {
                addLog('🎪 Injecting Carnival bookings scraper...', 'info');
                safeInjectJS(injectCarnivalBookingsScrape() + '; true;');
              } else if (page.name === 'Profile Home') {
                addLog('🎪 Injecting Carnival bookings scraper on profile page...', 'info');
                safeInjectJS(injectCarnivalBookingsScrape() + '; true;');
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
      
      const latestBookedCruises = stateRef.current.extractedBookedCruises;
      const upcomingCount = latestBookedCruises.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status === 'upcoming' || status === 'booked' || status === 'confirmed';
      }).length;
      const holdsCount = latestBookedCruises.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status === 'courtesy hold' || status === 'hold' || status === 'offer';
      }).length;
      addLog(`✅ STEP 2 COMPLETE: Captured ${latestBookedCruises.length} cruise(s) (${upcomingCount} booked, ${holdsCount} courtesy holds)`, 'success');
      
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

          webViewRef.current?.injectJavaScript(`
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
      
      const latestState = stateRef.current;
      const latestExtractedOffers = extractedOffersRef.current;
      const latestExtractedBookedCruises = latestState.extractedBookedCruises;
      const hasLoyalty = latestState.loyaltyData || extendedLoyaltyData;
      if (hasLoyalty) {
        addLog('✅ STEP 3 COMPLETE: Loyalty data captured successfully', 'success');
      } else {
        addLog('⚠️ STEP 3 COMPLETE: No loyalty data captured (continuing without it)', 'warning');
      }

      addLog('🎉 ====== ALL STEPS COMPLETE ======', 'success');
      addLog('✅ All data extracted successfully - ready to sync to your app!', 'success');

      console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[RoyalCaribbeanSync] FINAL EXTRACTION VERIFICATION');
      console.log('[RoyalCaribbeanSync] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[RoyalCaribbeanSync] Total extracted cruises:', latestExtractedBookedCruises.length);
      latestExtractedBookedCruises.forEach((c, idx) => {
        console.log(`[RoyalCaribbeanSync]   ${idx + 1}. ${c.shipName} - ${c.sailingStartDate} - Status: ${c.status} - Booking: ${c.bookingId} - Nights: ${c.numberOfNights}`);
      });

      const upcomingCruises = latestExtractedBookedCruises.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status === 'upcoming' || status === 'booked' || status === 'confirmed' || status === 'pending' || status === 'waitlist';
      }).length;

      const courtesyHolds = latestExtractedBookedCruises.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status === 'courtesy hold' || status === 'hold' || status === 'offer';
      }).length;

      const completedCruises = latestExtractedBookedCruises.filter(c => {
        const status = (c.status || '').toLowerCase();
        return status === 'completed' || status === 'past';
      }).length;

      console.log('[RoyalCaribbeanSync] Status counts - Upcoming:', upcomingCruises, ', Completed:', completedCruises, ', Courtesy Holds:', courtesyHolds);

      const finalOffersByName = new Map<string, number>();
      latestExtractedOffers.forEach(offer => {
        const key = offer.offerName || offer.offerCode || 'Unknown';
        finalOffersByName.set(key, (finalOffersByName.get(key) || 0) + 1);
      });
      const finalUniqueOffers = finalOffersByName.size;

      console.log('[RoyalCaribbeanSync] Extracted cruises breakdown:', {
        total: latestExtractedBookedCruises.length,
        upcomingCruises,
        courtesyHolds,
        cruiseDetails: latestExtractedBookedCruises.map(c => ({
          ship: c.shipName,
          date: c.sailingStartDate,
          status: c.status,
          bookingId: c.bookingId,
          nights: c.numberOfNights
        }))
      });

      console.log('[RoyalCaribbeanSync] Offer grouping:', {
        totalRows: latestExtractedOffers.length,
        uniqueOffers: finalUniqueOffers,
        offerBreakdown: Array.from(finalOffersByName.entries()).map(([name, count]) => ({ name, count }))
      });

      console.log('[RoyalCaribbeanSync] Setting status to awaiting_confirmation', {
        offerCount: finalUniqueOffers,
        offerRows: latestExtractedOffers.length,
        upcomingCruises,
        courtesyHolds,
        totalCruises: latestExtractedBookedCruises.length,
        status: 'awaiting_confirmation'
      });

      const statusParts: string[] = [];
      if (upcomingCruises > 0) statusParts.push(`${upcomingCruises} upcoming`);
      if (completedCruises > 0) statusParts.push(`${completedCruises} completed`);
      if (courtesyHolds > 0) statusParts.push(`${courtesyHolds} courtesy holds`);
      addLog(`📊 SUMMARY: ${finalUniqueOffers} casino offer(s) with ${latestExtractedOffers.length} total sailing(s)`, 'success');
      addLog(`📊 SUMMARY: ${latestExtractedBookedCruises.length} cruise(s)${statusParts.length > 0 ? ' - ' + statusParts.join(', ') : ''}`, 'success');
      if (hasLoyalty) {
        addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
      }
      addLog('⏳ Please review and confirm to sync this data to your app', 'info');

      setState(prev => ({
        ...prev,
        status: 'awaiting_confirmation' as SyncStatus,
        syncCounts: {
          offerCount: finalUniqueOffers,
          offerRows: latestExtractedOffers.length,
          upcomingCruises,
          courtesyHolds
        },
        syncPreview: null
      }));
      
    } catch (error) {
      clearPendingSyncWork();
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Ingestion failed: ${errorMessage}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.scrapePricingAndItinerary, addLog, clearPendingSyncWork, config, cruiseLine, safeInjectJS]);

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
        const { File: ExpoFile, Paths: ExpoPaths } = await import('expo-file-system');
        const file = new ExpoFile(ExpoPaths.cache, 'offers.csv');
        file.write(csv);

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
        const { File: ExpoFile, Paths: ExpoPaths } = await import('expo-file-system');
        const file = new ExpoFile(ExpoPaths.cache, 'Booked_Cruises.csv');
        file.write(csv);

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
        const { File: ExpoFile, Paths: ExpoPaths } = await import('expo-file-system');
        const file = new ExpoFile(ExpoPaths.cache, 'last.log');
        file.write(logText);

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
    clearPendingSyncWork();
    setState(INITIAL_STATE);
    setExtendedLoyaltyData(null);
    hasReceivedApiLoyaltyDataRef.current = false;
    carnivalUserDataRef.current = null;
    extractedOffersRef.current = [];
    rcLogger.clear();
  }, [clearPendingSyncWork]);

  const setExtendedLoyalty = useCallback((data: ExtendedLoyaltyData | null) => {
    setExtendedLoyaltyData(data);
    
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

  const syncToApp = useCallback(async (coreDataContext: SyncCoreDataContext, loyaltyContext: SyncLoyaltyContext, providedExtendedLoyalty?: ExtendedLoyaltyData | null) => {
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
      setState(prev => ({ ...prev, status: 'syncing', syncPreview: null, error: null }));
      addLog('🚀 Starting sync to app...', 'info');

      const persistenceFailures: string[] = [];

      if (!coreDataContext || typeof coreDataContext !== 'object') {
        throw new Error('Core data context was unavailable for Carnival sync.');
      }
      if (!loyaltyContext || typeof loyaltyContext !== 'object') {
        throw new Error('Loyalty context was unavailable for Carnival sync.');
      }
      if (typeof coreDataContext.setCasinoOffers !== 'function' || typeof coreDataContext.setCruises !== 'function' || typeof coreDataContext.setBookedCruises !== 'function') {
        throw new Error('Carnival sync storage handlers were not ready.');
      }

      console.log('[RoyalCaribbeanSync] Step 2: Creating sync preview...');
      addLog('Creating sync preview...', 'info');

      const safeExistingOffers = sanitizeSyncArray<CasinoOffer>(coreDataContext.casinoOffers, 'Existing offers');
      const safeExistingCruises = sanitizeSyncArray<Cruise>(coreDataContext.cruises, 'Existing cruises');
      const safeExistingBookedCruises = sanitizeSyncArray<BookedCruise>(coreDataContext.bookedCruises, 'Existing booked cruises');

      const currentLoyalty = {
        clubRoyalePoints: loyaltyContext.clubRoyalePoints,
        clubRoyaleTier: loyaltyContext.clubRoyaleTier,
        crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
        crownAndAnchorLevel: loyaltyContext.crownAnchorLevel
      };

      console.log('[RoyalCaribbeanSync] Creating sync preview with:', {
        extractedOffers: state.extractedOffers.length,
        extractedBookedCruises: state.extractedBookedCruises.length,
        existingOffers: safeExistingOffers.length,
        existingCruises: safeExistingCruises.length,
        existingBookedCruises: safeExistingBookedCruises.length
      });

      const normalizedOffers = normalizeOfferRows(state.extractedOffers);
      const normalizedBookedCruises = normalizeBookedCruiseRows(state.extractedBookedCruises);

      if (normalizedOffers.length !== state.extractedOffers.length) {
        addLog(`ℹ️ Sanitized ${state.extractedOffers.length - normalizedOffers.length} malformed offer row(s) before sync`, 'info');
      }
      if (normalizedBookedCruises.length !== state.extractedBookedCruises.length) {
        addLog(`ℹ️ Sanitized ${state.extractedBookedCruises.length - normalizedBookedCruises.length} malformed booked cruise row(s) before sync`, 'info');
      }

      const preserveManagedOffers = syncSource === 'carnival' && (!capturedSections.current.offers || normalizedOffers.length === 0);
      const preserveManagedCruises = syncSource === 'carnival' && (!capturedSections.current.offers || normalizedOffers.length === 0);
      const preserveManagedBookedCruises = syncSource === 'carnival' && (!capturedSections.current.bookings || normalizedBookedCruises.length === 0);

      if (syncSource === 'carnival' && normalizedOffers.length === 0 && normalizedBookedCruises.length === 0 && !carnivalUserDataRef.current && !state.loyaltyData) {
        throw new Error('No Carnival data was captured. Existing app data was left unchanged.');
      }

      if (preserveManagedOffers) {
        addLog('⚠️ Carnival offers were not captured in this run, so existing Carnival offers will be preserved', 'warning');
      }
      if (preserveManagedBookedCruises) {
        addLog('⚠️ Carnival bookings were not captured in this run, so existing Carnival bookings will be preserved', 'warning');
      }

      const preview = createSyncPreview(
        normalizedOffers,
        normalizedBookedCruises,
        state.loyaltyData,
        safeExistingOffers,
        safeExistingCruises,
        safeExistingBookedCruises,
        currentLoyalty,
        syncSource
      );

      console.log('[RoyalCaribbeanSync] Sync preview created successfully');

      const counts = calculateSyncCounts(preview);
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');

      addLog('Applying sync...', 'info');
      const { offers: rawOffers, cruises: rawCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        safeExistingOffers,
        safeExistingCruises,
        safeExistingBookedCruises,
        syncSource,
        {
          preserveManagedOffers,
          preserveManagedCruises,
          preserveManagedBookedCruises,
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

      console.log('[RoyalCaribbeanSync] Sync applied. Final counts:', {
        offers: finalOffers.length,
        cruises: finalCruises.length,
        bookedCruises: finalBookedCruises.length
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
      addLog(`Setting ${finalBookedCruises.length} total booked cruises in app`, 'info');
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
          offerCount: prev.syncCounts?.offerCount ?? 0,
          offerRows: prev.syncCounts?.offerRows ?? 0,
          upcomingCruises: counts.upcomingCruises,
          courtesyHolds: counts.courtesyHolds
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
      clearPendingSyncWork();
      syncToAppInFlightRef.current = false;
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, extendedLoyaltyData, addLog, clearPendingSyncWork, cruiseLine, authenticatedEmail, currentUser, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows, sanitizeSyncArray]);

  const cancelSync = useCallback(() => {
    clearPendingSyncWork();
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog, clearPendingSyncWork]);

  

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
