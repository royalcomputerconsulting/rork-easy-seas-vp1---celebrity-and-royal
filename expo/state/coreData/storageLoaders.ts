import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import {
  applyKnownRetailValues,
  enrichCruisesWithReceiptData,
  enrichCruisesWithMockItineraries,
  applyFreeplayOBCData,
} from "./dataEnrichment";
import { updateAllCruiseLifecycles } from "@/lib/lifecycleManager";
import { STORAGE_KEYS, DEFAULT_SETTINGS, getScopedStorageKeys, type AppSettings } from "./storageConfig";

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

export function filterDemoOffers(offers: CasinoOffer[]): CasinoOffer[] {
  return offers.filter((offer) =>
    !offer.id?.includes('demo-') &&
    offer.offerCode !== 'NOWHERE2025' &&
    offer.shipName !== 'Virtually a Ship of the Seas'
  );
}

function normalizeCruiseLifecycle(cruises: BookedCruise[]): BookedCruise[] {
  const { updatedCruises, report } = updateAllCruiseLifecycles(cruises);
  console.log('[CoreData] Lifecycle normalization completed:', {
    total: cruises.length,
    upcoming: report.upcomingCount,
    inProgress: report.inProgressCount,
    completed: report.completedCount,
    updated: report.updates.filter((update) => update.updated).length,
  });
  return updatedCruises;
}

export function enrichCruisePipeline(cruises: BookedCruise[]): BookedCruise[] {
  const withItineraries = enrichCruisesWithMockItineraries(cruises);
  const withKnownRetail = applyKnownRetailValues(withItineraries);
  const withFreeplayOBC = applyFreeplayOBCData(withKnownRetail);
  return enrichCruisesWithReceiptData(withFreeplayOBC);
}

export async function readAllStorageKeys(email?: string | null): Promise<StorageSnapshot> {
  const keys = email ? getScopedStorageKeys(email) : STORAGE_KEYS;
  console.log('[CoreData] Loading from storage for user:', email || 'unknown', 'using scoped keys:', !!email);
  const [cruisesData, bookedData, offersData, eventsData, lastSync, settingsData, pointsData, profileData, hasImportedData] = await Promise.all([
    AsyncStorage.getItem(keys.CRUISES).catch(e => { console.error('[CoreData] Error loading cruises:', e); return null; }),
    AsyncStorage.getItem(keys.BOOKED_CRUISES).catch(e => { console.error('[CoreData] Error loading booked:', e); return null; }),
    AsyncStorage.getItem(keys.CASINO_OFFERS).catch(e => { console.error('[CoreData] Error loading offers:', e); return null; }),
    AsyncStorage.getItem(keys.CALENDAR_EVENTS).catch(e => { console.error('[CoreData] Error loading events:', e); return null; }),
    AsyncStorage.getItem(keys.LAST_SYNC).catch(e => { console.error('[CoreData] Error loading lastSync:', e); return null; }),
    AsyncStorage.getItem(keys.SETTINGS).catch(e => { console.error('[CoreData] Error loading settings:', e); return null; }),
    AsyncStorage.getItem(keys.USER_POINTS).catch(e => { console.error('[CoreData] Error loading points:', e); return null; }),
    AsyncStorage.getItem(keys.CLUB_PROFILE).catch(e => { console.error('[CoreData] Error loading profile:', e); return null; }),
    AsyncStorage.getItem(keys.HAS_IMPORTED_DATA).catch(e => { console.error('[CoreData] Error loading import flag:', e); return null; }),
  ]);

  console.log('[CoreData] Storage promises resolved for user:', email || 'unknown');

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
  const realBookedData = filterDemoCruises(parsedBookedData);
  const realOffersData = filterDemoOffers(parsedOffersData);
  const hasRealData = realBookedData.length > 0 || realOffersData.length > 0;

  const isFirstTimeUser = hasImportedData === null && !hasAnyExistingData && initialCheckComplete && !hasCloudData;

  console.log('[CoreData] Data status:', {
    hasImported,
    isFirstTimeUser,
    hasAnyExistingData,
    hasRealData,
    bookedCount: parsedBookedData.length,
    offersCount: parsedOffersData.length,
    realBookedCount: realBookedData.length,
    realOffersCount: realOffersData.length,
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
  email?: string | null,
): Promise<ProcessedBookedResult> {
  const { parsedBookedData, isFirstTimeUser, hasRealData } = status;
  const { bookedData } = snapshot;

  if (bookedData && parsedBookedData.length > 0) {
    console.log('[CoreData] Found existing booked data, processing...');

    const nonMockCruises = filterDemoCruises(parsedBookedData);

    if (nonMockCruises.length === 0 && !hasRealData) {
      console.log('[CoreData] Existing booked data only contains demo records - loading isolated sample demo data');
      const { sampleCruises, sampleOffers } = getFirstTimeUserSampleData();
      const enrichedSample = enrichCruisePipeline(sampleCruises);
      return {
        bookedCruises: enrichedSample,
        offersOverride: sampleOffers,
        finalBookedCount: enrichedSample.length,
        shouldPersistMergedCruises: false,
        shouldPersistFirstTimeData: false,
      };
    }

    console.log('[CoreData] Filtered cruises:', {
      original: parsedBookedData.length,
      afterFilter: nonMockCruises.length,
    });

    const withNormalizedLifecycle = normalizeCruiseLifecycle(nonMockCruises);
    const enrichedBooked = enrichCruisePipeline(withNormalizedLifecycle);

    return {
      bookedCruises: enrichedBooked,
      finalBookedCount: enrichedBooked.length,
      shouldPersistMergedCruises: false,
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
