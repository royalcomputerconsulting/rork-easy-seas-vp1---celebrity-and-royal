import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import {
  applyKnownRetailValues,
  enrichCruisesWithReceiptData,
  enrichCruisesWithMockItineraries,
  applyFreeplayOBCData,
} from "./dataEnrichment";
import { STORAGE_KEYS, DEFAULT_SETTINGS, CURRENT_CRUISE_DATA_VERSION, type AppSettings } from "./storageConfig";

export interface StorageSnapshot {
  cruisesData: string | null;
  bookedData: string | null;
  offersData: string | null;
  eventsData: string | null;
  lastSync: string | null;
  settingsData: string | null;
  pointsData: string | null;
  profileData: string | null;
  hasImportedData: string | null;
}

export interface UserStatus {
  hasImported: boolean;
  isFirstTimeUser: boolean;
  hasAnyExistingData: boolean;
  hasRealData: boolean;
  parsedBookedData: BookedCruise[];
  parsedOffersData: CasinoOffer[];
}

export interface ProcessedBookedResult {
  bookedCruises: BookedCruise[];
  offersOverride?: CasinoOffer[];
  finalBookedCount: number;
  shouldPersistMergedCruises: boolean;
  shouldPersistFirstTimeData: boolean;
}

export interface ProcessedEventsResult {
  events: CalendarEvent[];
  shouldPersist: boolean;
}

export interface ProcessedMetadata {
  settings: AppSettings | null;
  userPoints: number | null;
  clubRoyaleProfile: ClubRoyaleProfile | null;
}

export function filterDemoCruises(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.filter((cruise) =>
    !cruise.id?.includes('demo-') &&
    !cruise.id?.includes('booked-virtual') &&
    cruise.reservationNumber !== 'DEMO123' &&
    cruise.reservationNumber !== 'DEMO456' &&
    cruise.shipName !== 'Virtually a Ship of the Seas'
  );
}

function transitionCruisesToCompleted(cruises: BookedCruise[]): BookedCruise[] {
  const today = new Date();
  return cruises.map((cruise: BookedCruise) => {
    if (cruise.returnDate) {
      const returnDate = new Date(cruise.returnDate);
      if (returnDate < today && cruise.completionState !== 'completed') {
        console.log('[CoreData] Auto-transitioning cruise to completed:', cruise.id, cruise.shipName, cruise.returnDate);
        return {
          ...cruise,
          status: 'completed' as const,
          completionState: 'completed' as const,
        };
      }
    }
    return cruise;
  });
}

export function enrichCruisePipeline(cruises: BookedCruise[]): BookedCruise[] {
  const withItineraries = enrichCruisesWithMockItineraries(cruises);
  const withKnownRetail = applyKnownRetailValues(withItineraries);
  const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
  return enrichCruisesWithReceiptData(withFreeplayOBC);
}

