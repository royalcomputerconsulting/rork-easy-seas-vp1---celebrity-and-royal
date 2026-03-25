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
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape } from '@/lib/carnival/carnivalOffersExtraction';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import { healImportedData } from '@/lib/dataHealing';

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
  const navigationRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  
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

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    rcLogger.log(message, type);
    // Batch log updates to prevent excessive state updates
    setState(prev => {
      const newLogs = rcLogger.getDisplayLogs();
      // Only update if logs actually changed
      if (prev.logs.length === newLogs.length) {
        return prev;
      }
      return {
        ...prev,
        logs: newLogs
      };
    });
  }, []);

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
            const newOffers = [...prev.extractedOffers, ...batch];
            const offerName = batch[0]?.offerName || 'Unknown Offer';
            const offerCode = batch[0]?.offerCode || 'N/A';
            console.log(`[RoyalCaribbeanSync] Batch received: ${batch.length} items, total now: ${newOffers.length}`);
            
            if (batch[0]?.offerName) {
              addLog(`✅ Captured casino offer "${offerName}" (Code: ${offerCode})`, 'success');
              addLog(`   📊 Captured ${batch.length} sailing(s) for this offer`, 'success');
              
              // Show first few sailings as examples
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
            console.log(`[RoyalCaribbeanSync] First booking sample:`, JSON.stringify(bookings[0]).substring(0, 300));
            console.log(`[RoyalCaribbeanSync] First booking FULL:`, JSON.stringify(bookings[0]));
            console.log(`[RoyalCaribbeanSync] First booking keys:`, Object.keys(bookings[0]));
            
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
            setState(prev => ({ ...prev, extractedOffers: [...prev.extractedOffers, ...offerRows] }));
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

      case 'carnival_user_data': {
        const userData = msg.data;
        if (userData) {
          const tierMap: Record<string, string> = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
          const tierName = tierMap[userData.TierCode] || userData.TierCode || 'Unknown';
          console.log('[CarnivalSync] User data captured:', userData.FirstName, userData.LastName, 'VIFP#', userData.PastGuestNumber, 'Tier:', tierName);
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
              crownAndAnchorPoints: userData.PastGuestNumber || '',
            }
          }));
          addLog(`✅ Carnival VIFP: ${tierName} tier (VIFP# ${userData.PastGuestNumber || 'N/A'})`, 'success');
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
  }, [addLog, setProgress, cruiseLine, config.name, createPayloadSignature, getObjectKeys, normalizeBookedCruiseRows, normalizeOfferRows]);

  const openLogin = useCallback(() => {
    setWebViewUrl(config.loginUrl);
    addLog(`Navigating to ${config.loyaltyClubName} page`, 'info');
  }, [addLog, config]);

  const runIngestion = useCallback(async () => {
    if (state.status !== 'logged_in' && state.status !== 'complete') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    processedPayloads.current.clear();
    hasReceivedApiLoyaltyDataRef.current = false;
    capturedSections.current = { offers: false, bookings: false, loyalty: false };
    carnivalUserDataRef.current = null;

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
      
      if (isCarnivalMode) {
        addLog('🎪 Carnival SPA detected — forcing full navigation to offers page...', 'info');
        await navigateToPage('about:blank', 3000);
        await delay(500);
        await navigateToPage(config.offersUrl, 20000);
        addLog('⏳ Waiting for Carnival offers page to fully render...', 'info');
        await delay(5000);
        
        const MAX_NAV_RETRIES = 4;
        for (let navRetry = 0; navRetry < MAX_NAV_RETRIES; navRetry++) {
          if (!webViewRef.current) break;
          
          const isOnOffers = await new Promise<boolean>((resolve) => {
            const checkTimeout = setTimeout(() => resolve(false), 5000);
            
            carnivalPageCheckResolver.current = (onOffers: boolean) => {
              clearTimeout(checkTimeout);
              resolve(onOffers);
            };
            
            webViewRef.current?.injectJavaScript(`
              (function() {
                try {
                  var currentUrl = window.location.href || '';
                  var onOffers = currentUrl.includes('/offers') || currentUrl.includes('/cruise-deals');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'carnival_page_check',
                    onOffers: onOffers,
                    url: currentUrl
                  }));
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: 'Page check: ' + currentUrl + (onOffers ? ' (ON OFFERS)' : ' (NOT on offers)'),
                    logType: onOffers ? 'success' : 'warning'
                  }));
                } catch(e) {}
              })();
              true;
            `);
          });
          
          if (isOnOffers) {
            addLog('✅ Confirmed on Carnival offers page', 'success');
            break;
          }
          
          addLog(`⚠️ Not on offers page (attempt ${navRetry + 1}/${MAX_NAV_RETRIES}) — re-navigating...`, 'warning');
          
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              (function() {
                try {
                  window.location.replace('${config.offersUrl}');
                } catch(e) {
                  window.location.href = '${config.offersUrl}';
                }
              })();
              true;
            `);
          }
          await delay(5000);
        }
        
        await delay(2000);
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
      capturedSections.current.offers = true;
      
      setState(prev => {
        const offersByName = new Map<string, number>();
        prev.extractedOffers.forEach(offer => {
          const key = offer.offerName || offer.offerCode || 'Unknown';
          offersByName.set(key, (offersByName.get(key) || 0) + 1);
        });
        const uniqueOffers = offersByName.size;
        const totalSailings = prev.extractedOffers.length;
        
        addLog(`✅ STEP 1 COMPLETE: Captured ${uniqueOffers} casino offer(s) with ${totalSailings} total sailing(s)`, 'success');
        
        return prev;
      });
      
      // Step 1.5: Carnival offer enrichment - navigate to each offer's cruise search page
      if (isCarnivalMode) {
        let offersToEnrich: { offerName: string; offerCode: string; bookingLink: string; offerExpiry: string; perks: string }[] = [];
        setState(prev => {
          const seen = new Set<string>();
          prev.extractedOffers.forEach(offer => {
            const code = offer.offerCode || '';
            const link = offer.bookingLink || '';
            if (code && !seen.has(code) && !offer.shipName && !offer.sailingDate) {
              seen.add(code);
              let fullLink = link;
              if (fullLink && !fullLink.startsWith('http')) {
                fullLink = 'https://www.carnival.com' + (fullLink.startsWith('/') ? '' : '/') + fullLink;
              }
              if (!fullLink && code) {
                fullLink = 'https://www.carnival.com/cruise-search?rateCodes=' + code;
              }
              if (fullLink) {
                offersToEnrich.push({
                  offerName: offer.offerName || 'Unknown Offer',
                  offerCode: code,
                  bookingLink: fullLink,
                  offerExpiry: offer.offerExpirationDate || '',
                  perks: offer.perks || ''
                });
              }
            }
          });
          return prev;
        });

        if (offersToEnrich.length > 0) {
          addLog(`🔍 ====== STEP 1.5: ENRICHING ${offersToEnrich.length} OFFER(S) WITH CRUISE DETAILS ======`, 'info');
          addLog('🚢 Navigating to each offer\'s cruise search page to find actual sailings...', 'info');

          const waitForOfferSailings = (timeoutMs: number = 30000): Promise<OfferRow[]> => {
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

          let totalEnrichedSailings = 0;
          for (let oi = 0; oi < offersToEnrich.length; oi++) {
            const offer = offersToEnrich[oi];
            addLog(`🔍 Offer ${oi + 1}/${offersToEnrich.length}: Navigating to "${offer.offerName}" (${offer.offerCode})...`, 'info');
            addLog(`   📍 URL: ${offer.bookingLink}`, 'info');

            await navigateToPage(offer.bookingLink, 25000);
            await delay(5000);

            if (webViewRef.current) {
              addLog(`   🎪 Injecting cruise search scraper for ${offer.offerCode}...`, 'info');
              webViewRef.current.injectJavaScript(
                injectCarnivalCruiseSearchScrape(offer.offerName, offer.offerCode, offer.offerExpiry, offer.perks)
              );
            }

            const sailings = await waitForOfferSailings(35000);

            if (sailings.length > 0) {
              totalEnrichedSailings += sailings.length;
              addLog(`   ✅ Found ${sailings.length} sailing(s) for "${offer.offerName}"`, 'success');
              sailings.slice(0, 3).forEach((s, idx) => {
                if (s.shipName || s.sailingDate) {
                  addLog(`      🚢 Sailing ${idx + 1}: ${s.shipName || 'TBD'} - ${s.sailingDate || 'TBD'}${s.interiorPrice ? ' from ' + s.interiorPrice : ''}`, 'success');
                }
              });
              if (sailings.length > 3) {
                addLog(`      ➕ ...and ${sailings.length - 3} more sailing(s)`, 'success');
              }
              setState(prev => {
                const existingWithoutThisOffer = prev.extractedOffers.filter(
                  o => o.offerCode !== offer.offerCode || (o.shipName && o.sailingDate)
                );
                return {
                  ...prev,
                  extractedOffers: [...existingWithoutThisOffer, ...sailings]
                };
              });
            } else {
              addLog(`   ⚠️ No sailings found on cruise search page for "${offer.offerName}" - keeping offer-level row`, 'warning');
            }

            await delay(1000);
          }

          addLog(`✅ STEP 1.5 COMPLETE: Enriched offers with ${totalEnrichedSailings} total sailing(s) from ${offersToEnrich.length} offer page(s)`, 'success');
        } else {
          addLog('ℹ️ All offers already have sailing details or no booking links found - skipping enrichment', 'info');
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
        
        // Group by offer name to get unique offer count
        const offersByName = new Map<string, number>();
        prev.extractedOffers.forEach(offer => {
          const key = offer.offerName || offer.offerCode || 'Unknown';
          offersByName.set(key, (offersByName.get(key) || 0) + 1);
        });
        const uniqueOffers = offersByName.size;
        
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
          totalRows: prev.extractedOffers.length,
          uniqueOffers,
          offerBreakdown: Array.from(offersByName.entries()).map(([name, count]) => ({ name, count }))
        });
        
        const newState = {
          ...prev, 
          status: 'awaiting_confirmation' as SyncStatus,
          syncCounts: {
            offerCount: uniqueOffers,
            offerRows: prev.extractedOffers.length,
            upcomingCruises,
            courtesyHolds
          },
          syncPreview: null
        };
        
        console.log('[RoyalCaribbeanSync] Setting status to awaiting_confirmation', {
          offerCount: uniqueOffers,
          offerRows: prev.extractedOffers.length,
          upcomingCruises,
          courtesyHolds,
          totalCruises: prev.extractedBookedCruises.length,
          status: 'awaiting_confirmation'
        });
        
        addLog(`📊 SUMMARY: ${uniqueOffers} casino offer(s) with ${prev.extractedOffers.length} total sailing(s)`, 'success');
        const statusParts: string[] = [];
        if (upcomingCruises > 0) statusParts.push(`${upcomingCruises} upcoming`);
        if (completedCruises > 0) statusParts.push(`${completedCruises} completed`);
        if (courtesyHolds > 0) statusParts.push(`${courtesyHolds} courtesy holds`);
        addLog(`📊 SUMMARY: ${prev.extractedBookedCruises.length} cruise(s)${statusParts.length > 0 ? ' - ' + statusParts.join(', ') : ''}`, 'success');
        if (prev.loyaltyData || extendedLoyaltyData) {
          addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
        }
        addLog('⏳ Please review and confirm to sync this data to your app', 'info');
        
        return newState;
      });
      
    } catch (error) {
      addLog(`Ingestion failed: ${String(error)}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
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
    setState(INITIAL_STATE);
    setExtendedLoyaltyData(null);
    hasReceivedApiLoyaltyDataRef.current = false;
    rcLogger.clear();
  }, []);

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
    
    try {
      console.log('[RoyalCaribbeanSync] Step 1: Setting status to syncing...');
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('🚀 Starting sync to app...', 'info');
      
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
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      addLog('Applying sync...', 'info');
      const { offers: rawOffers, cruises: rawCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        syncSource
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
        console.error('[RoyalCaribbeanSync] Error persisting offers:', offerError);
        addLog(`⚠️ Warning: Failed to persist offers: ${String(offerError)}`, 'warning');
      }

      console.log('[RoyalCaribbeanSync] Step: Persisting available cruises...');
      addLog(`Setting ${finalCruises.length} total available cruises in app`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setCruises()...');
        await coreDataContext.setCruises(finalCruises);
        console.log('[RoyalCaribbeanSync] setCruises() completed');
        addLog('✅ Available cruises persisted to storage', 'success');
      } catch (cruiseError) {
        console.error('[RoyalCaribbeanSync] Error persisting cruises:', cruiseError);
        addLog(`⚠️ Warning: Failed to persist cruises: ${String(cruiseError)}`, 'warning');
      }

      console.log('[RoyalCaribbeanSync] Step: Persisting booked cruises...');
      addLog(`Setting ${finalBookedCruises.length} total booked cruises in app`, 'info');
      try {
        console.log('[RoyalCaribbeanSync] Calling setBookedCruises()...');
        await coreDataContext.setBookedCruises(finalBookedCruises);
        console.log('[RoyalCaribbeanSync] setBookedCruises() completed');
        addLog('✅ Booked cruises persisted to storage', 'success');
      } catch (bookedError) {
        console.error('[RoyalCaribbeanSync] Error persisting booked cruises:', bookedError);
        addLog(`⚠️ Warning: Failed to persist booked cruises: ${String(bookedError)}`, 'warning');
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
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, extendedLoyaltyData, addLog, cruiseLine, authenticatedEmail, currentUser, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows]);

  const cancelSync = useCallback(() => {
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
