import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc, isBackendAvailable } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
import { useUserDataSync } from "@/state/UserDataSyncProvider";
import type { Cruise, BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile, CruiseFilter } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import {
  applyKnownRetailValues,
  enrichCruisesWithReceiptData,
  enrichCruisesWithMockItineraries,
  applyFreeplayOBCData,
} from "./coreData/dataEnrichment";
import { DEFAULT_FILTERS } from "./coreData/filterLogic";
import { STORAGE_KEYS, DEFAULT_SETTINGS, type AppSettings } from "./coreData/storageConfig";

const getMockCruises = (): { BOOKED_CRUISES_DATA: BookedCruise[]; COMPLETED_CRUISES_DATA: BookedCruise[] } => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bookedModule = require('@/mocks/bookedCruises');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const completedModule = require('@/mocks/completedCruises');
    return { 
      BOOKED_CRUISES_DATA: bookedModule.BOOKED_CRUISES_DATA || [], 
      COMPLETED_CRUISES_DATA: completedModule.COMPLETED_CRUISES_DATA || [] 
    };
  } catch (error) {
    console.error('[CoreData] Failed to load mock data:', error);
    return { BOOKED_CRUISES_DATA: [], COMPLETED_CRUISES_DATA: [] };
  }
};

const getFirstTimeUserSampleData = (): { sampleCruises: BookedCruise[]; sampleOffers: CasinoOffer[] } => {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 60);
  const futureReturnDate = new Date(futureDate);
  futureReturnDate.setDate(futureDate.getDate() + 5);
  
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 30);
  const pastReturnDate = new Date(pastDate);
  pastReturnDate.setDate(pastDate.getDate() + 4);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const sampleCruises: BookedCruise[] = [
    {
      id: 'demo-upcoming-nowhere',
      reservationNumber: 'DEMO123',
      shipName: 'Virtually a Ship of the Seas',
      sailDate: formatDate(futureDate),
      returnDate: formatDate(futureReturnDate),
      departurePort: 'Miami, Florida',
      destination: 'Cruise to Nowhere',
      itineraryName: '5 Night Cruise to Nowhere',
      nights: 5,
      cabinType: 'Balcony',
      cabinNumber: 'D100',
      guestNames: ['Demo Guest'],
      guests: 1,
      status: 'booked',
      completionState: 'upcoming',
      ports: ['Miami, Florida', 'At Sea', 'At Sea', 'At Sea', 'At Sea'],
      taxes: 250.00,
      offerCode: 'NOWHERE2025',
      freePlay: 150,
      freeOBC: 100,
      tradeInValue: 500,
      cruiseSource: 'royal',
      casinoLevel: 'Prime',
      casinoHost: 'Virtual Host',
      casinoHostEmail: 'virtualhost@rcclcasino.com',
      casinoHostPhone: '(555) 123-4567',
      earnedPoints: 0,
      pointsGoal: 500,
      dailyPointsGoal: 100,
    },
    {
      id: 'demo-completed-nowhere',
      reservationNumber: 'DEMO456',
      shipName: 'Virtually a Ship of the Seas',
      sailDate: formatDate(pastDate),
      returnDate: formatDate(pastReturnDate),
      departurePort: 'Miami, Florida',
      destination: 'Completed Cruise to Nowhere',
      itineraryName: '4 Night Cruise to Nowhere',
      nights: 4,
      cabinType: 'Balcony',
      cabinNumber: 'B250',
      guestNames: ['Demo Guest'],
      guests: 1,
      status: 'completed',
      completionState: 'completed',
      ports: ['Miami, Florida', 'Nassau, Bahamas', 'At Sea', 'At Sea'],
      casinoPoints: 450,
      cruiseSource: 'royal',
      casinoLevel: 'Prime',
      casinoHost: 'Virtual Host',
      casinoHostEmail: 'virtualhost@rcclcasino.com',
      casinoHostPhone: '(555) 123-4567',
      earnedPoints: 450,
      pointsGoal: 400,
      dailyPointsGoal: 100,
      taxes: 200.00,
      freePlay: 75,
      freeOBC: 25,
      totalSpend: 1250,
      totalWinnings: 980,
      netResult: -270,
      hoursPlayed: 12.5,
      sessionsPlayed: 8,
      avgBet: 2.50,
      theoreticalLoss: 125,
      actualLoss: 270,
      compValue: 95,
    },
  ];

  const offerExpiry = new Date(today);
  offerExpiry.setDate(today.getDate() + 90);
  
  const offerSailDate = new Date(today);
  offerSailDate.setDate(today.getDate() + 60);

  const sampleOffers: CasinoOffer[] = [
    {
      id: 'demo-offer-nowhere',
      offerCode: 'NOWHERE2025',
      offerName: 'Cruise to Nowhere Special',
      offerType: 'comped',
      title: '5 Night Cruise to Nowhere - Comped Balcony',
      description: 'Enjoy a relaxing 5-night cruise to nowhere with comped balcony cabin, $150 free play, $100 OBC, and $500 trade-in value! This sample offer shows how your real offers will appear.',
      category: 'Comped Cruise',
      shipName: 'Virtually a Ship of the Seas',
      sailingDate: formatDate(offerSailDate),
      itineraryName: '5 Night Cruise to Nowhere',
      nights: 5,
      ports: ['Miami, Florida', 'At Sea', 'At Sea', 'At Sea', 'At Sea'],
      roomType: 'Balcony',
      guests: 2,
      guestsInfo: '2 Guests',
      interiorPrice: 0,
      oceanviewPrice: 0,
      balconyPrice: 0,
      suitePrice: 750,
      taxesFees: 250,
      freePlay: 150,
      freeplayAmount: 150,
      OBC: 100,
      obcAmount: 100,
      tradeInValue: 500,
      retailCabinValue: 1800,
      totalValue: 2800,
      received: formatDate(today),
      expires: formatDate(offerExpiry),
      expiryDate: formatDate(offerExpiry),
      status: 'active',
      offerSource: 'royal',
      createdAt: new Date().toISOString(),
    },
  ];

  return { sampleCruises, sampleOffers };
};



