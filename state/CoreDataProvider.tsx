import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
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

  const hasLocalData = cruises.length > 0 || bookedCruises.length > 0 || casinoOffers.length > 0 || calendarEvents.length > 0;

  const userId = authenticatedEmail || 'anonymous';
  const saveToBackendMutation = trpc.data.saveUserData.useMutation();
  const { refetch: refetchBackendData } = trpc.data.getUserData.useQuery(
    { userId },
    { enabled: false, retry: false }
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
    // Backend sync is optional - silently skip if not configured
    try {
      const bookedData = await AsyncStorage.getItem(STORAGE_KEYS.BOOKED_CRUISES);
      const offersData = await AsyncStorage.getItem(STORAGE_KEYS.CASINO_OFFERS);
      
      const parsedBooked = bookedData ? JSON.parse(bookedData) : [];
      const parsedOffers = offersData ? JSON.parse(offersData) : [];
      
      // Only attempt sync if we have data
      if (parsedBooked.length === 0 && parsedOffers.length === 0) {
        return;
      }
      
      console.log('[CoreData] Attempting backend sync:', {
        cruises: parsedBooked.length,
        offers: parsedOffers.length,
      });
      
      await saveToBackendMutation.mutateAsync({
        userId,
        bookedCruises: parsedBooked,
        casinoOffers: parsedOffers,
      });
      
      console.log('[CoreData] Backend sync successful');
    } catch {
      // Silently ignore backend errors - local storage is the primary source
      console.log('[CoreData] Backend sync skipped (not configured or unavailable)');
    }
  }, [saveToBackendMutation, userId]);

  const loadFromBackend = useCallback(async () => {
    // Backend load is optional - silently skip if not configured
    try {
      console.log('[CoreData] Attempting to load from backend...');
      const result = await refetchBackendData();
      
      if (result.data && result.data.bookedCruises && result.data.bookedCruises.length > 0) {
        console.log('[CoreData] Backend data found:', {
          cruises: result.data.bookedCruises.length,
          offers: result.data.casinoOffers?.length || 0,
        });
        
        await AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(result.data.bookedCruises));
        if (result.data.casinoOffers) {
          await AsyncStorage.setItem(STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(result.data.casinoOffers));
        }
        
        return true;
      }
      
      console.log('[CoreData] No backend data found');
      return false;
    } catch {
      // Silently ignore backend errors - local storage is the primary source
      console.log('[CoreData] Backend load skipped (not configured or unavailable)');
      return false;
    }
  }, [refetchBackendData]);

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
      // Try backend load but don't block on it
      loadFromBackend().catch(() => {});
      
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
      const isFirstTimeUser = hasImportedData === null && !hasAnyExistingData;
      console.log('[CoreData] Has imported data flag:', hasImported, 'isFirstTimeUser:', isFirstTimeUser, 'hasAnyExistingData:', hasAnyExistingData);

      const parsedOffers: CasinoOffer[] = offersData ? JSON.parse(offersData) : [];
      console.log('[CoreData] Parsed offers:', parsedOffers.length);
      setCasinoOffersState(parsedOffers);

      if (cruisesData) {
        const parsedCruises = JSON.parse(cruisesData) as Cruise[];
        setCruisesState(parsedCruises);
      }
      
      const today = new Date();
      const transitionCruisesToCompleted = (cruises: BookedCruise[]): BookedCruise[] => {
        return cruises.map(cruise => {
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
      
      if (bookedData) {
        const parsedBooked = JSON.parse(bookedData) as BookedCruise[];
        console.log('[CoreData] Found existing booked data, processing...');
        const withTransition = transitionCruisesToCompleted(parsedBooked);
        const withItineraries = enrichCruisesWithMockItineraries(withTransition);
        const withKnownRetail = applyKnownRetailValues(withItineraries);
        const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
        const enrichedBooked = enrichCruisesWithReceiptData(withFreeplayOBC);
        finalBookedCount = enrichedBooked.length;
        setBookedCruisesState(enrichedBooked);
      } else if (isFirstTimeUser) {
        console.log('[CoreData] First time user detected - starting with empty data');
        finalBookedCount = 0;
        setBookedCruisesState([]);
        await AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true');
      } else {
        console.log('[CoreData] No booked cruises, keeping empty state');
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
        offers: parsedOffers.length,
        events: parsedEvents.length,
        hasImportedData: hasImported,
      });
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
  }, [loadFromBackend]);

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
  }, [loadFromStorage, isAuthenticated, authenticatedEmail]);

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

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('casinoSessionPointsUpdated', handleSessionPointsUpdate as EventListener);
        return () => {
          window.removeEventListener('casinoSessionPointsUpdated', handleSessionPointsUpdate as EventListener);
        };
      }
    } catch (error) {
      console.log('[CoreDataProvider] Could not set up event listener (not on web):', error);
    }
  }, [persistData]);

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
    const withItineraries = enrichCruisesWithMockItineraries(booked);
    const withKnownRetail = applyKnownRetailValues(withItineraries);
    const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
    const enrichedCruises = enrichCruisesWithReceiptData(withFreeplayOBC);
    setBookedCruisesState(enrichedCruises);
    persistData(STORAGE_KEYS.BOOKED_CRUISES, enrichedCruises);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
    syncToBackend().catch(console.error);
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
    setCasinoOffersState(newOffers);
    persistData(STORAGE_KEYS.CASINO_OFFERS, newOffers);
    AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, 'true').catch(console.error);
    syncToBackend().catch(console.error);
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
