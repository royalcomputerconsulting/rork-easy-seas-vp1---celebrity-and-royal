import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
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
import { DEFAULT_SETTINGS, getScopedStorageKeys, type AppSettings } from "./coreData/storageConfig";
import {
  readAllStorageKeys,
  determineUserStatus,
  processBookedCruises,
  processCalendarEvents,
  processMetadata,
} from "./coreData/storageLoaders";
import { clearUserSpecificData } from "@/lib/storage/storageOperations";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";

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

function parseOptionalStoredNumber(value: string | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsedValue = parseInt(value, 10);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function normalizeLoyaltySyncPayload(loyaltyData: unknown): {
  extendedLoyaltyData: unknown;
  manualClubRoyalePoints: number | null;
  manualCrownAnchorPoints: number | null;
} | null {
  if (!loyaltyData || typeof loyaltyData !== 'object') {
    return null;
  }

  const loyaltyRecord = loyaltyData as Record<string, unknown>;
  if (
    Object.prototype.hasOwnProperty.call(loyaltyRecord, 'extendedLoyaltyData') ||
    Object.prototype.hasOwnProperty.call(loyaltyRecord, 'manualClubRoyalePoints') ||
    Object.prototype.hasOwnProperty.call(loyaltyRecord, 'manualCrownAnchorPoints')
  ) {
    return {
      extendedLoyaltyData: loyaltyRecord.extendedLoyaltyData ?? null,
      manualClubRoyalePoints: typeof loyaltyRecord.manualClubRoyalePoints === 'number' ? loyaltyRecord.manualClubRoyalePoints : null,
      manualCrownAnchorPoints: typeof loyaltyRecord.manualCrownAnchorPoints === 'number' ? loyaltyRecord.manualCrownAnchorPoints : null,
    };
  }

  return {
    extendedLoyaltyData: loyaltyData,
    manualClubRoyalePoints: null,
    manualCrownAnchorPoints: null,
  };
}

function parseStoredTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function getStoredItemCount(rawValue: string | null): number {
  if (!rawValue) {
    return 0;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsedValue)) {
      return parsedValue.length;
    }

    if (parsedValue && typeof parsedValue === 'object') {
      return Object.keys(parsedValue as Record<string, unknown>).length > 0 ? 1 : 0;
    }

    return parsedValue ? 1 : 0;
  } catch {
    return rawValue.trim().length > 0 ? 1 : 0;
  }
}

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
  
  setCruises: (cruises: Cruise[]) => Promise<void>;
  addCruise: (cruise: Cruise) => void;
  updateCruise: (id: string, updates: Partial<Cruise>) => void;
  removeCruise: (id: string) => void;
  
  setBookedCruises: (cruises: BookedCruise[]) => Promise<void>;
  addBookedCruise: (cruise: BookedCruise) => void;
  updateBookedCruise: (id: string, updates: Partial<BookedCruise>) => void;
  removeBookedCruise: (id: string) => void;
  
  setCasinoOffers: (offers: CasinoOffer[]) => Promise<void>;
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
  syncToBackend: () => Promise<void>;
  
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  restoreMockData: () => Promise<void>;
}















