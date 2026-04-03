import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import {
  applyKnownRetailValues,
  enrichCruisesWithReceiptData,
  enrichCruisesWithMockItineraries,
  applyFreeplayOBCData,
} from "./dataEnrichment";
import { STORAGE_KEYS, DEFAULT_SETTINGS, CURRENT_CRUISE_DATA_VERSION, getScopedStorageKeys, type AppSettings } from "./storageConfig";
import { mergeCalendarEventsWithDerivedCruiseEvents } from "@/lib/calendar/derivedCruiseEvents";

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

const LEGACY_SEEDED_BOOKING_RESERVATION_NUMBERS = new Set([
  '4623588',
  '103650',
  '102141',
  '1627512',
  '1332345',
  '9351090',
  '1527742',
  '4622209',
  '4097701',
  '3839803',
]);

function sortCruisesBySailDate(cruises: BookedCruise[]): BookedCruise[] {
  return [...cruises].sort((a, b) => {
    const aTime = new Date(a.sailDate).getTime();
    const bTime = new Date(b.sailDate).getTime();
    return aTime - bTime;
  });
}

function normalizeSeededBookedCruises(
  existingCruises: BookedCruise[],
  canonicalCruises: BookedCruise[],
): { cruises: BookedCruise[]; changed: boolean } {
  const canonicalByReservation = new Map<string, BookedCruise>();
  canonicalCruises.forEach((cruise) => {
    if (cruise.reservationNumber) {
      canonicalByReservation.set(cruise.reservationNumber, cruise);
    }
  });

  let changed = false;
  const normalizedCruises: BookedCruise[] = [];

  existingCruises.forEach((cruise) => {
    const reservationNumber = cruise.reservationNumber ?? '';
    const canonicalCruise = reservationNumber ? canonicalByReservation.get(reservationNumber) : undefined;

    if (reservationNumber && LEGACY_SEEDED_BOOKING_RESERVATION_NUMBERS.has(reservationNumber) && !canonicalCruise) {
      changed = true;
      console.log('[CoreData] Removing outdated seeded cruise from stored data:', {
        reservationNumber,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
      });
      return;
    }

    if (canonicalCruise) {
      const mergedCruise = {
        ...cruise,
        ...canonicalCruise,
      };

      if (JSON.stringify(mergedCruise) !== JSON.stringify(cruise)) {
        changed = true;
        console.log('[CoreData] Refreshing stored cruise from canonical booking data:', {
          reservationNumber,
          previousShipName: cruise.shipName,
          previousSailDate: cruise.sailDate,
          nextShipName: canonicalCruise.shipName,
          nextSailDate: canonicalCruise.sailDate,
        });
      }

      normalizedCruises.push(mergedCruise);
      canonicalByReservation.delete(reservationNumber);
      return;
    }

    normalizedCruises.push(cruise);
  });

  if (canonicalByReservation.size > 0) {
    changed = true;
    const cruisesToAdd = Array.from(canonicalByReservation.values());
    console.log('[CoreData] Adding missing canonical cruises into stored data:', cruisesToAdd.map((cruise) => ({
      reservationNumber: cruise.reservationNumber,
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
    })));
    normalizedCruises.push(...cruisesToAdd);
  }

  return {
    cruises: sortCruisesBySailDate(normalizedCruises),
    changed,
  };
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
  email?: string | null,
): Promise<ProcessedBookedResult> {
  const { parsedBookedData, isFirstTimeUser, hasRealData } = status;
  const { bookedData } = snapshot;

  if (bookedData && parsedBookedData.length > 0) {
    console.log('[CoreData] Found existing booked data, processing...');

    const nonMockCruises = filterDemoCruises(parsedBookedData);

    const versionKey = email ? getScopedStorageKeys(email).CRUISE_DATA_VERSION : STORAGE_KEYS.CRUISE_DATA_VERSION;
    const storedVersion = await AsyncStorage.getItem(versionKey).catch(() => null);
    let mergedCruises = nonMockCruises;
    let didNormalizeStoredCruises = false;

    if (storedVersion !== CURRENT_CRUISE_DATA_VERSION) {
      console.log('[CoreData] Cruise data version changed:', storedVersion, '->', CURRENT_CRUISE_DATA_VERSION, '- normalizing stored cruises');
      const { BOOKED_CRUISES_DATA } = getMockCruises();
      const realMockCruises = filterDemoCruises(BOOKED_CRUISES_DATA);
      const normalizedResult = normalizeSeededBookedCruises(mergedCruises, realMockCruises);
      mergedCruises = normalizedResult.cruises;
      didNormalizeStoredCruises = normalizedResult.changed;

      if (!didNormalizeStoredCruises) {
        console.log('[CoreData] Stored cruises already matched canonical booking data');
      }

      await AsyncStorage.setItem(versionKey, CURRENT_CRUISE_DATA_VERSION).catch(console.error);
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
      shouldPersistMergedCruises: didNormalizeStoredCruises,
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

  const parsedEvents: CalendarEvent[] = eventsData ? JSON.parse(eventsData) : [];
  const currentBookedState = (() => {
    if (bookedData && parsedBookedData.length > 0) {
      return filterDemoCruises(parsedBookedData);
    }
    return [];
  })();

  if (parsedEvents.length === 0 && finalBookedCount > 0) {
    console.log('[CoreData] No stored calendar events found but', finalBookedCount, 'booked cruises exist - deriving port-day events');
  }

  const mergedEvents = mergeCalendarEventsWithDerivedCruiseEvents(parsedEvents, currentBookedState);
  const shouldPersist = JSON.stringify(mergedEvents) !== JSON.stringify(parsedEvents);

  console.log('[CoreData] Processed calendar events:', {
    storedEvents: parsedEvents.length,
    derivedCruises: currentBookedState.length,
    finalEvents: mergedEvents.length,
    shouldPersist,
  });

  return { events: mergedEvents, shouldPersist };
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