interface CoreDataState {
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  completedCruises: BookedCruise[];
  casinoOffers: CasinoOffer[];
  calendarEvents: CalendarEvent[];
  isLoading: boolean;
  lastSyncDate: string | null;
  
  filters: CruiseFilter;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  
  settings: AppSettings;
  userPoints: number;
  clubRoyaleProfile: ClubRoyaleProfile;
  hasLocalData: boolean;
  
  setCruises: (cruises: Cruise[]) => void;
  addCruise: (cruise: Cruise) => void;
  updateCruise: (id: string, updates: Partial<Cruise>) => void;
  removeCruise: (id: string) => void;
  
  setBookedCruises: (cruises: BookedCruise[]) => void;
  addBookedCruise: (cruise: BookedCruise) => void;
  updateBookedCruise: (id: string, updates: Partial<BookedCruise>) => void;
  removeBookedCruise: (id: string) => void;
  
  setCasinoOffers: (offers: CasinoOffer[]) => void;
  addCasinoOffer: (offer: CasinoOffer) => void;
  updateCasinoOffer: (id: string, updates: Partial<CasinoOffer>) => void;
  removeCasinoOffer: (id: string) => void;
  
  setCalendarEvents: (events: CalendarEvent[]) => void;
  addCalendarEvent: (event: CalendarEvent) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  removeCalendarEvent: (id: string) => void;
  
  setFilter: <K extends keyof CruiseFilter>(key: K, value: CruiseFilter[K]) => void;
  setFilters: (filters: Partial<CruiseFilter>) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof CruiseFilter) => void;
  
  updateSettings: (updates: Partial<AppSettings>) => void;
  setUserPoints: (points: number) => void;
  setClubRoyaleProfile: (profile: ClubRoyaleProfile) => void;
  
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  restoreMockData: () => Promise<void>;
}















