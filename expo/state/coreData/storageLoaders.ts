import type { BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile, Cruise } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import { updateAllCruiseLifecycles } from "@/lib/lifecycleManager";
import { applyKnownBookingCorrectionsToCruise, applyUserConfirmedBookedCruiseManifest, isKnownInvalidBookedCruise } from "@/lib/cruiseOverlapGuards";
import { STORAGE_KEYS, DEFAULT_SETTINGS, getScopedStorageKeys, type AppSettings } from "./storageConfig";
import { quotaSafeGetItem, quotaSafeGetJsonItemWithRaw, type QuotaSafeJsonRead } from "@/lib/storage/quotaSafeStorage";
import { containsKnownForeignPersonalData } from "@/lib/storage/dataOwnership";
import { dedupeBookedCruises, dedupeCalendarEvents } from "@/lib/dataIdentity";
import { canonicalizeDataRecords } from "@/lib/dataAuthority";
import { generateCruiseCalendarEvents } from "@/lib/calendar/cruiseEvents";


export function parseJsonArray<T>(raw: string | null, label: string): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      console.warn(`[CoreData] Ignored non-array ${label} payload`);
      return [];
    }
    return parsed.filter((item): item is T => item !== null && typeof item === 'object');
  } catch (error) {
    console.warn(`[CoreData] Isolated invalid ${label} JSON:`, error);
    return [];
  }
}

export function parseJsonObject(raw: string | null, label: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn(`[CoreData] Ignored non-object ${label} payload`);
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    console.warn(`[CoreData] Isolated invalid ${label} JSON:`, error);
    return null;
  }
}

const LOCAL_STORAGE_READ_TIMEOUT_MS = 1800;
const STORAGE_VALUE_PRESENT = '1';

type LateStorageReadListener = (key: string, label: string) => void;

const lateStorageReadCache = new Map<string, string | null>();
const lateStorageReadListeners = new Set<LateStorageReadListener>();

export function subscribeToLateStorageReads(listener: LateStorageReadListener): () => void {
  lateStorageReadListeners.add(listener);
  return () => lateStorageReadListeners.delete(listener);
}

function publishLateStorageRead(key: string, label: string, value: string | null): void {
  lateStorageReadCache.set(key, value);
  if (value === null) return;
  lateStorageReadListeners.forEach((listener) => {
    try {
      listener(key, label);
    } catch (error) {
      console.warn('[CoreData] Late storage listener failed:', error);
    }
  });
}