export async function readAllStorageKeys(): Promise<StorageSnapshot> {
  console.log('[CoreData] Loading from storage...');
  const [cruisesData, bookedData, offersData, eventsData, lastSync, settingsData, pointsData, profileData, hasImportedData] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.CRUISES).catch(e => { console.error('[CoreData] Error loading cruises:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.BOOKED_CRUISES).catch(e => { console.error('[CoreData] Error loading booked:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.CASINO_OFFERS).catch(e => { console.error('[CoreData] Error loading offers:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS).catch(e => { console.error('[CoreData] Error loading events:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC).catch(e => { console.error('[CoreData] Error loading lastSync:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.SETTINGS).catch(e => { console.error('[CoreData] Error loading settings:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.USER_POINTS).catch(e => { console.error('[CoreData] Error loading points:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.CLUB_PROFILE).catch(e => { console.error('[CoreData] Error loading profile:', e); return null; }),
    AsyncStorage.getItem(STORAGE_KEYS.HAS_IMPORTED_DATA).catch(e => { console.error('[CoreData] Error loading import flag:', e); return null; }),
  ]);

  console.log('[CoreData] Storage promises resolved');

  return { cruisesData, bookedData, offersData, eventsData, lastSync, settingsData, pointsData, profileData, hasImportedData };
}

export function determineUserStatus(
  snapshot: StorageSnapshot,
  initialCheckComplete: boolean,
  hasCloudData: boolean,
): UserStatus {
  const { bookedData, offersData, profileData, pointsData, cruisesData, hasImportedData } = snapshot;

  const hasImported = hasImportedData === 'true';
  const hasAnyExistingData = !!(bookedData || offersData || profileData || pointsData || cruisesData);

  const parsedBookedData: BookedCruise[] = bookedData ? JSON.parse(bookedData) : [];
  const parsedOffersData: CasinoOffer[] = offersData ? JSON.parse(offersData) : [];
  const hasRealData = parsedBookedData.length > 0 || parsedOffersData.length > 0;

  const isFirstTimeUser = hasImportedData === null && !hasAnyExistingData && initialCheckComplete && !hasCloudData;

  console.log('[CoreData] Data status:', {
    hasImported,
    isFirstTimeUser,
    hasAnyExistingData,
    hasRealData,
    bookedCount: parsedBookedData.length,
    offersCount: parsedOffersData.length,
    initialCheckComplete,
    hasCloudData,
  });

  return { hasImported, isFirstTimeUser, hasAnyExistingData, hasRealData, parsedBookedData, parsedOffersData };
}

export async function processBookedCruises(
  status: UserStatus,
  snapshot: StorageSnapshot,
  getMockCruises: () => { BOOKED_CRUISES_DATA: BookedCruise[]; COMPLETED_CRUISES_DATA: BookedCruise[] },
  getFirstTimeUserSampleData: () => { sampleCruises: BookedCruise[]; sampleOffers: CasinoOffer[] },
): Promise<ProcessedBookedResult> {
  const { parsedBookedData, isFirstTimeUser, hasRealData } = status;
  const { bookedData } = snapshot;

  if (bookedData && parsedBookedData.length > 0) {
    console.log('[CoreData] Found existing booked data, processing...');

    const nonMockCruises = filterDemoCruises(parsedBookedData);

    const storedVersion = await AsyncStorage.getItem(STORAGE_KEYS.CRUISE_DATA_VERSION).catch(() => null);
    let mergedCruises = nonMockCruises;

    if (storedVersion !== CURRENT_CRUISE_DATA_VERSION) {
      console.log('[CoreData] Cruise data version changed:', storedVersion, '->', CURRENT_CRUISE_DATA_VERSION, '- merging missing cruises');
      const { BOOKED_CRUISES_DATA } = getMockCruises();
      const realMockCruises = filterDemoCruises(BOOKED_CRUISES_DATA);

      const existingResNums = new Set(mergedCruises.map((c: BookedCruise) => c.reservationNumber));
      const missingCruises = realMockCruises.filter((mc: BookedCruise) => !existingResNums.has(mc.reservationNumber));

      if (missingCruises.length > 0) {
        console.log('[CoreData] Adding', missingCruises.length, 'missing cruises:', missingCruises.map((c: BookedCruise) => c.reservationNumber));
        mergedCruises = [...mergedCruises, ...missingCruises];
      } else {
        console.log('[CoreData] No missing cruises to add');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CRUISE_DATA_VERSION, CURRENT_CRUISE_DATA_VERSION).catch(console.error);
    }

    console.log('[CoreData] Filtered cruises:', {
      original: parsedBookedData.length,
      afterFilter: nonMockCruises.length,
      afterMerge: mergedCruises.length,
    });

    const withTransition = transitionCruisesToCompleted(mergedCruises);
    const enrichedBooked = enrichCruisePipeline(withTransition);

    return {
      bookedCruises: enrichedBooked,
      finalBookedCount: enrichedBooked.length,
      shouldPersistMergedCruises: mergedCruises.length > nonMockCruises.length,
      shouldPersistFirstTimeData: false,
    };
  }

  if (isFirstTimeUser && !hasRealData) {
    console.log('[CoreData] First time user with no real data - loading sample demo data');
    const { sampleCruises, sampleOffers } = getFirstTimeUserSampleData();
    const enrichedSample = enrichCruisePipeline(sampleCruises);
    console.log('[CoreData] Sample demo data loaded:', enrichedSample.length, 'cruises,', sampleOffers.length, 'offers');

    return {
      bookedCruises: enrichedSample,
      offersOverride: sampleOffers,
      finalBookedCount: enrichedSample.length,
      shouldPersistMergedCruises: false,
      shouldPersistFirstTimeData: true,
    };
  }

  console.log('[CoreData] No booked cruises or real data exists - keeping empty state');
  return {
    bookedCruises: [],
    finalBookedCount: 0,
    shouldPersistMergedCruises: false,
    shouldPersistFirstTimeData: false,
  };
}

export function processCalendarEvents(
  snapshot: StorageSnapshot,
  status: UserStatus,
  finalBookedCount: number,
): ProcessedEventsResult {
  const { eventsData, bookedData } = snapshot;
  const { parsedBookedData } = status;

  let parsedEvents: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];

  if (parsedEvents.length === 0 && finalBookedCount > 0) {
    console.log('[CoreData] No calendar events found but', finalBookedCount, 'booked cruises exist - auto-generating events');

    const currentBookedState = (() => {
      if (bookedData && parsedBookedData.length > 0) {
        return filterDemoCruises(parsedBookedData);
      }
      return [];
    })();

    parsedEvents = currentBookedState
      .filter((cruise: BookedCruise) => cruise.sailDate && cruise.returnDate)
      .map((cruise: BookedCruise): CalendarEvent => ({
        id: `cruise-${cruise.id}`,
        title: cruise.shipName,
        description: cruise.itineraryName || `${cruise.nights} Night Cruise`,
        startDate: cruise.sailDate,
        endDate: cruise.returnDate,
        type: 'cruise',
        allDay: true,
        location: cruise.departurePort,
        cruiseId: cruise.id,
      }));

    console.log('[CoreData] Auto-generated', parsedEvents.length, 'calendar events from booked cruises');

    return { events: parsedEvents, shouldPersist: parsedEvents.length > 0 };
  }

  console.log('[CoreData] Parsed events:', parsedEvents.length);
  return { events: parsedEvents, shouldPersist: false };
}

export function processMetadata(
  snapshot: StorageSnapshot,
  isFirstTimeUser: boolean,
): ProcessedMetadata {
  const { settingsData, pointsData, profileData } = snapshot;

  const settings: AppSettings | null = settingsData
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) }
    : null;

  const userPoints: number | null = pointsData
    ? parseInt(pointsData, 10)
    : null;

  let clubRoyaleProfile: ClubRoyaleProfile | null = null;
  if (profileData) {
    clubRoyaleProfile = JSON.parse(profileData);
    console.log('[CoreData] Loaded existing loyalty profile');
  } else if (isFirstTimeUser) {
    console.log('[CoreData] First time user - initializing with default loyalty profile');
    clubRoyaleProfile = SAMPLE_CLUB_ROYALE_PROFILE;
  } else {
    console.log('[CoreData] No profile data, but not first time user - keeping current state');
  }

  return { settings, userPoints, clubRoyaleProfile };
}