export const [CoreDataProvider, useCoreData] = createContextHook((): CoreDataState => {
  console.log('[CoreData] === CONTEXT HOOK INITIALIZING ===');
  console.log('[CoreData] === CREATING STATE ===');
  const { authenticatedEmail, isAuthenticated } = useAuth();
  const { initialCheckComplete, hasCloudData } = useUserDataSync();
  const [cruises, setCruisesState] = useState<Cruise[]>([]);
  const [bookedCruises, setBookedCruisesState] = useState<BookedCruise[]>([]);
  const [casinoOffers, setCasinoOffersState] = useState<CasinoOffer[]>([]);
  const [calendarEvents, setCalendarEventsState] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadAttemptedRef = useRef(false);
  const lastAuthEmailRef = useRef<string | null>(null);
  console.log('[CoreData] === STATE CREATED ===');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  
  const [filters, setFiltersState] = useState<CruiseFilter>(DEFAULT_FILTERS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userPoints, setUserPointsState] = useState(0);
  const [clubRoyaleProfile, setClubRoyaleProfileState] = useState<ClubRoyaleProfile>(SAMPLE_CLUB_ROYALE_PROFILE);
  const isSyncingRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  const hasLocalData = cruises.length > 0 || bookedCruises.length > 0 || casinoOffers.length > 0 || calendarEvents.length > 0;

  const { mutateAsync: saveAllUserDataMutateAsync } = trpc.data.saveAllUserData.useMutation();
  const { refetch: refetchBackendData } = trpc.data.getAllUserData.useQuery(
    { email: authenticatedEmail || '' },
    { enabled: false, retry: false, staleTime: 0 }
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery && filters.searchQuery.length > 0) count++;
    if (filters.shipNames && filters.shipNames.length > 0) count++;
    if (filters.departurePorts && filters.departurePorts.length > 0) count++;
    if (filters.destinations && filters.destinations.length > 0) count++;
    if (filters.minNights !== undefined) count++;
    if (filters.maxNights !== undefined) count++;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.dateRange) count++;
    if (filters.hasOffer !== undefined) count++;
    if (filters.hasFreeplay !== undefined) count++;
    if (filters.hasOBC !== undefined) count++;
    if (filters.cabinTypes && filters.cabinTypes.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  const persistData = useCallback(async <T,>(key: string, data: T) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`[CoreData] Persisted ${key}`);
    } catch (error) {
      console.error(`[CoreData] Failed to persist ${key}:`, error);
    }
  }, []);

  const syncToBackend = useCallback(async () => {
    if (!isBackendAvailable() || !authenticatedEmail) {
      console.log('[CoreData] Backend sync skipped - not authenticated or backend unavailable');
      return;
    }
    
    try {
      const [bookedData, offersData, eventsData, settingsData, pointsData, profileData, extendedLoyaltyData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.BOOKED_CRUISES),
        AsyncStorage.getItem(STORAGE_KEYS.CASINO_OFFERS),
        AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS),
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.USER_POINTS),
        AsyncStorage.getItem(STORAGE_KEYS.CLUB_PROFILE),
        AsyncStorage.getItem('easyseas_extended_loyalty_data'),
      ]);
      
      const parsedBooked = bookedData ? JSON.parse(bookedData) : [];
      const parsedOffers = offersData ? JSON.parse(offersData) : [];
      const parsedEvents = eventsData ? JSON.parse(eventsData) : [];
      const parsedSettings = settingsData ? JSON.parse(settingsData) : undefined;
      const parsedPoints = pointsData ? parseInt(pointsData, 10) : undefined;
      const parsedProfile = profileData ? JSON.parse(profileData) : undefined;
      const parsedExtendedLoyalty = extendedLoyaltyData ? JSON.parse(extendedLoyaltyData) : undefined;
      
      console.log('[CoreData] Syncing to backend:', {
        email: authenticatedEmail,
        cruises: parsedBooked.length,
        offers: parsedOffers.length,
        events: parsedEvents.length,
      });
      
      await saveAllUserDataMutateAsync({
        email: authenticatedEmail,
        bookedCruises: parsedBooked,
        casinoOffers: parsedOffers,
        calendarEvents: parsedEvents,
        settings: parsedSettings,
        userPoints: parsedPoints,
        clubRoyaleProfile: parsedProfile,
        loyaltyData: parsedExtendedLoyalty,
      });
      
      console.log('[CoreData] ✅ Backend sync successful');
    } catch (error) {
      console.error('[CoreData] Backend sync failed:', error);
    }
  }, [saveAllUserDataMutateAsync, authenticatedEmail]);

  const loadFromBackend = useCallback(async () => {
    if (!isBackendAvailable() || !authenticatedEmail) {
      console.log('[CoreData] Backend load skipped - not authenticated or backend unavailable');
      return false;
    }
    
    try {
      console.log('[CoreData] 🔄 Loading data from backend for:', authenticatedEmail);
      const result = await refetchBackendData();
      
      if (result.data && result.data.found && result.data.data) {
        const userData = result.data.data;
        console.log('[CoreData] ✅ Backend data found:', {
          email: authenticatedEmail,
          cruises: userData.bookedCruises?.length || 0,
          offers: userData.casinoOffers?.length || 0,
          events: userData.calendarEvents?.length || 0,
          updatedAt: userData.updatedAt,
        });
        
        // Save all data to AsyncStorage
        const savePromises = [];
        if (userData.bookedCruises) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(userData.bookedCruises)));
        }
        if (userData.casinoOffers) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(userData.casinoOffers)));
        }
        if (userData.calendarEvents) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(userData.calendarEvents)));
        }
        if (userData.settings) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(userData.settings)));
        }
        if (userData.userPoints !== undefined) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.USER_POINTS, userData.userPoints.toString()));
        }
        if (userData.clubRoyaleProfile) {
          savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.CLUB_PROFILE, JSON.stringify(userData.clubRoyaleProfile)));
        }
        if (userData.loyaltyData) {
          savePromises.push(AsyncStorage.setItem('easyseas_extended_loyalty_data', JSON.stringify(userData.loyaltyData)));
        }
        
        await Promise.all(savePromises);
        await AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
        
        console.log('[CoreData] ✅ Backend data loaded and cached locally');
        return true;
      }
      
      console.log('[CoreData] No backend data found for:', authenticatedEmail);
      return false;
    } catch (error) {
      console.error('[CoreData] Backend load failed:', error);
      return false;
    }
  }, [refetchBackendData, authenticatedEmail]);

  const loadFromStorage = useCallback(async (force = false) => {
    console.log('[CoreData] === START LOADING FROM STORAGE ===', { force, alreadyAttempted: loadAttemptedRef.current });
    if (loadAttemptedRef.current && !force) {
      console.log('[CoreData] Load already attempted, skipping');
      return;
    }
    setIsLoading(true);
    if (!force) {
      loadAttemptedRef.current = true;
    } else {
      console.log('[CoreData] Force reload requested, resetting attempt flag');
      loadAttemptedRef.current = true;
    }
    
    try {
      // Try to load from backend first if authenticated
      if (authenticatedEmail) {
        const hasBackendData = await loadFromBackend();
        if (hasBackendData) {
          console.log('[CoreData] Loaded user data from backend, will refresh from storage');
        }
      }
      
      console.log('[CoreData] Loading from storage...');

      const storagePromises = [
        AsyncStorage.getItem(STORAGE_KEYS.CRUISES).catch(e => { console.error('[CoreData] Error loading cruises:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.BOOKED_CRUISES).catch(e => { console.error('[CoreData] Error loading booked:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.CASINO_OFFERS).catch(e => { console.error('[CoreData] Error loading offers:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS).catch(e => { console.error('[CoreData] Error loading events:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC).catch(e => { console.error('[CoreData] Error loading lastSync:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS).catch(e => { console.error('[CoreData] Error loading settings:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.USER_POINTS).catch(e => { console.error('[CoreData] Error loading points:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.CLUB_PROFILE).catch(e => { console.error('[CoreData] Error loading profile:', e); return null; }),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_IMPORTED_DATA).catch(e => { console.error('[CoreData] Error loading import flag:', e); return null; }),
      ];

      const [cruisesData, bookedData, offersData, eventsData, lastSync, settingsData, pointsData, profileData, hasImportedData] = await Promise.all(storagePromises);
      console.log('[CoreData] Storage promises resolved');

      const hasImported = hasImportedData === 'true';
      const hasAnyExistingData = !!(bookedData || offersData || profileData || pointsData || cruisesData);
      
      // Parse existing data to check if there's any real (non-mock) data
      const parsedBookedData = bookedData ? JSON.parse(bookedData) : [];
      const parsedOffersData = offersData ? JSON.parse(offersData) : [];
      const hasRealData = parsedBookedData.length > 0 || parsedOffersData.length > 0;
      
      // Don't treat as first time user if:
      // 1. Cloud sync hasn't completed yet or cloud has data
      // 2. There's ANY existing data (prevents showing sample data to returning users)
      const isFirstTimeUser = hasImportedData === null && !hasAnyExistingData && initialCheckComplete && !hasCloudData;
      console.log('[CoreData] Data status:', { 
        hasImported, 
        isFirstTimeUser, 
        hasAnyExistingData, 
        hasRealData,
        bookedCount: parsedBookedData.length,
        offersCount: parsedOffersData.length,
        initialCheckComplete, 
        hasCloudData 
      });

      // Only show offers if they exist (no mock offers)
      console.log('[CoreData] Parsed offers:', parsedOffersData.length);
      setCasinoOffersState(parsedOffersData);

      if (cruisesData) {
        const parsedCruises = JSON.parse(cruisesData) as Cruise[];
        setCruisesState(parsedCruises);
      }
      
      const today = new Date();
      const transitionCruisesToCompleted = (cruises: BookedCruise[]): BookedCruise[] => {
        return cruises.map((cruise: BookedCruise) => {
          if (cruise.returnDate) {
            const returnDate = new Date(cruise.returnDate);
            if (returnDate < today && cruise.completionState !== 'completed') {
              console.log('[CoreData] Auto-transitioning cruise to completed:', cruise.id, cruise.shipName, cruise.returnDate);
              return {
                ...cruise,
                status: 'completed',
                completionState: 'completed',
              };
            }
          }
          return cruise;
        });
      };

      let finalBookedCount = 0;
      
      if (bookedData && parsedBookedData.length > 0) {
        console.log('[CoreData] Found existing booked data, processing...');
        
        // Filter out any mock/demo cruises if real data exists
        const nonMockCruises = parsedBookedData.filter((cruise: any) => 
          !cruise.id?.includes('demo-') && 
          !cruise.id?.includes('booked-virtual') &&
          cruise.reservationNumber !== 'DEMO123' &&
          cruise.reservationNumber !== 'DEMO456' &&
          cruise.shipName !== 'Virtually a Ship of the Seas'
        );
        
        console.log('[CoreData] Filtered cruises:', { 
          original: parsedBookedData.length, 
          afterFilter: nonMockCruises.length 
        });
        
        const withTransition = transitionCruisesToCompleted(nonMockCruises);
        const withItineraries = enrichCruisesWithMockItineraries(withTransition);
        const withKnownRetail = applyKnownRetailValues(withItineraries);
        const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
        const enrichedBooked = enrichCruisesWithReceiptData(withFreeplayOBC);
        finalBookedCount = enrichedBooked.length;
        setBookedCruisesState(enrichedBooked);
      } else if (isFirstTimeUser && !hasRealData) {
        console.log('[CoreData] First time user with no real data - loading sample demo data');
        const { sampleCruises, sampleOffers } = getFirstTimeUserSampleData();
        const withItineraries = enrichCruisesWithMockItineraries(sampleCruises);
        const withKnownRetail = applyKnownRetailValues(withItineraries);
        const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
        const enrichedSample = enrichCruisesWithReceiptData(withFreeplayOBC);
        finalBookedCount = enrichedSample.length;
        setBookedCruisesState(enrichedSample);
        setCasinoOffersState(sampleOffers);
        await AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(enrichedSample));
        await AsyncStorage.setItem(STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(sampleOffers));
        await AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
        console.log('[CoreData] Sample demo data loaded:', enrichedSample.length, 'cruises,', sampleOffers.length, 'offers');
      } else {
        console.log('[CoreData] No booked cruises or real data exists - keeping empty state');
        finalBookedCount = 0;
        setBookedCruisesState([]);
      }
      
      let parsedEvents: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
      
      console.log('[CoreData] Parsed events:', parsedEvents.length);
      setCalendarEventsState(parsedEvents);
      if (lastSync) setLastSyncDate(lastSync);
      
      if (settingsData) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) });
      }
      
      if (pointsData) {
        setUserPointsState(parseInt(pointsData, 10));
      }
      
      if (profileData) {
        setClubRoyaleProfileState(JSON.parse(profileData));
        console.log('[CoreData] Loaded existing loyalty profile');
      } else if (isFirstTimeUser) {
        console.log('[CoreData] First time user - initializing with default loyalty profile');
        setClubRoyaleProfileState(SAMPLE_CLUB_ROYALE_PROFILE);
      } else {
        console.log('[CoreData] No profile data, but not first time user - keeping current state');
      }

      console.log('[CoreData] === LOAD COMPLETE ===');
      console.log('[CoreData] Loaded data summary:', {
        cruises: cruisesData ? JSON.parse(cruisesData).length : 0,
        booked: finalBookedCount,
        offers: parsedOffersData.length,
        events: parsedEvents.length,
        hasImportedData: hasImported,
      });
      
      // Auto-sync to backend after load if authenticated
      if (authenticatedEmail && !isSyncingRef.current) {
        isSyncingRef.current = true;
        syncToBackend().finally(() => {
          isSyncingRef.current = false;
        });
      }
      
      // Mark initial load as complete
      isInitialLoadRef.current = false;
    } catch (error) {
      console.error('[CoreData] === LOAD FAILED ===');
      console.error('[CoreData] Error details:', error);
      console.error('[CoreData] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      setCruisesState([]);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
    }
    
    console.log('[CoreData] === SETTING isLoading to FALSE ===');
    setTimeout(() => {
      setIsLoading(false);
      console.log('[CoreData] === isLoading set to FALSE ===');
    }, 0);
  }, [loadFromBackend, initialCheckComplete, hasCloudData, authenticatedEmail, syncToBackend]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[CoreData] User not authenticated, clearing data');
      setCruisesState([]);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
      setIsLoading(false);
      loadAttemptedRef.current = false;
      return;
    }

    if (authenticatedEmail !== lastAuthEmailRef.current) {
      console.log('[CoreData] User changed from', lastAuthEmailRef.current, 'to', authenticatedEmail, '- reloading data');
      lastAuthEmailRef.current = authenticatedEmail;
      loadAttemptedRef.current = false;
      isInitialLoadRef.current = true;
      isSyncingRef.current = false;
      setCruisesState([]);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
      setClubRoyaleProfileState(SAMPLE_CLUB_ROYALE_PROFILE);
      setUserPointsState(0);
    }

    console.log('[CoreData] === MOUNT: Starting initial load ===');
    let isMounted = true;
    
    const loadTimeout = setTimeout(() => {
      console.warn('[CoreData] === TIMEOUT: Forcing load to complete after 1s ===');
      if (isMounted) {
        setIsLoading(false);
        console.log('[CoreData] === TIMEOUT: isLoading forced to FALSE ===');
      }
    }, 1000);
    
    const doLoad = async () => {
      try {
        // Wait for cloud sync check to complete before loading
        // This prevents showing sample data to returning users
        if (!initialCheckComplete) {
          console.log('[CoreData] === Waiting for cloud sync check to complete ===');
          return;
        }
        
        console.log('[CoreData] === Calling loadFromStorage ===');
        await loadFromStorage();
        console.log('[CoreData] === loadFromStorage completed ===');
      } catch (error) {
        console.error('[CoreData] === ERROR during load ===', error);
        if (isMounted) {
          setIsLoading(false);
        }
      } finally {
        if (isMounted) {
          clearTimeout(loadTimeout);
        }
      }
    };
    
    doLoad();
    
    return () => {
      console.log('[CoreData] === Cleanup: clearing timeout ===');
      isMounted = false;
      clearTimeout(loadTimeout);
    };
  }, [loadFromStorage, isAuthenticated, authenticatedEmail, initialCheckComplete]);

  // Auto-sync to backend when data changes (debounced)
  useEffect(() => {
    // Skip auto-sync during initial load or if already syncing
    if (!isAuthenticated || !authenticatedEmail || isInitialLoadRef.current || isSyncingRef.current) return;
    
    const syncTimeout = setTimeout(() => {
      if (!isSyncingRef.current) {
        console.log('[CoreData] Auto-syncing to backend...');
        isSyncingRef.current = true;
        syncToBackend().finally(() => {
          isSyncingRef.current = false;
        });
      }
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(syncTimeout);
  }, [bookedCruises, casinoOffers, calendarEvents, settings, userPoints, clubRoyaleProfile, isAuthenticated, authenticatedEmail, syncToBackend]);

  useEffect(() => {
    const handleSessionPointsUpdate = (event: any) => {
      const { cruiseId, points } = event.detail;
      console.log('[CoreDataProvider] Received points update event:', { cruiseId, points });
      
      setBookedCruisesState(prev => {
        const updated = prev.map(cruise => {
          if (cruise.id === cruiseId) {
            const currentPoints = cruise.earnedPoints || 0;
            const newPoints = currentPoints + points;
            console.log('[CoreDataProvider] Updating cruise points:', {
              cruiseId,
              oldPoints: currentPoints,
              addedPoints: points,
              newPoints,
            });
            return {
              ...cruise,
              earnedPoints: newPoints,
            };
          }
          return cruise;
        });
        
        persistData(STORAGE_KEYS.BOOKED_CRUISES, updated);
        return updated;
      });
    };

    const handleCloudDataRestored = () => {
      console.log('[CoreDataProvider] Cloud data restored event received, reloading data...');
      loadAttemptedRef.current = false;
      loadFromStorage(true);
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        const handleEntitlementProUnlocked = () => {
          console.log('[CoreDataProvider] entitlementProUnlocked event received, reloading data...');
          loadAttemptedRef.current = false;
          loadFromStorage(true);
        };

        window.addEventListener('casinoSessionPointsUpdated', handleSessionPointsUpdate as EventListener);
        window.addEventListener('cloudDataRestored', handleCloudDataRestored as EventListener);
        window.addEventListener('entitlementProUnlocked', handleEntitlementProUnlocked as EventListener);
        return () => {
          window.removeEventListener('casinoSessionPointsUpdated', handleSessionPointsUpdate as EventListener);
          window.removeEventListener('cloudDataRestored', handleCloudDataRestored as EventListener);
          window.removeEventListener('entitlementProUnlocked', handleEntitlementProUnlocked as EventListener);
        };
      }
    } catch (error) {
      console.log('[CoreDataProvider] Could not set up event listener (not on web):', error);
    }
  }, [persistData, loadFromStorage]);

  const setCruises = useCallback((newCruises: Cruise[]) => {
    setCruisesState(newCruises);
    persistData(STORAGE_KEYS.CRUISES, newCruises);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
  }, [persistData]);

  const addCruise = useCallback((cruise: Cruise) => {
    setCruisesState(prev => {
      const updated = [...prev, cruise];
      persistData(STORAGE_KEYS.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const updateCruise = useCallback((id: string, updates: Partial<Cruise>) => {
    setCruisesState(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      persistData(STORAGE_KEYS.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const removeCruise = useCallback((id: string) => {
    setCruisesState(prev => {
      const updated = prev.filter(c => c.id !== id);
      persistData(STORAGE_KEYS.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const setBookedCruises = useCallback((newCruises: BookedCruise[]) => {
    const booked = newCruises.filter(c => c.status !== 'available');
    
    // Filter out mock/demo cruises when setting real data
    const nonMockCruises = booked.filter(cruise => 
      !cruise.id?.includes('demo-') && 
      !cruise.id?.includes('booked-virtual') &&
      cruise.reservationNumber !== 'DEMO123' &&
      cruise.reservationNumber !== 'DEMO456' &&
      cruise.shipName !== 'Virtually a Ship of the Seas'
    );
    
    console.log('[CoreData] Setting booked cruises:', { 
      total: booked.length, 
      nonMock: nonMockCruises.length 
    });
    
    const withItineraries = enrichCruisesWithMockItineraries(nonMockCruises);
    const withKnownRetail = applyKnownRetailValues(withItineraries);
    const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
    const enrichedCruises = enrichCruisesWithReceiptData(withFreeplayOBC);
    setBookedCruisesState(enrichedCruises);
    persistData(STORAGE_KEYS.BOOKED_CRUISES, enrichedCruises);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const addBookedCruise = useCallback((cruise: BookedCruise) => {
    setBookedCruisesState(prev => {
      const updated = [...prev, cruise];
      persistData(STORAGE_KEYS.BOOKED_CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const updateBookedCruise = useCallback((id: string, updates: Partial<BookedCruise>) => {
    setBookedCruisesState(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      persistData(STORAGE_KEYS.BOOKED_CRUISES, updated);
      
      if (updates.earnedPoints !== undefined) {
        console.log('[CoreDataProvider] Cruise points updated via updateBookedCruise:', {
          cruiseId: id,
          newPoints: updates.earnedPoints,
        });
      }
      
      return updated;
    });
  }, [persistData]);

  const removeBookedCruise = useCallback((id: string) => {
    setBookedCruisesState(prev => {
      const { BOOKED_CRUISES_DATA, COMPLETED_CRUISES_DATA } = getMockCruises();
      const allMockCruises = [
        ...COMPLETED_CRUISES_DATA,
        ...BOOKED_CRUISES_DATA
      ];
      const isMockCruise = allMockCruises.some(mc => mc.id === id);
      
      if (isMockCruise) {
        AsyncStorage.getItem(STORAGE_KEYS.REMOVED_MOCK_CRUISES)
          .then(data => {
            const existing = data ? new Set<string>(JSON.parse(data)) : new Set<string>();
            existing.add(id);
            return AsyncStorage.setItem(STORAGE_KEYS.REMOVED_MOCK_CRUISES, JSON.stringify([...existing]));
          })
          .then(() => {
            console.log('[CoreData] Marked mock cruise as removed:', id);
          })
          .catch(console.error);
      }
      
      const updated = prev.filter(c => c.id !== id);
      persistData(STORAGE_KEYS.BOOKED_CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const setCasinoOffers = useCallback((newOffers: CasinoOffer[]) => {
    // Filter out demo offers when setting real offers
    const nonMockOffers = newOffers.filter(offer => 
      !offer.id?.includes('demo-') &&
      offer.offerCode !== 'NOWHERE2025'
    );
    
    console.log('[CoreData] Setting casino offers:', { 
      total: newOffers.length, 
      nonMock: nonMockOffers.length 
    });
    
    setCasinoOffersState(nonMockOffers);
    persistData(STORAGE_KEYS.CASINO_OFFERS, nonMockOffers);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const addCasinoOffer = useCallback((offer: CasinoOffer) => {
    setCasinoOffersState(prev => {
      const updated = [...prev, offer];
      persistData(STORAGE_KEYS.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const updateCasinoOffer = useCallback((id: string, updates: Partial<CasinoOffer>) => {
    setCasinoOffersState(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      persistData(STORAGE_KEYS.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const removeCasinoOffer = useCallback((id: string) => {
    setCasinoOffersState(prev => {
      const updated = prev.filter(o => o.id !== id);
      persistData(STORAGE_KEYS.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const setCalendarEvents = useCallback((newEvents: CalendarEvent[]) => {
    setCalendarEventsState(newEvents);
    persistData(STORAGE_KEYS.CALENDAR_EVENTS, newEvents);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
  }, [persistData]);

  const addCalendarEvent = useCallback((event: CalendarEvent) => {
    setCalendarEventsState(prev => {
      const updated = [...prev, event];
      persistData(STORAGE_KEYS.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [persistData]);

  const updateCalendarEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setCalendarEventsState(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      persistData(STORAGE_KEYS.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [persistData]);

  const removeCalendarEvent = useCallback((id: string) => {
    setCalendarEventsState(prev => {
      const updated = prev.filter(e => e.id !== id);
      persistData(STORAGE_KEYS.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [persistData]);

  const setFilter = useCallback(<K extends keyof CruiseFilter>(key: K, value: CruiseFilter[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<CruiseFilter>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const clearFilter = useCallback((key: keyof CruiseFilter) => {
    setFiltersState(prev => ({ ...prev, [key]: DEFAULT_FILTERS[key] }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  }, []);

  const setUserPoints = useCallback((points: number) => {
    setUserPointsState(points);
    AsyncStorage.setItem(STORAGE_KEYS.USER_POINTS, points.toString()).catch(console.error);
  }, []);

  const setClubRoyaleProfile = useCallback((profile: ClubRoyaleProfile) => {
    setClubRoyaleProfileState(profile);
    AsyncStorage.setItem(STORAGE_KEYS.CLUB_PROFILE, JSON.stringify(profile)).catch(console.error);
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      console.log('[CoreData] Clearing all data and preventing mock data from loading...');
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.CRUISES),
        AsyncStorage.removeItem(STORAGE_KEYS.BOOKED_CRUISES),
        AsyncStorage.removeItem(STORAGE_KEYS.CASINO_OFFERS),
        AsyncStorage.removeItem(STORAGE_KEYS.CALENDAR_EVENTS),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
        AsyncStorage.removeItem(STORAGE_KEYS.REMOVED_MOCK_CRUISES),
        AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true'),
      ]);
      setCruisesState([]);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
      setLastSyncDate(null);
      console.log('[CoreData] All data cleared successfully - state reset to empty arrays, mock data prevented from loading');
    } catch (error) {
      console.error('[CoreData] Failed to clear data:', error);
      throw error;
    }
  }, []);

  const refreshData = useCallback(async () => {
    console.log('[CoreData] === REFRESH DATA CALLED (FORCE RELOAD) ===');
    await loadFromStorage(true);
  }, [loadFromStorage]);

  const restoreMockData = useCallback(async () => {
    try {
      console.log('[CoreData] Restoring mock data to AsyncStorage...');
      const { BOOKED_CRUISES_DATA, COMPLETED_CRUISES_DATA } = getMockCruises();
      const allMockCruises = [
        ...COMPLETED_CRUISES_DATA,
        ...BOOKED_CRUISES_DATA
      ];
      
      const withItineraries = enrichCruisesWithMockItineraries(allMockCruises);
      const withKnownRetail = applyKnownRetailValues(withItineraries);
      const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
      const enrichedCruises = enrichCruisesWithReceiptData(withFreeplayOBC);
      
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(enrichedCruises)),
        AsyncStorage.removeItem(STORAGE_KEYS.HAS_IMPORTED_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.REMOVED_MOCK_CRUISES),
      ]);
      
      setBookedCruisesState(enrichedCruises);
      console.log('[CoreData] Mock data restored successfully:', enrichedCruises.length, 'cruises');
    } catch (error) {
      console.error('[CoreData] Failed to restore mock data:', error);
      throw error;
    }
  }, []);

  const completedCruises = useMemo(() => {
    return bookedCruises.filter(cruise => {
      const isCompleted = cruise.completionState === 'completed' || cruise.status === 'completed';
      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        const today = new Date();
        return isCompleted || returnDate < today;
      }
      return isCompleted;
    });
  }, [bookedCruises]);

  return {
    cruises,
    bookedCruises,
    completedCruises,
    casinoOffers,
    calendarEvents,
    isLoading,
    lastSyncDate,
    filters,
    activeFilterCount,
    hasActiveFilters,
    settings,
    userPoints,
    clubRoyaleProfile,
    hasLocalData,
    setCruises,
    addCruise,
    updateCruise,
    removeCruise,
    setBookedCruises,
    addBookedCruise,
    updateBookedCruise,
    removeBookedCruise,
    setCasinoOffers,
    addCasinoOffer,
    updateCasinoOffer,
    removeCasinoOffer,
    setCalendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    removeCalendarEvent,
    setFilter,
    setFilters,
    clearFilters,
    clearFilter,
    updateSettings,
    setUserPoints,
    setClubRoyaleProfile,
    clearAllData,
    refreshData,
    restoreMockData,
  };
});