export const [CoreDataProvider, useCoreData] = createContextHook((): CoreDataState => {

  const { authenticatedEmail, isAuthenticated } = useAuth();
  const { initialCheckComplete, hasCloudData } = useUserDataSync();

  const skRef = useRef(getScopedStorageKeys(authenticatedEmail));
  useEffect(() => {
    skRef.current = getScopedStorageKeys(authenticatedEmail);
    console.log('[CoreData] Scoped storage keys updated for user:', authenticatedEmail);
  }, [authenticatedEmail]);

  const [cruises, setCruisesState] = useState<Cruise[]>([]);
  const [bookedCruises, setBookedCruisesState] = useState<BookedCruise[]>([]);
  const [casinoOffers, setCasinoOffersState] = useState<CasinoOffer[]>([]);
  const [calendarEvents, setCalendarEventsState] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadAttemptedRef = useRef(false);
  const lastAuthEmailRef = useRef<string | null>(null);
  const accountSwitchClearingRef = useRef<Promise<void> | null>(null);

  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  
  const [filters, setFiltersState] = useState<CruiseFilter>(DEFAULT_FILTERS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userPoints, setUserPointsState] = useState(0);
  const [clubRoyaleProfile, setClubRoyaleProfileState] = useState<ClubRoyaleProfile>(SAMPLE_CLUB_ROYALE_PROFILE);
  const isSyncingRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const foregroundRefreshAttemptRef = useRef(0);

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

  const persistLastSyncDate = useCallback(async (timestamp?: string) => {
    const nextTimestamp = timestamp ?? new Date().toISOString();

    try {
      await AsyncStorage.setItem(skRef.current.LAST_SYNC, nextTimestamp);
      setLastSyncDate(nextTimestamp);
      console.log('[CoreData] Updated last sync timestamp:', nextTimestamp);
    } catch (error) {
      console.error('[CoreData] Failed to persist last sync timestamp:', error);
    }
  }, []);

  const persistData = useCallback(async <T,>(
    key: string,
    data: T,
    options?: { updateLastSync?: boolean; syncTimestamp?: string }
  ) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      if (options?.updateLastSync ?? true) {
        await persistLastSyncDate(options?.syncTimestamp);
      }
      console.log(`[CoreData] Persisted ${key}`);
    } catch (error) {
      console.error(`[CoreData] Failed to persist ${key}:`, error);
    }
  }, [persistLastSyncDate]);

  const syncToBackend = useCallback(async () => {
    if (!authenticatedEmail) {
      console.log('[CoreData] Backend sync skipped - no authenticated email');
      return;
    }

    if (!isBackendAvailable()) {
      console.log('[CoreData] Backend health cache says unavailable, attempting sync anyway to avoid stale cloud data');
    }
    
    try {
      const scopedKeys = getScopedStorageKeys(authenticatedEmail);
      const scopedLoyaltyKeys = {
        EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail),
        MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail),
        MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail),
      };
      const [cruisesData, bookedData, offersData, eventsData, settingsData, pointsData, profileData, extendedLoyaltyDataRaw, manualClubRoyalePointsRaw, manualCrownAnchorPointsRaw] = await Promise.all([
        AsyncStorage.getItem(scopedKeys.CRUISES),
        AsyncStorage.getItem(scopedKeys.BOOKED_CRUISES),
        AsyncStorage.getItem(scopedKeys.CASINO_OFFERS),
        AsyncStorage.getItem(scopedKeys.CALENDAR_EVENTS),
        AsyncStorage.getItem(scopedKeys.SETTINGS),
        AsyncStorage.getItem(scopedKeys.USER_POINTS),
        AsyncStorage.getItem(scopedKeys.CLUB_PROFILE),
        AsyncStorage.getItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA),
        AsyncStorage.getItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS),
        AsyncStorage.getItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS),
      ]);
      
      const parsedCruises = cruisesData ? JSON.parse(cruisesData) : [];
      const parsedBooked = bookedData ? JSON.parse(bookedData) : [];
      const parsedOffers = offersData ? JSON.parse(offersData) : [];
      const parsedEvents = eventsData ? JSON.parse(eventsData) : [];
      const parsedSettings = settingsData ? JSON.parse(settingsData) : undefined;
      const parsedPoints = pointsData ? parseInt(pointsData, 10) : undefined;
      const parsedProfile = profileData ? JSON.parse(profileData) : undefined;
      const parsedExtendedLoyalty = extendedLoyaltyDataRaw
        ? {
            extendedLoyaltyData: JSON.parse(extendedLoyaltyDataRaw),
            manualClubRoyalePoints: parseOptionalStoredNumber(manualClubRoyalePointsRaw),
            manualCrownAnchorPoints: parseOptionalStoredNumber(manualCrownAnchorPointsRaw),
          }
        : (
            parseOptionalStoredNumber(manualClubRoyalePointsRaw) !== null || parseOptionalStoredNumber(manualCrownAnchorPointsRaw) !== null
              ? {
                  extendedLoyaltyData: null,
                  manualClubRoyalePoints: parseOptionalStoredNumber(manualClubRoyalePointsRaw),
                  manualCrownAnchorPoints: parseOptionalStoredNumber(manualCrownAnchorPointsRaw),
                }
              : undefined
          );
      
      console.log('[CoreData] Syncing to backend:', {
        email: authenticatedEmail,
        availableCruises: parsedCruises.length,
        cruises: parsedBooked.length,
        offers: parsedOffers.length,
        events: parsedEvents.length,
      });
      
      const syncResult = await saveAllUserDataMutateAsync({
        email: authenticatedEmail,
        cruises: parsedCruises,
        bookedCruises: parsedBooked,
        casinoOffers: parsedOffers,
        calendarEvents: parsedEvents,
        settings: parsedSettings,
        userPoints: parsedPoints,
        clubRoyaleProfile: parsedProfile,
        loyaltyData: parsedExtendedLoyalty,
      });

      const syncTimestamp = typeof syncResult?.updatedAt === 'string' ? syncResult.updatedAt : new Date().toISOString();
      await AsyncStorage.setItem(scopedKeys.LAST_SYNC, syncTimestamp);
      setLastSyncDate(syncTimestamp);
      
      console.log('[CoreData] ✅ Backend sync successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);
      
      if (['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(errorMessage)) {
        console.log('[CoreData] Backend sync skipped:', errorMessage);
      } else if (errorString.includes('Failed to fetch') || errorString.includes('Network request failed')) {
        console.log('[CoreData] Backend sync skipped: Network error - backend may be unavailable');
      } else {
        console.log('[CoreData] Backend sync failed (non-critical):', errorMessage);
      }
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
        const scopedKeys = getScopedStorageKeys(authenticatedEmail);
        const [localLastSyncRaw, localCruisesRaw, localBookedRaw, localOffersRaw, localEventsRaw] = await Promise.all([
          AsyncStorage.getItem(scopedKeys.LAST_SYNC),
          AsyncStorage.getItem(scopedKeys.CRUISES),
          AsyncStorage.getItem(scopedKeys.BOOKED_CRUISES),
          AsyncStorage.getItem(scopedKeys.CASINO_OFFERS),
          AsyncStorage.getItem(scopedKeys.CALENDAR_EVENTS),
        ]);

        const backendUpdatedAtMs = parseStoredTimestamp(userData.updatedAt);
        const localLastSyncMs = parseStoredTimestamp(localLastSyncRaw);
        const localSummary = {
          cruises: getStoredItemCount(localCruisesRaw),
          bookedCruises: getStoredItemCount(localBookedRaw),
          casinoOffers: getStoredItemCount(localOffersRaw),
          calendarEvents: getStoredItemCount(localEventsRaw),
        };
        const backendSummary = {
          cruises: userData.cruises?.length ?? 0,
          bookedCruises: userData.bookedCruises?.length ?? 0,
          casinoOffers: userData.casinoOffers?.length ?? 0,
          calendarEvents: userData.calendarEvents?.length ?? 0,
        };
        const localHasMeaningfulData = Object.values(localSummary).some((count) => count > 0);
        const localHasMoreData =
          localSummary.cruises > backendSummary.cruises ||
          localSummary.bookedCruises > backendSummary.bookedCruises ||
          localSummary.casinoOffers > backendSummary.casinoOffers ||
          localSummary.calendarEvents > backendSummary.calendarEvents;
        const shouldPreferLocalData =
          localHasMeaningfulData &&
          ((localLastSyncMs !== null && (backendUpdatedAtMs === null || localLastSyncMs > backendUpdatedAtMs)) ||
            (localHasMoreData && (backendUpdatedAtMs === null || localLastSyncMs === null || localLastSyncMs >= backendUpdatedAtMs)));

        console.log('[CoreData] ✅ Backend data found:', {
          email: authenticatedEmail,
          availableCruises: userData.cruises?.length || 0,
          cruises: userData.bookedCruises?.length || 0,
          offers: userData.casinoOffers?.length || 0,
          events: userData.calendarEvents?.length || 0,
          updatedAt: userData.updatedAt,
          localLastSync: localLastSyncRaw,
          localSummary,
        });

        if (shouldPreferLocalData) {
          console.log('[CoreData] Skipping backend restore because local data is newer or richer than cloud data', {
            email: authenticatedEmail,
            localLastSync: localLastSyncRaw,
            backendUpdatedAt: userData.updatedAt,
            localSummary,
            backendSummary,
          });
          return false;
        }
        
        const savePromises: Promise<void>[] = [];
        if (userData.cruises) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.CRUISES, JSON.stringify(userData.cruises)));
        }
        if (userData.bookedCruises) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.BOOKED_CRUISES, JSON.stringify(userData.bookedCruises)));
        }
        if (userData.casinoOffers) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.CASINO_OFFERS, JSON.stringify(userData.casinoOffers)));
        }
        if (userData.calendarEvents) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.CALENDAR_EVENTS, JSON.stringify(userData.calendarEvents)));
        }
        if (userData.settings) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.SETTINGS, JSON.stringify(userData.settings)));
        }
        if (userData.userPoints !== undefined) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.USER_POINTS, userData.userPoints.toString()));
        }
        if (userData.clubRoyaleProfile) {
          savePromises.push(AsyncStorage.setItem(scopedKeys.CLUB_PROFILE, JSON.stringify(userData.clubRoyaleProfile)));
        }
        if (userData.loyaltyData !== undefined) {
          const normalizedLoyaltyData = normalizeLoyaltySyncPayload(userData.loyaltyData);
          const scopedLoyaltyKeys = {
            EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail),
            MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail),
            MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail),
          };

          const extendedLoyaltyData = normalizedLoyaltyData?.extendedLoyaltyData ?? null;
          const manualClubRoyalePoints = normalizedLoyaltyData?.manualClubRoyalePoints ?? null;
          const manualCrownAnchorPoints = normalizedLoyaltyData?.manualCrownAnchorPoints ?? null;

          if (extendedLoyaltyData !== null) {
            savePromises.push(AsyncStorage.setItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA, JSON.stringify(extendedLoyaltyData)));
          } else {
            savePromises.push(AsyncStorage.removeItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA));
          }

          if (manualClubRoyalePoints !== null) {
            savePromises.push(AsyncStorage.setItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS, manualClubRoyalePoints.toString()));
          } else {
            savePromises.push(AsyncStorage.removeItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS));
          }

          if (manualCrownAnchorPoints !== null) {
            savePromises.push(AsyncStorage.setItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS, manualCrownAnchorPoints.toString()));
          } else {
            savePromises.push(AsyncStorage.removeItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS));
          }
        }

        const backendTimestamp = typeof userData.updatedAt === 'string' ? userData.updatedAt : new Date().toISOString();
        savePromises.push(AsyncStorage.setItem(scopedKeys.LAST_SYNC, backendTimestamp));
        
        await Promise.all(savePromises);
        setLastSyncDate(backendTimestamp);
        await AsyncStorage.setItem(scopedKeys.HAS_IMPORTED_DATA, 'true');
        
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
      if (authenticatedEmail) {
        const hasBackendData = await loadFromBackend();
        if (hasBackendData) {
          console.log('[CoreData] Loaded user data from backend, will refresh from storage');
        }
      }

      const snapshot = await readAllStorageKeys(authenticatedEmail);
      const status = determineUserStatus(snapshot, initialCheckComplete, hasCloudData);

      console.log('[CoreData] Parsed offers:', status.parsedOffersData.length);
      setCasinoOffersState(status.parsedOffersData);

      if (snapshot.cruisesData) {
        const parsedCruises = JSON.parse(snapshot.cruisesData) as Cruise[];
        setCruisesState(parsedCruises);
      }

      const bookedResult = await processBookedCruises(status, snapshot, getMockCruises, getFirstTimeUserSampleData, authenticatedEmail);
      setBookedCruisesState(bookedResult.bookedCruises);

      if (bookedResult.offersOverride) {
        setCasinoOffersState(bookedResult.offersOverride);
      }

      if (bookedResult.shouldPersistMergedCruises) {
        await persistData(skRef.current.BOOKED_CRUISES, bookedResult.bookedCruises);
        console.log('[CoreData] Persisted merged cruise data with', bookedResult.bookedCruises.length, 'cruises');
      }

      if (bookedResult.shouldPersistFirstTimeData) {
        await AsyncStorage.setItem(skRef.current.BOOKED_CRUISES, JSON.stringify(bookedResult.bookedCruises));
        if (bookedResult.offersOverride) {
          await AsyncStorage.setItem(skRef.current.CASINO_OFFERS, JSON.stringify(bookedResult.offersOverride));
        }
        await AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true');
        console.log('[CoreData] First-time user data persisted');
      }

      const eventsResult = processCalendarEvents(snapshot, status, bookedResult.finalBookedCount);
      if (eventsResult.shouldPersist) {
        await persistData(skRef.current.CALENDAR_EVENTS, eventsResult.events);
      }
      setCalendarEventsState(eventsResult.events);

      if (snapshot.lastSync) setLastSyncDate(snapshot.lastSync);

      const metadata = processMetadata(snapshot, status.isFirstTimeUser);
      if (metadata.settings) setSettings(metadata.settings);
      if (metadata.userPoints !== null) setUserPointsState(metadata.userPoints);
      if (metadata.clubRoyaleProfile) setClubRoyaleProfileState(metadata.clubRoyaleProfile);

      console.log('[CoreData] === LOAD COMPLETE ===');
      console.log('[CoreData] Loaded data summary:', {
        cruises: snapshot.cruisesData ? JSON.parse(snapshot.cruisesData).length : 0,
        booked: bookedResult.finalBookedCount,
        offers: status.parsedOffersData.length,
        events: eventsResult.events.length,
        hasImportedData: status.hasImported,
      });

      if (authenticatedEmail && !isSyncingRef.current) {
        isSyncingRef.current = true;
        void syncToBackend().finally(() => {
          isSyncingRef.current = false;
        });
      }

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
  }, [loadFromBackend, initialCheckComplete, hasCloudData, authenticatedEmail, syncToBackend, persistData]);

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
      const previousEmail = lastAuthEmailRef.current;
      console.log('[CoreData] User changed from', previousEmail, 'to', authenticatedEmail, '- clearing ALL local data and reloading');
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
      setSettings(DEFAULT_SETTINGS);
      setLastSyncDate(null);

      if (previousEmail !== null) {
        console.log('[CoreData] Account switch detected - clearing AsyncStorage user data to prevent data leakage');
        accountSwitchClearingRef.current = clearUserSpecificData().then(() => {
          console.log('[CoreData] AsyncStorage user data cleared for account switch');
        }).catch((err) => {
          console.error('[CoreData] Failed to clear AsyncStorage on account switch:', err);
        }).finally(() => {
          accountSwitchClearingRef.current = null;
        });
      }
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
      let didStartStorageLoad = false;

      try {
        if (accountSwitchClearingRef.current) {
          console.log('[CoreData] === Waiting for account switch data clear to complete ===');
          await accountSwitchClearingRef.current;
          console.log('[CoreData] === Account switch data clear completed ===');
        }

        if (!initialCheckComplete) {
          console.log('[CoreData] === Waiting for cloud sync check to complete ===');
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }
        
        console.log('[CoreData] === Calling loadFromStorage ===');
        didStartStorageLoad = true;
        await loadFromStorage();
        console.log('[CoreData] === loadFromStorage completed ===');
      } catch (error) {
        console.error('[CoreData] === ERROR during load ===', error);
        if (isMounted) {
          setIsLoading(false);
        }
      } finally {
        if (isMounted && didStartStorageLoad) {
          clearTimeout(loadTimeout);
        }
      }
    };
    
    void doLoad();
    
    return () => {
      console.log('[CoreData] === Cleanup: clearing timeout ===');
      isMounted = false;
      clearTimeout(loadTimeout);
    };
  }, [loadFromStorage, isAuthenticated, authenticatedEmail, initialCheckComplete]);

  useEffect(() => {
    if (!isAuthenticated || !authenticatedEmail || !initialCheckComplete) {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') {
        return;
      }

      const now = Date.now();
      if (now - foregroundRefreshAttemptRef.current < 30000) {
        console.log('[CoreData] Foreground refresh skipped because the last refresh was too recent');
        return;
      }

      foregroundRefreshAttemptRef.current = now;
      console.log('[CoreData] App became active - forcing backend/local refresh to pick up latest data');
      void loadFromStorage(true);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
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
        void syncToBackend().finally(() => {
          isSyncingRef.current = false;
        });
      }
    }, 5000); // Debounce 5 seconds to reduce request frequency
    
    return () => clearTimeout(syncTimeout);
  }, [cruises, bookedCruises, casinoOffers, calendarEvents, settings, userPoints, clubRoyaleProfile, isAuthenticated, authenticatedEmail, syncToBackend]);

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
        
        void persistData(skRef.current.BOOKED_CRUISES, updated);
        return updated;
      });
    };

    const handleCloudDataRestored = () => {
      console.log('[CoreDataProvider] Cloud data restored event received, reloading data...');
      loadAttemptedRef.current = false;
      void loadFromStorage(true);
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        const handleEntitlementProUnlocked = () => {
          console.log('[CoreDataProvider] entitlementProUnlocked event received, reloading data...');
          loadAttemptedRef.current = false;
          void loadFromStorage(true);
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

  const setCruises = useCallback(async (newCruises: Cruise[]) => {
    setCruisesState(newCruises);
    await persistData(skRef.current.CRUISES, newCruises);
    await AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    console.log('[CoreData] Cruises state updated and persisted:', newCruises.length);
  }, [persistData]);

  const addCruise = useCallback((cruise: Cruise) => {
    setCruisesState(prev => {
      const updated = [...prev, cruise];
      void persistData(skRef.current.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const updateCruise = useCallback((id: string, updates: Partial<Cruise>) => {
    setCruisesState(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      void persistData(skRef.current.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const removeCruise = useCallback((id: string) => {
    setCruisesState(prev => {
      const updated = prev.filter(c => c.id !== id);
      void persistData(skRef.current.CRUISES, updated);
      return updated;
    });
  }, [persistData]);

  const setBookedCruises = useCallback(async (newCruises: BookedCruise[]) => {
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
    await persistData(skRef.current.BOOKED_CRUISES, enrichedCruises);
    await AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    
    // Auto-generate calendar events from booked cruises
    console.log('[CoreData] Auto-generating calendar events from', enrichedCruises.length, 'booked cruises');
    const newCalendarEvents: CalendarEvent[] = enrichedCruises.map(cruise => ({
      id: `cruise-${cruise.id}`,
      title: `${cruise.shipName}`,
      description: cruise.itineraryName || `${cruise.nights} Night Cruise`,
      startDate: cruise.sailDate,
      endDate: cruise.returnDate,
      type: 'cruise',
      isAllDay: true,
      location: cruise.departurePort,
      metadata: {
        cruiseId: cruise.id,
        shipName: cruise.shipName,
        cabinNumber: cruise.cabinNumber,
        reservationNumber: cruise.reservationNumber
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    console.log('[CoreData] Generated', newCalendarEvents.length, 'calendar events from cruises');
    setCalendarEventsState(newCalendarEvents);
    await persistData(skRef.current.CALENDAR_EVENTS, newCalendarEvents);
    console.log('[CoreData] Booked cruises state updated and persisted:', enrichedCruises.length);
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      void syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const buildCalendarEventFromCruise = useCallback((cruise: BookedCruise): CalendarEvent => ({
    id: `cruise-${cruise.id}`,
    title: cruise.shipName,
    description: cruise.itineraryName || `${cruise.nights} Night Cruise`,
    startDate: cruise.sailDate,
    endDate: cruise.returnDate,
    type: 'cruise',
    allDay: true,
    location: cruise.departurePort,
    cruiseId: cruise.id,
  }), []);

  const addBookedCruise = useCallback((cruise: BookedCruise) => {
    setBookedCruisesState(prev => {
      const updated = [...prev, cruise];
      void persistData(skRef.current.BOOKED_CRUISES, updated);
      return updated;
    });
    const calEvent = buildCalendarEventFromCruise(cruise);
    setCalendarEventsState(prev => {
      const filtered = prev.filter(e => e.id !== calEvent.id);
      const updated = [...filtered, calEvent];
      void persistData(skRef.current.CALENDAR_EVENTS, updated);
      console.log('[CoreData] Auto-added calendar event for cruise:', cruise.id, cruise.shipName);
      return updated;
    });
  }, [persistData, buildCalendarEventFromCruise]);

  const updateBookedCruise = useCallback((id: string, updates: Partial<BookedCruise>) => {
    setBookedCruisesState(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      void persistData(skRef.current.BOOKED_CRUISES, updated);
      
      if (updates.earnedPoints !== undefined) {
        console.log('[CoreDataProvider] Cruise points updated via updateBookedCruise:', {
          cruiseId: id,
          newPoints: updates.earnedPoints,
        });
      }

      const hasCalendarFields = updates.shipName || updates.sailDate || updates.returnDate || updates.departurePort || updates.itineraryName || updates.nights;
      if (hasCalendarFields) {
        const updatedCruise = updated.find(c => c.id === id);
        if (updatedCruise) {
          const calEvent = buildCalendarEventFromCruise(updatedCruise);
          setCalendarEventsState(prevEvents => {
            const updatedEvents = prevEvents.map(e => e.id === calEvent.id ? calEvent : e);
            const exists = prevEvents.some(e => e.id === calEvent.id);
            const finalEvents = exists ? updatedEvents : [...prevEvents, calEvent];
            void persistData(skRef.current.CALENDAR_EVENTS, finalEvents);
            console.log('[CoreData] Auto-updated calendar event for cruise:', id);
            return finalEvents;
          });
        }
      }
      
      return updated;
    });
  }, [persistData, buildCalendarEventFromCruise]);

  const removeBookedCruise = useCallback((id: string) => {
    setBookedCruisesState(prev => {
      const { BOOKED_CRUISES_DATA, COMPLETED_CRUISES_DATA } = getMockCruises();
      const allMockCruises = [
        ...COMPLETED_CRUISES_DATA,
        ...BOOKED_CRUISES_DATA
      ];
      const isMockCruise = allMockCruises.some(mc => mc.id === id);
      
      if (isMockCruise) {
        void AsyncStorage.getItem(skRef.current.REMOVED_MOCK_CRUISES)
          .then(data => {
            const existing = data ? new Set<string>(JSON.parse(data)) : new Set<string>();
            existing.add(id);
            return AsyncStorage.setItem(skRef.current.REMOVED_MOCK_CRUISES, JSON.stringify([...existing]));
          })
          .then(() => {
            console.log('[CoreData] Marked mock cruise as removed:', id);
          })
          .catch(console.error);
      }
      
      const updated = prev.filter(c => c.id !== id);
      void persistData(skRef.current.BOOKED_CRUISES, updated);
      return updated;
    });
    const calEventId = `cruise-${id}`;
    setCalendarEventsState(prev => {
      const updated = prev.filter(e => e.id !== calEventId && e.cruiseId !== id);
      void persistData(skRef.current.CALENDAR_EVENTS, updated);
      console.log('[CoreData] Auto-removed calendar event for cruise:', id);
      return updated;
    });
  }, [persistData]);

  const setCasinoOffers = useCallback(async (newOffers: CasinoOffer[]) => {
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
    await persistData(skRef.current.CASINO_OFFERS, nonMockOffers);
    await AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    console.log('[CoreData] Casino offers state updated and persisted:', nonMockOffers.length);
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      void syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const addCasinoOffer = useCallback((offer: CasinoOffer) => {
    setCasinoOffersState(prev => {
      const updated = [...prev, offer];
      void persistData(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const updateCasinoOffer = useCallback((id: string, updates: Partial<CasinoOffer>) => {
    setCasinoOffersState(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, ...updates } : o);
      void persistData(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const removeCasinoOffer = useCallback((id: string) => {
    setCasinoOffersState(prev => {
      const updated = prev.filter(o => o.id !== id);
      void persistData(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [persistData]);

  const setCalendarEvents = useCallback((newEvents: CalendarEvent[]) => {
    console.log('[CoreData] Setting calendar events:', newEvents.length);
    setCalendarEventsState(newEvents);
    void persistData(skRef.current.CALENDAR_EVENTS, newEvents);
    void AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      void syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const addCalendarEvent = useCallback((event: CalendarEvent) => {
    setCalendarEventsState(prev => {
      const updated = [...prev, event];
      void persistData(skRef.current.CALENDAR_EVENTS, updated);
      return updated;
    });
    
    if (!isSyncingRef.current) {
      isSyncingRef.current = true;
      void syncToBackend().finally(() => {
        isSyncingRef.current = false;
      });
    }
  }, [persistData, syncToBackend]);

  const updateCalendarEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setCalendarEventsState(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      void persistData(skRef.current.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [persistData]);

  const removeCalendarEvent = useCallback((id: string) => {
    setCalendarEventsState(prev => {
      const updated = prev.filter(e => e.id !== id);
      void persistData(skRef.current.CALENDAR_EVENTS, updated);
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
      const nextSyncTimestamp = new Date().toISOString();
      AsyncStorage.setItem(skRef.current.SETTINGS, JSON.stringify(updated)).catch(console.error);
      AsyncStorage.setItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
      setLastSyncDate(nextSyncTimestamp);
      return updated;
    });
  }, []);

  const setUserPoints = useCallback((points: number) => {
    const nextSyncTimestamp = new Date().toISOString();
    setUserPointsState(points);
    setLastSyncDate(nextSyncTimestamp);
    AsyncStorage.setItem(skRef.current.USER_POINTS, points.toString()).catch(console.error);
    AsyncStorage.setItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
  }, []);

  const setClubRoyaleProfile = useCallback((profile: ClubRoyaleProfile) => {
    const nextSyncTimestamp = new Date().toISOString();
    setClubRoyaleProfileState(profile);
    setLastSyncDate(nextSyncTimestamp);
    AsyncStorage.setItem(skRef.current.CLUB_PROFILE, JSON.stringify(profile)).catch(console.error);
    AsyncStorage.setItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      console.log('[CoreData] Clearing all data and preventing mock data from loading...');
      await Promise.all([
        AsyncStorage.removeItem(skRef.current.CRUISES),
        AsyncStorage.removeItem(skRef.current.BOOKED_CRUISES),
        AsyncStorage.removeItem(skRef.current.CASINO_OFFERS),
        AsyncStorage.removeItem(skRef.current.CALENDAR_EVENTS),
        AsyncStorage.removeItem(skRef.current.LAST_SYNC),
        AsyncStorage.removeItem(skRef.current.REMOVED_MOCK_CRUISES),
        AsyncStorage.setItem(skRef.current.HAS_IMPORTED_DATA, 'true'),
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
        AsyncStorage.setItem(skRef.current.BOOKED_CRUISES, JSON.stringify(enrichedCruises)),
        AsyncStorage.removeItem(skRef.current.HAS_IMPORTED_DATA),
        AsyncStorage.removeItem(skRef.current.REMOVED_MOCK_CRUISES),
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

  return useMemo(() => ({
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
    syncToBackend,
    clearAllData,
    refreshData,
    restoreMockData,
  }), [
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
    syncToBackend,
    clearAllData,
    refreshData,
    restoreMockData,
  ]);
});
