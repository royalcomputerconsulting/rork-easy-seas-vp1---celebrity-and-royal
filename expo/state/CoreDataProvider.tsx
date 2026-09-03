import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Platform } from 'react-native';
import createContextHook from "@nkzw/create-context-hook";
import { trpc, isBackendAvailable } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
import type { Cruise, BookedCruise, CasinoOffer, CalendarEvent, ClubRoyaleProfile, CruiseFilter } from "@/types/models";
import { SAMPLE_CLUB_ROYALE_PROFILE } from "@/types/models";
import { DEFAULT_FILTERS } from "./coreData/filterLogic";
import { DEFAULT_SETTINGS, getScopedStorageKeys, type AppSettings } from "./coreData/storageConfig";
import {
  readAllStorageKeys,
  determineUserStatus,
  processBookedCruises,
  processCalendarEvents,
  processMetadata,
  parseJsonArray,
  parseJsonObject,
  subscribeToLateStorageReads,
} from "./coreData/storageLoaders";
import { quotaSafeGetItem, quotaSafeSetItem, quotaSafeSetJsonItem, quotaSafeRemoveItem } from "@/lib/storage/quotaSafeStorage";
import type { PersistenceCommitResult } from "@/lib/storage/persistenceCoordinator";
import { appendDiagnosticJournal } from "@/lib/storage/diagnosticJournal";
import { ALL_STORAGE_KEYS, getUserScopedKey } from "@/lib/storage/storageKeys";
import { buildOwnerScopeId, getInstallationId } from "@/lib/storage/installationId";
import { containsKnownForeignPersonalData, filterRecordsForOwner, isOwnerScopeForEmail, stampRecordsForOwner } from "@/lib/storage/dataOwnership";
import { updateAllCruiseLifecycles } from "@/lib/lifecycleManager";
import { dedupeBookedCruises, dedupeCalendarEvents, dedupeCasinoOffers, dedupeCruises, getCruiseIdentityKey } from "@/lib/dataIdentity";
import { canonicalizeDataRecord, canonicalizeDataRecords } from "@/lib/dataAuthority";
import { generateCruiseCalendarEvents } from "@/lib/calendar/cruiseEvents";
import { annotateOverlappingCruises, applyKnownBookingCorrectionsToCruise, applyUserConfirmedBookedCruiseManifest, isKnownInvalidBookedCruise } from "@/lib/cruiseOverlapGuards";
import { isKnownCasinoProfile } from "@/lib/knownProfileFallback";
import { normalizeCruisesWithCasinoEconomics } from "@/lib/casinoCruiseEconomics";
import { getBookedCruiseCasinoPoints, normalizeCruiseCasinoPerformance } from "@/lib/casinoPointTruth";
import { notifyCruiseRecordChanged } from "@/lib/cruiseRecordChangeEvents";
import { isDateInPast, toLocalCalendarDateOnly } from "@/lib/date";
import { beginPerformanceSpan, recordPerformanceCount, recordProviderRender } from "@/lib/performance/performanceDiagnostics";
import { cruiseInventoryRepository } from '@/lib/cruiseInventory/CruiseInventoryRepository';
import type { CruiseInventoryCounts, CruiseInventoryIntegrity, CruiseInventoryPage, CruiseInventoryProgress, CruiseInventoryQuery, CruiseInventoryReconciliation } from '@/lib/cruiseInventory/CruiseInventoryRepository';
import { getCruiseInventoryOwnerScope } from '@/lib/cruiseInventory/cruiseCanonicalIdentity';
import { runAfterUiSettles, type UiSettledTask } from '@/lib/runAfterUiSettles';
import { collapseOfferSailingRowsToOfferInstances } from '@/lib/offers/offerInstanceIdentity';
import { hydrateHighVolumeDomain, mirrorStorageDatasetToRepository, replaceHighVolumeDomain } from '@/lib/database/highVolumeRepository';

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

function prepareOwnedRecords<T extends object>(records: T[], ownerScopeId: string | null, email: string | null, label: string): T[] {
  const owned = stampRecordsForOwner(filterRecordsForOwner(records, ownerScopeId, email, label), ownerScopeId, email);
  return canonicalizeDataRecords(owned as Array<T & Record<string, unknown>>) as T[];
}