export async function readStorageValueWithTimeout(key: string, label: string, timeoutMs = LOCAL_STORAGE_READ_TIMEOUT_MS): Promise<string | null> {
  if (lateStorageReadCache.has(key)) {
    return lateStorageReadCache.get(key) ?? null;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const storageRead = quotaSafeGetItem(key)
    .then((value) => {
      if (timedOut) publishLateStorageRead(key, label, value);
      return value;
    })
    .catch((error) => {
      console.error(`[CoreData] Error loading ${label}:`, error);
      return null;
    });
  const timeout = new Promise<null>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      console.warn(`[CoreData] Local storage read timed out for ${label}; continuing startup with the remaining saved data.`);
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([storageRead, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function readStorageArrayWithTimeout<T extends object>(
  key: string,
  label: string,
  timeoutMs = LOCAL_STORAGE_READ_TIMEOUT_MS,
): Promise<QuotaSafeJsonRead<T[]>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const storageRead = quotaSafeGetJsonItemWithRaw<T[]>(
    key,
    [],
    (value): value is T[] => Array.isArray(value),
  ).then((result) => {
    if (timedOut) publishLateStorageRead(key, label, result.raw);
    return result;
  }).catch((error) => {
    console.error(`[CoreData] Error loading ${label}:`, error);
    return { raw: null, value: [] };
  });
  const timeout = new Promise<QuotaSafeJsonRead<T[]>>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      console.warn(`[CoreData] Local storage read timed out for ${label}; continuing startup with the remaining saved data.`);
      resolve({ raw: null, value: [] });
    }, timeoutMs);
  });

  try {
    return await Promise.race([storageRead, timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

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
  parsedCruisesData: Cruise[];
  parsedBookedData: BookedCruise[];
  parsedOffersData: CasinoOffer[];
  parsedEventsData: CalendarEvent[];
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
  return applyUserConfirmedBookedCruiseManifest(
    cruises
      .filter((cruise) =>
        !cruise.id?.includes('demo-') &&
        !cruise.id?.includes('booked-virtual') &&
        cruise.reservationNumber !== 'DEMO123' &&
        cruise.reservationNumber !== 'DEMO456' &&
        cruise.shipName !== 'Virtually a Ship of the Seas' &&
        !isKnownInvalidBookedCruise(cruise)
      )
      .map(applyKnownBookingCorrectionsToCruise)
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
  // Imported records retain only their supplied data. Provider/document/user
  // enrichment happens explicitly in the reconciliation flow, never from a
  // bundled personal or mock-data table while storage hydrates.
  return cruises;
}

export async function readAllStorageKeys(
  email?: string | null,
  options?: { includeAvailableCruises?: boolean; includeHighVolumeCore?: boolean },
): Promise<StorageSnapshot> {
  const keys = email ? getScopedStorageKeys(email) : STORAGE_KEYS;
  const includeAvailableCruises = options?.includeAvailableCruises ?? true;
  const includeHighVolumeCore = options?.includeHighVolumeCore ?? true;
  console.log('[CoreData] Loading from storage for user:', email || 'unknown', 'using scoped keys:', !!email);
  const [cruisesResult, bookedResult, offersResult, eventsResult, lastSync, settingsData, pointsData, profileData, hasImportedData] = await Promise.all([
    includeAvailableCruises
      ? readStorageArrayWithTimeout<Cruise>(keys.CRUISES, 'available cruises')
      : Promise.resolve({ raw: STORAGE_VALUE_PRESENT, value: [] } as QuotaSafeJsonRead<Cruise[]>),
    includeHighVolumeCore ? readStorageArrayWithTimeout<BookedCruise>(keys.BOOKED_CRUISES, 'booked cruises') : Promise.resolve({ raw: null, value: [] } as QuotaSafeJsonRead<BookedCruise[]>),
    includeHighVolumeCore ? readStorageArrayWithTimeout<CasinoOffer>(keys.CASINO_OFFERS, 'casino offers') : Promise.resolve({ raw: null, value: [] } as QuotaSafeJsonRead<CasinoOffer[]>),
    includeHighVolumeCore ? readStorageArrayWithTimeout<CalendarEvent>(keys.CALENDAR_EVENTS, 'calendar events') : Promise.resolve({ raw: null, value: [] } as QuotaSafeJsonRead<CalendarEvent[]>),
    readStorageValueWithTimeout(keys.LAST_SYNC, 'last sync timestamp'),
    readStorageValueWithTimeout(keys.SETTINGS, 'settings'),
    readStorageValueWithTimeout(keys.USER_POINTS, 'user points'),
    readStorageValueWithTimeout(keys.CLUB_PROFILE, 'Club Royale profile'),
    readStorageValueWithTimeout(keys.HAS_IMPORTED_DATA, 'import status'),
  ]);

  console.log('[CoreData] Storage promises resolved for user:', email || 'unknown');

  return {
    // Downstream startup logic only needs presence for these four fields; it
    // consumes the already-parsed arrays below. Keeping the multi-megabyte raw
    // JSON strings in the snapshot doubled peak cold-start memory.
    cruisesData: cruisesResult.raw === null ? null : STORAGE_VALUE_PRESENT,
    bookedData: bookedResult.raw === null ? null : STORAGE_VALUE_PRESENT,
    offersData: offersResult.raw === null ? null : STORAGE_VALUE_PRESENT,
    eventsData: eventsResult.raw === null ? null : STORAGE_VALUE_PRESENT,
    lastSync,
    settingsData,
    pointsData,
    profileData,
    hasImportedData,
    parsedCruisesData: cruisesResult.value,
    parsedBookedData: bookedResult.value,
    parsedOffersData: offersResult.value,
    parsedEventsData: eventsResult.value,
  };
}

export function determineUserStatus(
  snapshot: StorageSnapshot,
  initialCheckComplete: boolean,
  hasCloudData: boolean,
): UserStatus {
  const { bookedData, offersData, profileData, pointsData, cruisesData, hasImportedData } = snapshot;

  const hasImported = hasImportedData === 'true';
  const hasAnyExistingData = !!(bookedData || offersData || profileData || pointsData || cruisesData);

  const parsedBookedData = dedupeBookedCruises(
    canonicalizeDataRecords(snapshot.parsedBookedData as Array<BookedCruise & Record<string, unknown>>) as BookedCruise[],
    'stored booked cruises',
  );
  const parsedOffersData = canonicalizeDataRecords(
    snapshot.parsedOffersData as Array<CasinoOffer & Record<string, unknown>>,
  ) as CasinoOffer[];
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
): Promise<ProcessedBookedResult> {
  const { parsedBookedData, isFirstTimeUser, hasRealData } = status;
  const { bookedData } = snapshot;

  if (bookedData && parsedBookedData.length > 0) {
    console.log('[CoreData] Found existing booked data, processing...');

    const nonMockCruises = filterDemoCruises(parsedBookedData);

    if (nonMockCruises.length === 0 && !hasRealData) {
      console.log('[CoreData] Existing booked data only contains demo records - keeping production state empty');
      return {
        bookedCruises: [],
        finalBookedCount: 0,
        shouldPersistMergedCruises: true,
        shouldPersistFirstTimeData: false,
      };
    }

    console.log('[CoreData] Filtered cruises:', {
      original: parsedBookedData.length,
      afterFilter: nonMockCruises.length,
      merged: nonMockCruises.length,
    });

    // filterDemoCruises already applies the authoritative booked-cruise
    // identity pass. Repeating it here doubled cold-start work for large
    // histories without changing the result.
    const dedupedNonMockCruises = nonMockCruises;
    const withNormalizedLifecycle = normalizeCruiseLifecycle(dedupedNonMockCruises);
    const enrichedBooked = enrichCruisePipeline(withNormalizedLifecycle);
    const correctedKnownData = parsedBookedData.some((originalCruise) => {
      const correctedCruise = applyKnownBookingCorrectionsToCruise(originalCruise);
      return correctedCruise.sailDate !== originalCruise.sailDate
        || correctedCruise.returnDate !== originalCruise.returnDate
        || correctedCruise.itineraryNeedsManualEntry !== originalCruise.itineraryNeedsManualEntry
        || JSON.stringify(correctedCruise.itinerary ?? []) !== JSON.stringify(originalCruise.itinerary ?? []);
    });
    const cleanedKnownData = parsedBookedData.length !== nonMockCruises.length || correctedKnownData;

    return {
      bookedCruises: enrichedBooked,
      finalBookedCount: enrichedBooked.length,
      shouldPersistMergedCruises: cleanedKnownData || dedupedNonMockCruises.length !== nonMockCruises.length,
      shouldPersistFirstTimeData: false,
    };
  }

  if (isFirstTimeUser && !hasRealData) {
    console.log('[CoreData] First time user with no real data - keeping production state empty');
    return {
      bookedCruises: [],
      finalBookedCount: 0,
      shouldPersistMergedCruises: false,
      shouldPersistFirstTimeData: false,
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

  let parsedEvents = dedupeCalendarEvents(
    canonicalizeDataRecords(snapshot.parsedEventsData as Array<CalendarEvent & Record<string, unknown>>) as CalendarEvent[],
    'stored calendar events',
  );

  if (parsedEvents.length === 0 && finalBookedCount > 0) {
    console.log('[CoreData] No calendar events found but', finalBookedCount, 'booked cruises exist - auto-generating events');

    const currentBookedState = (() => {
      if (bookedData && parsedBookedData.length > 0) {
        return filterDemoCruises(parsedBookedData);
      }
      return [];
    })();

    parsedEvents = generateCruiseCalendarEvents(dedupeBookedCruises(currentBookedState, 'auto-generated event cruises'));

    console.log('[CoreData] Auto-generated', parsedEvents.length, 'calendar events from booked cruises');

    return { events: parsedEvents, shouldPersist: parsedEvents.length > 0 };
  }

  console.log('[CoreData] Parsed events:', parsedEvents.length);
  return { events: parsedEvents, shouldPersist: false };
}

export function processMetadata(
  snapshot: StorageSnapshot,
  isFirstTimeUser: boolean,
  email?: string | null,
): ProcessedMetadata {
  const { settingsData, pointsData, profileData } = snapshot;

  const parsedSettings = parseJsonObject(settingsData, 'settings');
  const settings: AppSettings | null = parsedSettings && !containsKnownForeignPersonalData(parsedSettings, email)
    ? { ...DEFAULT_SETTINGS, ...parsedSettings }
    : null;

  const parsedUserPoints = pointsData ? parseInt(pointsData, 10) : Number.NaN;
  const userPoints: number | null = Number.isFinite(parsedUserPoints) ? parsedUserPoints : null;

  let clubRoyaleProfile: ClubRoyaleProfile | null = null;
  if (profileData) {
    const parsedProfile = parseJsonObject(profileData, 'Club Royale profile') as ClubRoyaleProfile | null;
    if (!parsedProfile) return { settings, userPoints, clubRoyaleProfile: null };
    if (!containsKnownForeignPersonalData(parsedProfile, email)) {
      clubRoyaleProfile = parsedProfile;
      console.log('[CoreData] Loaded existing loyalty profile');
    } else {
      console.warn('[CoreData] Ignored loyalty profile outside active user scope');
    }
  } else if (isFirstTimeUser) {
    console.log('[CoreData] First time user - initializing with default loyalty profile');
    clubRoyaleProfile = SAMPLE_CLUB_ROYALE_PROFILE;
  } else {
    console.log('[CoreData] No profile data, but not first time user - keeping current state');
  }

  return { settings, userPoints, clubRoyaleProfile };
}
