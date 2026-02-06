import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';

export type CruiseLine = 'royal_caribbean' | 'celebrity';

export const CRUISE_LINE_CONFIG = {
  royal_caribbean: {
    name: 'Royal Caribbean',
    loginUrl: 'https://www.royalcaribbean.com/club-royale',
    offersUrl: 'https://www.royalcaribbean.com/club-royale/offers',
    upcomingUrl: 'https://www.royalcaribbean.com/account/upcoming-cruises',
    holdsUrl: 'https://www.royalcaribbean.com/account/courtesy-holds',
    loyaltyClubName: 'Club Royale',
  },
  celebrity: {
    name: 'Celebrity Cruises',
    loginUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    offersUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    upcomingUrl: 'https://www.celebritycruises.com/account/upcoming-cruises',
    holdsUrl: 'https://www.celebritycruises.com/account/courtesy-holds',
    loyaltyClubName: 'Blue Chip Club',
  }
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

// Flag to track if we've received API loyalty data (which should take precedence)
let hasReceivedApiLoyaltyData = false;

const DEFAULT_CRUISE_LINE: CruiseLine = 'royal_caribbean';

export const [RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync] = createContextHook(() => {
  console.log('[RoyalCaribbeanSync] Provider initializing...');
  const [state, setState] = useState<RoyalCaribbeanSyncState>(INITIAL_STATE);
  const [cruiseLine, setCruiseLine] = useState<CruiseLine>(DEFAULT_CRUISE_LINE);
  const [extendedLoyaltyData, setExtendedLoyaltyData] = useState<ExtendedLoyaltyData | null>(INITIAL_EXTENDED_LOYALTY);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const webViewRef = useRef<WebView | null>(null);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];

  useEffect(() => {
    const ensureStaySignedInDefault = async () => {
      try {
        const preference = await AsyncStorage.getItem('stay_signed_in');
        if (preference == null) {
          await AsyncStorage.setItem('stay_signed_in', 'true');
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
    ensureStaySignedInDefault();
  }, []);

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
      await AsyncStorage.setItem('stay_signed_in', enabled ? 'true' : 'false');
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
  }, [addLog]);

  const setProgress = useCallback((current: number, total: number, stepName?: string) => {
    setState(prev => ({
      ...prev,
      progress: { current, total, stepName }
    }));
  }, []);

  const handleWebViewMessage = useCallback((message: WebViewMessage) => {
    switch (message.type) {
      case 'auth_status':
        setState(prev => {
          const status = prev.status;
          const isActiveSync = status.startsWith('running_') || status === 'syncing' || status === 'awaiting_confirmation';
          if (isActiveSync) {
            console.log('[RoyalCaribbeanSync] Ignoring auth_status during active sync:', status);
            return prev;
          }
          addLog(message.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
          return { ...prev, status: message.loggedIn ? 'logged_in' : 'not_logged_in' };
        });
        break;

      case 'log':
        addLog(message.message, message.logType);
        break;

      case 'progress':
        setProgress(message.current, message.total, message.stepName);
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'offers_batch':
        if (message.data && message.data.length > 0) {
          setState(prev => {
            const newOffers = [...prev.extractedOffers, ...(message.data as OfferRow[])];
            const batch = message.data as OfferRow[];
            const offerName = batch[0]?.offerName || 'Unknown Offer';
            const offerCode = batch[0]?.offerCode || 'N/A';
            console.log(`[RoyalCaribbeanSync] Batch received: ${message.data.length} items, total now: ${newOffers.length}`);
            
            // Show detailed offer information
            if (batch[0]?.offerName) {
              addLog(`✅ Captured casino offer "${offerName}" (Code: ${offerCode})`, 'success');
              addLog(`   📊 Captured ${message.data.length} sailing(s) for this offer`, 'success');
              
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
        }
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'cruise_batch':
        if (message.data && message.data.length > 0) {
          setState(prev => {
            const newCruises = [...prev.extractedBookedCruises, ...(message.data as BookedCruiseRow[])];
            console.log(`[RoyalCaribbeanSync] Cruise batch received: ${message.data.length} items, total now: ${newCruises.length}`);
            
            // Show detailed cruise capture info with more context
            const batch = message.data as BookedCruiseRow[];
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
        }
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'offer_progress':
        addLog(`Offer ${message.offerIndex}/${message.totalOffers} (${message.offerName}): ${message.sailingsCount} sailings - ${message.status}`, 'info');
        if (progressCallbacks.current.onProgress) {
          progressCallbacks.current.onProgress();
        }
        break;

      case 'step_complete':
        const itemCount = message.totalCount ?? message.data?.length ?? 0;
        addLog(`Step ${message.step} completed with ${itemCount} items`, 'success');
        if (stepCompleteResolvers.current[message.step]) {
          stepCompleteResolvers.current[message.step]();
          delete stepCompleteResolvers.current[message.step];
        }
        break;

      case 'all_bookings_data':
        // New: All bookings received from Step 1 consolidated API call
        if (message.bookings && Array.isArray(message.bookings)) {
          const formattedCruises = message.bookings.map((booking: any) => ({
            rawBooking: booking,
            sourcePage: booking.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming',
            shipName: booking.shipName || booking.shipCode + ' of the Seas',
            shipCode: booking.shipCode,
            cruiseTitle: booking.cruiseTitle || booking.numberOfNights + ' Night Cruise',
            sailingStartDate: booking.sailDate,
            sailingEndDate: booking.sailingEndDate || '',
            sailingDates: booking.sailingDates || '',
            itinerary: booking.itinerary || '',
            departurePort: booking.departurePort || '',
            arrivalPort: booking.arrivalPort || '',
            cabinType: booking.stateroomType || '',
            cabinCategory: booking.stateroomCategoryCode || '',
            cabinNumberOrGTY: booking.stateroomNumber === 'GTY' ? 'GTY' : booking.stateroomNumber,
            deckNumber: booking.deckNumber || '',
            bookingId: booking.bookingId,
            numberOfGuests: booking.passengers?.length.toString() || '1',
            numberOfNights: booking.numberOfNights,
            daysToGo: '',
            status: booking.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming',
            holdExpiration: booking.offerExpirationDate || '',
            loyaltyLevel: '',
            loyaltyPoints: '',
            paidInFull: booking.paidInFull ? 'Yes' : 'No',
            balanceDue: booking.balanceDueAmount?.toString() || '0',
            musterStation: booking.musterStation || '',
            bookingStatus: booking.bookingStatus,
            packageCode: booking.packageCode || '',
            passengerStatus: booking.passengers?.[0]?.passengerStatus || '',
            stateroomNumber: booking.stateroomNumber,
            stateroomCategoryCode: booking.stateroomCategoryCode,
            stateroomType: booking.stateroomType
          }));
          
          setState(prev => ({
            ...prev,
            extractedBookedCruises: [...prev.extractedBookedCruises, ...formattedCruises]
          }));
          
          addLog(`✅ Captured ${message.bookings.length} booking(s) from consolidated API call`, 'success');
          formattedCruises.forEach((c: any) => {
            addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} (${c.numberOfNights} nights)`, 'success');
          });
        }
        break;

      case 'loyalty_data':
        // Check if this is API data (from Step 1 consolidated call) or DOM fallback
        if (message.loyalty && typeof message.loyalty === 'object') {
          // This is API data from Step 1 consolidated call
          const loyaltyInfo = message.loyalty as LoyaltyApiInformation;
          const converted = convertLoyaltyInfoToExtended(loyaltyInfo, '');
          setExtendedLoyaltyData(converted);
          hasReceivedApiLoyaltyData = true;
          
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
        } else if (!hasReceivedApiLoyaltyData) {
          // This is DOM fallback data
          setState(prev => ({ ...prev, loyaltyData: message.data ?? null }));
          addLog('Loyalty data extracted (DOM fallback)', 'info');
        } else {
          addLog('Ignoring DOM loyalty data - API data already received', 'info');
        }
        break;

      case 'extended_loyalty_data':
        const extData = message.data as LoyaltyApiInformation;
        const converted = convertLoyaltyInfoToExtended(extData, (message as any).accountId);
        setExtendedLoyaltyData(converted);
        
        // Mark that we've received API data - this takes precedence over DOM scraping
        hasReceivedApiLoyaltyData = true;
        
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
        
        addLog('✅ Captured loyalty data from API (authoritative source)', 'success');
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
        if (converted.captainsClubPoints !== undefined && converted.captainsClubPoints > 0) {
          addLog(`   🌟 Captain's Club Status`, 'success');
          addLog(`   📊 Tier: "${converted.captainsClubTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${converted.captainsClubPoints.toLocaleString()}`, 'success');
        }
        if (converted.celebrityBlueChipPoints !== undefined && converted.celebrityBlueChipPoints > 0) {
          addLog(`   🎲 Blue Chip Club Status`, 'success');
          addLog(`   📊 Tier: "${converted.celebrityBlueChipTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${converted.celebrityBlueChipPoints.toLocaleString()}`, 'success');
        }
        break;

      case 'network_capture_headers': {
        const headerMsg = message as any;
        console.log('[RoyalCaribbeanSync] Captured request headers', {
          url: headerMsg.url,
          hasApiKey: headerMsg.hasApiKey,
          hasAuthorization: headerMsg.hasAuthorization,
          hasAccountId: headerMsg.hasAccountId,
        });
        addLog(`🔑 Captured request headers for ${String(headerMsg.url || '').split('?')[0]}`, 'info');
        break;
      }

      case 'network_payload':
        const { endpoint, data, url } = message as any;
        
        // Create unique key for this payload to prevent duplicate processing
        const payloadKey = `${endpoint}-${url}-${JSON.stringify(data).substring(0, 100)}`;
        if (processedPayloads.current.has(payloadKey)) {
          console.log(`[RoyalCaribbeanSync] Skipping duplicate payload: ${endpoint}`);
          return;
        }
        processedPayloads.current.add(payloadKey);
        
        console.log(`[RoyalCaribbeanSync] Network payload captured: ${endpoint}`, url);
        console.log(`[RoyalCaribbeanSync] Data structure:`, JSON.stringify(data).substring(0, 500));
        console.log(`[RoyalCaribbeanSync] Full data keys:`, Object.keys(data));
        if (data.payload) {
          console.log(`[RoyalCaribbeanSync] Payload keys:`, Object.keys(data.payload));
        }
        
        if ((endpoint === 'bookings' || endpoint === 'upcomingCruises' || endpoint === 'courtesyHolds') && data) {
          addLog(`📦 Processing captured ${endpoint} API payload...`, 'info');
          addLog(`📦 Data keys: ${Object.keys(data).join(', ')}`, 'info');
          
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
            addLog(`⚠️ Bookings data structure not recognized. Type: ${typeof data}, Keys: ${Object.keys(data).join(', ')}`, 'warning');
            if (data.payload) {
              addLog(`📦 Payload keys: ${Object.keys(data.payload).join(', ')}`, 'info');
            }
            addLog(`📦 Captured ${endpoint} API payload (UNKNOWN STRUCTURE)`, 'warning');
            break;
          }
          
          if (bookings && bookings.length > 0) {
            console.log(`[RoyalCaribbeanSync] Processing ${bookings.length} bookings from enriched API`);
            console.log(`[RoyalCaribbeanSync] First booking sample:`, JSON.stringify(bookings[0]).substring(0, 300));
            console.log(`[RoyalCaribbeanSync] First booking FULL:`, JSON.stringify(bookings[0]));
            console.log(`[RoyalCaribbeanSync] First booking keys:`, Object.keys(bookings[0]));
            
            const SHIP_CODE_MAP: Record<string, string> = {
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
            
            const formattedCruises = bookings.map((booking: any) => {
              const nights = booking.numberOfNights || 0;
              const shipCode = booking.shipCode || '';
              const shipName = SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship');
              const stateroomType = booking.stateroomType || '';
              const cabinType = STATEROOM_TYPE_MAP[stateroomType] || stateroomType || '';
              
              const stateroomNumber = booking.stateroomNumber || '';
              const cabinNumber = stateroomNumber === 'GTY' ? '' : stateroomNumber;
              const isGTY = stateroomNumber === 'GTY' || !stateroomNumber;
              
              return {
                rawBooking: booking,
                sourcePage: 'Upcoming',
                shipName,
                shipCode,
                cruiseTitle: nights ? `${nights} Night Cruise` : 'Cruise',
                sailingStartDate: booking.sailDate || '',
                sailingEndDate: '',
                sailingDates: booking.sailDate || '',
                itinerary: '',
                departurePort: '',
                arrivalPort: '',
                cabinType,
                cabinCategory: booking.stateroomCategoryCode || '',
                cabinNumberOrGTY: isGTY ? 'GTY' : cabinNumber,
                deckNumber: booking.deckNumber || '',
                bookingId: booking.bookingId?.toString() || '',
                numberOfGuests: booking.passengers?.length?.toString() || '1',
                numberOfNights: nights.toString(),
                daysToGo: '',
                status: booking.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming',
                holdExpiration: '',
                loyaltyLevel: '',
                loyaltyPoints: '',
                paidInFull: booking.paidInFull ? 'Yes' : 'No',
                balanceDue: booking.balanceDueAmount?.toString() || '0',
                musterStation: booking.musterStation || '',
                bookingStatus: booking.bookingStatus || 'BK',
                packageCode: booking.packageCode || '',
                passengerStatus: booking.passengers?.[0]?.passengerStatus || '',
                stateroomNumber,
                stateroomCategoryCode: booking.stateroomCategoryCode || '',
                stateroomType
              };
            });
            
            setState(prev => ({
              ...prev,
              extractedBookedCruises: [...prev.extractedBookedCruises, ...formattedCruises]
            }));
            
            addLog(`✅ Captured ${bookings.length} booking(s) from Royal Caribbean API`, 'success');
            formattedCruises.forEach((c: any) => {
              addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${c.numberOfNights} nights)`, 'success');
            });
            
            // Auto-complete Step 2 immediately since we have the bookings data
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
        
        if (endpoint === 'loyalty' && data) {
          addLog(`📦 Processing captured Loyalty API payload...`, 'info');
          console.log(`[RoyalCaribbeanSync] Loyalty data structure:`, JSON.stringify(data).substring(0, 500));
          
          // Extract from payload if present
          const loyaltyPayload = data.payload || data;
          const loyaltyInfo = loyaltyPayload.loyaltyInformation || loyaltyPayload;
          const accountId = loyaltyPayload.accountId || '';

          // Helpful signal: confirm the endpoint we captured from
          if (typeof url === 'string' && url.includes('/guestAccounts/loyalty/info')) {
            addLog('✅ Captured loyalty from /guestAccounts/loyalty/info (correct endpoint)', 'success');
          } else if (typeof url === 'string' && url.length > 0) {
            addLog(`ℹ️ Loyalty captured from: ${url}`, 'info');
          }
          
          addLog(`📦 Loyalty payload keys: ${Object.keys(loyaltyPayload).join(', ')}`, 'info');
          
          const convertedLoyalty = convertLoyaltyInfoToExtended(loyaltyInfo, accountId);
          setExtendedLoyaltyData(convertedLoyalty);
          hasReceivedApiLoyaltyData = true;
          
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

      case 'error':
        setState(prev => ({ ...prev, error: message.message, status: 'error' }));
        addLog(`Error: ${message.message}`, 'error');
        break;

      case 'complete':
        setState(prev => ({ 
          ...prev, 
          status: 'complete',
          lastSyncTimestamp: new Date().toISOString()
        }));
        addLog('Ingestion completed successfully', 'success');
        break;
    }
  }, [addLog, setProgress]);

  const openLogin = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        window.location.href = '${config.loginUrl}';
      `);
      addLog(`Navigating to ${config.loyaltyClubName} page`, 'info');
    }
  }, [addLog, config]);

  const runIngestion = useCallback(async () => {
    if (state.status !== 'logged_in') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    // Clear processed payloads on new ingestion
    processedPayloads.current.clear();
    hasReceivedApiLoyaltyData = false;

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
    
    try {
      addLog(`🚀 ====== STEP 1: ${config.loyaltyClubName.toUpperCase()} OFFERS ======`, 'info');
      addLog(`📍 Loading ${config.loyaltyClubName} offers page...`, 'info');
      addLog('⏱️ This may take several minutes - extracting all casino offers and sailings...', 'info');
      
      webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary) + '; true;');
      
      await waitForStepComplete(1, 900000);
      
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
      
      // Step 2: Navigate to upcoming cruises page
      setState(prev => ({ ...prev, status: 'running_step_2' }));
      addLog('🚀 ====== STEP 2: BOOKED CRUISES ======', 'info');
      addLog('📍 Loading your booked cruises...', 'info');
      
      try {
        if (webViewRef.current) {
          addLog('📍 Navigating to upcoming cruises page...', 'info');
          webViewRef.current.injectJavaScript(`
            window.location.href = '${config.upcomingUrl}';
            true;
          `);
          
          addLog('⏳ Waiting for Royal Caribbean API to respond...', 'info');
          
          // Wait 4 seconds for the page to load and network monitor to capture the API call
          // Network monitor will automatically process and send the payload
          await waitForStepComplete(2, 4000);
        }
      } catch (step2Error) {
        addLog(`Step 2 error: ${step2Error} - continuing with collected data`, 'warning');
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
      
      // Step 3: Removed - courtesy holds are in Step 2's API (bookingStatus='OF')
      // No need to navigate to a separate page
      
      // Step 3: Fetch loyalty data from the ONLY correct API endpoint.
      // IMPORTANT: This call must succeed even when direct fetch is blocked ("Load failed").
      // Strategy:
      // 1) Try to fetch with the same auth headers the site uses (token from localStorage), credentials: 'omit'
      // 2) Retry a few times with backoff
      setState(prev => ({ ...prev, status: 'running_step_3' }));
      addLog('🚀 ====== STEP 3: LOYALTY STATUS ======', 'info');
      addLog('📍 Loading your loyalty program status...', 'info');
      
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
        addLog(`Step 3 error: ${step3Error} - continuing without loyalty data`, 'warning');
      }
      
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
        
        console.log('[RoyalCaribbeanSync] Status counts - Upcoming:', upcomingCruises, ', Courtesy Holds:', courtesyHolds);
        
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
        addLog(`📊 SUMMARY: ${prev.extractedBookedCruises.length} cruise(s) - ${upcomingCruises} booked, ${courtesyHolds} courtesy holds`, 'success');
        if (prev.loyaltyData || extendedLoyaltyData) {
          addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
        }
        addLog('⏳ Please review and confirm to sync this data to your app', 'info');
        
        return newState;
      });
      
    } catch (error) {
      addLog(`Ingestion failed: ${error}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
    }
  }, [state.status, state.scrapePricingAndItinerary, addLog, config, cruiseLine]);

  const exportOffersCSV = useCallback(async () => {
    try {
      const csv = generateOffersCSV(state.extractedOffers, state.loyaltyData);
      const file = new File(Paths.cache, 'offers.csv');
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Offers CSV'
        });
      }

      addLog('Offers CSV exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export offers CSV: ${error}`, 'error');
    }
  }, [state.extractedOffers, state.loyaltyData, addLog]);

  const exportBookedCruisesCSV = useCallback(async () => {
    try {
      const csv = generateBookedCruisesCSV(state.extractedBookedCruises, state.loyaltyData);
      const file = new File(Paths.cache, 'Booked_Cruises.csv');
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Booked Cruises CSV'
        });
      }

      addLog('Booked Cruises CSV exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export booked cruises CSV: ${error}`, 'error');
    }
  }, [state.extractedBookedCruises, state.loyaltyData, addLog]);

  const exportLog = useCallback(async () => {
    try {
      const logText = rcLogger.getLogsAsText({ includeNotes: true });
      const file = new File(Paths.cache, 'last.log');
      file.write(logText);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Sync Log'
        });
      }

      addLog('Log exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export log: ${error}`, 'error');
    }
  }, [addLog]);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
    setExtendedLoyaltyData(null);
    hasReceivedApiLoyaltyData = false;
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
    try {
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('Creating sync preview...', 'info');

      const currentLoyalty = {
        clubRoyalePoints: loyaltyContext.clubRoyalePoints,
        clubRoyaleTier: loyaltyContext.clubRoyaleTier,
        crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
        crownAndAnchorLevel: loyaltyContext.crownAnchorLevel
      };

      const preview = createSyncPreview(
        state.extractedOffers,
        state.extractedBookedCruises,
        state.loyaltyData,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises,
        currentLoyalty
      );

      const counts = calculateSyncCounts(preview);
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      addLog('Applying sync...', 'info');
      const { offers: finalOffers, cruises: finalCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        coreDataContext.cruises,
        coreDataContext.bookedCruises
      );

      addLog(`Setting ${finalOffers.length} total offers in app`, 'info');
      await coreDataContext.setCasinoOffers(finalOffers);
      addLog('✅ Offers persisted to storage', 'success');

      addLog(`Setting ${finalCruises.length} total available cruises in app`, 'info');
      await coreDataContext.setCruises(finalCruises);
      addLog('✅ Available cruises persisted to storage', 'success');

      addLog(`Setting ${finalBookedCruises.length} total booked cruises in app`, 'info');
      await coreDataContext.setBookedCruises(finalBookedCruises);
      addLog('✅ Booked cruises persisted to storage', 'success');

      if (preview.loyalty) {
        if (preview.loyalty.clubRoyalePoints.changed) {
          addLog(`Updating Club Royale points: ${preview.loyalty.clubRoyalePoints.current} → ${preview.loyalty.clubRoyalePoints.synced}`, 'info');
          await loyaltyContext.setManualClubRoyalePoints(preview.loyalty.clubRoyalePoints.synced);
        }
        
        if (preview.loyalty.crownAndAnchorPoints.changed) {
          addLog(`Updating Crown & Anchor points: ${preview.loyalty.crownAndAnchorPoints.current} → ${preview.loyalty.crownAndAnchorPoints.synced}`, 'info');
          await loyaltyContext.setManualCrownAnchorPoints(preview.loyalty.crownAndAnchorPoints.synced);
        }
      }
      
      if (loyaltyToSync && loyaltyContext.setExtendedLoyaltyData) {
        addLog('Syncing extended loyalty data...', 'info');
        
        if (loyaltyToSync.clubRoyalePointsFromApi !== undefined) {
          addLog(`  → Club Royale: ${loyaltyToSync.clubRoyaleTierFromApi || 'N/A'} - ${loyaltyToSync.clubRoyalePointsFromApi.toLocaleString()} points`, 'info');
        }
        if (loyaltyToSync.crownAndAnchorPointsFromApi !== undefined) {
          addLog(`  → Crown & Anchor: ${loyaltyToSync.crownAndAnchorTier || 'N/A'} - ${loyaltyToSync.crownAndAnchorPointsFromApi} points`, 'info');
        }
        if (loyaltyToSync.captainsClubPoints !== undefined && loyaltyToSync.captainsClubPoints > 0) {
          addLog(`  → Captain's Club: ${loyaltyToSync.captainsClubTier || 'N/A'} - ${loyaltyToSync.captainsClubPoints} points`, 'info');
        }
        if (loyaltyToSync.celebrityBlueChipPoints !== undefined && loyaltyToSync.celebrityBlueChipPoints > 0) {
          addLog(`  → Blue Chip Club: ${loyaltyToSync.celebrityBlueChipTier || 'N/A'} - ${loyaltyToSync.celebrityBlueChipPoints} points`, 'info');
        }
        
        await loyaltyContext.setExtendedLoyaltyData(loyaltyToSync);
        addLog('Extended loyalty data synced successfully', 'success');
      }

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
      addLog('Data synced successfully to app!', 'success');
      
      // Force refresh CoreData to ensure all computed data (calendar, B2B sets) updates
      console.log('[RoyalCaribbeanSync] Triggering data refresh after sync...');
      if (coreDataContext.refreshData) {
        await coreDataContext.refreshData();
        addLog('✅ Data refresh completed', 'success');
      }
    } catch (error) {
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
      addLog(`Failed to sync data: ${error}`, 'error');
      console.error('[RoyalCaribbeanSync] Sync error:', error);
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, extendedLoyaltyData, addLog]);

  const cancelSync = useCallback(() => {
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog]);

  

  return {
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
    toggleStaySignedIn
  };
});