async function prepareOwnedRecordsCooperatively<T extends object>(
  records: T[],
  ownerScopeId: string | null,
  email: string | null,
  label: string,
  shouldAbort?: () => boolean,
): Promise<T[]> {
  if (records.length < 500) return prepareOwnedRecords(records, ownerScopeId, email, label);

  const prepared: T[] = [];
  const chunkSize = 250;
  for (let index = 0; index < records.length; index += chunkSize) {
    if (shouldAbort?.()) throw new Error('CATALOG_WRITE_CANCELLED');
    prepared.push(...prepareOwnedRecords(records.slice(index, index + chunkSize), ownerScopeId, email, label));
    // Hermes JSON parsing is synchronous, but the remaining ownership and
    // canonicalization work can yield between bounded chunks so a tab press is
    // never queued behind all 2,500–5,000 cruise records.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return prepared;
}

async function dedupeCruisesCooperatively(records: Cruise[], label: string, shouldAbort?: () => boolean): Promise<Cruise[]> {
  if (records.length < 500) return dedupeCruises(records, label);
  const keyed = new Map<string, Cruise>();
  let duplicateCount = 0;
  for (let index = 0; index < records.length; index += 250) {
    if (shouldAbort?.()) throw new Error('CATALOG_WRITE_CANCELLED');
    records.slice(index, index + 250).forEach((record) => {
      const key = getCruiseIdentityKey(record);
      if (keyed.has(key)) duplicateCount += 1;
      keyed.set(key, record);
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (duplicateCount > 0) {
    console.log('[CoreData] Cooperatively deduped available cruises:', { label, duplicateCount });
  }
  return Array.from(keyed.values());
}

function sanitizeForeignValue<T>(value: T, email: string | null, label: string): T | undefined {
  if (containsKnownForeignPersonalData(value, email)) {
    console.warn('[CoreData] Dropped user-identifiable data outside active user scope:', { label, email });
    return undefined;
  }

  return value;
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

  const formatDate = (d: Date) => toLocalCalendarDateOnly(d) ?? '';

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



export interface CoreDataCruiseCommitReceipt {
  runId?: string;
  ownerScopeId: string;
  inputRows: number;
  providersToReplace: string[];
  reconciliations: CruiseInventoryReconciliation[];
  activeCounts: CruiseInventoryCounts;
  readBackAt: string;
}

interface CoreDataCommitOptions {
  updateLastSync?: boolean;
  markImportedData?: boolean;
  syncTimestamp?: string;
  runId?: string;
  cruiseInventoryProviders?: string[];
  onCruiseInventoryProgress?: (progress: CruiseInventoryProgress) => void;
  onCruiseInventoryCommitted?: (receipt: CoreDataCruiseCommitReceipt) => void;
  shouldAbort?: () => boolean;
}

interface BackgroundPersistenceRequest {
  key: string;
  data: unknown;
  updateLastSync: boolean;
  syncTimestamp?: string;
}

interface CoreDataState {
  cruises: Cruise[];
  cruiseInventoryCount: number;
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
  
  setCruises: (cruises: Cruise[], options?: CoreDataCommitOptions) => Promise<void>;
  queryCruises: (query?: CruiseInventoryQuery) => Promise<CruiseInventoryPage>;
  getAllCruises: () => Promise<Cruise[]>;
  getCruiseInventoryIntegrity: () => Promise<CruiseInventoryIntegrity>;
  addCruise: (cruise: Cruise) => void;
  updateCruise: (id: string, updates: Partial<Cruise>) => void;
  removeCruise: (id: string) => void;
  
  setBookedCruises: (cruises: BookedCruise[], options?: CoreDataCommitOptions) => Promise<void>;
  addBookedCruise: (cruise: BookedCruise) => void;
  updateBookedCruise: (id: string, updates: Partial<BookedCruise>) => void;
  removeBookedCruise: (id: string) => void;
  
  setCasinoOffers: (offers: CasinoOffer[], options?: CoreDataCommitOptions) => Promise<void>;
  addCasinoOffer: (offer: CasinoOffer) => void;
  updateCasinoOffer: (id: string, updates: Partial<CasinoOffer>) => void;
  removeCasinoOffer: (id: string) => void;
  
  setCalendarEvents: (events: CalendarEvent[]) => Promise<void>;
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
  finalizeLocalSyncMetadata: (timestamp?: string) => Promise<void>;
  flushPendingWrites: () => Promise<void>;
  
  clearAllData: () => Promise<void>;
  refreshData: () => Promise<void>;
  restoreMockData: () => Promise<void>;
}















export const [CoreDataProvider, useCoreData] = createContextHook((): CoreDataState => {

  recordProviderRender('CoreDataProvider');

  const { authenticatedEmail, isAuthenticated } = useAuth();
  const skRef = useRef(getScopedStorageKeys(authenticatedEmail));
  useEffect(() => {
    skRef.current = getScopedStorageKeys(authenticatedEmail);
    console.log('[CoreData] Scoped storage keys updated for user:', authenticatedEmail);
  }, [authenticatedEmail]);

  const [cruises, setCruisesState] = useState<Cruise[]>([]);
  const [cruiseInventoryCount, setCruiseInventoryCount] = useState(0);
  const [bookedCruises, setBookedCruisesState] = useState<BookedCruise[]>([]);
  const [casinoOffers, setCasinoOffersState] = useState<CasinoOffer[]>([]);
  const [calendarEvents, setCalendarEventsState] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadAttemptedRef = useRef(false);
  const loadFromStorageRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const lateStorageReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCloudRestoreReloadRef = useRef(0);
  const lastAuthEmailRef = useRef<string | null>(null);

  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [ownerScopeId, setOwnerScopeId] = useState<string | null>(null);
  
  const [filters, setFiltersState] = useState<CruiseFilter>(DEFAULT_FILTERS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [userPoints, setUserPointsState] = useState(0);
  const [clubRoyaleProfile, setClubRoyaleProfileState] = useState<ClubRoyaleProfile>(SAMPLE_CLUB_ROYALE_PROFILE);
  const isSyncingRef = useRef(false);
  const pendingBackendSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);
  const backgroundPersistenceRequestsRef = useRef<Map<string, BackgroundPersistenceRequest>>(new Map());
  const backgroundPersistenceTaskRef = useRef<UiSettledTask | null>(null);
  const backgroundPersistenceDrainingRef = useRef(false);

  const hasLocalData = cruiseInventoryCount > 0 || cruises.length > 0 || bookedCruises.length > 0 || casinoOffers.length > 0 || calendarEvents.length > 0;

  useEffect(() => {
    let isMounted = true;

    if (!authenticatedEmail) {
      setOwnerScopeId(null);
      return;
    }

    const fallbackOwnerScopeId = buildOwnerScopeId(authenticatedEmail, 'local');
    setOwnerScopeId(fallbackOwnerScopeId);

    void getInstallationId()
      .then((installationId) => {
        if (!isMounted) {
          return;
        }
        const nextOwnerScopeId = buildOwnerScopeId(authenticatedEmail, installationId);
        setOwnerScopeId(nextOwnerScopeId);
        console.log('[CoreData] Owner data scope resolved:', { email: authenticatedEmail, ownerScopeId: nextOwnerScopeId });
      })
      .catch((error) => {
        console.error('[CoreData] Failed to resolve owner data scope:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [authenticatedEmail]);

  const { mutateAsync: saveAllUserDataMutateAsync } = trpc.data.saveAllUserData.useMutation();
  const { refetch: refetchBackendData } = trpc.data.getAllUserData.useQuery(
    { email: authenticatedEmail || 'placeholder@example.com', ownerScopeId: ownerScopeId || undefined },
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
      await quotaSafeSetItem(skRef.current.LAST_SYNC, nextTimestamp);
      setLastSyncDate(nextTimestamp);
      console.log('[CoreData] Updated last sync timestamp:', nextTimestamp);
    } catch (error) {
      console.error('[CoreData] Failed to persist last sync timestamp:', error);
    }
  }, []);

  const persistData = useCallback(async <T,>(
    key: string,
    data: T,
    options?: { updateLastSync?: boolean; syncTimestamp?: string; runId?: string }
  ): Promise<PersistenceCommitResult> => {
    appendDiagnosticJournal('CORE_DATA_COMMIT_STARTED', { key, runId: options?.runId });
    try {
      // Indexed SQLite is the runtime authority for high-volume domains. The
      // existing quota-safe artifact remains a rollback/export mirror during
      // this release, but navigation no longer depends on parsing it.
      await mirrorStorageDatasetToRepository(
        key,
        authenticatedEmail || ownerScopeId || 'local-default',
        data,
      );
      const result = await quotaSafeSetJsonItem(key, data, { runId: options?.runId });
      if (options?.updateLastSync ?? true) {
        await persistLastSyncDate(options?.syncTimestamp);
      }
      console.log(`[CoreData] Persisted ${key}`, result);
      appendDiagnosticJournal('CORE_DATA_COMMIT_COMPLETE', { key, runId: result.runId, bytes: result.bytes, hash: result.hash });
      return result;
    } catch (error) {
      console.error(`[CoreData] Failed to persist ${key}:`, error);
      appendDiagnosticJournal('CORE_DATA_COMMIT_FAILED', { key, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }, [authenticatedEmail, ownerScopeId, persistLastSyncDate]);

  const drainBackgroundPersistence = useCallback(async () => {
    if (backgroundPersistenceDrainingRef.current) {
      return;
    }

    backgroundPersistenceDrainingRef.current = true;
    let shouldUpdateLastSync = false;
    let latestSyncTimestamp: string | undefined;

    try {
      // Drain sequentially so two large local datasets never compete for the JS
      // thread. New edits made while a write is active replace the queued
      // snapshot for that key and are picked up by the next pass.
      while (true) {
        while (backgroundPersistenceRequestsRef.current.size > 0) {
          const requests = Array.from(backgroundPersistenceRequestsRef.current.values());
          backgroundPersistenceRequestsRef.current.clear();

          for (const request of requests) {
            try {
              await persistData(request.key, request.data, { updateLastSync: false });
              if (request.updateLastSync) {
                shouldUpdateLastSync = true;
                latestSyncTimestamp = request.syncTimestamp ?? latestSyncTimestamp;
              }
            } catch (error) {
              // A background write must never freeze navigation or create an
              // unhandled rejection. persistData retains details in diagnostics.
              console.error('[CoreData] Background persistence failed:', request.key, error);
            }
          }
        }

        if (shouldUpdateLastSync) {
          await persistLastSyncDate(latestSyncTimestamp);
          shouldUpdateLastSync = false;
          latestSyncTimestamp = undefined;
        }

        // A request can arrive while the metadata write above is awaiting
        // native storage. Loop again instead of stranding that latest snapshot.
        if (backgroundPersistenceRequestsRef.current.size === 0) {
          break;
        }
      }
    } finally {
      backgroundPersistenceDrainingRef.current = false;
    }
  }, [persistData, persistLastSyncDate]);

  const scheduleBackgroundPersist = useCallback((
    key: string,
    data: unknown,
    options?: { updateLastSync?: boolean; syncTimestamp?: string },
  ) => {
    backgroundPersistenceRequestsRef.current.set(key, {
      key,
      data,
      updateLastSync: options?.updateLastSync ?? true,
      syncTimestamp: options?.syncTimestamp,
    });

    if (backgroundPersistenceTaskRef.current || backgroundPersistenceDrainingRef.current) {
      return;
    }

    // Let the tap/navigation animation commit first. quotaSafeSetJsonItem then
    // performs transactional, cooperative serialization in the background.
    backgroundPersistenceTaskRef.current = runAfterUiSettles(() => {
      backgroundPersistenceTaskRef.current = null;
      setTimeout(() => {
        void drainBackgroundPersistence();
      }, 0);
    });
  }, [drainBackgroundPersistence]);

  const flushPendingWrites = useCallback(async () => {
    backgroundPersistenceTaskRef.current?.cancel?.();
    backgroundPersistenceTaskRef.current = null;

    // Save All must include the latest cruise closeout even when the normal
    // background writer was intentionally waiting for a navigation animation.
    while (backgroundPersistenceDrainingRef.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    await drainBackgroundPersistence();
    while (backgroundPersistenceDrainingRef.current || backgroundPersistenceRequestsRef.current.size > 0) {
      if (!backgroundPersistenceDrainingRef.current) await drainBackgroundPersistence();
      else await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
  }, [drainBackgroundPersistence]);

  const syncToBackend = useCallback(async () => {
    if (pendingBackendSyncTimeoutRef.current) {
      clearTimeout(pendingBackendSyncTimeoutRef.current);
      pendingBackendSyncTimeoutRef.current = null;
    }

    if (!authenticatedEmail || !ownerScopeId) {
      console.log('[CoreData] Backend sync skipped - no authenticated email or owner scope');
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
      const [cruisesData, bookedData, offersData, eventsData, sessionsData, settingsData, pointsData, profileData, usersData, currentUserIdData, extendedLoyaltyDataRaw, manualClubRoyalePointsRaw, manualCrownAnchorPointsRaw] = await Promise.all([
        quotaSafeGetItem(scopedKeys.CRUISES),
        quotaSafeGetItem(scopedKeys.BOOKED_CRUISES),
        quotaSafeGetItem(scopedKeys.CASINO_OFFERS),
        quotaSafeGetItem(scopedKeys.CALENDAR_EVENTS),
        quotaSafeGetItem(getUserScopedKey(ALL_STORAGE_KEYS.CASINO_SESSIONS, authenticatedEmail)),
        quotaSafeGetItem(scopedKeys.SETTINGS),
        quotaSafeGetItem(scopedKeys.USER_POINTS),
        quotaSafeGetItem(scopedKeys.CLUB_PROFILE),
        quotaSafeGetItem(scopedKeys.USERS),
        quotaSafeGetItem(scopedKeys.CURRENT_USER),
        quotaSafeGetItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA),
        quotaSafeGetItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS),
        quotaSafeGetItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS),
      ]);
      
      const parsedCruises = dedupeCruises(
        prepareOwnedRecords<Cruise>(parseJsonArray<Cruise>(cruisesData, 'backend-sync available cruises'), ownerScopeId, authenticatedEmail, 'backend-sync available cruises'),
        'backend-sync available cruises',
      );
      const parsedBooked = normalizeCruisesWithCasinoEconomics(
        annotateOverlappingCruises(dedupeBookedCruises(
          prepareOwnedRecords<BookedCruise>(parseJsonArray<BookedCruise>(bookedData, 'backend-sync booked cruises'), ownerScopeId, authenticatedEmail, 'backend-sync booked cruises'),
          'backend-sync booked cruises',
        )),
        { includeKnownAnnualFacts: isKnownCasinoProfile(authenticatedEmail) },
      );
      const parsedOffers = dedupeCasinoOffers(
        prepareOwnedRecords<CasinoOffer>(parseJsonArray<CasinoOffer>(offersData, 'backend-sync casino offers'), ownerScopeId, authenticatedEmail, 'backend-sync casino offers'),
        'backend-sync casino offers',
      );
      const parsedEvents = dedupeCalendarEvents(
        prepareOwnedRecords<CalendarEvent>(parseJsonArray<CalendarEvent>(eventsData, 'backend-sync calendar events'), ownerScopeId, authenticatedEmail, 'backend-sync calendar events'),
        'backend-sync calendar events',
      );
      const parsedSessions = parseJsonArray<Record<string, unknown>>(sessionsData, 'backend-sync casino sessions');
      const parsedSettingsObject = parseJsonObject(settingsData, 'backend-sync settings');
      const parsedSettings = parsedSettingsObject
        ? sanitizeForeignValue(parsedSettingsObject, authenticatedEmail, 'backend-sync settings')
        : undefined;
      const parsedUsers = prepareOwnedRecords<Record<string, unknown>>(
        parseJsonArray<Record<string, unknown>>(usersData, 'backend-sync user profiles'),
        ownerScopeId,
        authenticatedEmail,
        'backend-sync user profiles'
      );
      const parsedUserIds = new Set(parsedUsers.map((user) => typeof user.id === 'string' ? user.id : null).filter((id): id is string => id !== null));
      const parsedCurrentUserId = currentUserIdData && (parsedUserIds.size === 0 || parsedUserIds.has(currentUserIdData)) ? currentUserIdData : null;
      const syncableSettings = parsedSettings ? { ...parsedSettings } : undefined;
      if (syncableSettings && parsedUsers.length > 0) {
        syncableSettings.__easySeasUserProfiles = parsedUsers;
      }
      if (syncableSettings && parsedCurrentUserId) {
        syncableSettings.__easySeasCurrentUserId = parsedCurrentUserId;
      }
      const parsedPoints = pointsData ? parseInt(pointsData, 10) : undefined;
      const parsedProfileObject = parseJsonObject(profileData, 'backend-sync club profile');
      const parsedProfile = parsedProfileObject
        ? sanitizeForeignValue(parsedProfileObject, authenticatedEmail, 'backend-sync club profile')
        : undefined;
      const parsedExtendedLoyaltyObject = parseJsonObject(extendedLoyaltyDataRaw, 'backend-sync extended loyalty data');
      const parsedExtendedLoyalty = parsedExtendedLoyaltyObject
        ? sanitizeForeignValue({
            extendedLoyaltyData: parsedExtendedLoyaltyObject,
            manualClubRoyalePoints: parseOptionalStoredNumber(manualClubRoyalePointsRaw),
            manualCrownAnchorPoints: parseOptionalStoredNumber(manualCrownAnchorPointsRaw),
          }, authenticatedEmail, 'backend-sync loyalty data')
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
        ownerScopeId,
        cruises: parsedCruises,
        bookedCruises: parsedBooked,
        casinoOffers: parsedOffers,
        calendarEvents: parsedEvents,
        casinoSessions: parsedSessions,
        userProfiles: parsedUsers,
        currentUserId: parsedCurrentUserId,
        settings: syncableSettings,
        userPoints: parsedPoints,
        clubRoyaleProfile: parsedProfile,
        loyaltyData: parsedExtendedLoyalty,
      });

      const syncTimestamp = typeof syncResult?.updatedAt === 'string' ? syncResult.updatedAt : new Date().toISOString();
      await quotaSafeSetItem(scopedKeys.LAST_SYNC, syncTimestamp);
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
  }, [saveAllUserDataMutateAsync, authenticatedEmail, ownerScopeId]);

  const loadFromBackend = useCallback(async () => {
    if (!isBackendAvailable() || !authenticatedEmail || !ownerScopeId) {
      console.log('[CoreData] Backend load skipped - not authenticated, owner scope missing, or backend unavailable');
      return false;
    }

    const inMemorySummary = {
      cruises: cruises.length,
      bookedCruises: bookedCruises.length,
      casinoOffers: casinoOffers.length,
      calendarEvents: calendarEvents.length,
    };
    const hasInMemoryData = Object.values(inMemorySummary).some((count) => count > 0);
    
    try {
      console.log('[CoreData] 🔄 Loading data from backend for:', authenticatedEmail);
      const result = await refetchBackendData();
      
      if (result.data && result.data.found && result.data.data) {
        const userData = result.data.data;
        const cloudOwnerScopeId = typeof userData.ownerScopeId === 'string' ? userData.ownerScopeId : ownerScopeId;
        if (!cloudOwnerScopeId || cloudOwnerScopeId !== ownerScopeId || !isOwnerScopeForEmail(cloudOwnerScopeId, authenticatedEmail)) {
          console.warn('[CoreData] Refusing backend restore for mismatched owner scope:', {
            authenticatedEmail,
            ownerScopeId,
            cloudOwnerScopeId,
          });
          return false;
        }
        const ownedBackendCruises = dedupeCruises(prepareOwnedRecords<Cruise>((userData.cruises ?? []) as Cruise[], ownerScopeId, authenticatedEmail, 'backend-restore available cruises'), 'backend-restore available cruises');
        const ownedBackendBookedCruises = normalizeCruisesWithCasinoEconomics(
          annotateOverlappingCruises(dedupeBookedCruises(prepareOwnedRecords<BookedCruise>((userData.bookedCruises ?? []) as BookedCruise[], ownerScopeId, authenticatedEmail, 'backend-restore booked cruises'), 'backend-restore booked cruises')),
          { includeKnownAnnualFacts: isKnownCasinoProfile(authenticatedEmail) },
        );
        const ownedBackendOffers = dedupeCasinoOffers(prepareOwnedRecords<CasinoOffer>((userData.casinoOffers ?? []) as CasinoOffer[], ownerScopeId, authenticatedEmail, 'backend-restore casino offers'), 'backend-restore casino offers');
        const ownedBackendEvents = dedupeCalendarEvents(prepareOwnedRecords<CalendarEvent>((userData.calendarEvents ?? []) as CalendarEvent[], ownerScopeId, authenticatedEmail, 'backend-restore calendar events'), 'backend-restore calendar events');
        const scopedKeys = getScopedStorageKeys(authenticatedEmail);
        const [localLastSyncRaw, localCruisesRaw, localBookedRaw, localOffersRaw, localEventsRaw] = await Promise.all([
          quotaSafeGetItem(scopedKeys.LAST_SYNC),
          quotaSafeGetItem(scopedKeys.CRUISES),
          quotaSafeGetItem(scopedKeys.BOOKED_CRUISES),
          quotaSafeGetItem(scopedKeys.CASINO_OFFERS),
          quotaSafeGetItem(scopedKeys.CALENDAR_EVENTS),
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
          cruises: ownedBackendCruises.length,
          bookedCruises: ownedBackendBookedCruises.length,
          casinoOffers: ownedBackendOffers.length,
          calendarEvents: ownedBackendEvents.length,
        };
        const localHasMeaningfulData = Object.values(localSummary).some((count) => count > 0);
        const localHasMoreData =
          localSummary.cruises > backendSummary.cruises ||
          localSummary.bookedCruises > backendSummary.bookedCruises ||
          localSummary.casinoOffers > backendSummary.casinoOffers ||
          localSummary.calendarEvents > backendSummary.calendarEvents;
        const inMemoryLastSyncMs = parseStoredTimestamp(lastSyncDate);
        const inMemoryHasMoreData =
          inMemorySummary.cruises > backendSummary.cruises ||
          inMemorySummary.bookedCruises > backendSummary.bookedCruises ||
          inMemorySummary.casinoOffers > backendSummary.casinoOffers ||
          inMemorySummary.calendarEvents > backendSummary.calendarEvents;
        const shouldPreferLocalData =
          (localHasMeaningfulData &&
            ((localLastSyncMs !== null && (backendUpdatedAtMs === null || localLastSyncMs > backendUpdatedAtMs)) ||
              (localHasMoreData && (backendUpdatedAtMs === null || localLastSyncMs === null || localLastSyncMs >= backendUpdatedAtMs)))) ||
          (hasInMemoryData &&
            ((inMemoryLastSyncMs !== null && (backendUpdatedAtMs === null || inMemoryLastSyncMs > backendUpdatedAtMs)) ||
              inMemoryHasMoreData));

        console.log('[CoreData] ✅ Backend data found:', {
          email: authenticatedEmail,
          availableCruises: ownedBackendCruises.length,
          cruises: ownedBackendBookedCruises.length,
          offers: ownedBackendOffers.length,
          events: ownedBackendEvents.length,
          updatedAt: userData.updatedAt,
          localLastSync: localLastSyncRaw,
          inMemoryLastSync: lastSyncDate,
          localSummary,
          inMemorySummary,
        });

        if (shouldPreferLocalData) {
          console.log('[CoreData] Skipping backend restore because local data is newer or richer than cloud data', {
            email: authenticatedEmail,
            localLastSync: localLastSyncRaw,
            inMemoryLastSync: lastSyncDate,
            backendUpdatedAt: userData.updatedAt,
            localSummary,
            inMemorySummary,
            backendSummary,
          });
          return false;
        }
        
        const savePromises: Promise<unknown>[] = [];
        if (userData.cruises) {
          savePromises.push(quotaSafeSetJsonItem(scopedKeys.CRUISES, ownedBackendCruises));
        }
        if (userData.bookedCruises) {
          savePromises.push(Promise.all([
            replaceHighVolumeDomain(authenticatedEmail, 'booked_cruises', ownedBackendBookedCruises, scopedKeys.BOOKED_CRUISES),
            quotaSafeSetJsonItem(scopedKeys.BOOKED_CRUISES, ownedBackendBookedCruises),
          ]));
        }
        if (userData.casinoOffers) {
          savePromises.push(Promise.all([
            replaceHighVolumeDomain(authenticatedEmail, 'casino_offers', ownedBackendOffers, scopedKeys.CASINO_OFFERS),
            quotaSafeSetJsonItem(scopedKeys.CASINO_OFFERS, ownedBackendOffers),
          ]));
        }
        if (userData.calendarEvents) {
          savePromises.push(Promise.all([
            replaceHighVolumeDomain(authenticatedEmail, 'calendar_events', ownedBackendEvents, scopedKeys.CALENDAR_EVENTS),
            quotaSafeSetJsonItem(scopedKeys.CALENDAR_EVENTS, ownedBackendEvents),
          ]));
        }
        if (userData.casinoSessions) {
          const sessionStorageKey = getUserScopedKey(ALL_STORAGE_KEYS.CASINO_SESSIONS, authenticatedEmail);
          savePromises.push(Promise.all([
            replaceHighVolumeDomain(authenticatedEmail, 'casino_sessions', userData.casinoSessions, sessionStorageKey),
            quotaSafeSetJsonItem(sessionStorageKey, userData.casinoSessions),
          ]));
        }
        if (userData.settings) {
          const sanitizedSettings = sanitizeForeignValue(userData.settings, authenticatedEmail, 'backend-restore settings');
          if (sanitizedSettings !== undefined) {
            savePromises.push(quotaSafeSetJsonItem(scopedKeys.SETTINGS, sanitizedSettings));
          } else {
            savePromises.push(quotaSafeRemoveItem(scopedKeys.SETTINGS));
          }
        }
        if (userData.userPoints !== undefined) {
          savePromises.push(quotaSafeSetItem(scopedKeys.USER_POINTS, userData.userPoints.toString()));
        }
        if (userData.clubRoyaleProfile) {
          const sanitizedClubProfile = sanitizeForeignValue(userData.clubRoyaleProfile, authenticatedEmail, 'backend-restore club profile');
          if (sanitizedClubProfile !== undefined) {
            savePromises.push(quotaSafeSetJsonItem(scopedKeys.CLUB_PROFILE, sanitizedClubProfile));
          } else {
            savePromises.push(quotaSafeRemoveItem(scopedKeys.CLUB_PROFILE));
          }
        }
        if (userData.loyaltyData !== undefined) {
          const sanitizedLoyaltyData = sanitizeForeignValue(userData.loyaltyData, authenticatedEmail, 'backend-restore loyalty data');
          const normalizedLoyaltyData = normalizeLoyaltySyncPayload(sanitizedLoyaltyData);
          const scopedLoyaltyKeys = {
            EXTENDED_LOYALTY_DATA: getUserScopedKey(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA, authenticatedEmail),
            MANUAL_CLUB_ROYALE_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS, authenticatedEmail),
            MANUAL_CROWN_ANCHOR_POINTS: getUserScopedKey(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS, authenticatedEmail),
          };

          const extendedLoyaltyData = normalizedLoyaltyData?.extendedLoyaltyData ?? null;
          const manualClubRoyalePoints = normalizedLoyaltyData?.manualClubRoyalePoints ?? null;
          const manualCrownAnchorPoints = normalizedLoyaltyData?.manualCrownAnchorPoints ?? null;

          if (extendedLoyaltyData !== null) {
            savePromises.push(quotaSafeSetJsonItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA, extendedLoyaltyData));
          } else {
            savePromises.push(quotaSafeRemoveItem(scopedLoyaltyKeys.EXTENDED_LOYALTY_DATA));
          }

          if (manualClubRoyalePoints !== null) {
            savePromises.push(quotaSafeSetItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS, manualClubRoyalePoints.toString()));
          } else {
            savePromises.push(quotaSafeRemoveItem(scopedLoyaltyKeys.MANUAL_CLUB_ROYALE_POINTS));
          }

          if (manualCrownAnchorPoints !== null) {
            savePromises.push(quotaSafeSetItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS, manualCrownAnchorPoints.toString()));
          } else {
            savePromises.push(quotaSafeRemoveItem(scopedLoyaltyKeys.MANUAL_CROWN_ANCHOR_POINTS));
          }
        }

        const backendTimestamp = typeof userData.updatedAt === 'string' ? userData.updatedAt : new Date().toISOString();
        savePromises.push(quotaSafeSetItem(scopedKeys.LAST_SYNC, backendTimestamp));
        
        await Promise.allSettled(savePromises);
        setLastSyncDate(backendTimestamp);
        await quotaSafeSetItem(scopedKeys.HAS_IMPORTED_DATA, 'true');
        
        console.log('[CoreData] ✅ Backend data loaded and cached locally');
        return true;
      }
      
      console.log('[CoreData] No backend data found for:', authenticatedEmail);
      return false;
    } catch (error) {
      console.error('[CoreData] Backend load failed:', error);
      return false;
    }
  }, [refetchBackendData, authenticatedEmail, ownerScopeId, cruises.length, bookedCruises.length, casinoOffers.length, calendarEvents.length, lastSyncDate]);

  const loadFromStorage = useCallback(async (force = false) => {
    console.log('[CoreData] === START LOADING FROM STORAGE ===', { force, alreadyAttempted: loadAttemptedRef.current });
    const finishHydrationDiagnostic = beginPerformanceSpan('CoreDataProvider.startupHydration', { force });
    const hydrationStartedAt = Date.now();
    let storageReadCompletedAt = hydrationStartedAt;
    const postHydrationWrites: Array<{ label: string; run: () => Promise<unknown> }> = [];
    const queuePostHydrationWrite = (label: string, run: () => Promise<unknown>) => {
      postHydrationWrites.push({ label, run });
    };
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
      // Local storage is the startup authority. Backend restore is manual only.
      const inventoryOwnerScope = getCruiseInventoryOwnerScope(authenticatedEmail);
      let activeInventoryRows = 0;
      if (Platform.OS !== 'web') {
        try {
          await cruiseInventoryRepository.initialize();
          const inventoryCounts = await cruiseInventoryRepository.getCounts(inventoryOwnerScope);
          activeInventoryRows = inventoryCounts.sourceTotal || inventoryCounts.total;
          setCruiseInventoryCount(activeInventoryRows);
        } catch (error) {
          console.warn('[CoreData] SQLite inventory unavailable; retaining quota-safe legacy hydration:', error);
        }
      }
      const repositoryOwner = authenticatedEmail || ownerScopeId || 'local-default';
      const [repositoryBooked, repositoryOffers, repositoryEvents] = await Promise.all([
        hydrateHighVolumeDomain<BookedCruise>(repositoryOwner, 'booked_cruises'),
        hydrateHighVolumeDomain<CasinoOffer>(repositoryOwner, 'casino_offers'),
        hydrateHighVolumeDomain<CalendarEvent>(repositoryOwner, 'calendar_events'),
      ]);
      const storageSnapshot = await readAllStorageKeys(authenticatedEmail, {
        includeAvailableCruises: activeInventoryRows === 0,
        includeHighVolumeCore: false,
      });
      const snapshot = {
        ...storageSnapshot,
        bookedData: repositoryBooked.length > 0 ? '__sqlite_present__' : null,
        offersData: repositoryOffers.length > 0 ? '__sqlite_present__' : null,
        eventsData: repositoryEvents.length > 0 ? '__sqlite_present__' : null,
        parsedBookedData: repositoryBooked,
        parsedOffersData: repositoryOffers,
        parsedEventsData: repositoryEvents,
      };
      if (activeInventoryRows > 0) {
        queuePostHydrationWrite('prune retired cruise catalog generations', async () => {
          await cruiseInventoryRepository.pruneRetiredGenerations(inventoryOwnerScope, 2);
        });
      }
      storageReadCompletedAt = Date.now();
      recordPerformanceCount('CoreDataProvider.cruisesLoadedIntoJS', snapshot.parsedCruisesData.length, {
        phase: 'legacy-storage-read',
      });
      const status = determineUserStatus(snapshot, true, false);
      const ownedStatus = {
        ...status,
        parsedBookedData: prepareOwnedRecords<BookedCruise>(status.parsedBookedData, ownerScopeId, authenticatedEmail, 'local booked cruises'),
        parsedOffersData: prepareOwnedRecords<CasinoOffer>(status.parsedOffersData, ownerScopeId, authenticatedEmail, 'local casino offers'),
      };

      const preparedCruises = await prepareOwnedRecordsCooperatively<Cruise>(
        snapshot.parsedCruisesData as unknown as Cruise[],
        ownerScopeId,
        authenticatedEmail,
        'local available cruises',
      );
      const parsedCruises = await dedupeCruisesCooperatively(
        preparedCruises,
        'local available cruises',
      );
      recordPerformanceCount('CoreDataProvider.cruisesPublishedToContext', parsedCruises.length, {
        phase: 'legacy-global-hydration',
      });
      if (activeInventoryRows === 0 && parsedCruises.length > 0) {
        queuePostHydrationWrite('migrate available cruise catalog to SQLite', async () => {
          const migration = await cruiseInventoryRepository.migrateLegacyCatalog(
            parsedCruises,
            'available-cruises-v1',
            inventoryOwnerScope,
          );
          const counts = await cruiseInventoryRepository.getCounts(inventoryOwnerScope);
          setCruiseInventoryCount(counts.sourceTotal || counts.total);
          appendDiagnosticJournal('CRUISE_INVENTORY_MIGRATION_COMPLETE', {
            sourceRows: parsedCruises.length,
            canonicalRows: counts.physicalSailings ?? counts.total,
            availableOptionRows: counts.sourceTotal || counts.total,
            generationsPromoted: migration.length,
            byProvider: counts.byProvider,
          });
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const bookedResult = await processBookedCruises(ownedStatus, snapshot);
      const ownedBookedCruises = normalizeCruisesWithCasinoEconomics(
        annotateOverlappingCruises(dedupeBookedCruises(prepareOwnedRecords<BookedCruise>(bookedResult.bookedCruises, ownerScopeId, authenticatedEmail, 'processed booked cruises'), 'processed booked cruises')),
        { includeKnownAnnualFacts: isKnownCasinoProfile(authenticatedEmail) },
      );
      const casinoHistoryWasEnriched = ownedBookedCruises.some((cruise, index) =>
        cruise.casinoHistoryImportId && cruise.casinoHistoryImportId !== bookedResult.bookedCruises[index]?.casinoHistoryImportId,
      );
      const ownedOffersOverride = bookedResult.offersOverride
        ? prepareOwnedRecords<CasinoOffer>(bookedResult.offersOverride, ownerScopeId, authenticatedEmail, 'processed casino offers')
        : undefined;
      let hydratedOffers = collapseOfferSailingRowsToOfferInstances(
        ownedOffersOverride ?? ownedStatus.parsedOffersData,
      );

      // Recovery for older builds that persisted the SQLite offer-sailing
      // inventory but lost/failed to hydrate the small marketing-offer table.
      // Rebuild only the missing summary; SQLite remains the sailing authority.
      if (hydratedOffers.length === 0 && activeInventoryRows > 0) {
        const inventoryOfferRows: CasinoOffer[] = [];
        await cruiseInventoryRepository.exportAllSourceRows((batch) => {
          inventoryOfferRows.push(...(batch as unknown as CasinoOffer[]));
        }, 500, inventoryOwnerScope);
        hydratedOffers = collapseOfferSailingRowsToOfferInstances(inventoryOfferRows)
          .filter((offer) => Boolean(String(offer.offerCode ?? '').trim()));
        if (hydratedOffers.length > 0) {
          const recoveredOffers = hydratedOffers;
          queuePostHydrationWrite('recover marketing offers from SQLite sailing inventory', async () => {
            await persistData(skRef.current.CASINO_OFFERS, recoveredOffers, { updateLastSync: false });
            appendDiagnosticJournal('CASINO_OFFERS_RECOVERED_FROM_INVENTORY', {
              inventoryRows: activeInventoryRows,
              recoveredOfferInstances: recoveredOffers.length,
            });
          });
        }
      }

      if (bookedResult.shouldPersistMergedCruises) {
        queuePostHydrationWrite('persist merged booked cruises', async () => {
          await persistData(skRef.current.BOOKED_CRUISES, ownedBookedCruises);
          console.log('[CoreData] Persisted merged cruise data with', ownedBookedCruises.length, 'cruises');
        });
      }

      if (casinoHistoryWasEnriched && !bookedResult.shouldPersistMergedCruises && !bookedResult.shouldPersistFirstTimeData) {
        queuePostHydrationWrite('persist owner-scoped casino history enrichment', async () => {
          await persistData(skRef.current.BOOKED_CRUISES, ownedBookedCruises, { updateLastSync: false });
          appendDiagnosticJournal('CASINO_HISTORY_OWNER_SCOPED_MIGRATION_COMPLETE', {
            enrichedCruises: ownedBookedCruises.filter((cruise) => Boolean(cruise.casinoHistoryImportId)).length,
          });
        });
      }

      if (bookedResult.shouldPersistFirstTimeData) {
        queuePostHydrationWrite('persist first-time local data', async () => {
          await persistData(skRef.current.BOOKED_CRUISES, ownedBookedCruises, { updateLastSync: false });
          if (ownedOffersOverride) {
            await persistData(skRef.current.CASINO_OFFERS, ownedOffersOverride, { updateLastSync: false });
          }
          await quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true');
          console.log('[CoreData] First-time user data persisted');
        });
      }

      const eventsResult = bookedResult.shouldPersistMergedCruises
        ? {
            events: generateCruiseCalendarEvents(ownedBookedCruises),
            shouldPersist: true,
          }
        : processCalendarEvents(snapshot, ownedStatus, bookedResult.finalBookedCount);
      const ownedEvents = dedupeCalendarEvents(prepareOwnedRecords<CalendarEvent>(eventsResult.events, ownerScopeId, authenticatedEmail, 'local calendar events'), 'local calendar events');
      if (eventsResult.shouldPersist) {
        queuePostHydrationWrite('persist regenerated calendar events', () => persistData(skRef.current.CALENDAR_EVENTS, ownedEvents));
      }
      const metadata = processMetadata(snapshot, ownedStatus.isFirstTimeUser, authenticatedEmail);

      // Publish one coherent hydration snapshot. React can batch these state
      // updates into one provider notification instead of making every nested
      // feature provider recompute once per dataset.
      setCasinoOffersState(hydratedOffers);
      setCruisesState(parsedCruises);
      setBookedCruisesState(ownedBookedCruises);
      setCalendarEventsState(ownedEvents);
      if (snapshot.lastSync) setLastSyncDate(snapshot.lastSync);
      if (metadata.settings) setSettings(metadata.settings);
      if (metadata.userPoints !== null) setUserPointsState(metadata.userPoints);
      if (metadata.clubRoyaleProfile) setClubRoyaleProfileState(metadata.clubRoyaleProfile);

      appendDiagnosticJournal('CORE_DATA_HYDRATION_TIMING', {
        force,
        storageReadMs: storageReadCompletedAt - hydrationStartedAt,
        normalizeAndPublishMs: Date.now() - storageReadCompletedAt,
        totalMs: Date.now() - hydrationStartedAt,
        cruises: parsedCruises.length,
        bookedCruises: ownedBookedCruises.length,
        offers: hydratedOffers.length,
        calendarEvents: ownedEvents.length,
      });
      finishHydrationDiagnostic({
        storageReadMs: storageReadCompletedAt - hydrationStartedAt,
        cruisesLoadedIntoJS: parsedCruises.length,
        bookedCruises: ownedBookedCruises.length,
        offers: hydratedOffers.length,
        calendarEvents: ownedEvents.length,
        success: true,
      });

      console.log('[CoreData] === LOAD COMPLETE ===');
      console.log('[CoreData] Loaded data summary:', {
        cruises: parsedCruises.length,
        booked: bookedResult.finalBookedCount,
        offers: ownedStatus.parsedOffersData.length,
        events: ownedEvents.length,
        hasImportedData: ownedStatus.hasImported,
      });

      isInitialLoadRef.current = false;
    } catch (error) {
      appendDiagnosticJournal('CORE_DATA_HYDRATION_FAILED', {
        force,
        totalMs: Date.now() - hydrationStartedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('[CoreData] === LOAD FAILED ===');
      console.error('[CoreData] Error details:', error);
      console.error('[CoreData] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Fail closed without destroying the last known-good in-memory snapshot.
      // A transient storage/cloud error must not make the app appear empty or
      // overwrite valid saved data on the next persistence cycle.
      console.warn('[CoreData] Preserving the current in-memory data after load failure.');
      finishHydrationDiagnostic({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    console.log('[CoreData] === SETTING isLoading to FALSE ===');
    setIsLoading(false);
    console.log('[CoreData] === isLoading set to FALSE ===');

    if (postHydrationWrites.length > 0) {
      runAfterUiSettles(() => {
        setTimeout(() => {
          void Promise.allSettled(postHydrationWrites.map(async ({ label, run }) => {
            try {
              await run();
            } catch (error) {
              console.error(`[CoreData] Deferred local repair failed: ${label}`, error);
            }
          })).then(() => {
            console.log('[CoreData] Deferred post-hydration persistence complete:', postHydrationWrites.length);
          });
        }, 500);
      });
    }
  }, [authenticatedEmail, ownerScopeId, persistData]);

  useEffect(() => {
    loadFromStorageRef.current = loadFromStorage;
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return subscribeToLateStorageReads((key, label) => {
      appendDiagnosticJournal('LOCAL_STORAGE_LATE_READ_RECOVERED', { key, label });
      if (lateStorageReloadTimerRef.current) clearTimeout(lateStorageReloadTimerRef.current);
      lateStorageReloadTimerRef.current = setTimeout(() => {
        runAfterUiSettles(() => {
          void loadFromStorageRef.current(true).catch((error) => {
            console.warn('[CoreData] Late local-data refresh failed:', error);
          });
        });
      }, 100);
    });
  }, [authenticatedEmail, isAuthenticated]);

  useEffect(() => () => {
    if (lateStorageReloadTimerRef.current) clearTimeout(lateStorageReloadTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[CoreData] User not authenticated, clearing data');
      setCruisesState([]);
      setCruiseInventoryCount(0);
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
      setCruiseInventoryCount(0);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
      setClubRoyaleProfileState(SAMPLE_CLUB_ROYALE_PROFILE);
      setUserPointsState(0);
      setSettings(DEFAULT_SETTINGS);
      setLastSyncDate(null);

      if (previousEmail !== null) {
        console.log('[CoreData] Account switch detected - preserving all scoped local data and loading the selected account only');
      }
    }

    console.log('[CoreData] === MOUNT: Starting local-first load ===');
    let isMounted = true;

    const doLoad = async () => {
      try {
        await loadFromStorageRef.current();
      } catch (error) {
        console.error('[CoreData] Local-first load failed:', error);
        if (isMounted) setIsLoading(false);
      }
    };

    void doLoad();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authenticatedEmail, ownerScopeId]);

  // Foregrounding does not trigger a full reload or any backend work.
  // Feature screens refresh their own local/network data explicitly.

  useEffect(() => {
    const handleSessionPointsUpdate = (event: any) => {
      const { cruiseId, points } = event.detail;
      console.log('[CoreDataProvider] Received points update event:', { cruiseId, points });
      
      setBookedCruisesState(prev => {
        const updated = prev.map(cruise => {
          if (cruise.id === cruiseId) {
            const currentPoints = getBookedCruiseCasinoPoints(cruise);
            const newPoints = currentPoints + points;
            console.log('[CoreDataProvider] Updating cruise points:', {
              cruiseId,
              oldPoints: currentPoints,
              addedPoints: points,
              newPoints,
            });
            return normalizeCruiseCasinoPerformance({
              ...cruise,
              earnedPoints: newPoints,
              casinoPoints: newPoints,
              pointsEarned: newPoints,
              coinIn: newPoints * 5,
              updatedAt: new Date().toISOString(),
            });
          }
          return cruise;
        });
        
        scheduleBackgroundPersist(skRef.current.BOOKED_CRUISES, updated);
        return updated;
      });
    };

    const handleCloudDataRestored = () => {
      const now = Date.now();
      if (now - lastCloudRestoreReloadRef.current < 1200) {
        console.log('[CoreDataProvider] Cloud data restored event ignored because a reload just ran');
        return;
      }
      lastCloudRestoreReloadRef.current = now;
      console.log('[CoreDataProvider] Cloud data restored event received, reloading data...');
      loadAttemptedRef.current = false;
      void loadFromStorageRef.current(true);
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        const handleEntitlementProUnlocked = () => {
          console.log('[CoreDataProvider] entitlementProUnlocked event received, reloading data...');
          loadAttemptedRef.current = false;
          void loadFromStorageRef.current(true);
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
  }, [scheduleBackgroundPersist]);

  const setCruises = useCallback(async (newCruises: Cruise[], options?: CoreDataCommitOptions) => {
    const finishCommitDiagnostic = beginPerformanceSpan('CoreDataProvider.setCruises', {
      inputRows: newCruises.length,
      runId: options?.runId,
    });
    const preparedCruises = await prepareOwnedRecordsCooperatively<Cruise>(newCruises, ownerScopeId, authenticatedEmail, 'set available cruises', options?.shouldAbort);
    const ownedCruises = await dedupeCruisesCooperatively(preparedCruises, 'set available cruises', options?.shouldAbort);
    const reconciliation = await cruiseInventoryRepository.replaceCatalog(ownedCruises, {
      ownerScopeId: getCruiseInventoryOwnerScope(authenticatedEmail),
      runId: options?.runId,
      providersToReplace: options?.cruiseInventoryProviders,
      batchSize: 500,
      shouldAbort: options?.shouldAbort,
      onProgress: (progress) => {
        options?.onCruiseInventoryProgress?.(progress);
        if (progress.processedRows === progress.totalRows || progress.processedRows % 2_500 === 0) {
          appendDiagnosticJournal('CRUISE_INVENTORY_COMMIT_PROGRESS', { ...progress });
        }
      },
    });
    const canonicalRows = reconciliation.reduce((sum, entry) => sum + entry.canonicalRows, 0);
    const activeInventoryCounts = await cruiseInventoryRepository.getCounts(getCruiseInventoryOwnerScope(authenticatedEmail));
    setCruiseInventoryCount(activeInventoryCounts.sourceTotal || activeInventoryCounts.total);
    appendDiagnosticJournal('CRUISE_INVENTORY_COMMIT_RECONCILED', {
      runId: options?.runId,
      inputRows: ownedCruises.length,
      canonicalRows,
      availableOptionRows: activeInventoryCounts.sourceTotal || activeInventoryCounts.total,
      duplicatesMerged: reconciliation.reduce((sum, entry) => sum + entry.duplicatesMerged, 0),
      rejectedRows: reconciliation.reduce((sum, entry) => sum + entry.rejectedRows, 0),
      readbackRows: reconciliation.reduce((sum, entry) => sum + entry.readbackRows, 0),
      providersToReplace: options?.cruiseInventoryProviders ?? reconciliation.map((entry) => entry.provider),
      generationIds: reconciliation.map((entry) => entry.generationId),
    });
    options?.onCruiseInventoryCommitted?.({
      runId: options?.runId,
      ownerScopeId: getCruiseInventoryOwnerScope(authenticatedEmail),
      inputRows: ownedCruises.length,
      providersToReplace: options?.cruiseInventoryProviders ?? reconciliation.map((entry) => entry.provider),
      reconciliations: reconciliation,
      activeCounts: activeInventoryCounts,
      readBackAt: new Date().toISOString(),
    });
    // The pre-migration quota-safe artifact is intentionally left untouched as
    // a rollback/import source. Rewriting all 40K+ rows after every sync would
    // duplicate the SQLite transaction and was the largest persistence stall.
    // Explicit export/cloud operations stream from SQLite instead.
    await cruiseInventoryRepository.setMetadata(`legacy_catalog_retained:${getCruiseInventoryOwnerScope(authenticatedEmail)}`, JSON.stringify({
      retainedAt: new Date().toISOString(),
      activeAuthority: 'sqlite',
      runId: options?.runId ?? null,
      sourceRows: ownedCruises.length,
    }));
    setCruisesState([]);
    if (options?.markImportedData ?? true) {
      await quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    }
    console.log('[CoreData] Cruises state updated and persisted:', ownedCruises.length);
    finishCommitDiagnostic({ canonicalRows, publishedRows: 0 });
  }, [persistData, ownerScopeId, authenticatedEmail]);

  const queryCruises = useCallback(async (query: CruiseInventoryQuery = {}) => {
    if (Platform.OS === 'web') {
      const startedAt = Date.now();
      const search = query.search?.trim().toLowerCase();
      const filtered = cruises.filter((row) => {
        const record = row as Cruise & Record<string, unknown>;
        if (query.providers?.length && !query.providers.includes(String(record.cruiseSource ?? record.brand ?? ''))) return false;
        if (query.shipNames?.length && !query.shipNames.includes(String(record.shipName ?? ''))) return false;
        if (query.departurePorts?.length && !query.departurePorts.includes(String(record.departurePort ?? ''))) return false;
        if (query.destinations?.length && !query.destinations.includes(String(record.destination ?? record.itineraryName ?? ''))) return false;
        if (query.cabinTypes?.length && !query.cabinTypes.includes(String(record.cabinType ?? ''))) return false;
        if (query.minNights !== undefined && Number(record.nights ?? 0) < query.minNights) return false;
        if (query.maxNights !== undefined && Number(record.nights ?? 0) > query.maxNights) return false;
        if (query.sailDateFrom && String(record.sailDate ?? record.sailingDate ?? '') < query.sailDateFrom) return false;
        if (query.sailDateTo && String(record.sailDate ?? record.sailingDate ?? '') > query.sailDateTo) return false;
        if (search && !JSON.stringify(record).toLowerCase().includes(search)) return false;
        return true;
      });
      const limit = Math.max(1, Math.min(200, query.limit ?? 75));
      const rows = filtered.slice(0, limit);
      return { rows, nextCursor: null, total: filtered.length, queryMs: Date.now() - startedAt } satisfies CruiseInventoryPage;
    }
    return cruiseInventoryRepository.query({
      ...query,
      ownerScopeId: getCruiseInventoryOwnerScope(authenticatedEmail),
    });
  }, [authenticatedEmail]);

  const getAllCruises = useCallback(async () => {
    if (Platform.OS === 'web') return cruises;
    const rows: Cruise[] = [];
    const exported = await cruiseInventoryRepository.exportAllSourceRows(
      (batch) => { rows.push(...batch); },
      500,
      getCruiseInventoryOwnerScope(authenticatedEmail),
    );
    if (exported > 0) return rows;
    return cruises;
  }, [authenticatedEmail, cruises]);

  const getCruiseInventoryIntegrity = useCallback(async () => {
    if (Platform.OS === 'web') {
      return {
        rawRows: cruises.length,
        canonicalRows: cruises.length,
        duplicatesMerged: 0,
        rejectedRows: 0,
        offerSailingRelationships: cruises.filter((row) => Boolean((row as Cruise & Record<string, unknown>).offerId || (row as Cruise & Record<string, unknown>).offerInstanceKey)).length,
        durableSourceRows: cruises.length,
        readbackRows: cruises.length,
        activeGenerations: cruises.length ? 1 : 0,
        reconciled: true,
      } satisfies CruiseInventoryIntegrity;
    }
    return cruiseInventoryRepository.getActiveIntegrity(getCruiseInventoryOwnerScope(authenticatedEmail));
  }, [authenticatedEmail, cruises]);

  const addCruise = useCallback((cruise: Cruise) => {
    void getAllCruises().then((current) => setCruises([
      ...current,
      canonicalizeDataRecord(cruise as Cruise & Record<string, unknown>) as Cruise,
    ])).catch((error) => console.error('[CoreData] Failed to add cruise to inventory:', error));
  }, [getAllCruises, setCruises]);

  const updateCruise = useCallback((id: string, updates: Partial<Cruise>) => {
    void getAllCruises().then((current) => setCruises(current.map(c => c.id === id
        ? canonicalizeDataRecord({ ...c, ...updates } as Cruise & Record<string, unknown>) as Cruise
        : c))).catch((error) => console.error('[CoreData] Failed to update cruise inventory:', error));
  }, [getAllCruises, setCruises]);

  const removeCruise = useCallback((id: string) => {
    void getAllCruises().then((current) => setCruises(current.filter(c => c.id !== id)))
      .catch((error) => console.error('[CoreData] Failed to remove cruise from inventory:', error));
  }, [getAllCruises, setCruises]);

  const setBookedCruises = useCallback(async (newCruises: BookedCruise[], options?: CoreDataCommitOptions) => {
    const ownedInputCruises = prepareOwnedRecords<BookedCruise>(newCruises, ownerScopeId, authenticatedEmail, 'set booked cruises');
    const booked = ownedInputCruises.filter(c => c.status !== 'available');
    
    // Filter out mock/demo cruises when setting real data
    const nonMockCruises = booked.filter(cruise => 
      !cruise.id?.includes('demo-') && 
      !cruise.id?.includes('booked-virtual') &&
      cruise.reservationNumber !== 'DEMO123' &&
      cruise.reservationNumber !== 'DEMO456' &&
      cruise.shipName !== 'Virtually a Ship of the Seas' &&
      !isKnownInvalidBookedCruise(cruise)
    );
    
    console.log('[CoreData] Setting booked cruises:', { 
      total: booked.length, 
      nonMock: nonMockCruises.length 
    });
    
    const importedCruises = applyUserConfirmedBookedCruiseManifest(nonMockCruises.map(applyKnownBookingCorrectionsToCruise));
    const lifecycleResult = updateAllCruiseLifecycles(importedCruises);
    const normalizedCruises = annotateOverlappingCruises(dedupeBookedCruises(prepareOwnedRecords<BookedCruise>(lifecycleResult.updatedCruises.map(normalizeCruiseCasinoPerformance), ownerScopeId, authenticatedEmail, 'normalized booked cruises'), 'normalized booked cruises'));
    console.log('[CoreData] Normalized booked cruise lifecycle before persist:', {
      total: normalizedCruises.length,
      upcoming: lifecycleResult.report.upcomingCount,
      inProgress: lifecycleResult.report.inProgressCount,
      completed: lifecycleResult.report.completedCount,
    });
    await persistData(skRef.current.BOOKED_CRUISES, normalizedCruises, options);
    setBookedCruisesState(normalizedCruises);
    normalizedCruises.forEach((cruise) => notifyCruiseRecordChanged({ cruiseId: cruise.id, kind: 'replaced' }));
    if (options?.markImportedData ?? true) {
      await quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    }

    // Calendar generation is derived and must never block authoritative booking persistence.
    setTimeout(() => {
      void (async () => {
        try {
          const newCalendarEvents: CalendarEvent[] = dedupeCalendarEvents(
            prepareOwnedRecords<CalendarEvent>(generateCruiseCalendarEvents(normalizedCruises), ownerScopeId, authenticatedEmail, 'booked cruise calendar events'),
            'booked cruise calendar events'
          );
          await persistData(skRef.current.CALENDAR_EVENTS, newCalendarEvents, { updateLastSync: false });
          setCalendarEventsState(newCalendarEvents);
          appendDiagnosticJournal('DERIVED_CALENDAR_REBUILT', { count: newCalendarEvents.length });
        } catch (error) {
          console.warn('[CoreData] Deferred calendar rebuild failed without blocking bookings:', error);
        }
      })();
    }, 0);
    console.log('[CoreData] Booked cruises state updated and durably persisted:', normalizedCruises.length);
  }, [persistData, ownerScopeId, authenticatedEmail]);

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
    const canonicalCruise = canonicalizeDataRecord(cruise as BookedCruise & Record<string, unknown>) as BookedCruise;
    const correctedCruise = normalizeCruiseCasinoPerformance(applyKnownBookingCorrectionsToCruise(canonicalCruise));
    setBookedCruisesState(prev => {
      const updated = annotateOverlappingCruises([...prev, correctedCruise]);
      scheduleBackgroundPersist(skRef.current.BOOKED_CRUISES, updated);
      return updated;
    });
    const calEvent = buildCalendarEventFromCruise(correctedCruise);
    notifyCruiseRecordChanged({ cruiseId: correctedCruise.id, kind: 'created' });
    setCalendarEventsState(prev => {
      const filtered = prev.filter(e => e.id !== calEvent.id);
      const updated = [...filtered, calEvent];
      scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, updated);
      console.log('[CoreData] Auto-added calendar event for cruise:', cruise.id, cruise.shipName);
      return updated;
    });
  }, [scheduleBackgroundPersist, buildCalendarEventFromCruise]);

  const updateBookedCruise = useCallback((id: string, updates: Partial<BookedCruise>) => {
    setBookedCruisesState(prev => {
      const updated = annotateOverlappingCruises(prev.map(c => c.id === id
        ? normalizeCruiseCasinoPerformance(applyKnownBookingCorrectionsToCruise(canonicalizeDataRecord({ ...c, ...updates } as BookedCruise & Record<string, unknown>) as BookedCruise))
        : c));
      scheduleBackgroundPersist(skRef.current.BOOKED_CRUISES, updated);
      
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
            scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, finalEvents);
            console.log('[CoreData] Auto-updated calendar event for cruise:', id);
            return finalEvents;
          });
        }
      }
      
      return updated;
    });
    notifyCruiseRecordChanged({ cruiseId: id, kind: 'updated', changedFields: Object.keys(updates) });
  }, [scheduleBackgroundPersist, buildCalendarEventFromCruise]);

  const removeBookedCruise = useCallback((id: string) => {
    setBookedCruisesState(prev => {
      const updated = prev.filter(c => c.id !== id);
      scheduleBackgroundPersist(skRef.current.BOOKED_CRUISES, updated);
      return updated;
    });
    const calEventId = `cruise-${id}`;
    setCalendarEventsState(prev => {
      const updated = prev.filter(e => e.id !== calEventId && e.cruiseId !== id);
      scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, updated);
      console.log('[CoreData] Auto-removed calendar event for cruise:', id);
      return updated;
    });
    notifyCruiseRecordChanged({ cruiseId: id, kind: 'removed' });
  }, [scheduleBackgroundPersist]);

  const setCasinoOffers = useCallback(async (newOffers: CasinoOffer[], options?: CoreDataCommitOptions) => {
    const ownedOffers = collapseOfferSailingRowsToOfferInstances(
      dedupeCasinoOffers(prepareOwnedRecords<CasinoOffer>(newOffers, ownerScopeId, authenticatedEmail, 'set casino offers'), 'set casino offers'),
    );
    const nonMockOffers = ownedOffers.filter(offer => 
      !offer.id?.includes('demo-') &&
      offer.offerCode !== 'NOWHERE2025'
    );
    
    console.log('[CoreData] Setting casino offers:', { 
      total: newOffers.length, 
      owned: ownedOffers.length,
      nonMock: nonMockOffers.length 
    });
    
    await persistData(skRef.current.CASINO_OFFERS, nonMockOffers, options);
    setCasinoOffersState(nonMockOffers);
    if (options?.markImportedData ?? true) {
      await quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
    }
    console.log('[CoreData] Casino offers state updated and persisted:', nonMockOffers.length);
  }, [persistData, ownerScopeId, authenticatedEmail]);

  const finalizeLocalSyncMetadata = useCallback(async (timestamp?: string) => {
    const nextTimestamp = timestamp ?? new Date().toISOString();
    await Promise.all([
      quotaSafeSetItem(skRef.current.LAST_SYNC, nextTimestamp, { runId: `local-sync-metadata-${nextTimestamp}` }),
      quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true', { runId: `local-sync-imported-${nextTimestamp}` }),
    ]);
    setLastSyncDate(nextTimestamp);
    appendDiagnosticJournal('CORE_DATA_SYNC_METADATA_COMMITTED', { timestamp: nextTimestamp });
  }, []);

  const addCasinoOffer = useCallback((offer: CasinoOffer) => {
    setCasinoOffersState(prev => {
      const updated = [...prev, canonicalizeDataRecord(offer as CasinoOffer & Record<string, unknown>) as CasinoOffer];
      scheduleBackgroundPersist(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [scheduleBackgroundPersist]);

  const updateCasinoOffer = useCallback((id: string, updates: Partial<CasinoOffer>) => {
    setCasinoOffersState(prev => {
      const updated = prev.map(o => o.id === id
        ? canonicalizeDataRecord({ ...o, ...updates } as CasinoOffer & Record<string, unknown>) as CasinoOffer
        : o);
      scheduleBackgroundPersist(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [scheduleBackgroundPersist]);

  const removeCasinoOffer = useCallback((id: string) => {
    setCasinoOffersState(prev => {
      const updated = prev.filter(o => o.id !== id);
      scheduleBackgroundPersist(skRef.current.CASINO_OFFERS, updated);
      return updated;
    });
  }, [scheduleBackgroundPersist]);

  const setCalendarEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    const ownedEvents = dedupeCalendarEvents(prepareOwnedRecords<CalendarEvent>(newEvents, ownerScopeId, authenticatedEmail, 'set calendar events'), 'set calendar events');
    console.log('[CoreData] Setting calendar events:', ownedEvents.length);
    setCalendarEventsState(ownedEvents);
    await persistData(skRef.current.CALENDAR_EVENTS, ownedEvents);
    await quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true').catch(console.error);
  }, [persistData, ownerScopeId, authenticatedEmail]);

  const addCalendarEvent = useCallback((event: CalendarEvent) => {
    setCalendarEventsState(prev => {
      const updated = [...prev, canonicalizeDataRecord(event as CalendarEvent & Record<string, unknown>) as CalendarEvent];
      scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, updated);
      return updated;
    });

  }, [scheduleBackgroundPersist]);

  const updateCalendarEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setCalendarEventsState(prev => {
      const updated = prev.map(e => e.id === id
        ? canonicalizeDataRecord({ ...e, ...updates } as CalendarEvent & Record<string, unknown>) as CalendarEvent
        : e);
      scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [scheduleBackgroundPersist]);

  const removeCalendarEvent = useCallback((id: string) => {
    setCalendarEventsState(prev => {
      const updated = prev.filter(e => e.id !== id);
      scheduleBackgroundPersist(skRef.current.CALENDAR_EVENTS, updated);
      return updated;
    });
  }, [scheduleBackgroundPersist]);

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
      quotaSafeSetJsonItem(skRef.current.SETTINGS, updated).catch(console.error);
      quotaSafeSetItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
      setLastSyncDate(nextSyncTimestamp);
      return updated;
    });
  }, []);

  const setUserPoints = useCallback((points: number) => {
    const nextSyncTimestamp = new Date().toISOString();
    setUserPointsState(points);
    setLastSyncDate(nextSyncTimestamp);
    quotaSafeSetItem(skRef.current.USER_POINTS, points.toString()).catch(console.error);
    quotaSafeSetItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
  }, []);

  const setClubRoyaleProfile = useCallback((profile: ClubRoyaleProfile) => {
    const nextSyncTimestamp = new Date().toISOString();
    setClubRoyaleProfileState(profile);
    setLastSyncDate(nextSyncTimestamp);
    quotaSafeSetJsonItem(skRef.current.CLUB_PROFILE, profile).catch(console.error);
    quotaSafeSetItem(skRef.current.LAST_SYNC, nextSyncTimestamp).catch(console.error);
  }, []);

  const clearAllData = useCallback(async () => {
    try {
      console.log('[CoreData] Clearing all data and preventing mock data from loading...');
      const repositoryOwner = authenticatedEmail || ownerScopeId || 'local-default';
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'booked_cruises', [], skRef.current.BOOKED_CRUISES),
        replaceHighVolumeDomain(repositoryOwner, 'casino_offers', [], skRef.current.CASINO_OFFERS),
        replaceHighVolumeDomain(repositoryOwner, 'calendar_events', [], skRef.current.CALENDAR_EVENTS),
        quotaSafeRemoveItem(skRef.current.CRUISES),
        quotaSafeRemoveItem(skRef.current.BOOKED_CRUISES),
        quotaSafeRemoveItem(skRef.current.CASINO_OFFERS),
        quotaSafeRemoveItem(skRef.current.CALENDAR_EVENTS),
        quotaSafeRemoveItem(skRef.current.LAST_SYNC),
        quotaSafeRemoveItem(skRef.current.REMOVED_MOCK_CRUISES),
        quotaSafeSetItem(skRef.current.HAS_IMPORTED_DATA, 'true'),
        cruiseInventoryRepository.clear(getCruiseInventoryOwnerScope(authenticatedEmail)),
      ]);
      setCruisesState([]);
      setCruiseInventoryCount(0);
      setBookedCruisesState([]);
      setCasinoOffersState([]);
      setCalendarEventsState([]);
      setLastSyncDate(null);
      console.log('[CoreData] All data cleared successfully - state reset to empty arrays, mock data prevented from loading');
    } catch (error) {
      console.error('[CoreData] Failed to clear data:', error);
      throw error;
    }
  }, [authenticatedEmail, ownerScopeId]);

  const refreshData = useCallback(async () => {
    console.log('[CoreData] === REFRESH DATA CALLED (FORCE RELOAD) ===');
    await loadFromStorageRef.current(true);
  }, []);

  const restoreMockData = useCallback(async () => {
    console.warn('[CoreData] Demo cruise restoration is disabled in production data paths.');
  }, []);

  const completedCruises = useMemo(() => {
    return bookedCruises.filter(cruise => {
      const isCompleted = cruise.completionState === 'completed' || cruise.status === 'completed';
      if (cruise.returnDate) {
        return isCompleted || isDateInPast(cruise.returnDate);
      }
      return isCompleted;
    });
  }, [bookedCruises]);

  return useMemo(() => ({
    cruises,
    cruiseInventoryCount,
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
    queryCruises,
    getAllCruises,
    getCruiseInventoryIntegrity,
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
    finalizeLocalSyncMetadata,
    flushPendingWrites,
    clearAllData,
    refreshData,
    restoreMockData,
  }), [
    cruises,
    cruiseInventoryCount,
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
    queryCruises,
    getAllCruises,
    getCruiseInventoryIntegrity,
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
    flushPendingWrites,
    setFilter,
    setFilters,
    clearFilters,
    clearFilter,
    updateSettings,
    setUserPoints,
    setClubRoyaleProfile,
    syncToBackend,
    finalizeLocalSyncMetadata,
    clearAllData,
    refreshData,
    restoreMockData,
  ]);
});
