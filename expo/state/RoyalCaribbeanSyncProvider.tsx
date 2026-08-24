import createContextHook from '@nkzw/create-context-hook';
import type { Cruise } from '@/types/models';
import { useState, useCallback, useRef, useEffect, useContext, createContext, useMemo, ReactNode } from 'react';
import { WebView } from 'react-native-webview';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import { beginSyncTransaction, recordSyncDatasets, commitSyncTransaction, abortSyncTransaction, type SyncTransactionManifest } from '@/lib/storage/syncTransaction';
import { appendDiagnosticJournal, readDiagnosticJournal } from '@/lib/storage/diagnosticJournal';
import { Platform } from 'react-native';
import { getUserScopedKey, ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';
import { useUser, type UserProfile } from './UserProvider';
import { 
  RoyalCaribbeanSyncState, 
  SyncStatus,
  OfferRow, 
  BookedCruiseRow,
  WebViewMessage,
  ExtendedLoyaltyData,
  LoyaltyApiInformation,
  CarnivalCollectionEvidenceMap,
  CarnivalCollectionKey,
  CarnivalSyncOutcome,
  RoyalSyncHandoffEvidence,
} from '@/lib/royalCaribbean/types';
import { convertLoyaltyInfoToExtended, mergeExtendedLoyaltyData } from '@/lib/royalCaribbean/loyaltyConverter';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectCarnivalOffersExtraction, injectCarnivalBookingsScrape, injectCarnivalCruiseSearchScrape, injectCarnivalTgoExtract } from '@/lib/carnival/carnivalOffersExtraction';
import {
  injectCarnivalSearchPageScrape,
  type CarnivalSearchPageResult,
} from '@/lib/carnival/carnivalSafeSync';
import {
  buildCarnivalNextPageUrl,
  createCarnivalSailingKey,
  shouldRetryCarnivalSearchPage,
} from '@/lib/carnival/carnivalInventoryRuntime';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';
import { validateOfferCruiseReferences } from '@/lib/royalCaribbean/syncIntegrity';
import { parseCasinoOffersPayload } from '@/lib/royalCaribbean/offerPayloadParser';
import { healImportedData } from '@/lib/dataHealing';
import { isActiveBookedCruise, isCompletedBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';
import {
  buildCarnivalCheckpoint,
  clearCarnivalSyncCheckpoint,
  assessCarnivalRateCodePagination,
  createCarnivalAccountFingerprint,
  createCarnivalOwnerFingerprint,
  createCarnivalCollectionEvidence,
  evaluateCarnivalSyncOutcome,
  getCarnivalOutcomeMessage,
  inspectCarnivalStructuredPayload,
  parseCarnivalVifpPayload,
  createCarnivalRateCodeEvidence,
  updateCarnivalRateCodeEvidence,
  loadCarnivalSyncCheckpoint,
  saveCarnivalSyncCheckpoint,
  updateCarnivalCollection,
  validateCarnivalSyncCheckpoint,
  type CarnivalSyncCheckpoint,
  type CarnivalVifpPayload,
  type CarnivalRateCodeEvidenceMap,
} from '@/lib/carnival/syncSupport';
import {
  assessCarnivalRuntimeCompatibility,
  mustBlockCarnivalIngestion,
  type CarnivalRuntimeCompatibility,
} from '@/lib/carnival/runtimeCompatibility';
import {
  canPersistSyncToTarget,
  createSyncOwnershipSnapshot,
  isSyncOwnershipCurrent,
  verifySyncReadback,
  type SyncOwnershipSnapshot,
} from '@/lib/sync/syncRunIntegrity';
import { isSafeRemoteWebViewUrl } from '@/lib/webViewSourceSafety';
import {
  hasMeaningfulExtendedLoyaltyData,
  isRoyalLoyaltyHistoryPayload,
  parseRoyalLoyaltyHistorySailings,
  resolveRoyalCruiseStatus,
  ROYAL_SHIP_CODE_MAP,
} from '@/lib/royalCaribbean/bookingNormalization';
import { inferClubRoyaleTierValidThrough, normalizeClubRoyaleTier } from '@/constants/clubRoyaleTiers';
import {
  normalizeCarnivalBookingClassification,
} from '@/lib/carnival/carnivalDataRuntime';

export type CruiseLine = 'royal_caribbean' | 'celebrity' | 'carnival';

// Expo Router can briefly keep an outgoing Carnival screen mounted while a
// replacement screen is opening. A provider-local ref cannot prevent both
// screens from starting the same browser ingestion. Keep one module-scoped
// Carnival run and let any overlapping caller wait for that run to unwind.
// This is an execution lock only; no user data is stored here.
let activeCarnivalIngestionToken: symbol | null = null;
let activeCarnivalIngestionCompletion: Promise<void> | null = null;
let resolveActiveCarnivalIngestion: (() => void) | null = null;

export const CRUISE_LINE_CONFIG = {
  royal_caribbean: {
    name: 'Royal Caribbean',
    loginUrl: 'https://www.royalcaribbean.com/club-royale',
    offersUrl: 'https://www.royalcaribbean.com/club-royale/offers',
    upcomingUrl: 'https://www.royalcaribbean.com/account/upcoming-cruises',
    holdsUrl: 'https://www.royalcaribbean.com/account/courtesy-holds',
    myTripsUrl: 'https://www.royalcaribbean.com/myaccount/my-trips',
    loyaltyClubName: 'Club Royale',
    loyaltyPageUrl: 'https://www.royalcaribbean.com/account/loyalty-programs',
  },
  celebrity: {
    name: 'Celebrity Cruises',
    loginUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    offersUrl: 'https://www.celebritycruises.com/blue-chip-club/offers',
    upcomingUrl: 'https://www.celebritycruises.com/account/upcoming-cruises',
    holdsUrl: 'https://www.celebritycruises.com/account/courtesy-holds',
    myTripsUrl: 'https://www.celebritycruises.com/account/upcoming-cruises',
    loyaltyClubName: 'Blue Chip Club',
    loyaltyPageUrl: 'https://www.celebritycruises.com/account/loyalty',
  },
  carnival: {
    name: 'Carnival Cruise Line',
    loginUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    offersUrl: 'https://www.carnival.com/profilemanagement/profiles/offers',
    upcomingUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    holdsUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    myTripsUrl: 'https://www.carnival.com/profilemanagement/profiles/cruises',
    loyaltyClubName: 'VIFP Club',
    loyaltyPageUrl: 'https://www.carnival.com/profilemanagement/profiles',
  },
} as const;

function normalizeCarnivalRateCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

interface CarnivalSearchPageWaiter {
  requestId: string;
  rows: OfferRow[];
  resolve: (result: CarnivalSearchPageResult) => void;
}

// Carnival's API reports itinerary groups, each of which can contain several
// dated sailings. A larger bounded page cuts dozens of browser round-trips
// while retaining the same verified per-rate-code pagination proof.
const CARNIVAL_SEARCH_PAGE_SIZE = 200;
const CARNIVAL_SEARCH_MAX_PAGES = 50;
const CARNIVAL_SEARCH_PAGE_TIMEOUT_MS = 35_000;

function hasLoyaltyForCruiseLine(data: ExtendedLoyaltyData, cruiseLine: CruiseLine): boolean {
  if (cruiseLine === 'celebrity') {
    return Boolean(
      data.captainsClubId?.trim() ||
      data.captainsClubTier?.trim() ||
      data.captainsClubPoints !== undefined ||
      data.celebrityBlueChipTier?.trim() ||
      data.celebrityBlueChipPoints !== undefined
    );
  }
  if (cruiseLine === 'royal_caribbean') {
    return Boolean(
      data.crownAndAnchorId?.trim() ||
      data.crownAndAnchorTier?.trim() ||
      data.crownAndAnchorPointsFromApi !== undefined ||
      data.clubRoyaleTierFromApi?.trim() ||
      data.clubRoyalePointsFromApi !== undefined
    );
  }
  return hasMeaningfulExtendedLoyaltyData(data);
}

function scopeLoyaltyForCruiseLine(
  data: ExtendedLoyaltyData | null | undefined,
  cruiseLine: CruiseLine,
): ExtendedLoyaltyData | null {
  if (!data || !hasLoyaltyForCruiseLine(data, cruiseLine)) {
    return null;
  }

  const common = {
    accountId: data.accountId,
    hasCoBrandCard: data.hasCoBrandCard,
    coBrandCardStatus: data.coBrandCardStatus,
    coBrandCardErrorMessage: data.coBrandCardErrorMessage,
  };

  if (cruiseLine === 'celebrity') {
    return {
      ...common,
      captainsClubId: data.captainsClubId,
      captainsClubTier: data.captainsClubTier,
      captainsClubPoints: data.captainsClubPoints,
      captainsClubRelationshipPoints: data.captainsClubRelationshipPoints,
      captainsClubNextTier: data.captainsClubNextTier,
      captainsClubRemainingPoints: data.captainsClubRemainingPoints,
      captainsClubTrackerPercentage: data.captainsClubTrackerPercentage,
      captainsClubLoyaltyMatchTier: data.captainsClubLoyaltyMatchTier,
      celebrityBlueChipTier: data.celebrityBlueChipTier,
      celebrityBlueChipPoints: data.celebrityBlueChipPoints,
      celebrityBlueChipRelationshipPoints: data.celebrityBlueChipRelationshipPoints,
    };
  }

  if (cruiseLine === 'royal_caribbean') {
    return {
      ...common,
      clubRoyaleTierFromApi: data.clubRoyaleTierFromApi,
      clubRoyalePointsFromApi: data.clubRoyalePointsFromApi,
      clubRoyaleRelationshipPointsFromApi: data.clubRoyaleRelationshipPointsFromApi,
      crownAndAnchorId: data.crownAndAnchorId,
      crownAndAnchorTier: data.crownAndAnchorTier,
      crownAndAnchorPointsFromApi: data.crownAndAnchorPointsFromApi,
      crownAndAnchorRelationshipPointsFromApi: data.crownAndAnchorRelationshipPointsFromApi,
      crownAndAnchorNextTier: data.crownAndAnchorNextTier,
      crownAndAnchorRemainingPoints: data.crownAndAnchorRemainingPoints,
      crownAndAnchorTrackerPercentage: data.crownAndAnchorTrackerPercentage,
      crownAndAnchorLoyaltyMatchTier: data.crownAndAnchorLoyaltyMatchTier,
    };
  }

  return data;
}

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
  scrapePricingAndItinerary: false
};

const INITIAL_EXTENDED_LOYALTY: ExtendedLoyaltyData | null = null;

function createRoyalSyncHandoffEvidence(): RoyalSyncHandoffEvidence {
  return {
    discoveredOfferRows: 0,
    discoveredBookedRows: 0,
    normalizedOfferRows: 0,
    normalizedBookedRows: 0,
    emittedRows: 0,
    acknowledgedRows: 0,
    receivedRows: 0,
    malformedOfferRows: 0,
    malformedBookedRows: 0,
    exactOfferDuplicates: 0,
    exactBookedDuplicates: 0,
    canonicalRows: 0,
    rejectedRows: 0,
    quarantinedRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    unchangedRows: 0,
    databaseReadbackRows: 0,
    unaccountedRows: 0,
  };
}

type SyncTargetSlot = 'primary' | 'secondary';

interface SyncTargetOptions {
  targetProfileId?: string;
  targetProfileSlot?: SyncTargetSlot;
}

function normalizeProfileText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function hasProfileLoyaltyData(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.crownAnchorNumber?.trim() ||
    profile.royalCaribbeanNumber?.trim() ||
    profile.clubRoyaleId?.trim() ||
    profile.clubRoyaleTier?.trim() ||
    (profile.clubRoyalePoints ?? 0) > 0 ||
    profile.crownAnchorLevel?.trim() ||
    (profile.loyaltyPoints ?? 0) > 0 ||
    profile.celebrityCaptainsClubNumber?.trim() ||
    profile.celebrityCaptainsClubTier?.trim() ||
    profile.blueChipId?.trim() ||
    profile.celebrityBlueChipTier?.trim() ||
    (profile.celebrityCaptainsClubPoints ?? 0) > 0 ||
    (profile.celebrityBlueChipPoints ?? 0) > 0 ||
    profile.silverseaVenetianNumber?.trim() ||
    profile.silverseaVenetianTier?.trim() ||
    (profile.silverseaVenetianPoints ?? 0) > 0 ||
    profile.carnivalVifpNumber?.trim() ||
    profile.carnivalVifpTier?.trim() ||
    profile.carnivalPlayersClubTier?.trim() ||
    (profile.carnivalPlayersClubPoints ?? 0) > 0
  );
}

function isUnassignedProfile(profile: UserProfile | null | undefined, slot: SyncTargetSlot): boolean {
  if (!profile) return true;
  if (hasProfileLoyaltyData(profile)) return false;

  const label = normalizeProfileText(profile.displayName || profile.name);
  if (slot === 'secondary') {
    return !label || label === 'unassigned' || label === 'second user' || label === 'secondary user';
  }

  return !label || label === 'unassigned' || label === 'player' || label === 'user';
}

type SyncCheckpointLogType = 'info' | 'success' | 'warning' | 'error';

async function runBoundedSyncCheckpoint<T>(
  name: string,
  operation: () => Promise<T> | T,
  log: (message: string, type: SyncCheckpointLogType) => void,
  timeoutMs: number = 45000,
  hardTimeout: boolean = false,
): Promise<T> {
  const startedAt = Date.now();
  log(`${name} started`, 'info');
  appendDiagnosticJournal('SYNC_CHECKPOINT_STARTED', { name, startedAt });
  let warned = false;
  const warningHandle = setTimeout(() => {
    warned = true;
    log(`⚠️ ${name} is still working locally; the app remains usable.`, 'warning');
    appendDiagnosticJournal('SYNC_CHECKPOINT_SLOW', { name, elapsedMs: Date.now() - startedAt });
  }, Math.max(1000, Math.floor(timeoutMs / 2)));
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const operationPromise = Promise.resolve().then(operation);
    let result: T;
    if (hardTimeout) {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`SYNC_CHECKPOINT_TIMEOUT:${name}:${timeoutMs}`)), timeoutMs);
      });
      result = await Promise.race([operationPromise, timeoutPromise]);
    } else {
      // Native transactional writes cannot be safely cancelled once their
      // temporary file is being verified and activated. Rejecting here leaves
      // the write running and starts rollback against the same storage key,
      // which is exactly how a successful Carnival/Royal save was reported as
      // failed. Keep the UI responsive, report slow progress, and await the
      // authoritative commit acknowledgement instead.
      timeoutHandle = setTimeout(() => {
        log(`⚠️ ${name} passed the normal ${Math.round(timeoutMs / 1000)}s window; waiting for the verified local commit instead of aborting it.`, 'warning');
        appendDiagnosticJournal('SYNC_CHECKPOINT_EXTENDED', { name, elapsedMs: Date.now() - startedAt });
      }, timeoutMs);
      result = await operationPromise;
    }
    const elapsed = Date.now() - startedAt;
    log(`✅ ${name} completed in ${(elapsed / 1000).toFixed(1)}s${warned ? ' after extended local work' : ''}`, 'success');
    appendDiagnosticJournal('SYNC_CHECKPOINT_COMPLETE', { name, elapsedMs: elapsed });
    return result;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    log(`❌ ${name} failed after ${(elapsed / 1000).toFixed(1)}s: ${message}`, 'error');
    appendDiagnosticJournal('SYNC_CHECKPOINT_FAILED', { name, elapsedMs: elapsed, error: message });
    throw error;
  } finally {
    clearTimeout(warningHandle);
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function yieldSyncUi(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}


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
  const { currentUser, users, updateUser: updateUserProfile } = useUser();
  const carnivalUserDataRef = useRef<CarnivalVifpPayload | null>(null);
  const extractedOffersRef = useRef<OfferRow[]>([]);
  const webViewRef = useRef<WebView | null>(null);
  const hasReceivedApiLoyaltyDataRef = useRef(false);
  const lastAuthenticatedEmailRef = useRef<string | null>(authenticatedEmail);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});
  const progressCallbacks = useRef<{ onProgress?: () => void }>({});
  const processedPayloads = useRef<Set<string>>(new Set());
  const capturedSections = useRef({ offers: false, bookings: false, loyalty: false, pastTrips: false });
  const pageLoadResolver = useRef<((loadedUrl?: string) => void) | null>(null);
  const carnivalSearchPageResolver = useRef<CarnivalSearchPageWaiter | null>(null);
  const carnivalPageCheckResolver = useRef<((onOffers: boolean) => void) | null>(null);
  const carnivalTgoDataResolver = useRef<((data: { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> }) => void) | null>(null);
  const navigationRequestIdRef = useRef<number>(0);
  const pendingNavigationTargetRef = useRef<string | null>(null);
  const syncToAppInFlightRef = useRef<boolean>(false);
  const activeSyncTransactionRef = useRef<SyncTransactionManifest | null>(null);
  const ingestionInFlightRef = useRef<boolean>(false);
  const ingestionInstanceTokenRef = useRef(Symbol('easyseas-carnival-ingestion'));
  const carnivalSingleFlightWaitLoggedRef = useRef(false);
  const logFlushScheduledRef = useRef<boolean>(false);
  const logFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extractedOffersPublishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerMountedRef = useRef<boolean>(true);
  const carnivalCollectionsRef = useRef<CarnivalCollectionEvidenceMap>(createCarnivalCollectionEvidence());
  const carnivalRateCodesRef = useRef<CarnivalRateCodeEvidenceMap>({});
  const carnivalRunRef = useRef<{ syncRunId: string; profileId: string; createdAt: string } | null>(null);
  const carnivalResumeCheckpointRef = useRef<CarnivalSyncCheckpoint | null>(null);
  const carnivalSyncCancelledRef = useRef<boolean>(false);
  const syncStopRequestedRef = useRef<boolean>(false);
  const carnivalRuntimeCompatibilityRef = useRef<CarnivalRuntimeCompatibility | null>(null);
  const carnivalCompatibilityLoggedRef = useRef<boolean>(false);
  // Carnival's client-side router emits overlapping auth probes while pages
  // transition. Latch a confirmed session until an explicit sign-in form or
  // login URL is observed so a stale probe cannot require a screen remount.
  const carnivalAuthenticatedSessionRef = useRef<boolean>(false);
  const carnivalIngestionReadinessWaitLoggedRef = useRef<boolean>(false);
  const royalHandoffEvidenceRef = useRef<RoyalSyncHandoffEvidence>(createRoyalSyncHandoffEvidence());
  const syncOwnershipRef = useRef<SyncOwnershipSnapshot | null>(null);
  const currentSyncOwnerRef = useRef({ profileId: '', authenticatedEmail: '' });
  // Async ingestion callbacks must compare against the latest render, not the
  // profile/email values captured when the callback originally started.
  currentSyncOwnerRef.current = {
    profileId: String(currentUser?.id ?? '').trim(),
    authenticatedEmail: String(authenticatedEmail ?? '').trim().toLowerCase(),
  };
  
  const config = CRUISE_LINE_CONFIG[cruiseLine];
  const [webViewUrl, setWebViewUrl] = useState<string>(CRUISE_LINE_CONFIG[initialCruiseLine].loginUrl);

  const recordCarnivalCollection = useCallback((
    key: CarnivalCollectionKey,
    count: number,
    source: string,
    status?: 'captured' | 'empty' | 'unavailable' | 'failed',
    reason?: string,
  ) => {
    carnivalCollectionsRef.current = updateCarnivalCollection(
      carnivalCollectionsRef.current,
      key,
      count,
      source,
      status,
      reason,
    );
  }, []);

  const persistCarnivalCheckpoint = useCallback(async (
    completedStages: string[],
    pendingStages: string[],
    offerRows: OfferRow[],
    bookedCruiseRows: BookedCruiseRow[],
    loyaltyData: Record<string, string> = {},
  ): Promise<boolean> => {
    const run = carnivalRunRef.current;
    const currentOwner = currentSyncOwnerRef.current;
    if (!run || !currentOwner.authenticatedEmail
      || !isSyncOwnershipCurrent(syncOwnershipRef.current, currentOwner.profileId, currentOwner.authenticatedEmail)) {
      return false;
    }
    const fingerprint = createCarnivalAccountFingerprint(carnivalUserDataRef.current?.vifpNumber || currentUser?.carnivalVifpNumber);
    const checkpoint = buildCarnivalCheckpoint({
      syncRunId: run.syncRunId,
      profileId: run.profileId,
      accountFingerprint: fingerprint,
      ownerFingerprint: createCarnivalOwnerFingerprint(run.profileId, currentOwner.authenticatedEmail),
      createdAt: run.createdAt,
      completedStages,
      pendingStages,
      collections: carnivalCollectionsRef.current,
      rateCodes: carnivalRateCodesRef.current,
      offerRows,
      bookedCruiseRows,
      loyaltyData,
    });
    await saveCarnivalSyncCheckpoint(currentOwner.authenticatedEmail, checkpoint);
    if (!isSyncOwnershipCurrent(syncOwnershipRef.current, currentSyncOwnerRef.current.profileId, currentSyncOwnerRef.current.authenticatedEmail)) {
      return false;
    }
    setState((prev) => ({ ...prev, hasResumableCarnivalCheckpoint: true }));
    return true;
  }, [currentUser?.carnivalVifpNumber]);

  const preserveCarnivalFailureCheckpoint = useCallback(async (
    pendingStage: string,
    offerRows: OfferRow[],
    bookedCruiseRows: BookedCruiseRow[],
    loyaltyData: Record<string, string> = {},
  ): Promise<'saved' | 'owner_changed' | 'failed'> => {
    try {
      const saved = await persistCarnivalCheckpoint([], [pendingStage], offerRows, bookedCruiseRows, loyaltyData);
      return saved ? 'saved' : 'owner_changed';
    } catch (error) {
      console.warn(`[CarnivalSync] Could not preserve checkpoint after ${pendingStage}:`, error);
      return 'failed';
    }
  }, [persistCarnivalCheckpoint]);

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

  const getPayloadIdentifier = useCallback(function collect(value: unknown, depth: number = 0): string {
    if (depth > 2) {
      return '';
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 6)
        .map((item) => collect(item, depth + 1))
        .filter(Boolean)
        .join('|');
    }

    if (!value || typeof value !== 'object') {
      return stringifyValue(value).slice(0, 120);
    }

    const record = value as Record<string, unknown>;
    const directIdentifier = stringifyValue(
      record.offerCode ??
        record.marketingCouponCode ??
        record.bookingId ??
        record.confirmationNumber ??
        record.reservationId ??
        record.accountId ??
        record.loyaltyNumber ??
        record.shipCode ??
        record.shipName ??
        record.sailDate ??
        record.startDate ??
        record.id ??
        record.code ??
        record.name ??
        record.title
    );

    if (directIdentifier) {
      return directIdentifier.slice(0, 120);
    }

    return (
      collect(record.campaignOffer ?? record.payload ?? record.offers ?? record.casinoOffers ?? record.sailingInfo ?? record.profileBookings ?? record.bookings ?? record.Items, depth + 1) ||
      Object.keys(record).sort().join(',')
    ).slice(0, 240);
  }, [stringifyValue]);

  const createPayloadSignature = useCallback((value: unknown): string => {
    if (Array.isArray(value)) {
      const firstItemKeys = getObjectKeys(value[0]).slice(0, 8).join(',');
      const identifiers = getPayloadIdentifier(value);
      return `array:${value.length}:${firstItemKeys}:${identifiers}`;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const topLevelKeys = Object.keys(record).sort().join(',');
      const payloadKeys = getObjectKeys(record.payload).slice(0, 8).sort().join(',');
      const identifiers = getPayloadIdentifier(record);
      return `object:${topLevelKeys}:${payloadKeys}:${identifiers}`;
    }

    return `${typeof value}:${stringifyValue(value).slice(0, 120)}`;
  }, [getObjectKeys, getPayloadIdentifier, stringifyValue]);

  const normalizeOfferRows = useCallback((value: unknown): OfferRow[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedRows: OfferRow[] = [];

    value.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const row = item as Partial<OfferRow>;
      const normalizedRow: OfferRow = {
        sourcePage: stringifyValue(row.sourcePage) || 'Offers',
        offerName: stringifyValue(row.offerName) || stringifyValue(row.offerCode),
        offerCode: stringifyValue(row.offerCode),
        playerOfferId: stringifyValue(row.playerOfferId) || undefined,
        offerInstanceId: stringifyValue(row.offerInstanceId) || undefined,
        carnivalOfferId: stringifyValue(row.carnivalOfferId) || undefined,
        offerExpirationDate: stringifyValue(row.offerExpirationDate),
        offerType: stringifyValue(row.offerType),
        shipName: stringifyValue(row.shipName),
        shipCode: stringifyValue(row.shipCode) || undefined,
        sailingDate: stringifyValue(row.sailingDate),
        itinerary: stringifyValue(row.itinerary),
        departurePort: stringifyValue(row.departurePort),
        cabinType: stringifyValue(row.cabinType),
        numberOfGuests: stringifyValue(row.numberOfGuests),
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
        offerStatus: stringifyValue(row.offerStatus) || undefined,
        isInProgress: row.isInProgress === true,
      };

      const hasOfferIdentity = Boolean(normalizedRow.offerCode || (normalizedRow.offerName && normalizedRow.offerName !== 'Unknown Offer'));
      const hasSailingIdentity = Boolean(normalizedRow.shipName && normalizedRow.sailingDate);
      if (hasOfferIdentity || hasSailingIdentity) {
        normalizedRows.push(normalizedRow);
      }
    });

    // Keep raw variants intact until createSyncPreview can classify them as a
    // legitimate variant, exact duplicate, incomplete row, or rejected row.
    return normalizedRows;
  }, [stringifyValue]);

  const mergeOfferRows = useCallback((existingRows: OfferRow[], incomingRows: OfferRow[]): OfferRow[] => {
    // Existing rows have already crossed the normalization boundary. Re-running
    // the entire accumulated collection for every WebView batch made a 2,500
    // row handoff quadratic and blocked the JavaScript thread.
    return [...existingRows, ...normalizeOfferRows(incomingRows)];
  }, [normalizeOfferRows]);

  const normalizeBookedCruiseRows = useCallback((value: unknown): BookedCruiseRow[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalizedRows: BookedCruiseRow[] = [];

    value.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const row = item as Partial<BookedCruiseRow>;
      const rawBookingRecord = row.rawBooking && typeof row.rawBooking === 'object' && !Array.isArray(row.rawBooking)
        ? row.rawBooking as Record<string, unknown>
        : item as Record<string, unknown>;
      const bookingId = stringifyValue(row.bookingId) || stringifyValue(rawBookingRecord.bookingId) || stringifyValue(rawBookingRecord.masterBookingId);
      const rawNumberOfNights = rawBookingRecord.numberOfNights ?? rawBookingRecord.nights;
      const normalizedRow: BookedCruiseRow = {
        rawBooking: row.rawBooking ?? item,
        sourcePage: stringifyValue(row.sourcePage) || 'Upcoming',
        shipName: stringifyValue(row.shipName),
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
        cabinNumberOrGTY: stringifyValue(row.cabinNumberOrGTY),
        deckNumber: stringifyValue(rawBookingRecord.deckNumber) || stringifyValue(row.deckNumber) || undefined,
        bookingId,
        numberOfGuests: stringifyValue(row.numberOfGuests) || undefined,
        numberOfNights: typeof rawNumberOfNights === 'number'
          ? rawNumberOfNights
          : (() => {
              const parsedNights = Number.parseInt(stringifyValue(rawNumberOfNights) || stringifyValue(row.numberOfNights), 10);
              return Number.isFinite(parsedNights) ? parsedNights : undefined;
            })(),
        daysToGo: stringifyValue(row.daysToGo) || undefined,
        status: stringifyValue(row.status),
        loyaltyLevel: stringifyValue(row.loyaltyLevel),
        loyaltyPoints: stringifyValue(row.loyaltyPoints),
        paidInFull: stringifyValue(row.paidInFull) || undefined,
        balanceDue: stringifyValue(row.balanceDue) || undefined,
        musterStation: stringifyValue(rawBookingRecord.musterStation) || stringifyValue(row.musterStation) || undefined,
        holdExpiration: stringifyValue(row.holdExpiration) || undefined,
        bookingStatus: stringifyValue(rawBookingRecord.bookingStatus) || stringifyValue(row.bookingStatus) || undefined,
        packageCode: stringifyValue(rawBookingRecord.packageCode) || stringifyValue(row.packageCode) || undefined,
        passengerStatus: stringifyValue(row.passengerStatus) || undefined,
        stateroomNumber: stringifyValue(rawBookingRecord.stateroomNumber) || stringifyValue(row.stateroomNumber) || undefined,
        stateroomCategoryCode: stringifyValue(rawBookingRecord.stateroomCategoryCode) || stringifyValue(row.stateroomCategoryCode) || undefined,
        stateroomType: stringifyValue(rawBookingRecord.stateroomType) || stringifyValue(row.stateroomType) || undefined,
        stateroomSubtype: stringifyValue(rawBookingRecord.stateroomSubtype) || stringifyValue(row.stateroomSubtype) || undefined,
        interiorPrice: stringifyValue(row.interiorPrice) || undefined,
        oceanviewPrice: stringifyValue(row.oceanviewPrice) || undefined,
        balconyPrice: stringifyValue(row.balconyPrice) || undefined,
        suitePrice: stringifyValue(row.suitePrice) || undefined,
        taxesAndFees: stringifyValue(row.taxesAndFees) || undefined,
      };

      const providerNormalizedRow = cruiseLine === 'carnival'
        ? normalizeCarnivalBookingClassification(normalizedRow)
        : normalizedRow;
      const hasProviderIdentity = Boolean(providerNormalizedRow.bookingId);
      const hasVoyageIdentity = Boolean(providerNormalizedRow.shipName && providerNormalizedRow.sailingStartDate);
      if (hasProviderIdentity || hasVoyageIdentity) {
        normalizedRows.push(providerNormalizedRow);
      }
    });

    const seen = new Set<string>();
    return normalizedRows.filter((row) => {
      const key = row.bookingId
        ? `booking:${row.bookingId}`
        : `voyage:${row.shipName}|${row.sailingStartDate}|${row.cabinNumberOrGTY || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cruiseLine, stringifyValue]);

  const matchesNavigationTarget = useCallback((loadedUrl: string, targetUrl: string | null): boolean => {
    if (!targetUrl) {
      return true;
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
    providerMountedRef.current = true;
    return () => {
      providerMountedRef.current = false;
      syncStopRequestedRef.current = true;
      ingestionInFlightRef.current = false;
      const activeTransaction = activeSyncTransactionRef.current;
      activeSyncTransactionRef.current = null;
      if (activeTransaction) {
        void abortSyncTransaction(activeTransaction, 'SYNC_PROVIDER_UNMOUNTED').catch(() => undefined);
      }
      Object.values(stepCompleteResolvers.current).forEach((resolve) => resolve());
      stepCompleteResolvers.current = {};
      if (pageLoadResolver.current) {
        pageLoadResolver.current();
        pageLoadResolver.current = null;
      }
      if (carnivalSearchPageResolver.current) {
        const waiter = carnivalSearchPageResolver.current;
        carnivalSearchPageResolver.current = null;
        waiter.resolve({
          requestId: waiter.requestId,
          runId: '', offerCode: '', offerName: '', offerExpiry: '', perks: '',
          pageNumber: 1, pageSize: CARNIVAL_SEARCH_PAGE_SIZE,
          totalResults: 0, hasNextPage: false, rows: waiter.rows,
          error: 'cancelled',
        });
      }
      pendingNavigationTargetRef.current = null;
      logFlushScheduledRef.current = false;
      if (logFlushTimerRef.current) {
        clearTimeout(logFlushTimerRef.current);
        logFlushTimerRef.current = null;
      }
      if (extractedOffersPublishTimerRef.current) {
        clearTimeout(extractedOffersPublishTimerRef.current);
        extractedOffersPublishTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const previousEmail = lastAuthenticatedEmailRef.current;

    if (previousEmail === authenticatedEmail) {
      return;
    }

    lastAuthenticatedEmailRef.current = authenticatedEmail;
    processedPayloads.current.clear();
    capturedSections.current = { offers: false, bookings: false, loyalty: false, pastTrips: false };
    hasReceivedApiLoyaltyDataRef.current = false;
    carnivalUserDataRef.current = null;
    carnivalRunRef.current = null;
    carnivalResumeCheckpointRef.current = null;
    carnivalCompatibilityLoggedRef.current = false;
    carnivalRuntimeCompatibilityRef.current = null;
    carnivalAuthenticatedSessionRef.current = false;
    carnivalIngestionReadinessWaitLoggedRef.current = false;
    syncOwnershipRef.current = null;
    ingestionInFlightRef.current = false;
    syncToAppInFlightRef.current = false;
    royalHandoffEvidenceRef.current = createRoyalSyncHandoffEvidence();
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

  const flushDisplayLogs = useCallback(() => {
    logFlushScheduledRef.current = false;
    if (!providerMountedRef.current) {
      return;
    }
    setState(prev => {
      const newLogs = rcLogger.getDisplayLogs();
      const previousLastLog = prev.logs[prev.logs.length - 1];
      const nextLastLog = newLogs[newLogs.length - 1];
      const logsChanged =
        prev.logs.length !== newLogs.length ||
        previousLastLog?.timestamp !== nextLastLog?.timestamp ||
        previousLastLog?.message !== nextLastLog?.message ||
        previousLastLog?.type !== nextLastLog?.type;
      if (!logsChanged) {
        return prev;
      }
      return {
        ...prev,
        logs: newLogs
      };
    });
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    rcLogger.log(message, type);
    if (logFlushScheduledRef.current) {
      return;
    }
    // WebView extraction can emit hundreds of messages in a few seconds. Flush
    // a bounded display log at most eight times per second so navigation and
    // Cancel remain responsive during a large Royal or Carnival sync.
    logFlushScheduledRef.current = true;
    logFlushTimerRef.current = setTimeout(() => {
      logFlushTimerRef.current = null;
      try {
        flushDisplayLogs();
      } catch (error) {
        logFlushScheduledRef.current = false;
        console.error('[RoyalCaribbeanSync] Failed to flush logs:', error);
      }
    }, 125);
  }, [flushDisplayLogs]);

  const getSyncLogs = useCallback(() => rcLogger.getLogs(), []);

  const publishExtractedOffers = useCallback((rows: OfferRow[], immediate = false) => {
    extractedOffersRef.current = rows;
    if (cruiseLine === 'carnival') {
      // Carnival can exceed 40K sailing rows. The authoritative collection
      // stays in the ingestion ref/checkpoint until the user confirms; putting
      // that array in provider state would rerender the browser and every
      // status consumer for each batch. UI receives only bounded counters.
      if (immediate) {
        setState((previous) => ({
          ...previous,
          syncCounts: {
            ...(previous.syncCounts ?? { offerCount: 0, upcomingCruises: 0, courtesyHolds: 0 }),
            offerRows: rows.length,
          },
        }));
      }
      return;
    }
    const publish = () => {
      extractedOffersPublishTimerRef.current = null;
      if (!providerMountedRef.current) return;
      const latestRows = extractedOffersRef.current;
      setState((prev) => prev.extractedOffers === latestRows ? prev : ({ ...prev, extractedOffers: latestRows }));
    };

    if (immediate) {
      if (extractedOffersPublishTimerRef.current) {
        clearTimeout(extractedOffersPublishTimerRef.current);
        extractedOffersPublishTimerRef.current = null;
      }
      publish();
      return;
    }

    if (!extractedOffersPublishTimerRef.current) {
      extractedOffersPublishTimerRef.current = setTimeout(publish, 250);
    }
  }, [cruiseLine]);

  const toggleStaySignedIn = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(staySignedInKey(), enabled ? 'true' : 'false');
      setStaySignedIn(enabled);
      if (!enabled) {
        carnivalAuthenticatedSessionRef.current = false;
        carnivalRuntimeCompatibilityRef.current = null;
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

  const recordRoyalHandoff = useCallback((kind: 'offer' | 'booked', discoveredCount: number, normalizedCount: number) => {
    if (cruiseLine === 'carnival') {
      return;
    }

    const evidence = royalHandoffEvidenceRef.current;
    const safeDiscoveredCount = Math.max(0, discoveredCount);
    const safeNormalizedCount = Math.max(0, normalizedCount);
    evidence.emittedRows += safeDiscoveredCount;
    evidence.acknowledgedRows += safeNormalizedCount;
    evidence.receivedRows += safeNormalizedCount;
    if (kind === 'offer') {
      evidence.discoveredOfferRows += safeDiscoveredCount;
      evidence.normalizedOfferRows += safeNormalizedCount;
      evidence.malformedOfferRows += Math.max(0, safeDiscoveredCount - safeNormalizedCount);
    } else {
      evidence.discoveredBookedRows += safeDiscoveredCount;
      evidence.normalizedBookedRows += safeNormalizedCount;
      evidence.malformedBookedRows += Math.max(0, safeDiscoveredCount - safeNormalizedCount);
    }
  }, [cruiseLine]);

  const assertSyncOwnership = useCallback((operation: string) => {
    const snapshot = syncOwnershipRef.current;
    const currentOwner = currentSyncOwnerRef.current;
    if (!isSyncOwnershipCurrent(snapshot, currentOwner.profileId, currentOwner.authenticatedEmail)) {
      const message = `Sync stopped before ${operation} because the signed-in EasySeas account changed.`;
      addLog(message, 'error');
      throw new Error('SYNC_ACCOUNT_CHANGED');
    }
  }, [addLog]);

  const acceptCarnivalProviderAccount = useCallback((vifpNumber: string | null | undefined): boolean => {
    const snapshot = syncOwnershipRef.current;
    if (!snapshot || snapshot.provider !== 'carnival') {
      return true;
    }
    const currentOwner = currentSyncOwnerRef.current;
    if (!isSyncOwnershipCurrent(snapshot, currentOwner.profileId, currentOwner.authenticatedEmail)) {
      ingestionInFlightRef.current = false;
      setState((prev) => ({ ...prev, status: 'error', error: 'SYNC_ACCOUNT_CHANGED' }));
      addLog('Ignored Carnival data because the signed-in EasySeas account changed during sync.', 'error');
      return false;
    }

    const fingerprint = createCarnivalAccountFingerprint(vifpNumber);
    if (!fingerprint) {
      return true;
    }
    if (snapshot.providerAccountFingerprint && snapshot.providerAccountFingerprint !== fingerprint) {
      ingestionInFlightRef.current = false;
      setState((prev) => ({ ...prev, status: 'error', error: 'CARNIVAL_ACCOUNT_CHANGED' }));
      addLog('Ignored Carnival data because the signed-in Carnival account changed during sync.', 'error');
      return false;
    }
    snapshot.providerAccountFingerprint = fingerprint;
    return true;
  }, [addLog]);

  const readBackPersistedRows = useCallback(async (storageKey: string, expectedRows: unknown[], label: string) => {
    const scopedKey = getUserScopedKey(storageKey, authenticatedEmail);
    // Quota-safe storage can leave an internal pointer in AsyncStorage for a
    // bulky dataset. Resolve it through the quota-safe reader before comparing.
    const storedRows = await quotaSafeGetJsonItem<unknown[]>(
      scopedKey,
      [],
      (value): value is unknown[] => Array.isArray(value),
    );
    const report = verifySyncReadback(expectedRows, storedRows);
    royalHandoffEvidenceRef.current.databaseReadbackRows += report.matchedRows;
    if (!report.complete) {
      addLog(`Storage readback for ${label} is incomplete: ${report.missingRows} accepted row(s) were not found. Previous app data remains usable.`, 'error');
      throw new Error(`SYNC_READBACK_INCOMPLETE:${label}`);
    }
    addLog(`Storage readback verified ${report.matchedRows}/${report.expectedRows} ${label} row(s).`, 'success');
  }, [addLog, authenticatedEmail]);

  const readBackCruiseInventory = useCallback(async (coreDataContext: any, expectedRows: number) => {
    const integrity = await coreDataContext.getCruiseInventoryIntegrity();
    royalHandoffEvidenceRef.current.databaseReadbackRows += integrity.durableSourceRows;
    if (!integrity.reconciled || (expectedRows > 0 && integrity.rawRows === 0)) {
      addLog(
        `Cruise database reconciliation failed: raw ${integrity.rawRows}, canonical ${integrity.canonicalRows}, merged ${integrity.duplicatesMerged}, rejected ${integrity.rejectedRows}, readback ${integrity.readbackRows}.`,
        'error',
      );
      throw new Error('SYNC_READBACK_INCOMPLETE:available-cruise-database');
    }
    addLog(
      `Cruise database verified: ${integrity.rawRows.toLocaleString()} raw → ${integrity.canonicalRows.toLocaleString()} physical sailings + ${integrity.duplicatesMerged.toLocaleString()} merged offer variants + ${integrity.rejectedRows.toLocaleString()} rejected; ${integrity.offerSailingRelationships.toLocaleString()} offer-sailing relationships and ${integrity.readbackRows.toLocaleString()} canonical rows read back.`,
      integrity.rejectedRows > 0 ? 'warning' : 'success',
    );
  }, [addLog]);

  const handleWebViewMessage = useCallback((message: WebViewMessage) => {
    try {
    const activeSync = state.status.startsWith('running_') || state.status === 'syncing' || state.status === 'awaiting_confirmation';
    const currentOwner = currentSyncOwnerRef.current;
    if (activeSync && syncOwnershipRef.current && !isSyncOwnershipCurrent(syncOwnershipRef.current, currentOwner.profileId, currentOwner.authenticatedEmail)) {
      setState((prev) => ({ ...prev, status: 'error', error: 'SYNC_ACCOUNT_CHANGED' }));
      addLog('Ignored browser data because the signed-in EasySeas account changed during sync.', 'error');
      return;
    }
    const msg = message as any;
    const msgType = msg.type;
    switch (msgType) {
      case 'network_capture_offer_available': {
        addLog(`Live ${config.loyaltyClubName} offer payload detected from the signed-in website; Step 1 will parse it locally.`, 'success');
        break;
      }

      case 'bridge_payload_rejected': {
        const rejectedType = String(msg.rejectedType || 'unknown');
        const size = Number(msg.originalCharacters || 0);
        addLog(`Carnival browser payload ${rejectedType} was rejected before crossing the native size limit${size > 0 ? ` (${size.toLocaleString()} characters)` : ''}. Sync remains open and can continue with chunked rows.`, 'warning');
        break;
      }

      case 'auth_status': {
        const authEvidence = String(msg.evidence || '').trim().toLowerCase();
        const authUrl = String(msg.url || '').trim().toLowerCase();
        const explicitCarnivalSignIn = authEvidence === 'visible_sign_in_form'
          || /(?:\/login|\/sign-in|\/signin|okta|auth0)/.test(authUrl);

        if (cruiseLine === 'carnival' && msg.loggedIn === true) {
          carnivalAuthenticatedSessionRef.current = true;
        } else if (cruiseLine === 'carnival' && msg.loggedIn !== true && explicitCarnivalSignIn) {
          carnivalAuthenticatedSessionRef.current = false;
          carnivalRuntimeCompatibilityRef.current = null;
        }

        if (
          cruiseLine === 'carnival'
          && msg.loggedIn !== true
          && carnivalAuthenticatedSessionRef.current
          && !explicitCarnivalSignIn
        ) {
          console.log('[RoyalCaribbeanSync] Ignoring stale Carnival logged-out probe after authenticated session latch', {
            authEvidence,
            authUrl,
          });
          break;
        }

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
      }

      case 'carnival_runtime_probe': {
        if (cruiseLine !== 'carnival') break;
        const compatibility = assessCarnivalRuntimeCompatibility(msg);
        const probeUrl = String(msg.url || '').trim().toLowerCase();
        const probeEvidence = Array.isArray(msg.evidence)
          ? msg.evidence.map((item: unknown) => String(item).trim().toLowerCase())
          : [];
        const explicitSignInProbe = probeEvidence.includes('visible_sign_in_form')
          || /(?:\/login|\/sign-in|\/signin|okta|auth0)/.test(probeUrl);

        if (compatibility.state === 'ready') {
          carnivalAuthenticatedSessionRef.current = true;
          carnivalIngestionReadinessWaitLoggedRef.current = false;
        } else if (compatibility.state === 'authentication_required' && explicitSignInProbe) {
          carnivalAuthenticatedSessionRef.current = false;
        } else if (
          carnivalAuthenticatedSessionRef.current
          && (compatibility.state === 'authentication_required' || compatibility.state === 'unsupported_layout')
        ) {
          console.log('[RoyalCaribbeanSync] Ignoring transient Carnival compatibility probe during authenticated navigation', {
            state: compatibility.state,
            probeUrl,
          });
          break;
        }

        carnivalRuntimeCompatibilityRef.current = compatibility;
        if (compatibility.state === 'ready') {
          if (!carnivalCompatibilityLoggedRef.current) {
            carnivalCompatibilityLoggedRef.current = true;
            addLog('Carnival page compatibility confirmed for this session.', 'success');
          }
        } else if (compatibility.state === 'authentication_required') {
          setState((prev) => ({ ...prev, status: 'not_logged_in', error: null }));
          addLog(compatibility.reason, 'warning');
        } else {
          ingestionInFlightRef.current = false;
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: compatibility.state === 'challenge_detected'
              ? 'CARNIVAL_CHALLENGE_REQUIRED'
              : 'CARNIVAL_LAYOUT_UNSUPPORTED',
          }));
          addLog(compatibility.reason, 'error');
        }
        break;
      }

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
        recordRoyalHandoff('offer', Array.isArray(msg.data) ? msg.data.length : 0, batch.length);
        if (batch.length > 0) {
          const newOffers = mergeOfferRows(extractedOffersRef.current, batch);
          publishExtractedOffers(newOffers);
          const offerName = batch[0]?.offerName || 'Unknown Offer';
          const offerCode = batch[0]?.offerCode || 'N/A';
          console.log(`[RoyalCaribbeanSync] Batch received: ${batch.length} items, total now: ${newOffers.length}`);

          if (batch[0]?.offerName) {
            addLog(`✅ Captured casino offer "${offerName}" (Code: ${offerCode})`, 'success');
            addLog(`   📊 Captured ${batch.length} sailing(s) for this offer`, 'success');
            batch.slice(0, Math.min(3, batch.length)).forEach((sailing, idx) => {
              if (sailing.shipName && sailing.sailingDate) {
                addLog(`   🚢 Sailing ${idx + 1}: ${sailing.shipName} - ${sailing.sailingDate}`, 'success');
              }
            });
            if (batch.length > 3) {
              addLog(`   ➕ ...and ${batch.length - 3} more sailing(s)`, 'success');
            }
          }
          if (cruiseLine === 'carnival') {
            recordCarnivalCollection('offers', batch.length, 'browser_collector');
            recordCarnivalCollection(
              'offerSailings',
              batch.filter((row) => Boolean(row.shipName || row.sailingDate)).length,
              'browser_collector',
            );
          }
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
        recordRoyalHandoff('booked', Array.isArray(msg.data) ? msg.data.length : 0, incoming.length);
        if (incoming.length > 0) {
          setState(prev => {
            const newCruises = [...prev.extractedBookedCruises, ...incoming];
            console.log(`[RoyalCaribbeanSync] Cruise batch received: ${incoming.length} raw item(s), total now: ${newCruises.length}`);
            
            const batch = incoming;
            capturedSections.current.bookings = true;
            addLog(`✅ Captured ${batch.length} cruise booking(s)`, 'success');
            batch.forEach((cruise, idx) => {
              const cabinInfo = cruise.cabinNumberOrGTY ? ` - Cabin ${cruise.cabinNumberOrGTY}` : '';
              const statusInfo = cruise.status ? ` [${cruise.status}]` : '';
              const durationLabel = typeof cruise.numberOfNights === 'number' && cruise.numberOfNights > 0 ? `${cruise.numberOfNights} nights` : 'duration unavailable';
              addLog(`   🚢 Cruise ${idx + 1}: ${cruise.shipName} - ${cruise.sailingStartDate} (${durationLabel})${cabinInfo}${statusInfo}`, 'success');
            });
            
            return {
              ...prev,
              extractedBookedCruises: newCruises
            };
          });
          if (cruiseLine === 'carnival') {
            const statusCounts = incoming.reduce((counts, cruise) => {
              const status = String(cruise.status || '').toLowerCase();
              if (status.includes('hold')) counts.holds += 1;
              else if (status.includes('completed') || status.includes('past')) counts.completed += 1;
              else counts.booked += 1;
              return counts;
            }, { booked: 0, holds: 0, completed: 0 });
            recordCarnivalCollection('bookedCruises', statusCounts.booked, 'browser_collector');
            recordCarnivalCollection('cruiseHolds', statusCounts.holds, 'browser_collector');
            recordCarnivalCollection('completedCruises', statusCounts.completed, 'browser_collector');
          }
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

      case 'carnival_search_page_chunk': {
        const waiter = carnivalSearchPageResolver.current;
        if (!waiter || String(msg.requestId || '') !== waiter.requestId) break;
        const chunk = normalizeOfferRows(msg.rows).map((row) => ({
          ...row,
          sourcePage: row.sourcePage || 'Carnival Offers',
          offerType: row.offerType || 'Carnival Players Club',
          numberOfGuests: row.numberOfGuests || '2',
        }));
        if (chunk.length > 0) waiter.rows = mergeOfferRows(waiter.rows, chunk);
        if (progressCallbacks.current.onProgress) progressCallbacks.current.onProgress();
        break;
      }

      case 'carnival_search_page_complete': {
        const waiter = carnivalSearchPageResolver.current;
        if (!waiter || String(msg.requestId || '') !== waiter.requestId) {
          addLog('Ignored a stale Carnival page completion from an earlier offer/page.', 'warning');
          break;
        }
        const result: CarnivalSearchPageResult = {
          requestId: waiter.requestId,
          runId: String(msg.runId || ''),
          offerCode: normalizeCarnivalRateCode(msg.offerCode),
          offerName: String(msg.offerName || ''),
          offerExpiry: String(msg.offerExpiry || ''),
          perks: String(msg.perks || ''),
          pageNumber: Number(msg.pageNumber || 1),
          pageSize: Number(msg.pageSize || CARNIVAL_SEARCH_PAGE_SIZE),
          effectivePageSize: Number(msg.effectivePageSize || msg.pageSize || CARNIVAL_SEARCH_PAGE_SIZE),
          totalResults: Number(msg.totalResults || 0),
          hasNextPage: Boolean(msg.hasNextPage),
          rowCount: Number(msg.rowCount || waiter.rows.length),
          error: msg.error ? String(msg.error) : undefined,
          url: msg.url ? String(msg.url) : undefined,
          expectedUrl: msg.expectedUrl ? String(msg.expectedUrl) : undefined,
          capturedUrl: msg.capturedUrl ? String(msg.capturedUrl) : undefined,
          payloadMatched: Boolean(msg.payloadMatched),
          authoritativeEmpty: Boolean(msg.authoritativeEmpty),
          readiness: msg.readiness ? String(msg.readiness) : undefined,
          requestProof: Boolean(msg.requestProof),
          pageProof: Boolean(msg.pageProof),
          pageContextMatched: Boolean(msg.pageContextMatched),
          renderedTerminalProof: Boolean(msg.renderedTerminalProof),
          resultStable: Boolean(msg.resultStable),
          visibleRowCount: Number(msg.visibleRowCount || 0),
          displayedTotal: msg.displayedTotal == null ? undefined : Number(msg.displayedTotal),
          nextControlState: msg.nextControlState ? String(msg.nextControlState) as CarnivalSearchPageResult['nextControlState'] : 'unknown',
          terminalProofSource: msg.terminalProofSource ? String(msg.terminalProofSource) as CarnivalSearchPageResult['terminalProofSource'] : 'none',
          pageSignature: msg.pageSignature ? String(msg.pageSignature) : undefined,
          paginationMode: msg.paginationMode ? String(msg.paginationMode) as CarnivalSearchPageResult['paginationMode'] : 'unknown',
          nextPageNumber: Number(msg.nextPageNumber || Number(msg.pageNumber || 1) + 1),
          nextOffset: msg.nextOffset == null ? null : Number(msg.nextOffset),
          nextCursor: msg.nextCursor ? String(msg.nextCursor) : undefined,
          nextUrl: msg.nextUrl ? String(msg.nextUrl) : undefined,
          truncationReason: msg.truncationReason ? String(msg.truncationReason) : undefined,
          inventoryPayloadCount: Number(msg.inventoryPayloadCount || 0),
          payloadKinds: Array.isArray(msg.payloadKinds) ? msg.payloadKinds.map((value: unknown) => String(value)) : [],
          rows: waiter.rows,
        };
        carnivalSearchPageResolver.current = null;
        waiter.resolve(result);
        break;
      }

      case 'carnival_rate_code_pagination': {
        const pagination = message as {
          offerCode?: string;
          requestedPages?: number;
          acknowledgedPages?: number;
          expectedPages?: number;
          receivedRows?: number;
          complete?: boolean;
          reason?: string;
        };
        const code = String(pagination.offerCode ?? '').trim();
        if (code) {
          const assessment = assessCarnivalRateCodePagination(pagination);
          carnivalRateCodesRef.current = updateCarnivalRateCodeEvidence(carnivalRateCodesRef.current, code, {
            requestedPages: assessment.requestedPages,
            acknowledgedPages: assessment.acknowledgedPages,
            expectedPages: assessment.expectedPages,
            receivedRows: assessment.receivedRows,
            status: assessment.status,
            reason: assessment.reason,
          });
          addLog(`Carnival ${code}: ${assessment.complete ? 'all acknowledged pages captured' : 'pagination remains incomplete'} (${assessment.acknowledgedPages}/${assessment.expectedPages || assessment.requestedPages} pages).`, assessment.complete ? 'success' : 'warning');
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
          
          const formattedCruises = msg.bookings.map((booking: any) => {
            const sailDate = booking.sailDate || booking.departureDate || booking.startDate || booking.sailingStartDate || '';
            const endDate = booking.sailingEndDate || booking.endDate || booking.returnDate || '';
            const nights = Number(booking.numberOfNights || booking.duration || booking.numNights || booking.nights || 0) || 0;
            const bStatus = booking.bookingStatus || booking.statusCode || booking.status || 'BK';
            const status = resolveRoyalCruiseStatus({
              sailDate,
              endDate,
              nights: nights || undefined,
              bookingStatus: bStatus,
              completePastStartWhenEndUnknown: isCarnivalBookings,
            });
            const shipCode = String(booking.shipCode || '').trim().toUpperCase();
            let shipName = booking.shipName || '';
            if (!shipName && shipCode) {
              shipName = isCarnivalBookings ? `Carnival ${shipCode}` : (ROYAL_SHIP_CODE_MAP[shipCode] || `${shipCode} of the Seas`);
            }
            return {
              rawBooking: booking,
              sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
              shipName,
              shipCode,
              cruiseTitle: booking.cruiseTitle || (nights ? `${nights} Night Cruise` : 'Cruise'),
              sailingStartDate: sailDate,
              sailingEndDate: endDate,
              sailingDates: booking.sailingDates || '',
              itinerary: booking.itinerary || booking.destination || '',
              departurePort: booking.departurePort || booking.homePort || '',
              arrivalPort: booking.arrivalPort || '',
              cabinType: booking.stateroomType || booking.cabinType || '',
              cabinCategory: booking.stateroomCategoryCode || '',
              cabinNumberOrGTY: booking.stateroomNumber === 'GTY' ? 'GTY' : (booking.stateroomNumber || booking.cabinNumber || ''),
              deckNumber: booking.deckNumber || '',
              bookingId: (booking.bookingId || booking.confirmationNumber || '').toString(),
              numberOfGuests: (booking.passengers?.length || booking.guestCount || '').toString(),
              numberOfNights: nights || undefined,
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
          recordRoyalHandoff('booked', msg.bookings.length, formattedCruises.length);
          
          setState(prev => {
            return {
              ...prev,
              extractedBookedCruises: [...prev.extractedBookedCruises, ...formattedCruises]
            };
          });
          
          capturedSections.current.bookings = true;
          addLog(`✅ Captured ${msg.bookings.length} booking(s) from consolidated API call`, 'success');
          formattedCruises.forEach((c: any) => {
            const durationLabel = typeof c.numberOfNights === 'number' && c.numberOfNights > 0 ? `${c.numberOfNights} nights` : 'duration unavailable';
            addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} (${durationLabel}) [${c.status}]`, 'success');
          });
        }
        break;

      case 'loyalty_data':
        if (msg.loyalty && typeof msg.loyalty === 'object') {
          const loyaltyInfo = msg.loyalty as LoyaltyApiInformation;
          const converted = convertLoyaltyInfoToExtended(loyaltyInfo, '');
          const matchesCurrentCruiseLine = hasLoyaltyForCruiseLine(converted, cruiseLine);
          const scopedLoyalty = scopeLoyaltyForCruiseLine(converted, cruiseLine);
          if (scopedLoyalty) {
            setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, scopedLoyalty));
          }
          hasReceivedApiLoyaltyDataRef.current = matchesCurrentCruiseLine;
          
          if (cruiseLine === 'royal_caribbean' && matchesCurrentCruiseLine) {
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
          }
          
          capturedSections.current.loyalty = matchesCurrentCruiseLine;
          if (!matchesCurrentCruiseLine) {
            addLog(`The ${config.name} response contained another brand's loyalty fields; continuing to wait for ${cruiseLine === 'celebrity' ? "Captain's Club / Blue Chip Club" : 'Crown & Anchor / Club Royale'} data.`, 'info');
          } else {
            addLog(`✅ Captured ${config.name} loyalty data from API`, 'success');
          }
          if (cruiseLine === 'royal_caribbean' && converted.clubRoyalePointsFromApi !== undefined) {
            addLog(`   🎰 Club Royale Status`, 'success');
            addLog(`   📊 Tier: "${converted.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
          }
          if (cruiseLine === 'royal_caribbean' && converted.crownAndAnchorPointsFromApi !== undefined) {
            addLog(`   ⚓ Crown & Anchor Society`, 'success');
            addLog(`   📊 Level: "${converted.crownAndAnchorTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.crownAndAnchorPointsFromApi.toLocaleString()}`, 'success');
          }
          if (cruiseLine === 'celebrity' && converted.captainsClubPoints !== undefined) {
            addLog(`   🌟 Captain's Club Status`, 'success');
            addLog(`   📊 Tier: "${converted.captainsClubTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.captainsClubPoints.toLocaleString()}`, 'success');
          }
          if (cruiseLine === 'celebrity' && converted.celebrityBlueChipPoints !== undefined) {
            addLog(`   🎲 Blue Chip Club Status`, 'success');
            addLog(`   📊 Tier: "${converted.celebrityBlueChipTier || 'N/A'}"`, 'success');
            addLog(`   💎 Points: ${converted.celebrityBlueChipPoints.toLocaleString()}`, 'success');
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
        const matchesCurrentCruiseLine = hasLoyaltyForCruiseLine(converted, cruiseLine);
        const scopedLoyalty = scopeLoyaltyForCruiseLine(converted, cruiseLine);
        if (scopedLoyalty) {
          setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, scopedLoyalty));
        }
        
        // Mark that we've received API data - this takes precedence over DOM scraping
        hasReceivedApiLoyaltyDataRef.current = matchesCurrentCruiseLine;
        
        if (cruiseLine === 'royal_caribbean' && matchesCurrentCruiseLine) {
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
        }
        
        capturedSections.current.loyalty = matchesCurrentCruiseLine;
        addLog(
          matchesCurrentCruiseLine
            ? `✅ Captured ${config.name} loyalty data from API (authoritative source)`
            : `The API response did not contain ${cruiseLine === 'celebrity' ? "Captain's Club or Blue Chip Club" : 'Crown & Anchor or Club Royale'} values; continuing loyalty capture.`,
          matchesCurrentCruiseLine ? 'success' : 'info',
        );
        if (cruiseLine === 'royal_caribbean' && converted.clubRoyalePointsFromApi !== undefined) {
          addLog(`   🎰 Club Royale Status`, 'success');
          addLog(`   📊 Tier: "${converted.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.clubRoyalePointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine === 'royal_caribbean' && converted.crownAndAnchorPointsFromApi !== undefined) {
          addLog(`   ⚓ Crown & Anchor Society`, 'success');
          addLog(`   📊 Level: "${converted.crownAndAnchorTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.crownAndAnchorPointsFromApi ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine === 'celebrity' && converted.captainsClubPoints !== undefined && converted.captainsClubPoints > 0) {
          addLog(`   🌟 Captain's Club Status`, 'success');
          addLog(`   📊 Tier: "${converted.captainsClubTier || 'N/A'}"`, 'success');
          addLog(`   💎 Points: ${(converted.captainsClubPoints ?? 0).toLocaleString()}`, 'success');
        }
        if (cruiseLine === 'celebrity' && converted.celebrityBlueChipPoints !== undefined && converted.celebrityBlueChipPoints > 0) {
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

      case 'network_capture':
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

        const carnivalStructuredPayload = cruiseLine === 'carnival' ? inspectCarnivalStructuredPayload(data, { url, endpoint }) : null;
        if (carnivalStructuredPayload) {
          if (carnivalStructuredPayload.offers.length > 0) {
            recordCarnivalCollection('offers', carnivalStructuredPayload.offers.length, 'live_json');
          }
          if (carnivalStructuredPayload.bookings.length > 0) {
            recordCarnivalCollection('bookedCruises', carnivalStructuredPayload.bookings.length, 'live_json');
          }
          if (carnivalStructuredPayload.holds.length > 0) {
            recordCarnivalCollection('cruiseHolds', carnivalStructuredPayload.holds.length, 'live_json');
          }
          if (carnivalStructuredPayload.completedCruises.length > 0) {
            recordCarnivalCollection('completedCruises', carnivalStructuredPayload.completedCruises.length, 'live_json');
          }
        }
        
        if (endpoint === 'offers' && data && cruiseLine !== 'carnival') {
          addLog('📦 Processing captured casino offers API payload...', 'info');
          const parsedOffers = parseCasinoOffersPayload(
            data,
            cruiseLine === 'celebrity' ? 'Blue Chip Club Offers' : 'Club Royale Offers',
            cruiseLine === 'celebrity' ? 'Blue Chip Club' : 'Club Royale'
          );

          if (parsedOffers.offerRows.length > 0) {
            recordRoyalHandoff('offer', parsedOffers.offerRows.length, parsedOffers.offerRows.length);
            const mergedOffers = mergeOfferRows(extractedOffersRef.current, parsedOffers.offerRows);
            publishExtractedOffers(mergedOffers);

            addLog(`✅ Captured ${parsedOffers.offerCount} casino offer(s) with ${parsedOffers.totalSailings} sailing(s) from network capture`, 'success');
            addLog('ℹ️ Waiting for full offer extraction before completing sync step', 'info');
            if (progressCallbacks.current.onProgress) {
              progressCallbacks.current.onProgress();
            }
          } else {
            addLog(`⚠️ Captured offers payload but no offer rows were parsed. Keys: ${dataKeys.join(', ')}`, 'warning');
            if (payloadKeys.length > 0) {
              addLog(`📦 Offer payload keys: ${payloadKeys.join(', ')}`, 'info');
            }
          }
        }

        if ((endpoint === 'bookings' || endpoint === 'upcomingCruises' || endpoint === 'courtesyHolds' || endpoint === 'pastTrips' || (cruiseLine === 'carnival' && carnivalStructuredPayload && (carnivalStructuredPayload.bookings.length > 0 || carnivalStructuredPayload.completedCruises.length > 0 || carnivalStructuredPayload.holds.length > 0))) && data) {
          addLog(`📦 Processing captured ${endpoint} API payload...`, 'info');
          if (dataKeys.length > 0) {
            addLog(`📦 Data keys: ${dataKeys.join(', ')}`, 'info');
          }
          
          // Check for error responses first
          if (data.message && !data.payload && !data.status && data.status !== 200) {
            addLog(`⚠️ Captured error response: ${data.message}`, 'warning');
            break;
          }
          
          const isPastTripsPayload = endpoint === 'pastTrips' || (typeof url === 'string' && (url.includes('/myaccount/my-trips') || (url.toLowerCase().includes('past') && url.toLowerCase().includes('trip'))));
          const findNestedArray = (value: any, keys: string[], depth: number = 0): any[] | null => {
            if (!value || depth > 3) return null;
            if (Array.isArray(value)) return value;
            if (typeof value !== 'object') return null;
            for (const key of keys) {
              if (Array.isArray(value[key])) return value[key];
            }
            for (const childKey of ['payload', 'data', 'result', 'response', 'myTrips', 'trips']) {
              const found = findNestedArray(value[childKey], keys, depth + 1);
              if (found) return found;
            }
            return null;
          };
          const pastTripRows = findNestedArray(data, ['pastCruises', 'pastTrips', 'completedCruises', 'completedTrips', 'previousTrips', 'past']);

          // Royal Caribbean API structure: data.payload.sailingInfo (enriched bookings)
          let bookings = null;
          if (cruiseLine === 'carnival' && carnivalStructuredPayload && (carnivalStructuredPayload.bookings.length > 0 || carnivalStructuredPayload.completedCruises.length > 0 || carnivalStructuredPayload.holds.length > 0)) {
            bookings = [
              ...carnivalStructuredPayload.bookings,
              ...carnivalStructuredPayload.completedCruises,
              ...carnivalStructuredPayload.holds,
            ];
            addLog(`📦 Processing ${bookings.length} Carnival record(s) from live structured JSON`, 'info');
          } else if (isPastTripsPayload && pastTripRows) {
            bookings = pastTripRows;
            addLog(`📦 Processing ${bookings.length} past cruise(s) from My Trips API response...`, 'info');
          } else if (data.payload && Array.isArray(data.payload.sailingInfo)) {
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
          } else if (data.payload && Array.isArray(data.payload.pastCruises)) {
            bookings = data.payload.pastCruises;
            addLog(`📦 Processing ${bookings.length} past cruise(s) from API response...`, 'info');
          } else if (data.payload && Array.isArray(data.payload.trips)) {
            bookings = data.payload.trips;
            addLog(`📦 Processing ${bookings.length} trip(s) from API response...`, 'info');
          } else if (data.payload && Array.isArray(data.payload.reservations)) {
            bookings = data.payload.reservations;
            addLog(`📦 Processing ${bookings.length} reservation(s) from API response...`, 'info');
          } else if (Array.isArray(data.pastCruises)) {
            bookings = data.pastCruises;
            addLog(`📦 Processing ${bookings.length} past cruise(s) from API response...`, 'info');
          } else if (Array.isArray(data.trips)) {
            bookings = data.trips;
            addLog(`📦 Processing ${bookings.length} trip(s) from API response...`, 'info');
          } else if (Array.isArray(data.reservations)) {
            bookings = data.reservations;
            addLog(`📦 Processing ${bookings.length} reservation(s) from API response...`, 'info');
          } else if (data.bookings && Array.isArray(data.bookings)) {
            bookings = data.bookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (data.data && Array.isArray(data.data.bookings)) {
            bookings = data.data.bookings;
            addLog(`📦 Processing ${bookings.length} booking(s) from API response...`, 'info');
          } else if (data.data && Array.isArray(data.data.pastCruises)) {
            bookings = data.data.pastCruises;
            addLog(`📦 Processing ${bookings.length} past cruise(s) from API response...`, 'info');
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
            try {
              console.log(`[RoyalCaribbeanSync] First booking sample:`, JSON.stringify(bookings[0]).substring(0, 300));
              console.log(`[RoyalCaribbeanSync] First booking keys:`, Object.keys(bookings[0]));
            } catch (logErr) {
              console.log(`[RoyalCaribbeanSync] Could not stringify first booking:`, logErr);
            }
            
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
            
            const STATEROOM_TYPE_MAP: Record<string, string> = {
              'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
            };
            
            const formattedCruisesRaw = bookings.map((booking: any) => {
              const nights = booking.numberOfNights || booking.duration || booking.numNights || booking.nights || booking.cruiseNights || 0;
              const shipCode = booking.shipCode || booking.ship?.code || booking.vesselCode || '';
              const nestedShipName = typeof booking.ship === 'object' ? booking.ship?.name : '';
              let shipName = '';
              if (isCarnivalBooking) {
                shipName = booking.shipName || nestedShipName || booking.ship || CARNIVAL_SHIP_CODE_MAP[shipCode] || (shipCode ? `Carnival ${shipCode}` : '');
              } else {
                shipName = booking.shipName || nestedShipName || ROYAL_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : '');
              }
              const stateroomType = booking.stateroomType || booking.cabinType || booking.categoryType || '';
              const cabinType = STATEROOM_TYPE_MAP[stateroomType] || stateroomType || '';
              
              const stateroomNumber = booking.stateroomNumber || booking.cabinNumber || '';
              const cabinNumber = stateroomNumber === 'GTY' ? '' : stateroomNumber;
              const isGTY = stateroomNumber === 'GTY';
              const sailDate = booking.sailDate || booking.sailingDate || booking.departureDate || booking.startDate || booking.sailingStartDate || booking.start || '';
              const sailingEndDate = booking.endDate || booking.returnDate || booking.sailingEndDate || booking.end || '';
              const bookingStatus = booking.bookingStatus || booking.statusCode || booking.status || 'BK';
              const forceCompleted = isPastTripsPayload || String(booking.status || '').toLowerCase() === 'past' || String(booking.tripStatus || '').toLowerCase() === 'past';
              const status = resolveRoyalCruiseStatus({
                sailDate,
                endDate: sailingEndDate,
                nights: Number(nights) || undefined,
                bookingStatus,
                forceCompleted,
                completePastStartWhenEndUnknown: isCarnivalBooking,
              });
              
              return {
                rawBooking: booking,
                sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
                shipName,
                shipCode,
                cruiseTitle: booking.cruiseTitle || booking.title || (nights ? `${nights} Night Cruise` : 'Cruise'),
                sailingStartDate: sailDate,
                sailingEndDate,
                sailingDates: booking.sailingDates || sailDate,
                itinerary: booking.itinerary || booking.destination || booking.cruiseName || booking.name || booking.title || '',
                departurePort: booking.departurePort || booking.homePort || booking.embarkPort || booking.embarkationPort || booking.departurePortName || '',
                arrivalPort: booking.arrivalPort || booking.arrivalPortName || '',
                cabinType,
                cabinCategory: booking.stateroomCategoryCode || booking.categoryCode || '',
                cabinNumberOrGTY: isGTY ? 'GTY' : cabinNumber,
                deckNumber: booking.deckNumber || '',
                bookingId: (booking.bookingId || booking.confirmationNumber || booking.reservationId || booking.reservationNumber || booking.id || '').toString(),
                numberOfGuests: (booking.passengers?.length || booking.guestCount || booking.numberOfGuests || '').toString(),
                numberOfNights: Number(nights) || undefined,
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
            const validFormattedCruises = formattedCruisesRaw.filter((cruise: any) => {
              const hasShipAndDate = Boolean(String(cruise.shipName || '').trim() && String(cruise.sailingStartDate || '').trim());
              if (!hasShipAndDate) return false;
              if (isPastTripsPayload) {
                const nights = Number(cruise.numberOfNights || 0);
                const hasUsableDuration = Number.isFinite(nights) && nights > 0;
                const hasEndDate = Boolean(String(cruise.sailingEndDate || '').trim());
                if (!hasUsableDuration && !hasEndDate) return false;
              }
              return true;
            });
            const seenCruises = new Set<string>();
            const formattedCruises = validFormattedCruises.filter((cruise: any) => {
              const voyageKey = `voyage:${String(cruise.shipName || '').trim().toLowerCase()}|${String(cruise.sailingStartDate || '').trim()}|${String(cruise.cabinNumberOrGTY || '').trim().toLowerCase()}`;
              const bookingKey = cruise.bookingId ? `booking:${String(cruise.bookingId).trim().toLowerCase()}` : '';
              if (seenCruises.has(voyageKey) || (bookingKey && seenCruises.has(bookingKey))) return false;
              seenCruises.add(voyageKey);
              if (bookingKey) seenCruises.add(bookingKey);
              return true;
            });
            recordRoyalHandoff('booked', bookings.length, formattedCruises.length);

            if (formattedCruises.length === 0) {
              addLog(`⚠️ Rejected ${bookings.length} ${isPastTripsPayload ? 'past-trip' : 'booking'} record(s) because they lacked a complete ship/date and authoritative duration identity`, 'warning');
              break;
            }
            
            setState(prev => {
              const merged = normalizeBookedCruiseRows([...prev.extractedBookedCruises, ...formattedCruises]);
              return {
                ...prev,
                extractedBookedCruises: merged
              };
            });
            
            if (isPastTripsPayload) {
              capturedSections.current.pastTrips = formattedCruises.length > 0;
            } else {
              capturedSections.current.bookings = formattedCruises.length > 0;
            }
            const cruiseLineName = isCarnivalBooking ? 'Carnival' : config.name;
            addLog(`✅ Captured ${formattedCruises.length} valid ${isPastTripsPayload ? 'past cruise(s)' : 'booking(s)'} from ${cruiseLineName} API`, 'success');
            formattedCruises.forEach((c: any) => {
              const durationLabel = typeof c.numberOfNights === 'number' && c.numberOfNights > 0 ? `${c.numberOfNights} nights` : 'duration unavailable';
              addLog(`✅ Captured booking: ${c.shipName} - ${c.sailingStartDate} - ${c.cabinType} ${c.cabinNumberOrGTY} (${durationLabel}) [${c.status}]`, 'success');
            });
            
            setState(prev => {
              if (prev.status === 'running_step_2' && !isPastTripsPayload) {
                addLog(`✅ Step 2 auto-completing with ${formattedCruises.length} valid bookings from network monitor`, 'success');
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

          const rawVoyages: Array<{ key: string; value: any }> = [];
          const root = (data as any)?.payload ?? (data as any)?.data ?? data;
          if (Array.isArray(root)) {
            root.forEach((value: any, index: number) => rawVoyages.push({ key: String(value?.voyageId || value?.id || index), value }));
          } else if (root && typeof root === 'object') {
            Object.entries(root).forEach(([key, value]) => rawVoyages.push({ key, value }));
          }

          const readName = (value: any): string => {
            if (typeof value === 'string') return value.trim();
            if (value && typeof value === 'object') return String(value.name || value.description || value.label || value.code || '').trim();
            return '';
          };
          const readFirst = (value: any, keys: string[]): string => {
            if (!value || typeof value !== 'object') return '';
            for (const key of keys) {
              const candidate = readName(value[key]);
              if (candidate) return candidate;
            }
            for (const containerKey of ['itinerary', 'voyage', 'sailing', 'masterSailing', 'departurePort', 'destination']) {
              const nested = value[containerKey];
              if (nested && typeof nested === 'object') {
                for (const key of keys) {
                  const candidate = readName(nested[key]);
                  if (candidate) return candidate;
                }
              }
            }
            return '';
          };
          const compactDate = (value: string): string => String(value || '').replace(/[^0-9]/g, '').slice(0, 8);

          setState((prev) => {
            let enrichedCount = 0;
            const nextRows = prev.extractedBookedCruises.map((cruise) => {
              const desiredKey = `${String(cruise.shipCode || '').trim().toUpperCase()}${compactDate(cruise.sailingStartDate)}`;
              const match = rawVoyages.find((entry) => {
                const candidateId = String(entry.key || entry.value?.voyageId || entry.value?.id || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
                const candidateShip = String(entry.value?.shipCode || entry.value?.ship?.code || '').trim().toUpperCase();
                const candidateDate = compactDate(entry.value?.sailDate || entry.value?.startDate || entry.value?.departureDate || '');
                return (desiredKey && candidateId.includes(desiredKey)) || (candidateShip === String(cruise.shipCode || '').trim().toUpperCase() && candidateDate === compactDate(cruise.sailingStartDate));
              });
              if (!match) return cruise;

              const value = match.value || {};
              const itinerary = readFirst(value, ['itineraryName', 'name', 'cruiseTitle', 'destinationName']);
              const departurePort = readFirst(value, ['departurePortName', 'departurePort', 'embarkationPort', 'homePort']);
              const arrivalPort = readFirst(value, ['arrivalPortName', 'arrivalPort', 'disembarkationPort']);
              const nights = Number(value.numberOfNights || value.nights || value.duration || value.itinerary?.sailingNights || value.itinerary?.totalNights || 0);
              const endDate = readFirst(value, ['endDate', 'returnDate', 'sailingEndDate']);
              enrichedCount += 1;
              return {
                ...cruise,
                itinerary: cruise.itinerary || itinerary,
                departurePort: cruise.departurePort || departurePort,
                arrivalPort: cruise.arrivalPort || arrivalPort,
                numberOfNights: Number(cruise.numberOfNights || 0) > 0 ? cruise.numberOfNights : (nights > 0 ? String(nights) : cruise.numberOfNights),
                sailingEndDate: cruise.sailingEndDate || endDate,
              };
            });
            if (enrichedCount > 0) {
              addLog(`✅ Merged voyage details into ${enrichedCount} booking(s)`, 'success');
            } else {
              addLog('⚠️ Voyage payload did not match any captured booking identity', 'warning');
            }
            return { ...prev, extractedBookedCruises: normalizeBookedCruiseRows(nextRows) };
          });
        }
        
        if ((endpoint === 'carnival_vifp_offers' || (cruiseLine === 'carnival' && carnivalStructuredPayload && carnivalStructuredPayload.offers.length > 0)) && data) {
          const carnivalOfferItems = Array.isArray((data as any)?.Items)
            ? (data as any).Items
            : carnivalStructuredPayload?.offers ?? [];
          console.log('[CarnivalSync] VIFP offers captured:', carnivalOfferItems.length || 0);
          addLog('Processing Carnival VIFP offers...', 'info');
          if (carnivalOfferItems.length > 0) {
            const dollarSign = String.fromCharCode(36);
            const offerRows: OfferRow[] = carnivalOfferItems.map((item: any) => {
              const campaign = item?.campaignOffer || item?.offer || item?.promotion || item || {};
              const ctaUrl = item?.CtaUrl || item?.ctaUrl || item?.callToActionUrl || item?.bookingUrl || item?.url || campaign?.CtaUrl || campaign?.ctaUrl || campaign?.bookingUrl || '';
              let rateCode = '';
              try { const m = String(ctaUrl).match(/(?:rateCodes?|offerCode|promoCode)=([A-Z0-9]+)/i); if (m) rateCode = m[1]; } catch { /* ignore */ }
              rateCode = rateCode || item?.RateCode || item?.rateCode || item?.offerCode || item?.promoCode || campaign?.offerCode || campaign?.rateCode || '';
              let expiry = '';
              try { const m2 = String(item?.Subtitle || item?.subtitle || campaign?.subtitle || '').match(/Book by (.+)/i); if (m2) expiry = m2[1].trim(); } catch { /* ignore */ }
              expiry = expiry || item?.ExpirationDate || item?.expirationDate || item?.bookByDate || item?.reserveByDate || campaign?.reserveByDate || campaign?.expirationDate || '';
              const offerName = item?.Title || item?.title || item?.name || campaign?.name || campaign?.title || 'Carnival VIFP Offer';
              const desc = String(item?.Description || item?.description || campaign?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              const priceNum = Number(item?.Price || item?.price || item?.startingPrice || campaign?.Price || campaign?.price || 0);
              const priceStr = priceNum > 0 ? (dollarSign + priceNum.toFixed(2)) : '';
              const playerOfferId = String(item?.PlayerOfferId || item?.playerOfferId || item?.OfferId || item?.offerId || item?.Id || item?.id || campaign?.playerOfferId || campaign?.offerId || campaign?.id || '').trim();
              const offerInstanceId = playerOfferId || ['carnival', rateCode, offerName, expiry].join('|').toLowerCase();
              return {
                sourcePage: 'Offers' as const,
                offerName,
                offerCode: rateCode,
                playerOfferId,
                carnivalOfferId: playerOfferId,
                offerInstanceId,
                offerExpirationDate: expiry,
                offerType: 'VIFP Club',
                shipName: '',
                shipCode: '',
                sailingDate: '',
                itinerary: '',
                departurePort: '',
                cabinType: '',
                numberOfGuests: '',
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
                bookingLink: ctaUrl
              } as unknown as OfferRow;
            });
            const newOffers = mergeOfferRows(extractedOffersRef.current, offerRows);
            publishExtractedOffers(newOffers);
            capturedSections.current.offers = true;
            addLog('Captured ' + String(offerRows.length) + ' Carnival VIFP offer(s); continuing page scan for featured offers', 'success');
            offerRows.forEach((o: OfferRow) => {
              addLog('  ' + o.offerName + ' (' + o.offerCode + ')' + (o.interiorPrice ? ' - from ' + o.interiorPrice : ''), 'success');
            });
            console.log('[CarnivalSync] VIFP network payload merged; waiting for injected page extraction to finish before completing step 1');
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

          if (isRoyalLoyaltyHistoryPayload(data)) {
            const historyResult = parseRoyalLoyaltyHistorySailings(data);
            recordRoyalHandoff('booked', historyResult.discovered, historyResult.rows.length);

            if (historyResult.rows.length > 0) {
              setState(prev => ({
                ...prev,
                extractedBookedCruises: normalizeBookedCruiseRows([
                  ...prev.extractedBookedCruises,
                  ...historyResult.rows,
                ]),
              }));
              capturedSections.current.pastTrips = true;
              addLog(
                `✅ Parsed ${historyResult.rows.length} completed cruise sailing(s) from loyalty/history payload; accepted ${historyResult.rows.length}`,
                'success',
              );
              if (historyResult.duplicates > 0 || historyResult.rejected > 0) {
                addLog(
                  `Loyalty/history reconciliation: ${historyResult.duplicates} duplicate(s), ${historyResult.rejected} incomplete record(s) excluded`,
                  historyResult.rejected > 0 ? 'warning' : 'info',
                );
              }
              if (progressCallbacks.current.onProgress) {
                progressCallbacks.current.onProgress();
              }
            } else {
              addLog(
                `⚠️ Loyalty/history contained ${historyResult.discovered} sailing record(s), but none had a complete ship/date/duration identity`,
                'warning',
              );
            }
          }

          const convertedLoyalty = convertLoyaltyInfoToExtended(loyaltyInfo, accountId);
          const hasMeaningfulLoyalty = hasLoyaltyForCruiseLine(convertedLoyalty, cruiseLine);

          if (!hasMeaningfulLoyalty) {
            if (isRoyalLoyaltyHistoryPayload(data)) {
              addLog(`ℹ️ Loyalty/history payload contained completed sailings but no ${cruiseLine === 'celebrity' ? "Captain's Club / Blue Chip Club" : 'Crown & Anchor / Club Royale'} tier-point values; keeping loyalty capture open`, 'info');
            } else {
              addLog(`Ignored a loyalty payload that did not contain ${cruiseLine === 'celebrity' ? "Captain's Club or Blue Chip Club" : 'Crown & Anchor or Club Royale'} membership, tier, or points data; capture remains open.`, 'info');
            }
          } else {
            const scopedLoyalty = scopeLoyaltyForCruiseLine(convertedLoyalty, cruiseLine);
            setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, scopedLoyalty));
            hasReceivedApiLoyaltyDataRef.current = true;

            if (cruiseLine === 'royal_caribbean') {
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
            }

            capturedSections.current.loyalty = true;
            addLog('✅ Captured loyalty data from network capture', 'success');
            if (cruiseLine === 'royal_caribbean' && convertedLoyalty.clubRoyalePointsFromApi !== undefined) {
              addLog(`   🎰 Club Royale Status`, 'success');
              addLog(`   📊 Tier: "${convertedLoyalty.clubRoyaleTierFromApi || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${convertedLoyalty.clubRoyalePointsFromApi.toLocaleString()}`, 'success');
            }
            if (cruiseLine === 'royal_caribbean' && convertedLoyalty.crownAndAnchorPointsFromApi !== undefined) {
              addLog(`   ⚓ Crown & Anchor Society`, 'success');
              addLog(`   📊 Level: "${convertedLoyalty.crownAndAnchorTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${convertedLoyalty.crownAndAnchorPointsFromApi.toLocaleString()}`, 'success');
            }
            if (cruiseLine === 'celebrity' && convertedLoyalty.captainsClubPoints !== undefined) {
              addLog(`   🌟 Captain's Club Status`, 'success');
              addLog(`   📊 Tier: "${convertedLoyalty.captainsClubTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${convertedLoyalty.captainsClubPoints.toLocaleString()}`, 'success');
            }
            if (cruiseLine === 'celebrity' && convertedLoyalty.celebrityBlueChipPoints !== undefined) {
              addLog(`   🎲 Blue Chip Club Status`, 'success');
              addLog(`   📊 Tier: "${convertedLoyalty.celebrityBlueChipTier || 'N/A'}"`, 'success');
              addLog(`   💎 Points: ${convertedLoyalty.celebrityBlueChipPoints.toLocaleString()}`, 'success');
            }

            // Auto-complete Step 3 only for an authoritative loyalty payload.
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

      case 'carnival_offers_url_data': {
        const tgoMsg = msg as { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
        console.log('[CarnivalSync] offers URL data:', tgoMsg.rateCodes?.length, 'rate codes, VIFP#', tgoMsg.vifp);
        if (tgoMsg.vifp || tgoMsg.tierName) {
          const tierName = tgoMsg.tierName || 'VIFP Club';
          capturedSections.current.loyalty = true;
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              crownAndAnchorLevel: tierName,
              crownAndAnchorPoints: prev.loyaltyData?.crownAndAnchorPoints ?? '',
            }
          }));
        }
        if (carnivalTgoDataResolver.current) {
          carnivalTgoDataResolver.current(tgoMsg);
          carnivalTgoDataResolver.current = null;
        }
        break;
      }

      case 'carnival_user_data': {
        const carnivalUser = parseCarnivalVifpPayload(msg.data);
        if (carnivalUser) {
          console.log('[CarnivalSync] User data captured:', carnivalUser.firstName, carnivalUser.lastName, 'VIFP#', carnivalUser.vifpNumber, 'Tier:', carnivalUser.vifpTier, 'Points:', carnivalUser.vifpPoints || 'N/A');
          if (!acceptCarnivalProviderAccount(carnivalUser.vifpNumber)) {
            break;
          }
          carnivalUserDataRef.current = carnivalUser;
          recordCarnivalCollection('vifpIdentity', carnivalUser.vifpNumber ? 1 : 0, 'carnival_user_payload', carnivalUser.vifpNumber ? 'captured' : 'unavailable');
          recordCarnivalCollection('vifpTier', carnivalUser.vifpTier && carnivalUser.vifpTier !== 'Unknown' ? 1 : 0, 'carnival_user_payload', carnivalUser.vifpTier && carnivalUser.vifpTier !== 'Unknown' ? 'captured' : 'unavailable');
          recordCarnivalCollection('vifpPoints', carnivalUser.vifpPoints ? 1 : 0, 'carnival_user_payload', carnivalUser.vifpPoints ? 'captured' : 'unavailable');
          recordCarnivalCollection('cruiseDayPoints', carnivalUser.cruiseDayPoints ? 1 : 0, 'carnival_user_payload', carnivalUser.cruiseDayPoints ? 'captured' : 'unavailable');
          recordCarnivalCollection('cruiseCount', carnivalUser.cruiseCount ? 1 : 0, 'carnival_user_payload', carnivalUser.cruiseCount ? 'captured' : 'unavailable');
          capturedSections.current.loyalty = true;
          setState(prev => ({
            ...prev,
            loyaltyData: {
              ...(prev.loyaltyData ?? {}),
              crownAndAnchorLevel: carnivalUser.vifpTier,
              crownAndAnchorPoints: carnivalUser.vifpPoints || (prev.loyaltyData?.crownAndAnchorPoints ?? ''),
            }
          }));
          addLog(`✅ Carnival VIFP: ${carnivalUser.vifpTier} tier (VIFP# ${carnivalUser.vifpNumber || 'N/A'}${carnivalUser.vifpPoints ? ` • ${carnivalUser.vifpPoints} points` : ''})`, 'success');
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
  }, [acceptCarnivalProviderAccount, addLog, setProgress, state.status, cruiseLine, config.name, createPayloadSignature, getObjectKeys, mergeOfferRows, normalizeBookedCruiseRows, normalizeOfferRows, recordCarnivalCollection, recordRoyalHandoff, stringifyValue, publishExtractedOffers]);

  const openLogin = useCallback(() => {
    setWebViewUrl(config.loginUrl);
    addLog(`Navigating to ${config.loyaltyClubName} page`, 'info');
  }, [addLog, config]);

  const runIngestion = useCallback(async () => {
    const isCarnivalMode = cruiseLine === 'carnival';
    if (ingestionInFlightRef.current) {
      if (isCarnivalMode && activeCarnivalIngestionCompletion) {
        if (!carnivalSingleFlightWaitLoggedRef.current) {
          carnivalSingleFlightWaitLoggedRef.current = true;
          addLog('Carnival download is already running; the duplicate start was ignored.', 'info');
        }
        await activeCarnivalIngestionCompletion;
        carnivalSingleFlightWaitLoggedRef.current = false;
        return;
      }
      addLog('Sync ingestion is already running...', 'warning');
      return;
    }

    const hasAuthenticatedCarnivalSession = isCarnivalMode && carnivalAuthenticatedSessionRef.current;
    if (state.status !== 'logged_in' && state.status !== 'complete' && state.status !== 'resumable' && !hasAuthenticatedCarnivalSession) {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    if (!currentUser?.id || !authenticatedEmail) {
      addLog('Sync cannot start until the signed-in EasySeas profile is available.', 'error');
      setState((prev) => ({ ...prev, status: 'error', error: 'SYNC_OWNER_UNAVAILABLE' }));
      return;
    }

    ingestionInFlightRef.current = true;
    syncStopRequestedRef.current = false;
    if (isCarnivalMode && mustBlockCarnivalIngestion(carnivalRuntimeCompatibilityRef.current)) {
      const compatibility = carnivalRuntimeCompatibilityRef.current!;
      ingestionInFlightRef.current = false;
      // An authenticated Carnival page can briefly publish an older
      // authentication-required compatibility probe while its client router
      // finishes rendering the protected account page. Keep the confirmed
      // session in the retryable logged-in state; the same-screen handoff will
      // try again after the fresh ready probe arrives.
      if (compatibility.state === 'authentication_required' && hasAuthenticatedCarnivalSession) {
        if (!carnivalIngestionReadinessWaitLoggedRef.current) {
          carnivalIngestionReadinessWaitLoggedRef.current = true;
          addLog('Carnival login is confirmed. Waiting for the account page to finish loading before collection starts...', 'info');
        }
        setState((prev) => ({ ...prev, status: 'logged_in', error: null }));
        return;
      }
      addLog(compatibility.reason, 'error');
      setState((prev) => ({
        ...prev,
        status: compatibility.state === 'authentication_required' ? 'not_logged_in' : 'error',
        error: compatibility.state === 'authentication_required' ? null : `CARNIVAL_${compatibility.state.toUpperCase()}`,
      }));
      return;
    }
    carnivalIngestionReadinessWaitLoggedRef.current = false;

    if (isCarnivalMode && activeCarnivalIngestionToken) {
      ingestionInFlightRef.current = false;
      if (!carnivalSingleFlightWaitLoggedRef.current) {
        carnivalSingleFlightWaitLoggedRef.current = true;
        addLog('A Carnival download is already active. Waiting for it to stop instead of starting a duplicate run.', 'info');
      }
      await activeCarnivalIngestionCompletion;
      carnivalSingleFlightWaitLoggedRef.current = false;
      return;
    }

    if (isCarnivalMode) {
      activeCarnivalIngestionToken = ingestionInstanceTokenRef.current;
      activeCarnivalIngestionCompletion = new Promise<void>((resolve) => {
        resolveActiveCarnivalIngestion = resolve;
      });
    }
    syncOwnershipRef.current = createSyncOwnershipSnapshot(
      isCarnivalMode ? 'carnival' : cruiseLine === 'celebrity' ? 'celebrity' : 'royal',
      currentUser.id,
      authenticatedEmail,
      isCarnivalMode ? createCarnivalAccountFingerprint(currentUser.carnivalVifpNumber) : undefined,
    );
    const resumeCheckpoint = isCarnivalMode ? carnivalResumeCheckpointRef.current : null;
    carnivalSyncCancelledRef.current = false;

    if (isCarnivalMode) {
      const syncRunId = resumeCheckpoint?.syncRunId ?? `carnival-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      carnivalRunRef.current = {
        syncRunId,
        profileId: currentUser?.id ?? '',
        createdAt: resumeCheckpoint?.createdAt ?? new Date().toISOString(),
      };
      carnivalCollectionsRef.current = resumeCheckpoint?.collections ?? createCarnivalCollectionEvidence();
      carnivalRateCodesRef.current = resumeCheckpoint?.rateCodes ?? {};
      if (resumeCheckpoint) {
        extractedOffersRef.current = resumeCheckpoint.offerRows;
        addLog(`Resuming Carnival sync from a saved checkpoint (${resumeCheckpoint.completedStages.join(', ') || 'no completed stages'}).`, 'info');
      }
      carnivalResumeCheckpointRef.current = null;
    }

    processedPayloads.current.clear();
    royalHandoffEvidenceRef.current = createRoyalSyncHandoffEvidence();
    hasReceivedApiLoyaltyDataRef.current = false;
    capturedSections.current = { offers: false, bookings: false, loyalty: false, pastTrips: false };
    carnivalUserDataRef.current = null;
    if (!resumeCheckpoint) {
      extractedOffersRef.current = [];
    } else {
      extractedOffersRef.current = resumeCheckpoint.offerRows;
    }

    setState(prev => ({
      ...prev,
      status: 'running_step_1',
      extractedOffers: resumeCheckpoint?.offerRows ?? [],
      extractedBookedCruises: resumeCheckpoint?.bookedCruiseRows ?? [],
      error: null
    }));

    addLog('Starting ingestion process...', 'info');
    
    const waitForStepComplete = (step: number, baseTimeoutMs: number = 600000): Promise<void> => {
      return new Promise((resolve) => {
        let lastProgressTime = Date.now();
        let isSettled = false;
        const progressTimeoutMs = step === 1 ? 240000 : 90000;

        const finishStep = (timeoutMessage?: string) => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          clearTimeout(maxTimeout);
          clearInterval(progressInterval);
          delete stepCompleteResolvers.current[step];
          delete progressCallbacks.current.onProgress;
          if (timeoutMessage) {
            addLog(timeoutMessage, 'warning');
          }
          resolve();
        };
        
        const checkProgress = () => {
          if (syncStopRequestedRef.current) {
            finishStep(isCarnivalMode ? 'Carnival sync paused. A resumable checkpoint was saved.' : undefined);
            return;
          }
          const timeSinceProgress = Date.now() - lastProgressTime;
          if (timeSinceProgress > progressTimeoutMs) {
            finishStep(`Step ${step} timed out (no progress for ${progressTimeoutMs / 1000}s) - continuing with collected data`);
          }
        };
        
        const progressInterval = setInterval(checkProgress, 5000);
        
        const maxTimeout = setTimeout(() => {
          finishStep(`Step ${step} reached max timeout (${baseTimeoutMs / 1000}s) - continuing with collected data`);
        }, baseTimeoutMs);
        
        progressCallbacks.current.onProgress = () => {
          if (!isSettled) {
            lastProgressTime = Date.now();
          }
        };
        
        stepCompleteResolvers.current[step] = () => {
          finishStep();
        };
      });
    };

    const navigateToPage = (
      url: string,
      maxWaitMs: number = 15000,
      settleDelayMs: number = 2500,
    ): Promise<void> => {
      if (syncStopRequestedRef.current) {
        return Promise.resolve();
      }
      if (!isSafeRemoteWebViewUrl(url)) {
        addLog(`Blocked unsafe browser navigation target: ${String(url || '(empty)')}`, 'error');
        return Promise.resolve();
      }

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
          if (syncStopRequestedRef.current) {
            resolve();
          } else {
            setTimeout(resolve, settleDelayMs);
          }
        };

        addLog(`🌐 Navigating to: ${url}`, 'info');
        setWebViewUrl(url);
      });
    };

    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const throwIfSyncCancelled = () => {
      if (syncStopRequestedRef.current || (isCarnivalMode && carnivalSyncCancelledRef.current)) {
        throw new Error(isCarnivalMode ? 'CARNIVAL_SYNC_CANCELLED' : 'SYNC_SCREEN_CLOSED');
      }
    };
    const waitForCapturedSection = async (
      section: 'bookings' | 'loyalty',
      maxWaitMs: number,
    ): Promise<boolean> => {
      const deadline = Date.now() + maxWaitMs;
      while (!capturedSections.current[section] && Date.now() < deadline) {
        throwIfSyncCancelled();
        await delay(Math.min(250, Math.max(1, deadline - Date.now())));
      }
      return capturedSections.current[section];
    };
    
    try {
      addLog(`🚀 ====== STEP 1: ${config.loyaltyClubName.toUpperCase()} OFFERS ======`, 'info');
      addLog(`📍 Loading ${config.loyaltyClubName} offers page...`, 'info');
      addLog('⏱️ This may take several minutes - extracting all offers and sailings...', 'info');
      
      addLog('📍 Navigating to offers page...', 'info');

      // Hoist tgoData so both Step 1 and Step 1.5 can access it
      type TgoData = { fullUrl: string; tgo: string; vifp: string; tierCode: string; tierName: string; rateCodes: Array<{ code: string; startDate: string; endDate: string }> };
      let tgoData: TgoData | null = null;

      if (isCarnivalMode) {
        addLog('🎪 Carnival — navigating to personalized offers page...', 'info');
        await navigateToPage(config.offersUrl, 20000);
        addLog('⏳ Waiting for Carnival offers page to fully render and redirect to personalized URL...', 'info');
        await delay(6000);

        // Extract tgo params + rate codes from the redirected (personalized) URL
        addLog('🔍 Extracting TGO rate codes from personalized offers URL...', 'info');
        const extractTgo = (timeoutMs: number): Promise<TgoData | null> => new Promise<TgoData | null>((resolve) => {
          carnivalTgoDataResolver.current = null;
          const tgoTimeout = setTimeout(() => { carnivalTgoDataResolver.current = null; resolve(null); }, timeoutMs);
          carnivalTgoDataResolver.current = (data) => { clearTimeout(tgoTimeout); resolve(data); };
          webViewRef.current?.injectJavaScript(injectCarnivalTgoExtract());
        });

        tgoData = await extractTgo(9000);
        if (!tgoData || tgoData.rateCodes.length === 0) {
          addLog('⚠️ No TGO rate codes yet — waiting for personalized redirect...', 'warning');
          await delay(4000);
          tgoData = await extractTgo(8000);
        }

        if (!tgoData || tgoData.rateCodes.length === 0) {
          addLog('⚠️ Profile offers shell contained no rate codes — trying Carnival View Your Offers...', 'warning');
          await navigateToPage('https://www.carnival.com/offers', 20000);
          await delay(6000);
          tgoData = await extractTgo(9000);
        }

        if (tgoData && tgoData.rateCodes.length > 0) {
          carnivalRateCodesRef.current = createCarnivalRateCodeEvidence(tgoData.rateCodes.map((entry) => entry.code));
          addLog(`✅ Found ${tgoData.rateCodes.length} rate codes: ${tgoData.rateCodes.map(r => r.code).join(', ')}`, 'success');
          if (tgoData.vifp) addLog(`✅ VIFP# ${tgoData.vifp} (${tgoData.tierName} tier)`, 'success');
        } else {
          addLog('ℹ️ No personalized TGO URL — will scrape offers from page DOM', 'info');
        }

        // Also run the standard extraction on the offers page DOM for offer names/descriptions
        addLog('🎪 Injecting Carnival offers page extraction...', 'info');
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
      
      await waitForStepComplete(1, isCarnivalMode ? 180000 : 120000);
      throwIfSyncCancelled();
      capturedSections.current.offers = extractedOffersRef.current.length > 0;
      if (!capturedSections.current.offers) {
        addLog(`⚠️ Step 1 finished without any ${config.loyaltyClubName} offer rows - existing ${config.loyaltyClubName} data will be preserved during sync`, 'warning');
      }
      
      {
        const offersByName = new Map<string, number>();
        let totalSailings = 0;
        extractedOffersRef.current.forEach(offer => {
          const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
          const isInProgress = offer.isInProgress === true || status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning');
          const hasSailing = Boolean(offer.shipName || offer.sailingDate);
          if (!isInProgress && hasSailing) {
            const key = [offer.playerOfferId || offer.carnivalOfferId || offer.offerInstanceId || '', offer.offerCode || offer.offerName || 'Unknown', offer.offerExpirationDate || ''].join('|');
            offersByName.set(key, (offersByName.get(key) || 0) + 1);
            totalSailings += 1;
          }
        });
        const uniqueOffers = offersByName.size;
        const hiddenInProgress = extractedOffersRef.current.filter(offer => {
          const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
          return offer.isInProgress === true || status.includes('in progress') || status.includes('pending') || status.includes('processing') || status.includes('earning') || (!offer.shipName && !offer.sailingDate);
        }).length;
        
        if (uniqueOffers > 0 && totalSailings > 0) {
          addLog(`✅ STEP 1 COMPLETE: Captured ${uniqueOffers} active casino offer(s) with ${totalSailings} total sailing(s)`, 'success');
        } else {
          addLog(`⛔ STEP 1 INCOMPLETE: ${config.loyaltyClubName} displayed offers but no valid offer sailing rows were captured. Existing offers will not be overwritten.`, 'error');
        }
        if (hiddenInProgress > 0) {
          addLog(`ℹ️ Excluded ${hiddenInProgress} in-progress/empty offer row(s) from active offer counts`, 'info');
        }
        
      }

      publishExtractedOffers(extractedOffersRef.current, true);
      await yieldSyncUi();

      // Step 1.5: Carnival offer enrichment - navigate to each rate code's cruise search page
      if (isCarnivalMode) {
        type EnrichEntry = { offerName: string; offerCode: string; bookingLink: string; offerExpiry: string; perks: string; playerOfferId?: string; carnivalOfferId?: string; offerInstanceId?: string };
        type EnrichGroup = EnrichEntry & { instances: EnrichEntry[] };
        const offersToEnrichMap = new Map<string, Map<string, EnrichEntry>>();
        const getEnrichIdentity = (entry: EnrichEntry): string => {
          const providerId = entry.playerOfferId || entry.carnivalOfferId || entry.offerInstanceId;
          return providerId
            ? `id:${providerId}`.toLowerCase()
            : ['material', entry.offerCode, entry.offerName, entry.offerExpiry, entry.bookingLink].join('|').toLowerCase();
        };
        const isGenericRateCodeEntry = (entry: EnrichEntry): boolean =>
          !entry.playerOfferId && !entry.carnivalOfferId && !entry.offerInstanceId && /^Rate Code\s+/i.test(entry.offerName);
        const buildCarnivalSearchUrl = (code: string, sourceUrl?: string): string => {
          const tgoParam = tgoData?.tgo || '';
          let url: URL;
          try {
            url = new URL(sourceUrl || 'https://www.carnival.com/cruise-search', 'https://www.carnival.com');
          } catch {
            url = new URL('https://www.carnival.com/cruise-search');
          }
          url.pathname = '/cruise-search';
          // Keep the official CTA query intact when it contains a family of
          // companion rate codes. Emit one canonical rateCodes key: duplicate
          // case variants can make Carnival's client router remain in its
          // loading state and were the cause of all rate codes returning zero.
          const sourceRateCodes: string[] = [];
          Array.from(url.searchParams.entries()).forEach(([key, value]) => {
            if (!/^ratecodes?$/i.test(key)) return;
            String(value || '').split(/[,;|]/).forEach((candidate) => {
              const normalized = normalizeCarnivalRateCode(candidate);
              if (normalized && !sourceRateCodes.includes(normalized)) sourceRateCodes.push(normalized);
            });
            url.searchParams.delete(key);
          });
          url.searchParams.set('rateCodes', sourceRateCodes.includes(code) ? sourceRateCodes.join(',') : code);
          url.searchParams.set('pageNumber', '1');
          url.searchParams.set('pageSize', String(CARNIVAL_SEARCH_PAGE_SIZE));
          if (!url.searchParams.get('numadults')) url.searchParams.set('numadults', '2');
          // Authentication, currency, locality, and past-guest eligibility are
          // already carried by Carnival's signed-in cookies and official CTA.
          // Do not synthesize duplicate query flags that can invalidate a
          // personalized search request.
          if (tgoParam) url.searchParams.set('tgo', tgoParam);
          if (tgoData?.vifp) url.searchParams.set('vifp', tgoData.vifp);
          return url.toString();
        };
        const upsertEnrichEntry = (entry: EnrichEntry) => {
          const normalizedCode = entry.offerCode.trim().toUpperCase();
          if (!normalizedCode) {
            return;
          }
          const normalizedEntry = { ...entry, offerCode: normalizedCode };
          const group = offersToEnrichMap.get(normalizedCode) ?? new Map<string, EnrichEntry>();
          const existingEntries = Array.from(group.values());
          if (isGenericRateCodeEntry(normalizedEntry) && existingEntries.some((candidate) => !isGenericRateCodeEntry(candidate))) {
            return;
          }
          if (!isGenericRateCodeEntry(normalizedEntry)) {
            existingEntries.forEach((candidate) => {
              if (isGenericRateCodeEntry(candidate)) group.delete(getEnrichIdentity(candidate));
            });
          }
          const identity = getEnrichIdentity(normalizedEntry);
          const existing = group.get(identity);
          if (!existing) {
            group.set(identity, normalizedEntry);
            offersToEnrichMap.set(normalizedCode, group);
            return;
          }
          group.set(identity, {
            ...existing,
            offerCode: normalizedCode,
            offerName: existing.offerName.startsWith('Rate Code ') && normalizedEntry.offerName ? normalizedEntry.offerName : (existing.offerName || normalizedEntry.offerName),
            bookingLink: normalizedEntry.bookingLink || existing.bookingLink,
            offerExpiry: normalizedEntry.offerExpiry || existing.offerExpiry,
            perks: normalizedEntry.perks || existing.perks,
            playerOfferId: normalizedEntry.playerOfferId || existing.playerOfferId,
            carnivalOfferId: normalizedEntry.carnivalOfferId || existing.carnivalOfferId,
            offerInstanceId: normalizedEntry.offerInstanceId || existing.offerInstanceId,
          });
          offersToEnrichMap.set(normalizedCode, group);
        };

        if (tgoData && tgoData.rateCodes.length > 0) {
          tgoData.rateCodes.forEach((entry: TgoData['rateCodes'][number]) => {
            upsertEnrichEntry({
              offerName: `Rate Code ${entry.code}`,
              offerCode: entry.code,
              bookingLink: buildCarnivalSearchUrl(entry.code),
              offerExpiry: entry.endDate || '',
              perks: ''
            });
          });
        }

        const currentExtractedOffers = normalizeOfferRows(extractedOffersRef.current);
        currentExtractedOffers.forEach((offer) => {
          const code = offer.offerCode || '';
          if (!code) {
            return;
          }
          let fullLink = offer.bookingLink || '';
          if (fullLink && !fullLink.startsWith('http')) {
            fullLink = 'https://www.carnival.com' + (fullLink.startsWith('/') ? '' : '/') + fullLink;
          }
          upsertEnrichEntry({
            offerName: offer.offerName || `Carnival Offer ${code}`,
            offerCode: code,
            bookingLink: fullLink || buildCarnivalSearchUrl(code),
            offerExpiry: offer.offerExpirationDate || '',
            perks: offer.perks || '',
            playerOfferId: offer.playerOfferId,
            carnivalOfferId: offer.carnivalOfferId,
            offerInstanceId: offer.offerInstanceId,
          });
        });

        const allOffersToEnrich: EnrichGroup[] = Array.from(offersToEnrichMap.entries()).map(([offerCode, entries]) => {
          const instances = Array.from(entries.values());
          const representative = instances.find((entry) => !isGenericRateCodeEntry(entry)) ?? instances[0];
          return { ...representative, offerCode, instances };
        });
        // Every discovered rate code must be processed. A fixed slice made a
        // large Carnival catalog silently partial while the UI still advanced.
        const offersToEnrich = allOffersToEnrich.filter((entry) =>
          carnivalRateCodesRef.current[entry.offerCode]?.status !== 'captured'
        );
        const resumedCompleteRateCodes = allOffersToEnrich.length - offersToEnrich.length;
        if (resumedCompleteRateCodes > 0) {
          addLog(`↻ Resume checkpoint already contains complete pagination proof for ${resumedCompleteRateCodes} rate code(s); continuing only the incomplete codes.`, 'info');
        }
        if (offersToEnrich.length > 0) {
          const instanceCount = offersToEnrich.reduce((total, entry) => total + entry.instances.length, 0);
          addLog(`🎯 Prepared ${offersToEnrich.length} unique Carnival rate code(s) across ${instanceCount} offer instance(s) for detailed sailing/pricing fetch`, 'success');
        }

        const scrapeCarnivalSearchPage = (
          input: Parameters<typeof injectCarnivalSearchPageScrape>[0],
          timeoutMs = CARNIVAL_SEARCH_PAGE_TIMEOUT_MS,
        ): Promise<CarnivalSearchPageResult> => new Promise((resolve) => {
          const waiter: CarnivalSearchPageWaiter = { requestId: input.requestId, rows: [], resolve };
          const timer = setTimeout(() => {
            if (carnivalSearchPageResolver.current === waiter) carnivalSearchPageResolver.current = null;
            resolve({
              requestId: input.requestId,
              runId: input.runId,
              offerCode: input.offerCode,
              offerName: input.offerName,
              offerExpiry: input.offerExpiry,
              perks: input.perks,
              pageNumber: input.pageNumber,
              pageSize: input.pageSize,
              totalResults: 0,
              hasNextPage: false,
              rows: waiter.rows,
              error: 'page_scrape_timeout',
            });
          }, timeoutMs);
          waiter.resolve = (result) => {
            clearTimeout(timer);
            resolve(result);
          };
          carnivalSearchPageResolver.current = waiter;
          webViewRef.current?.injectJavaScript(injectCarnivalSearchPageScrape(input));
        });

        const primeCarnivalSearchCaptureContext = async (input: {
          runId: string;
          offerCode: string;
          pageNumber: number;
          expectedUrl: string;
        }): Promise<void> => {
          const context = JSON.stringify({
            ...input,
            contextFingerprint: `${input.runId}|${input.offerCode}`,
            navigationSequenceId: navigationRequestIdRef.current + 1,
            startedAt: Date.now(),
          }).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
          webViewRef.current?.injectJavaScript(`
            (function() {
              try { window.sessionStorage.setItem('__easySeasCarnivalSearchContext', ${JSON.stringify(context)}); } catch (e) {}
            })();
            true;
          `);
          await delay(75);
        };

        const mergeUniqueCarnivalSailings = (prior: OfferRow[], incoming: OfferRow[]): OfferRow[] => {
          const rows = new Map<string, OfferRow>();
          [...prior, ...incoming].forEach((row) => {
            if (!String(row.shipName || '').trim() || !String(row.sailingDate || '').trim()) return;
            rows.set(createCarnivalSailingKey(row), row);
          });
          return Array.from(rows.values());
        };

        if (offersToEnrich.length > 0) {
          addLog(`🔍 ====== STEP 1.5: FETCHING SAILINGS FOR ${offersToEnrich.length} RATE CODE(S) ======`, 'info');
          addLog('🚢 Downloading every available results page for every rate code; a partial page set will remain resumable and will not be labeled complete.', 'info');

          let totalEnrichedSailings = 0;
          let processedRateCodes = 0;
          const incompleteRateCodes: string[] = [];
          const runId = carnivalRunRef.current?.syncRunId || `carnival-${Date.now()}`;
          for (let oi = 0; oi < offersToEnrich.length; oi++) {
            throwIfSyncCancelled();
            const offer = offersToEnrich[oi];
            processedRateCodes += 1;
            addLog(`🔍 Rate code ${oi + 1}/${offersToEnrich.length}: ${offer.offerCode}`, 'info');

            let pageNumber = 1;
            let pagesVisited = 0;
            let expectedItineraryGroups = 0;
            let effectivePageSize = CARNIVAL_SEARCH_PAGE_SIZE;
            let currentSearchUrl = buildCarnivalSearchUrl(offer.offerCode, offer.bookingLink);
            let sailings: OfferRow[] = [];
            let complete = false;
            let completionReason = '';
            let lastSignature = '';
            let repeatedPages = 0;

            while (pagesVisited < CARNIVAL_SEARCH_MAX_PAGES) {
              throwIfSyncCancelled();
              const pageUrl = buildCarnivalNextPageUrl({
                currentUrl: currentSearchUrl,
                offerCode: offer.offerCode,
                nextPageNumber: pageNumber,
                pageSize: CARNIVAL_SEARCH_PAGE_SIZE,
              });
              // The page scraper performs an 8-second readiness poll followed
              // by a two-snapshot stability proof. Use only a short WebView
              // handoff here instead of stacking the default 2.5s settle plus
              // another fixed pause on every Carnival results page.
              let activePageUrl = pageUrl;
              await primeCarnivalSearchCaptureContext({ runId, offerCode: offer.offerCode, pageNumber, expectedUrl: activePageUrl });
              if (pagesVisited === 0) {
                // Load one offer-specific page to establish the authenticated
                // browser context. Later pages use the verified same-origin API
                // directly and do not reload the entire React website.
                await navigateToPage(activePageUrl, 25_000, 500);
              }

              let pageResult: CarnivalSearchPageResult | null = null;
              // Re-injecting a scraper cannot recover an inventory request
              // that occurred before the WebView bridge was ready. When a
              // page is unresolved, perform a real cache-busted navigation so
              // Carnival issues its Fetch/XHR search request again and the
              // already-installed bridge can capture the complete payload.
              // One real reload is enough to recover a request that fired
              // before the bridge was ready. A stable, correctly scoped empty
              // page is not improved by loading the identical URL in circles;
              // retain it as incomplete evidence and move to the next code.
              for (let attempt = 1; attempt <= 2; attempt += 1) {
                const requestId = `${runId}-${offer.offerCode}-${pageNumber}-${attempt}-${Date.now()}`;
                pageResult = await scrapeCarnivalSearchPage({
                  requestId,
                  runId,
                  contextFingerprint: `${runId}|${offer.offerCode}`,
                  expectedUrl: activePageUrl,
                  offerCode: offer.offerCode,
                  offerName: offer.offerName,
                  offerExpiry: offer.offerExpiry,
                  perks: offer.perks,
                  pageNumber,
                  pageSize: CARNIVAL_SEARCH_PAGE_SIZE,
                  priorUniqueCount: sailings.length,
                });
                const unresolved = shouldRetryCarnivalSearchPage({
                  error: pageResult.error,
                  rowCount: pageResult.rows.length,
                  authoritativeEmpty: pageResult.authoritativeEmpty,
                  renderedTerminalProof: pageResult.renderedTerminalProof,
                  pageContextMatched: pageResult.pageContextMatched,
                  resultStable: pageResult.resultStable,
                }, attempt, 2);
                if (!unresolved) break;
                addLog(`   ↻ ${offer.offerCode} page ${pageNumber} was not settled; retrying the Carnival results request once`, 'warning');
                const retryUrl = new URL(pageUrl);
                retryUrl.searchParams.set('_easySeasRetry', `${attempt}-${Date.now()}`);
                activePageUrl = retryUrl.toString();
                await primeCarnivalSearchCaptureContext({ runId, offerCode: offer.offerCode, pageNumber, expectedUrl: activePageUrl });
                await navigateToPage(activePageUrl, 30_000, 750);
              }

              if (!pageResult) {
                completionReason = `Carnival did not return a result for ${offer.offerCode} page ${pageNumber}.`;
                break;
              }

              pagesVisited += 1;
              const responseCode = normalizeCarnivalRateCode(pageResult.offerCode);
              if (responseCode !== offer.offerCode || Number(pageResult.pageNumber) !== pageNumber || !pageResult.pageContextMatched) {
                completionReason = `Page ${pageNumber} did not retain the verified ${offer.offerCode} search context.`;
                break;
              }

              const beforeCount = sailings.length;
              sailings = mergeUniqueCarnivalSailings(sailings, pageResult.rows);
              expectedItineraryGroups = Math.max(expectedItineraryGroups, Number(pageResult.totalResults || 0), Number(pageResult.displayedTotal || 0));
              effectivePageSize = Math.max(1, Number(pageResult.effectivePageSize || effectivePageSize));
              const signature = pageResult.pageSignature || `${pageNumber}|${pageResult.rows.length}|${sailings.length}`;
              repeatedPages = signature === lastSignature || sailings.length === beforeCount ? repeatedPages + 1 : 0;
              lastSignature = signature;

              addLog(
                `   Page ${pageNumber}: ${pageResult.rows.length} dated sailing(s), ${sailings.length} unique dated sailing(s)${expectedItineraryGroups ? ` from ${expectedItineraryGroups} itinerary group(s)` : ''} — ${pageResult.payloadMatched ? 'verified Carnival API' : pageResult.resultStable ? 'stable rendered page' : 'unverified page'}`,
                pageResult.rows.length ? 'success' : 'info',
              );

              const authoritativePage = Boolean(pageResult.payloadMatched && pageResult.requestProof && pageResult.pageProof);
              const terminalProof = Boolean(pageResult.authoritativeEmpty || pageResult.renderedTerminalProof || (authoritativePage && !pageResult.hasNextPage));
              if (!pageResult.hasNextPage && terminalProof && (pageResult.rows.length > 0 || pageResult.authoritativeEmpty)) {
                complete = true;
                completionReason = pageResult.authoritativeEmpty
                  ? 'Carnival authoritatively confirmed zero eligible sailings.'
                  : `Captured ${sailings.length} unique dated sailing(s) from ${expectedItineraryGroups || 'all'} itinerary group(s) across ${pagesVisited} verified page(s).`;
                break;
              }

              const shouldContinue = Boolean(pageResult.hasNextPage);
              if (!shouldContinue) {
                completionReason = pageResult.truncationReason || `Carnival did not provide terminal proof after page ${pageNumber}.`;
                break;
              }
              if (repeatedPages >= 3 && !authoritativePage) {
                completionReason = `Carnival repeated page ${pageNumber} without adding dated sailings; ${sailings.length} were captured.`;
                break;
              }

              pageNumber = Math.max(pageNumber + 1, Number(pageResult.nextPageNumber || pageNumber + 1));
              currentSearchUrl = buildCarnivalNextPageUrl({
                currentUrl: activePageUrl,
                offerCode: offer.offerCode,
                nextPageNumber: pageNumber,
                pageSize: pageResult.effectivePageSize || CARNIVAL_SEARCH_PAGE_SIZE,
                nextUrl: pageResult.nextUrl || undefined,
                nextOffset: pageResult.paginationMode === 'offset' ? pageResult.nextOffset : null,
                nextCursor: pageResult.paginationMode === 'cursor' ? pageResult.nextCursor : '',
              });
              await yieldSyncUi();
            }

            if (!complete && pagesVisited >= CARNIVAL_SEARCH_MAX_PAGES) {
              completionReason = `Safety page limit reached with ${sailings.length} dated sailings.`;
            }

            const priorEvidence = carnivalRateCodesRef.current[offer.offerCode] ?? createCarnivalRateCodeEvidence([offer.offerCode])[offer.offerCode];
            carnivalRateCodesRef.current = updateCarnivalRateCodeEvidence(carnivalRateCodesRef.current, offer.offerCode, {
              requestedPages: Math.max(priorEvidence.requestedPages, pagesVisited),
              acknowledgedPages: complete ? pagesVisited : Math.min(pagesVisited, priorEvidence.acknowledgedPages),
              expectedPages: expectedItineraryGroups > 0 ? Math.max(1, Math.ceil(expectedItineraryGroups / effectivePageSize)) : pagesVisited,
              receivedRows: sailings.length,
              status: complete ? 'captured' : 'incomplete',
              reason: completionReason || (complete ? 'All Carnival pages captured.' : 'Carnival pagination remains incomplete.'),
            });

            if (!complete) {
              incompleteRateCodes.push(offer.offerCode);
              addLog(`   ⚠️ ${offer.offerCode} remains partial/resumable: ${completionReason}`, 'warning');
            } else {
              addLog(`   ✅ ${offer.offerCode} complete: ${completionReason}`, 'success');
            }

            if (sailings.length > 0) {
              totalEnrichedSailings += sailings.length;
              const enrichedSailings = offer.instances.flatMap((instance) => sailings.map((sailing) => ({
                ...sailing,
                offerName: instance.offerName || sailing.offerName,
                offerCode: instance.offerCode || sailing.offerCode,
                offerExpirationDate: instance.offerExpiry || sailing.offerExpirationDate,
                perks: instance.perks || sailing.perks,
                bookingLink: instance.bookingLink || sailing.bookingLink,
                playerOfferId: instance.playerOfferId,
                carnivalOfferId: instance.carnivalOfferId,
                offerInstanceId: instance.offerInstanceId || instance.playerOfferId || instance.carnivalOfferId || getEnrichIdentity(instance),
              })));
              const instanceIdentities = new Set(offer.instances.map(getEnrichIdentity));
              const existingWithoutThisOffer = extractedOffersRef.current.filter((row) => {
                const rowIdentity = getEnrichIdentity({
                  offerName: row.offerName || '', offerCode: row.offerCode || '', bookingLink: row.bookingLink || '', offerExpiry: row.offerExpirationDate || '', perks: row.perks || '',
                  playerOfferId: row.playerOfferId, carnivalOfferId: row.carnivalOfferId, offerInstanceId: row.offerInstanceId,
                });
                return !instanceIdentities.has(rowIdentity);
              });
              const updatedOffers = [...existingWithoutThisOffer, ...enrichedSailings];
              publishExtractedOffers(updatedOffers);
              if (offer.instances.length > 1) addLog(`   ↳ Reused the ${offer.offerCode} sailing inventory for ${offer.instances.length} distinct offer instance(s)`, 'info');
            }
            await yieldSyncUi();
          }
          if (incompleteRateCodes.length > 0) {
            addLog(`⚠️ STEP 1.5 PARTIAL/RESUMABLE: processed all ${processedRateCodes} rate code(s), captured ${totalEnrichedSailings} sailing(s), and retained ${incompleteRateCodes.length} incomplete code(s): ${incompleteRateCodes.join(', ')}`, 'warning');
          } else {
            addLog(`✅ STEP 1.5 COMPLETE: all ${processedRateCodes} rate code(s) were fully paginated with ${totalEnrichedSailings} unique sailing(s)`, 'success');
          }
        } else {
          addLog('ℹ️ No rate codes to enrich — all offer data already complete or no offers found', 'info');
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
              await waitForCapturedSection(page.section, isCarnivalMode ? 8000 : 6000);
              
              if (capturedSections.current[page.section]) {
                addLog(`✅ ${page.name} data captured after wait!`, 'success');
              }
            }
          }
        }
      } catch (step2Error) {
        addLog(`Step 2 error: ${String(step2Error)} - continuing with collected data`, 'warning');
      }
      throwIfSyncCancelled();
      
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
      throwIfSyncCancelled();
      
      setState(prev => {
        const hasLoyalty = prev.loyaltyData || extendedLoyaltyData;
        if (hasLoyalty) {
          addLog('✅ STEP 3 COMPLETE: Loyalty data captured successfully', 'success');
        } else {
          addLog('⚠️ STEP 3 COMPLETE: No loyalty data captured (continuing without it)', 'warning');
        }
        return prev;
      });

      if (cruiseLine === 'royal_caribbean') {
        setState(prev => ({ ...prev, status: 'running_step_4' }));
        addLog('🚀 ====== STEP 4: PAST TRIPS ======', 'info');
        addLog('📡 Opening My Trips and switching to Past cruises before app sync...', 'info');

        const injectPastTripsTabClick = () => {
          webViewRef.current?.injectJavaScript(`
            (function() {
              function post(type, payload) {
                try { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {}))); } catch (e) {}
              }
              function log(message, logType) {
                post('log', { message: message, logType: logType || 'info' });
              }
              try { window.__easySeasReadingPastTrips = true; } catch (e) {}
              function clickPastTab() {
                var candidates = Array.prototype.slice.call(document.querySelectorAll('button, [role="tab"], a, div, span'));
                var past = candidates.find(function(el) {
                  var text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
                  return /\\bPAST\\b|\\bPast\\b/i.test(text) && /\\(?(\\d+)\\)?/.test(text);
                }) || candidates.find(function(el) {
                  var text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
                  return /^past/i.test(text);
                });
                if (past && typeof past.click === 'function') {
                  past.click();
                  log('✅ Clicked Past Trips tab on My Trips', 'success');
                  return true;
                }
                log('⚠️ Past Trips tab not visible yet', 'warning');
                return false;
              }
              var attempts = 0;
              var timer = setInterval(function() {
                attempts++;
                if (clickPastTab() || attempts >= 12) {
                  clearInterval(timer);
                  var scrolls = 0;
                  var scrollTimer = setInterval(function() {
                    scrolls++;
                    try { window.scrollBy(0, Math.max(700, window.innerHeight || 700)); } catch (e) {}
                    if (scrolls >= 8) {
                      clearInterval(scrollTimer);
                      try { window.scrollTo(0, 0); } catch (e) {}
                      var existing = window.capturedPayloads && window.capturedPayloads.pastTrips ? window.capturedPayloads.pastTrips : null;
                      if (existing) {
                        post('network_payload', { endpoint: 'pastTrips', data: existing, url: window.location.href });
                      }
                      try { window.__easySeasReadingPastTrips = false; } catch (e) {}
                      post('step_complete', { step: 4, totalCount: 0 });
                    }
                  }, 900);
                }
              }, 1000);
              true;
            })();
          `);
        };

        try {
          const pastCaptureCycles = 2;
          for (let cycle = 0; cycle < pastCaptureCycles && !capturedSections.current.pastTrips; cycle++) {
            if (cycle > 0) {
              addLog('🔄 Past Trips not captured yet — refreshing loyalty then returning to My Trips...', 'info');
              await navigateToPage(config.loyaltyPageUrl, 16000);
              await delay(2500);
            }
            await navigateToPage(config.myTripsUrl, 22000);
            await delay(4500);
            injectPastTripsTabClick();
            await waitForStepComplete(4, 26000);
            if (!capturedSections.current.pastTrips) {
              await delay(2000);
            }
          }
        } catch (step4Error) {
          addLog(`Step 4 error: ${String(step4Error)} - continuing with collected data`, 'warning');
        }

        setState(prev => {
          const completedCruises = prev.extractedBookedCruises.filter(c => {
            const status = (c.status || '').toLowerCase();
            return status === 'completed' || status === 'past';
          }).length;
          if (completedCruises > 0) {
            addLog(`✅ STEP 4 COMPLETE: Captured ${completedCruises} completed/past cruise(s)`, 'success');
          } else {
            addLog('⚠️ STEP 4 COMPLETE: No Past Trips payload captured; existing completed cruises will be preserved', 'warning');
          }
          return prev;
        });
      }
      
      addLog('🏁 ====== EXTRACTION FINISHED ======', 'info');
      addLog('Review the validated rows below. Data is not saved until Sync to App completes.', 'info');
      const finalExtractedOffers = extractedOffersRef.current;
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
          return status === 'upcoming' || status === 'in progress' || status === 'in-progress' || status === 'booked' || status === 'confirmed' || status === 'pending' || status === 'waitlist';
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
        finalExtractedOffers.forEach(offer => {
          const key = [offer.playerOfferId || offer.carnivalOfferId || offer.offerInstanceId || '', offer.offerCode || offer.offerName || 'Unknown', offer.offerExpirationDate || ''].join('|');
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
          totalRows: finalExtractedOffers.length,
          uniqueOffers,
          offerBreakdown: Array.from(offersByName.entries()).map(([name, count]) => ({ name, count }))
        });

        let carnivalOutcome: CarnivalSyncOutcome | undefined;
        if (isCarnivalMode) {
          const offerSailings = finalExtractedOffers.filter((offer) => Boolean(offer.shipName || offer.sailingDate)).length;
          if (finalExtractedOffers.length > 0) {
            recordCarnivalCollection('offers', finalExtractedOffers.length, 'final_reconciliation', 'captured');
          } else if (carnivalCollectionsRef.current.offers.status === 'not_started') {
            recordCarnivalCollection('offers', 0, 'final_reconciliation', 'unavailable', 'No authoritative personalized-offers response was captured.');
          }
          if (offerSailings > 0) {
            recordCarnivalCollection('offerSailings', offerSailings, 'final_reconciliation', 'captured');
          } else if (carnivalCollectionsRef.current.offerSailings.status === 'not_started') {
            const rateCodeEvidence = Object.values(carnivalRateCodesRef.current);
            const everyDiscoveredRateCodeCompleted = rateCodeEvidence.length > 0
              && rateCodeEvidence.every((entry) => entry.status === 'captured'
                && entry.acknowledgedPages >= entry.requestedPages
                && entry.acknowledgedPages >= (entry.expectedPages ?? 0));
            if (everyDiscoveredRateCodeCompleted) {
              recordCarnivalCollection('offerSailings', 0, 'final_reconciliation', 'empty', 'Every discovered rate code completed pagination and returned no sailing rows.');
            } else {
              recordCarnivalCollection('offerSailings', 0, 'final_reconciliation', 'unavailable', 'No authoritative offer-sailing rows were captured.');
            }
          }
          if (upcomingCruises > 0) {
            recordCarnivalCollection('bookedCruises', upcomingCruises, 'final_reconciliation', 'captured');
          } else if (carnivalCollectionsRef.current.bookedCruises.status === 'not_started') {
            recordCarnivalCollection('bookedCruises', 0, 'final_reconciliation', 'unavailable', 'No authoritative upcoming-bookings response was captured.');
          }
          if (courtesyHolds > 0) recordCarnivalCollection('cruiseHolds', courtesyHolds, 'final_reconciliation', 'captured');
          if (completedCruises > 0) recordCarnivalCollection('completedCruises', completedCruises, 'final_reconciliation', 'captured');

          if (!carnivalUserDataRef.current?.vifpNumber) {
            recordCarnivalCollection('vifpIdentity', 0, 'final_reconciliation', 'unavailable', 'No VIFP identity was returned by Carnival.');
          }
          if (!carnivalUserDataRef.current?.vifpTier) {
            recordCarnivalCollection('vifpTier', 0, 'final_reconciliation', 'unavailable', 'No VIFP tier was returned by Carnival.');
          }
          carnivalOutcome = evaluateCarnivalSyncOutcome(carnivalCollectionsRef.current, carnivalRateCodesRef.current);
          const completedStages = [
            (carnivalCollectionsRef.current.offers.status === 'captured' || carnivalCollectionsRef.current.offers.status === 'empty')
              && (carnivalCollectionsRef.current.offers.count === 0 || carnivalCollectionsRef.current.offerSailings.status === 'captured' || carnivalCollectionsRef.current.offerSailings.status === 'empty') ? 'offers' : '',
            carnivalCollectionsRef.current.bookedCruises.status === 'captured' || carnivalCollectionsRef.current.bookedCruises.status === 'empty' ? 'bookings' : '',
            carnivalCollectionsRef.current.vifpIdentity.status === 'captured' || carnivalCollectionsRef.current.vifpTier.status === 'captured' ? 'loyalty' : '',
          ].filter(Boolean);
          const pendingStages = ['offers', 'bookings', 'loyalty'].filter((stage) => !completedStages.includes(stage));
          void persistCarnivalCheckpoint(
            completedStages,
            pendingStages,
            finalExtractedOffers,
            prev.extractedBookedCruises,
            carnivalUserDataRef.current
              ? {
                  vifpNumber: carnivalUserDataRef.current.vifpNumber,
                  vifpTier: carnivalUserDataRef.current.vifpTier,
                  vifpPoints: carnivalUserDataRef.current.vifpPoints ?? '',
                  cruiseDayPoints: carnivalUserDataRef.current.cruiseDayPoints ?? '',
                  cruiseCount: carnivalUserDataRef.current.cruiseCount ?? '',
                }
              : {},
          ).catch((checkpointError) => {
            console.warn('[CarnivalSync] Could not save checkpoint:', checkpointError);
          });
          addLog(getCarnivalOutcomeMessage(carnivalOutcome), carnivalOutcome === 'complete' ? 'success' : 'warning');
        }
        
        const newState = {
          ...prev, 
          status: (isCarnivalMode
            ? carnivalOutcome === 'invalid_response'
              ? 'invalid_response'
              : carnivalOutcome === 'partial'
                ? 'resumable'
                : 'awaiting_confirmation'
            : 'awaiting_confirmation') as SyncStatus,
          syncCounts: {
            offerCount: uniqueOffers,
            offerRows: finalExtractedOffers.length,
            upcomingCruises,
            courtesyHolds,
            completedCruises,
            ...(isCarnivalMode ? {
              carnivalOutcome,
              carnivalCollections: carnivalCollectionsRef.current,
              carnivalRateCodes: carnivalRateCodesRef.current,
            } : {}),
          },
          syncPreview: null,
          hasResumableCarnivalCheckpoint: isCarnivalMode,
        };
        
        console.log('[RoyalCaribbeanSync] Setting status to awaiting_confirmation', {
          offerCount: uniqueOffers,
          offerRows: finalExtractedOffers.length,
          upcomingCruises,
          courtesyHolds,
          completedCruises,
          totalCruises: prev.extractedBookedCruises.length,
          status: 'awaiting_confirmation'
        });
        
        if (!isCarnivalMode && uniqueOffers === 0) {
          addLog(`⛔ ${config.loyaltyClubName} offer extraction is incomplete: zero offer rows were captured. Existing saved offers will be preserved.`, 'error');
        } else {
          addLog(`📊 SUMMARY: ${uniqueOffers} casino offer(s) with ${finalExtractedOffers.length} total sailing(s)`, 'success');
        }
        const statusParts: string[] = [];
        if (upcomingCruises > 0) statusParts.push(`${upcomingCruises} upcoming`);
        if (completedCruises > 0) statusParts.push(`${completedCruises} completed`);
        if (courtesyHolds > 0) statusParts.push(`${courtesyHolds} courtesy holds`);
        addLog(`📊 SUMMARY: ${prev.extractedBookedCruises.length} cruise(s)${statusParts.length > 0 ? ' - ' + statusParts.join(', ') : ''}`, 'success');
        if (prev.loyaltyData || extendedLoyaltyData) {
          addLog(`📊 SUMMARY: Loyalty status captured successfully`, 'success');
        }
        if (!isCarnivalMode || carnivalOutcome === 'complete' || carnivalOutcome === 'complete_with_warnings') {
          addLog('⏳ Please review and confirm to sync this data to your app', 'info');
        } else if (carnivalOutcome === 'partial') {
          addLog('↻ Carnival inventory is incomplete. The partial rows were checkpointed but were not published; Resume Saved Carnival Sync will continue the missing rate codes.', 'warning');
        } else {
          addLog('⛔ Carnival returned no usable data. The app will not report this run as a successful sync.', 'error');
        }
        
        return newState;
      });
      
    } catch (error) {
      if (!isCarnivalMode && error instanceof Error && error.message === 'SYNC_SCREEN_CLOSED') {
        return;
      }
      if (isCarnivalMode && error instanceof Error && error.message === 'CARNIVAL_SYNC_CANCELLED') {
        void preserveCarnivalFailureCheckpoint(
          'cancelled_ingestion',
          extractedOffersRef.current,
          state.extractedBookedCruises,
        ).then((checkpointStatus) => {
          if (checkpointStatus === 'saved') {
            setState((prev) => ({ ...prev, status: 'resumable', error: null, hasResumableCarnivalCheckpoint: true }));
            addLog('Carnival sync paused. Resume will continue with the saved local evidence.', 'warning');
          } else if (checkpointStatus === 'failed') {
            setState((prev) => ({ ...prev, status: 'error', error: 'CARNIVAL_CHECKPOINT_SAVE_FAILED' }));
            addLog('Carnival sync paused, but its resumable checkpoint could not be saved.', 'error');
          }
        });
        return;
      }
      if (isCarnivalMode) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        void preserveCarnivalFailureCheckpoint(
          'failed_ingestion',
          extractedOffersRef.current,
          state.extractedBookedCruises,
        ).then((checkpointStatus) => {
          if (checkpointStatus === 'saved') {
            setState((prev) => ({ ...prev, status: 'resumable', error: errorMessage, hasResumableCarnivalCheckpoint: true }));
            addLog(`Carnival ingestion stopped: ${errorMessage}. Source evidence was saved for a retry.`, 'warning');
          } else if (checkpointStatus === 'failed') {
            setState((prev) => ({ ...prev, status: 'error', error: errorMessage }));
            addLog(`Carnival ingestion failed and its checkpoint could not be saved: ${errorMessage}`, 'error');
          }
        });
        return;
      }
      addLog(`Ingestion failed: ${String(error)}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
    } finally {
      ingestionInFlightRef.current = false;
      if (isCarnivalMode && activeCarnivalIngestionToken === ingestionInstanceTokenRef.current) {
        activeCarnivalIngestionToken = null;
        const resolveCompletion = resolveActiveCarnivalIngestion;
        resolveActiveCarnivalIngestion = null;
        activeCarnivalIngestionCompletion = null;
        resolveCompletion?.();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.scrapePricingAndItinerary, state.extractedBookedCruises, addLog, authenticatedEmail, config, createSyncOwnershipSnapshot, cruiseLine, currentUser?.id, persistCarnivalCheckpoint, preserveCarnivalFailureCheckpoint, recordCarnivalCollection]);

  const exportOffersCSV = useCallback(async () => {
    try {
      const csv = generateOffersCSV(extractedOffersRef.current, state.loyaltyData);
      
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
        const file = new ExpoFile(ExpoPaths.cache, 'offers.csv');
        await file.write(csv);

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
  }, [state.loyaltyData, addLog]);

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
        const file = new ExpoFile(ExpoPaths.cache, 'Booked_Cruises.csv');
        await file.write(csv);

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
      const diagnosticText = await readDiagnosticJournal();
      const logText = `${rcLogger.getLogsAsText({ includeNotes: true })}\n\n=== Durable persistence journal ===\n${diagnosticText}`;
      
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
        const file = new ExpoFile(ExpoPaths.cache, 'last.log');
        await file.write(logText);

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
    carnivalCompatibilityLoggedRef.current = false;
    royalHandoffEvidenceRef.current = createRoyalSyncHandoffEvidence();
    rcLogger.clear();
  }, []);

  const setExtendedLoyalty = useCallback((data: ExtendedLoyaltyData | null) => {
    setExtendedLoyaltyData((prev) => mergeExtendedLoyaltyData(prev, data));
    
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

  const syncToApp = useCallback(async (coreDataContext: any, loyaltyContext: any, providedExtendedLoyalty?: ExtendedLoyaltyData | null, targetOptions?: SyncTargetOptions) => {
    const loyaltyToSync = providedExtendedLoyalty ?? extendedLoyaltyData;
    const fallbackExtendedLoyaltyFromState = state.loyaltyData
      ? convertLoyaltyInfoToExtended(state.loyaltyData as unknown as LoyaltyApiInformation)
      : null;
    const effectiveExtendedLoyalty = scopeLoyaltyForCruiseLine(
      loyaltyToSync ?? fallbackExtendedLoyaltyFromState,
      cruiseLine,
    );
    const syncSource = cruiseLine === 'carnival' ? 'carnival' : cruiseLine === 'celebrity' ? 'celebrity' : 'royal';
    const activeProfiles = users.filter((profile) => profile.active !== false);
    const primaryProfile = activeProfiles.find((profile) => profile.isOwner) ?? currentUser ?? activeProfiles[0] ?? null;
    const secondaryProfile = activeProfiles.find((profile) => profile.id !== primaryProfile?.id) ?? null;
    const requestedSlot = targetOptions?.targetProfileSlot ?? 'primary';
    const requestedById = targetOptions?.targetProfileId
      ? activeProfiles.find((profile) => profile.id === targetOptions.targetProfileId) ?? null
      : null;
    const requestedProfile = requestedById ?? (requestedSlot === 'secondary' ? secondaryProfile : primaryProfile);
    const targetProfile = requestedSlot === 'secondary' && isUnassignedProfile(secondaryProfile, 'secondary')
      ? primaryProfile
      : requestedProfile ?? primaryProfile ?? currentUser;
    const isPrimarySyncTarget = !primaryProfile || targetProfile?.id === primaryProfile.id;
    const targetSlotLabel = isPrimarySyncTarget ? 'Primary User' : 'Second User';
    const ownershipOptions = targetProfile
      ? { ownerProfileId: targetProfile.id, sourceEmail: targetProfile.email || authenticatedEmail || undefined, includeUnownedRecords: isPrimarySyncTarget }
      : undefined;

    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] Loyalty sync input diagnostics:', {
      hasProvidedExtendedLoyalty: !!providedExtendedLoyalty,
      hasExtendedLoyaltyState: !!extendedLoyaltyData,
      hasLoyaltyState: !!state.loyaltyData,
      hasEffectiveExtendedLoyalty: !!effectiveExtendedLoyalty,
      clubRoyalePointsFromEffective: effectiveExtendedLoyalty?.clubRoyalePointsFromApi,
      crownAndAnchorPointsFromEffective: effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi,
      targetProfileId: targetProfile?.id,
      targetSlotLabel,
      isPrimarySyncTarget,
    });
    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] ========================================');
    console.log('[RoyalCaribbeanSync] SYNC TO APP STARTED');
    console.log('[RoyalCaribbeanSync] ========================================');

    if (syncToAppInFlightRef.current) {
      console.log('[RoyalCaribbeanSync] Sync to app already in progress, ignoring duplicate request');
      addLog('Sync already in progress...', 'warning');
      return;
    }

    if (syncSource === 'carnival' && state.syncCounts?.carnivalOutcome === 'invalid_response') {
      addLog('Carnival sync was not applied because the provider response was invalid or empty.', 'error');
      setState((prev) => ({ ...prev, status: 'invalid_response' }));
      return;
    }
    if (syncSource === 'carnival' && state.syncCounts?.carnivalOutcome === 'partial') {
      addLog('Carnival sync was not applied because one or more rate codes are not fully paginated. Resume the saved sync; the last complete Carnival dataset remains unchanged.', 'error');
      setState((prev) => ({ ...prev, status: 'resumable' }));
      return;
    }

    if (!canPersistSyncToTarget(syncOwnershipRef.current, targetProfile?.id, targetProfile?.email)) {
      addLog('Sync was not applied because its target profile is not linked to the signed-in EasySeas account.', 'error');
      setState((prev) => ({ ...prev, status: 'error', error: 'SYNC_TARGET_PROFILE_MISMATCH' }));
      return;
    }

    syncToAppInFlightRef.current = true;
    let existingInventoryCruises: Cruise[];
    try {
      existingInventoryCruises = await coreDataContext.getAllCruises();
    } catch (error) {
      syncToAppInFlightRef.current = false;
      addLog(`Could not read the current local cruise inventory: ${String(error)}`, 'error');
      setState((prev) => ({ ...prev, status: 'error', error: 'LOCAL_CRUISE_INVENTORY_READ_FAILED' }));
      return;
    }
    let transactionManifest: SyncTransactionManifest | null = null;
    let datasetWritesStarted = false;
    let localTransactionCommitted = false;
    const rollbackSnapshot = {
      offers: [...coreDataContext.casinoOffers],
      cruises: [...existingInventoryCruises],
      bookedCruises: [...coreDataContext.bookedCruises],
    };
    const assertSyncNotCancelled = (stage: string) => {
      if (syncStopRequestedRef.current || !providerMountedRef.current) {
        throw new Error(`SYNC_CANCELLED:${stage}`);
      }
    };
    
    try {
      assertSyncNotCancelled('before_transaction');
      transactionManifest = await runBoundedSyncCheckpoint(
        'BEGIN_LOCAL_TRANSACTION',
        () => beginSyncTransaction(syncSource),
        addLog,
        10000,
      );
      activeSyncTransactionRef.current = transactionManifest;
      assertSyncNotCancelled('after_transaction');
      addLog(`Local transaction ${transactionManifest.runId} prepared`, 'info');
      assertSyncOwnership('application persistence');
      console.log('[RoyalCaribbeanSync] Step 1: Setting status to syncing...');
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('🚀 Starting sync to app...', 'info');
      addLog(`Sync target: ${targetSlotLabel}${targetProfile?.name ? ` (${targetProfile.name})` : ''}`, 'info');

      console.log('[RoyalCaribbeanSync] Step 2: Creating sync preview...');
      addLog('Creating sync preview...', 'info');

      const currentLoyalty = isPrimarySyncTarget
        ? {
            clubRoyalePoints: loyaltyContext.clubRoyalePoints,
            clubRoyaleTier: loyaltyContext.clubRoyaleTier,
            crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
            crownAndAnchorLevel: loyaltyContext.crownAnchorLevel,
          }
        : {
            clubRoyalePoints: targetProfile?.clubRoyalePoints ?? 0,
            clubRoyaleTier: targetProfile?.clubRoyaleTier ?? '',
            crownAndAnchorPoints: targetProfile?.loyaltyPoints ?? 0,
            crownAndAnchorLevel: targetProfile?.crownAnchorLevel ?? '',
          };

      console.log('[RoyalCaribbeanSync] Creating sync preview with:', {
        extractedOffers: extractedOffersRef.current.length,
        extractedBookedCruises: state.extractedBookedCruises.length,
        existingOffers: coreDataContext.casinoOffers.length,
        existingCruises: existingInventoryCruises.length,
        existingBookedCruises: coreDataContext.bookedCruises.length
      });

      await yieldSyncUi();
      assertSyncNotCancelled('before_normalize');
      const normalizeStartedAt = Date.now();
      const normalizedOffers = normalizeOfferRows(extractedOffersRef.current);
      const normalizedBookedCruises = normalizeBookedCruiseRows(state.extractedBookedCruises);
      addLog(`✅ NORMALIZE completed in ${((Date.now() - normalizeStartedAt) / 1000).toFixed(1)}s`, 'success');
      const incomingUniqueOfferCount = new Set(
        normalizedOffers.map((offer) => {
          const instanceId = String(offer.playerOfferId || offer.carnivalOfferId || offer.offerInstanceId || '').trim().toLowerCase();
          if (instanceId) return `instance:${instanceId}`;
          return [offer.offerCode, offer.offerName, offer.offerExpirationDate]
            .map((value) => String(value || '').trim().toLowerCase())
            .join('|');
        }).filter(Boolean),
      ).size;

      if (normalizedOffers.length !== extractedOffersRef.current.length) {
        addLog(`ℹ️ Sanitized ${extractedOffersRef.current.length - normalizedOffers.length} malformed offer row(s) before sync`, 'info');
      }
      if (normalizedBookedCruises.length !== state.extractedBookedCruises.length) {
        addLog(`ℹ️ Sanitized ${state.extractedBookedCruises.length - normalizedBookedCruises.length} malformed booked cruise row(s) before sync`, 'info');
      }

      await yieldSyncUi();
      assertSyncNotCancelled('before_preview');
      const previewStartedAt = Date.now();
      const preview = createSyncPreview(
        normalizedOffers,
        normalizedBookedCruises,
        state.loyaltyData,
        coreDataContext.casinoOffers,
        existingInventoryCruises,
        coreDataContext.bookedCruises,
        currentLoyalty,
        syncSource,
        ownershipOptions
      );

      console.log('[RoyalCaribbeanSync] Sync preview created successfully');
      addLog(`✅ PREVIEW completed in ${((Date.now() - previewStartedAt) / 1000).toFixed(1)}s`, 'success');
      assertSyncNotCancelled('after_preview');

      const counts = calculateSyncCounts(preview);
      const handoffEvidence = { ...royalHandoffEvidenceRef.current };
      handoffEvidence.exactOfferDuplicates = preview.evidence.exactOfferDuplicates;
      handoffEvidence.exactBookedDuplicates = preview.evidence.exactBookedDuplicates;
      handoffEvidence.canonicalRows = counts.canonicalRows;
      handoffEvidence.rejectedRows = counts.rejectedRows;
      handoffEvidence.quarantinedRows = counts.quarantinedRows;
      handoffEvidence.insertedRows = counts.insertedRows;
      handoffEvidence.updatedRows = counts.updatedRows;
      handoffEvidence.unchangedRows = counts.unchangedRows;
      const discoveredRows = handoffEvidence.discoveredOfferRows + handoffEvidence.discoveredBookedRows;
      const normalizedRows = normalizedOffers.length + normalizedBookedCruises.length;
      const malformedRows = handoffEvidence.malformedOfferRows + handoffEvidence.malformedBookedRows;
      const exactDuplicates = handoffEvidence.exactOfferDuplicates + handoffEvidence.exactBookedDuplicates;
      handoffEvidence.receivedRows = normalizedRows;
      handoffEvidence.unaccountedRows = Math.max(
        0,
        discoveredRows - malformedRows - exactDuplicates - handoffEvidence.acknowledgedRows,
      ) + counts.unaccountedRows;
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      addLog(`Preview: ${counts.cruisesNew} new available cruises, ${counts.cruisesUpdated} updated available cruises`, 'info');
      addLog(`Preview: ${counts.bookedCruisesNew} new booked cruises, ${counts.bookedCruisesUpdated} updated booked cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');
      addLog(
        `Reconciliation: ${counts.rawRowsReceived} normalized raw row(s), ${counts.canonicalRows} canonical row(s), ${counts.retainedVariants} retained offer variant(s), ${counts.consolidatedDuplicates} exact duplicate(s), ${counts.rejectedRows} rejected row(s), ${counts.quarantinedRows} quarantined row(s)`,
        counts.rejectedRows > 0 || counts.quarantinedRows > 0 ? 'warning' : 'info'
      );
      addLog(
        `Raw evidence: ${discoveredRows} discovered, ${normalizedRows} normalized, ${malformedRows} malformed, ${handoffEvidence.unaccountedRows} unaccounted`,
        handoffEvidence.unaccountedRows > 0 ? 'error' : 'info'
      );
      if (handoffEvidence.unaccountedRows > 0) {
        addLog('Sync evidence is incomplete; unaccounted provider rows will not be labeled as duplicates.', 'error');
      }

      setState(prev => ({ ...prev, syncPreview: preview }));

      const authoritativeOfferRows = normalizedOffers.filter((offer) => {
        const status = (offer.offerStatus || '').toLowerCase().replace(/[\s_-]+/g, ' ');
        const isIncompleteFallback =
          offer.isInProgress === true ||
          status.includes('in progress') ||
          status.includes('pending') ||
          status.includes('processing') ||
          status.includes('earning') ||
          status.includes('fallback extraction incomplete') ||
          (!offer.offerCode?.trim() && !offer.offerName?.trim()) ||
          (offer.offerName?.trim().toLowerCase() === 'unknown offer' && !offer.offerCode?.trim());
        return !isIncompleteFallback;
      });
      const offerRowsWithSailings = authoritativeOfferRows.filter((offer) => Boolean(offer.shipName?.trim() || offer.sailingDate?.trim()));
      const allowOfferRemoval = authoritativeOfferRows.length > 0;
      const allowCruiseRemoval = offerRowsWithSailings.length > 0;
      const allowBookedCruiseRemoval = normalizedBookedCruises.length > 0;
      const offersRequireCommit = allowOfferRemoval || preview.offers.new.length > 0 || preview.offers.updates.length > 0;
      const cruisesRequireCommit = allowCruiseRemoval || preview.cruises.new.length > 0 || preview.cruises.updates.length > 0;
      const bookingsRequireCommit = allowBookedCruiseRemoval || preview.bookedCruises.new.length > 0 || preview.bookedCruises.updates.length > 0;

      if (!allowOfferRemoval) {
        addLog(`⚠️ No authoritative ${config.loyaltyClubName} offer rows were captured, so existing offers and available sailings will be preserved`, 'warning');
      } else if (!allowCruiseRemoval) {
        addLog(`⚠️ ${config.loyaltyClubName} offers were captured without sailing detail, so existing available sailings will be preserved`, 'warning');
      }
      if (!allowBookedCruiseRemoval) {
        addLog(`⚠️ No booked cruise rows were captured for ${config.name}, so existing booked cruises will be preserved`, 'warning');
      }

      addLog('Applying sync...', 'info');
      assertSyncNotCancelled('before_apply');
      const { offers: rawOffers, cruises: rawCruises, bookedCruises: finalBookedCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        existingInventoryCruises,
        coreDataContext.bookedCruises,
        syncSource,
        {
          allowOfferRemoval,
          allowCruiseRemoval,
          allowBookedCruiseRemoval,
          targetOwnerProfileId: targetProfile?.id,
          includeUnownedRecords: isPrimarySyncTarget,
        }
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
      const referenceValidation = validateOfferCruiseReferences(finalOffers, finalCruises);
      addLog(
        `Referential check: ${referenceValidation.offerCount} offers, ${referenceValidation.cruiseCount} sailings, ${referenceValidation.linkedCruiseCount} linked sailing IDs`,
        referenceValidation.valid ? 'success' : 'error',
      );
      if (!referenceValidation.valid) {
        throw new Error(
          `SYNC_REFERENCE_VALIDATION_FAILED:dangling=${referenceValidation.danglingCruiseIds.length};duplicateCruises=${referenceValidation.duplicateCruiseIds.length};duplicateOffers=${referenceValidation.duplicateOfferIds.length}`,
        );
      }
      await yieldSyncUi();
      assertSyncNotCancelled('after_apply');

      const finalActiveBookedCruises = finalBookedCruises.filter(cruise => isActiveBookedCruise(cruise));
      const finalCourtesyHolds = finalBookedCruises.filter(cruise => isCourtesyHoldCruise(cruise));
      const finalCompletedCruises = finalBookedCruises.filter((cruise) => isCompletedBookedCruise(cruise));
      const finalRoyalCruiseRecords = finalBookedCruises.filter((cruise) => {
        const source = String(cruise.cruiseSource ?? '').toLowerCase();
        return source === syncSource || (!source && syncSource === 'royal');
      });
      const finalProviderActiveBookedCruises = finalRoyalCruiseRecords.filter((cruise) => isActiveBookedCruise(cruise));
      const finalProviderCourtesyHolds = finalRoyalCruiseRecords.filter((cruise) => isCourtesyHoldCruise(cruise));
      const finalProviderCompletedCruises = finalRoyalCruiseRecords.filter((cruise) => isCompletedBookedCruise(cruise));

      console.log('[RoyalCaribbeanSync] Sync applied. Final counts:', {
        offers: finalOffers.length,
        cruises: finalCruises.length,
        bookedCruises: finalBookedCruises.length,
        activeBookedCruises: finalActiveBookedCruises.length,
        courtesyHolds: finalCourtesyHolds.length,
        completedCruises: finalCompletedCruises.length,
      });

      console.log('[RoyalCaribbeanSync] Step: Persisting verified datasets as one batch...');
      addLog(
        `Saving ${finalOffers.length} offers, ${finalCruises.length} available sailings, and ${finalBookedCruises.length} booked/history rows`,
        'info',
      );
      assertSyncNotCancelled('before_dataset_batch');
      assertSyncOwnership('dataset batch persistence');
      // Retain the dataset-specific ownership gate and diagnostics used by the
      // release audit while the physical writes run in one parallel batch.
      assertSyncOwnership('offer persistence');
      if (!offersRequireCommit) {
        addLog('✅ COMMIT_OFFERS skipped — no authoritative new offer data; existing local rows were left untouched.', 'success');
      }
      if (!cruisesRequireCommit) {
        addLog('✅ COMMIT_AVAILABLE_CRUISES skipped — no authoritative new sailing data; existing local rows were left untouched.', 'success');
      }
      if (!bookingsRequireCommit) {
        addLog('✅ COMMIT_BOOKINGS_HISTORY skipped — no authoritative booking/history data; existing local rows were left untouched.', 'success');
      }
      datasetWritesStarted = offersRequireCommit || cruisesRequireCommit || bookingsRequireCommit;
      const datasetCommitTimestamp = new Date().toISOString();
      const datasetCommitOptions = (datasetName: string) => ({
        updateLastSync: false,
        markImportedData: false,
        syncTimestamp: datasetCommitTimestamp,
        runId: `${transactionManifest!.runId}:${datasetName}`,
      });
      let lastCruiseProgressPublishedAt = 0;
      const cruiseCommitOptions = {
        ...datasetCommitOptions('cruises'),
        shouldAbort: () => syncStopRequestedRef.current,
        onCruiseInventoryProgress: (progress: { processedRows: number; totalRows: number; provider: string }) => {
          const now = Date.now();
          if (progress.processedRows !== progress.totalRows && now - lastCruiseProgressPublishedAt < 300) return;
          lastCruiseProgressPublishedAt = now;
          setState((previous) => ({
            ...previous,
            progress: {
              current: progress.processedRows,
              total: progress.totalRows,
              stepName: `Saving ${progress.provider} cruise inventory ${progress.processedRows.toLocaleString()} / ${progress.totalRows.toLocaleString()}`,
            },
          }));
        },
      };
      await Promise.all([
        offersRequireCommit
          ? runBoundedSyncCheckpoint('COMMIT_OFFERS', () => coreDataContext.setCasinoOffers(finalOffers, datasetCommitOptions('offers')), addLog, 45000)
          : Promise.resolve(),
        cruisesRequireCommit
          ? runBoundedSyncCheckpoint('COMMIT_AVAILABLE_CRUISES', () => coreDataContext.setCruises(finalCruises, cruiseCommitOptions), addLog, 45000)
          : Promise.resolve(),
        bookingsRequireCommit
          ? runBoundedSyncCheckpoint('COMMIT_BOOKINGS_HISTORY', () => coreDataContext.setBookedCruises(finalBookedCruises, datasetCommitOptions('bookedCruises')), addLog, 45000)
          : Promise.resolve(),
      ]);
      if (datasetWritesStarted) {
        await runBoundedSyncCheckpoint(
          'COMMIT_SYNC_METADATA',
          () => coreDataContext.finalizeLocalSyncMetadata(datasetCommitTimestamp),
          addLog,
          10000,
        );
      }
      await yieldSyncUi();
      assertSyncNotCancelled('after_dataset_writes');
      addLog('✅ Offers, available cruises, and booked cruises persisted', 'success');

      // Manifest updates are deliberately small bounded fingerprints. They run
      // after the parallel data writes so they do not lengthen the UI-blocking
      // portion of a 2,500+ sailing sync.
      transactionManifest = await runBoundedSyncCheckpoint(
        'RECORD_DATASETS_TRANSACTION',
        () => recordSyncDatasets(transactionManifest!, {
          offers: finalOffers,
          cruises: finalCruises,
          bookedCruises: finalBookedCruises,
        }),
        addLog,
        15000,
      );
      activeSyncTransactionRef.current = transactionManifest;

      assertSyncOwnership('storage readback');
      await yieldSyncUi();
      await Promise.all([
        runBoundedSyncCheckpoint('READBACK_OFFERS', () => readBackPersistedRows(ALL_STORAGE_KEYS.CASINO_OFFERS, finalOffers, 'offer'), addLog, 30000),
        runBoundedSyncCheckpoint('READBACK_AVAILABLE_CRUISES', () => readBackCruiseInventory(coreDataContext, finalCruises.length), addLog, 30000),
        runBoundedSyncCheckpoint('READBACK_BOOKINGS_AND_HISTORY', () => readBackPersistedRows(ALL_STORAGE_KEYS.BOOKED_CRUISES, finalBookedCruises, 'booked-cruise'), addLog, 30000),
      ]);
      assertSyncNotCancelled('after_readback');
      addLog('✅ LOCAL_DATA_READBACK_COMPLETE', 'success');
      assertSyncNotCancelled('before_loyalty');

      if (syncSource === 'royal' && isPrimarySyncTarget && preview.loyalty) {
        const loyaltyPreview = preview.loyalty;
        try {
          if (loyaltyPreview.clubRoyalePoints.changed) {
            addLog(`Updating Club Royale points: ${loyaltyPreview.clubRoyalePoints.current} → ${loyaltyPreview.clubRoyalePoints.synced}`, 'info');
            await runBoundedSyncCheckpoint('LOYALTY_CLUB_ROYALE', () => loyaltyContext.setManualClubRoyalePoints(loyaltyPreview.clubRoyalePoints.synced), addLog, 20000);
          }
          
          if (loyaltyPreview.crownAndAnchorPoints.changed) {
            addLog(`Updating Crown & Anchor points: ${loyaltyPreview.crownAndAnchorPoints.current} → ${loyaltyPreview.crownAndAnchorPoints.synced}`, 'info');
            await runBoundedSyncCheckpoint('LOYALTY_CROWN_AND_ANCHOR', () => loyaltyContext.setManualCrownAnchorPoints(loyaltyPreview.crownAndAnchorPoints.synced), addLog, 20000);
          }
        } catch (loyaltyError) {
          console.error('[RoyalCaribbeanSync] Error updating loyalty points:', loyaltyError);
          addLog(`⚠️ Warning: Failed to update loyalty points: ${String(loyaltyError)}`, 'warning');
        }
      } else if (syncSource !== 'carnival' && !isPrimarySyncTarget) {
        addLog('Secondary profile selected — loyalty totals will be saved to that profile only', 'info');
      }
      
      if (syncSource !== 'carnival' && isPrimarySyncTarget && effectiveExtendedLoyalty && loyaltyContext.setExtendedLoyaltyData) {
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
          
          await runBoundedSyncCheckpoint('LOYALTY_EXTENDED', () => loyaltyContext.setExtendedLoyaltyData(effectiveExtendedLoyalty), addLog, 20000);
          addLog('Extended loyalty data synced successfully', 'success');
        } catch (extLoyaltyError) {
          console.error('[RoyalCaribbeanSync] Error syncing extended loyalty:', extLoyaltyError);
          addLog(`⚠️ Warning: Failed to sync extended loyalty data: ${String(extLoyaltyError)}`, 'warning');
        }
      } else if (syncSource !== 'carnival' && !effectiveExtendedLoyalty) {
        addLog('⚠️ No extended loyalty payload available at sync time', 'warning');
      }

      // Sync user profile data: name from passenger data + loyalty numbers/tiers
      if (syncSource !== 'carnival' && targetProfile && updateUserProfile) {
        try {
          const profileUpdates: Record<string, unknown> = {};

          // Extract name from first booked cruise's primary passenger (rawBooking first, then top-level)
          const firstExtracted = state.extractedBookedCruises[0] as any;
          const rawBooking = firstExtracted?.rawBooking;
          const primaryPassenger =
            rawBooking?.passengers?.[0] ??
            rawBooking?.passengersInStateroom?.[0] ??
            firstExtracted?.passengers?.[0] ??
            firstExtracted?.passengersInStateroom?.[0];
          if (primaryPassenger?.firstName || primaryPassenger?.lastName) {
            const fullName = [primaryPassenger.firstName, primaryPassenger.lastName]
              .filter((s: string | undefined) => typeof s === 'string' && s.trim().length > 0)
              .join(' ')
              .trim();
            if (fullName.length > 1) {
              profileUpdates.name = fullName;
              profileUpdates.displayName = fullName;
              addLog(`  → Name: ${fullName}`, 'info');
            }
          }

          // Extract Crown & Anchor number from extended loyalty data
          const syncedClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi ?? (state.loyaltyData?.clubRoyalePoints ? parseInt(String(state.loyaltyData.clubRoyalePoints).replace(/,/g, ''), 10) : undefined);
          if (typeof syncedClubRoyalePoints === 'number' && Number.isFinite(syncedClubRoyalePoints)) {
            profileUpdates.clubRoyalePoints = syncedClubRoyalePoints;
            addLog(`  → Club Royale points: ${syncedClubRoyalePoints.toLocaleString()}`, 'info');
          }

          const syncedClubRoyaleTier = effectiveExtendedLoyalty?.clubRoyaleTierFromApi ?? state.loyaltyData?.clubRoyaleTier;
          if (syncedClubRoyaleTier && syncedClubRoyaleTier.trim().length > 0) {
            const normalizedSyncedTier = normalizeClubRoyaleTier(syncedClubRoyaleTier);
            if (normalizedSyncedTier) {
              const tierConfirmationTimestamp = new Date();
              profileUpdates.clubRoyaleTier = normalizedSyncedTier;
              profileUpdates.clubRoyaleTierValidThrough = inferClubRoyaleTierValidThrough(
                normalizedSyncedTier,
                syncedClubRoyalePoints ?? 0,
                tierConfirmationTimestamp,
              );
              profileUpdates.clubRoyaleTierConfirmedAt = tierConfirmationTimestamp.toISOString();
              addLog(`  → Club Royale tier: ${normalizedSyncedTier} (retained through ${profileUpdates.clubRoyaleTierValidThrough})`, 'info');
            }
          }

          const cAndAId = effectiveExtendedLoyalty?.crownAndAnchorId;
          if (cAndAId && cAndAId.trim().length > 0) {
            profileUpdates.crownAnchorNumber = cAndAId.trim();
            profileUpdates.royalCaribbeanNumber = cAndAId.trim();
            addLog(`  → Crown & Anchor #: ${cAndAId.trim()}`, 'info');
          }

          const syncedCrownAnchorPoints = effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi ?? (state.loyaltyData?.crownAndAnchorPoints ? parseInt(String(state.loyaltyData.crownAndAnchorPoints).replace(/,/g, ''), 10) : undefined);
          if (typeof syncedCrownAnchorPoints === 'number' && Number.isFinite(syncedCrownAnchorPoints)) {
            profileUpdates.loyaltyPoints = syncedCrownAnchorPoints;
            addLog(`  → Crown & Anchor points: ${syncedCrownAnchorPoints.toLocaleString()}`, 'info');
          }

          const cAndALevel = effectiveExtendedLoyalty?.crownAndAnchorTier;
          if (cAndALevel && cAndALevel.trim().length > 0) {
            profileUpdates.crownAnchorLevel = cAndALevel.trim();
            addLog(`  → Crown & Anchor level: ${cAndALevel.trim()}`, 'info');
          }

          // Sync Celebrity loyalty numbers to user profile
          if (effectiveExtendedLoyalty) {
            if (typeof effectiveExtendedLoyalty.captainsClubPoints === 'number') {
              profileUpdates.celebrityCaptainsClubPoints = effectiveExtendedLoyalty.captainsClubPoints;
              addLog(`  → Captain's Club points: ${effectiveExtendedLoyalty.captainsClubPoints}`, 'info');
            }
            if (effectiveExtendedLoyalty.captainsClubTier) {
              profileUpdates.celebrityCaptainsClubTier = effectiveExtendedLoyalty.captainsClubTier;
              addLog(`  → Captain's Club reported tier: ${effectiveExtendedLoyalty.captainsClubTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.captainsClubId) {
              profileUpdates.celebrityCaptainsClubNumber = effectiveExtendedLoyalty.captainsClubId;
            }
            if (typeof effectiveExtendedLoyalty.celebrityBlueChipPoints === 'number') {
              profileUpdates.celebrityBlueChipPoints = effectiveExtendedLoyalty.celebrityBlueChipPoints;
              addLog(`  → Blue Chip points: ${effectiveExtendedLoyalty.celebrityBlueChipPoints}`, 'info');
            }
            if (effectiveExtendedLoyalty.celebrityBlueChipTier) {
              profileUpdates.celebrityBlueChipTier = effectiveExtendedLoyalty.celebrityBlueChipTier;
              addLog(`  → Blue Chip tier: ${effectiveExtendedLoyalty.celebrityBlueChipTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyTier) {
              profileUpdates.silverseaVenetianTier = effectiveExtendedLoyalty.venetianSocietyTier;
              addLog(`  → Venetian Society tier: ${effectiveExtendedLoyalty.venetianSocietyTier}`, 'info');
            }
            if (effectiveExtendedLoyalty.venetianSocietyMemberNumber) {
              profileUpdates.silverseaVenetianNumber = effectiveExtendedLoyalty.venetianSocietyMemberNumber;
            }
          }

          if (syncSource === 'royal') {
            profileUpdates.preferredBrand = 'royal';
          } else if (syncSource === 'celebrity') {
            profileUpdates.preferredBrand = 'celebrity';
          }

          if (Object.keys(profileUpdates).length > 0) {
            addLog(`Syncing ${targetSlotLabel.toLowerCase()} profile from loyalty data...`, 'info');
            await runBoundedSyncCheckpoint('PROFILE_UPDATE', () => updateUserProfile(targetProfile.id, profileUpdates as any), addLog, 20000);
            addLog(`✅ ${targetSlotLabel} profile updated from sync`, 'success');
          } else {
            addLog('ℹ️ No passenger or loyalty profile fields found to update', 'info');
          }
        } catch (profileSyncError) {
          console.error('[RoyalCaribbeanSync] Error syncing user profile:', profileSyncError);
          addLog(`⚠️ Could not sync user profile data: ${String(profileSyncError)}`, 'warning');
        }
      }

      if (cruiseLine === 'carnival' && carnivalUserDataRef.current) {
        try {
          const carnivalData = carnivalUserDataRef.current;
          addLog('Syncing Carnival VIFP loyalty data to user profile...', 'info');
          console.log('[CarnivalSync] Writing Carnival loyalty to user profile:', carnivalData);

          if (targetProfile && updateUserProfile) {
            console.log('[CarnivalSync] Using UserProvider.updateUser for userId:', targetProfile.id);
            await runBoundedSyncCheckpoint('CARNIVAL_PROFILE_UPDATE', () => updateUserProfile(targetProfile.id, {
              carnivalVifpNumber: carnivalData.vifpNumber,
              carnivalVifpTier: carnivalData.vifpTier,
              carnivalVifpPoints: Number(carnivalData.vifpPoints || 0) || 0,
              carnivalCruiseDayPoints: Number(carnivalData.cruiseDayPoints || 0) || 0,
              carnivalCruiseCount: Number(carnivalData.cruiseCount || 0) || 0,
              preferredBrand: 'carnival',
            }), addLog, 20000);
            console.log('[CarnivalSync] Carnival loyalty data saved via UserProvider');
          } else {
            console.warn('[CarnivalSync] No currentUser available, falling back to direct AsyncStorage write');
            const scopedUsersKey = getUserScopedKey(ALL_STORAGE_KEYS.USERS, authenticatedEmail);
            const scopedCurrentUserKey = getUserScopedKey(ALL_STORAGE_KEYS.CURRENT_USER, authenticatedEmail);
            const usersRawValue = await quotaSafeGetJsonItem<unknown>(scopedUsersKey, null);
            const usersRaw = usersRawValue === null ? null : JSON.stringify(usersRawValue);
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
                        carnivalVifpPoints: Number(carnivalData.vifpPoints || 0) || 0,
                        carnivalCruiseDayPoints: Number(carnivalData.cruiseDayPoints || 0) || 0,
                        carnivalCruiseCount: Number(carnivalData.cruiseCount || 0) || 0,
                        preferredBrand: 'carnival',
                        updatedAt: new Date().toISOString(),
                      }
                    : u
                );
                await quotaSafeSetJsonItem(scopedUsersKey, updatedUsers);
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

      assertSyncNotCancelled('after_profile');
      assertSyncNotCancelled('before_commit');
      transactionManifest = await runBoundedSyncCheckpoint(
        'FINALIZE_LOCAL_TRANSACTION',
        () => commitSyncTransaction(transactionManifest!),
        addLog,
        10000,
      );
      localTransactionCommitted = true;
      activeSyncTransactionRef.current = null;
      addLog(`✅ LOCAL TRANSACTION COMMITTED (${transactionManifest.runId})`, 'success');
      await yieldSyncUi();

      const carnivalOutcome = syncSource === 'carnival' ? state.syncCounts?.carnivalOutcome : undefined;
      const finalStatus: SyncStatus = carnivalOutcome === 'partial'
        ? 'partial'
        : carnivalOutcome === 'complete_with_warnings'
          ? 'complete_with_warnings'
          : syncSource !== 'carnival' && handoffEvidence.unaccountedRows > 0
            ? 'complete_with_warnings'
            : 'complete';
      console.log('[RoyalCaribbeanSync] Setting final sync status:', finalStatus);
      addLog(finalStatus === 'complete' ? '✅ Data synced successfully to app!' : '⚠️ Carnival data was saved with incomplete evidence clearly marked.', finalStatus === 'complete' ? 'success' : 'warning');
      
      // Set complete status immediately - don't wait for refresh
      setState(prev => ({ 
        ...prev, 
        status: finalStatus,
        lastSyncTimestamp: new Date().toISOString(),
        syncCounts: {
          offerCount: incomingUniqueOfferCount,
          offerRows: normalizedOffers.length,
          upcomingCruises: finalProviderActiveBookedCruises.length,
          courtesyHolds: finalProviderCourtesyHolds.length,
          completedCruises: finalProviderCompletedCruises.length,
          bookedCruises: finalProviderActiveBookedCruises.length,
          totalImportedCruises: finalRoyalCruiseRecords.length,
          rawRowsReceived: counts.rawRowsReceived,
          canonicalRows: counts.canonicalRows,
          retainedVariants: counts.retainedVariants,
          consolidatedDuplicates: counts.consolidatedDuplicates,
          rejectedRows: counts.rejectedRows,
          insertedRows: counts.insertedRows,
          updatedRows: counts.updatedRows,
          unchangedRows: counts.unchangedRows,
          royalHandoffEvidence: handoffEvidence,
          ...(syncSource === 'carnival' ? {
            carnivalOutcome,
            carnivalCollections: state.syncCounts?.carnivalCollections,
            carnivalRateCodes: carnivalRateCodesRef.current,
          } : {}),
        }
      }));
      addLog('✅ LOCAL_COMMIT_COMPLETE — EasySeas data is saved on this device.', 'success');

      // EasySeas is local-first. Provider syncs are complete after verified
      // on-device persistence and never require the optional EasySeas backend.
      // Users may invoke manual cloud backup from Settings when desired.
      addLog('Local-only sync complete. No backend connection was required.', 'success');

      if (syncSource === 'carnival' && carnivalOutcome !== 'partial') {
        try {
          await runBoundedSyncCheckpoint('CLEAR_CARNIVAL_CHECKPOINT', () => clearCarnivalSyncCheckpoint(authenticatedEmail), addLog, 10000);
          setState((prev) => ({ ...prev, hasResumableCarnivalCheckpoint: false }));
        } catch (checkpointClearError) {
          console.warn('[CarnivalSync] Could not clear completed checkpoint:', checkpointClearError);
          addLog('Carnival data was saved, but the local resume checkpoint could not be cleared.', 'warning');
        }
      }
      
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
      const wasCancelled = errorMessage.startsWith('SYNC_CANCELLED:');
      const transactionToAbort = activeSyncTransactionRef.current ?? transactionManifest;
      activeSyncTransactionRef.current = null;
      if (datasetWritesStarted && !localTransactionCommitted) {
        addLog('Restoring the previously committed local datasets after the interrupted sync...', 'warning');
        try {
          await Promise.all([
            runBoundedSyncCheckpoint('ROLLBACK_OFFERS', () => coreDataContext.setCasinoOffers(rollbackSnapshot.offers), addLog, 45000),
            runBoundedSyncCheckpoint('ROLLBACK_AVAILABLE_CRUISES', () => coreDataContext.setCruises(rollbackSnapshot.cruises), addLog, 45000),
            runBoundedSyncCheckpoint('ROLLBACK_BOOKINGS', () => coreDataContext.setBookedCruises(rollbackSnapshot.bookedCruises), addLog, 45000),
          ]);
          addLog('✅ Previous local data restored; no partial sync was published.', 'success');
        } catch (rollbackError) {
          console.error('[RoyalCaribbeanSync] Dataset rollback failed:', rollbackError);
          addLog(`⚠️ Local rollback needs attention: ${String(rollbackError)}`, 'error');
        }
      }
      await runBoundedSyncCheckpoint(
        'ABORT_LOCAL_TRANSACTION',
        () => abortSyncTransaction(transactionToAbort, error),
        addLog,
        5000,
      ).catch(() => undefined);
      if (wasCancelled) {
        addLog('Sync stopped safely. Previously saved local data remains available.', 'warning');
        if (syncSource !== 'carnival') {
          setState((prev) => ({ ...prev, status: 'logged_in', error: null, syncCounts: null }));
        }
        return;
      }
      if (syncSource === 'carnival') {
        void preserveCarnivalFailureCheckpoint(
          'application_persistence',
          extractedOffersRef.current,
          state.extractedBookedCruises,
        ).then((checkpointStatus) => {
          if (checkpointStatus === 'saved') {
            setState((prev) => ({ ...prev, status: 'resumable', error: `Carnival sync could not be verified. Previous saved data is still available. (${errorMessage})`, hasResumableCarnivalCheckpoint: true }));
            addLog('Carnival sync could not be verified. Previous saved data remains active and source evidence was saved for a safe retry.', 'warning');
          } else if (checkpointStatus === 'failed') {
            setState((prev) => ({ ...prev, status: 'logged_in', error: `Carnival sync failed, but the rest of EasySeas remains usable. (${errorMessage})` }));
            addLog(`Carnival sync failed, but the rest of EasySeas remains usable: ${errorMessage}`, 'error');
          } else {
            setState((prev) => ({ ...prev, status: 'logged_in', error: 'Carnival sync stopped because the active account changed. Previous data remains available.' }));
          }
        });
        return;
      }
      console.log('[RoyalCaribbeanSync] Sync failed safely; restoring an interactive state...');
      setState(prev => ({
        ...prev,
        status: 'logged_in',
        error: `Sync could not be verified. Previous saved data is still available. (${errorMessage})`,
      }));
      addLog(`❌ Sync could not be verified: ${errorMessage}`, 'error');
      addLog('Previous saved data remains available and the rest of EasySeas is still usable.', 'warning');
    } finally {
      if (activeSyncTransactionRef.current?.runId === transactionManifest?.runId) {
        activeSyncTransactionRef.current = null;
      }
      syncToAppInFlightRef.current = false;
    }
  }, [state.extractedBookedCruises, state.loyaltyData, state.syncCounts, extendedLoyaltyData, addLog, assertSyncOwnership, cruiseLine, authenticatedEmail, currentUser, users, updateUserProfile, normalizeBookedCruiseRows, normalizeOfferRows, preserveCarnivalFailureCheckpoint, readBackPersistedRows, readBackCruiseInventory, publishExtractedOffers]);

  const resumeCarnivalSync = useCallback(async () => {
    if (cruiseLine !== 'carnival') {
      return;
    }
    const checkpoint = await loadCarnivalSyncCheckpoint(authenticatedEmail);
    if (!checkpoint) {
      addLog('No resumable Carnival sync checkpoint was found for this account.', 'warning');
      setState((prev) => ({ ...prev, hasResumableCarnivalCheckpoint: false }));
      return;
    }

    const validation = validateCarnivalSyncCheckpoint(
      checkpoint,
      currentUser?.id,
      createCarnivalAccountFingerprint(currentUser?.carnivalVifpNumber),
      createCarnivalOwnerFingerprint(currentUser?.id, authenticatedEmail),
    );
    if (!validation.valid) {
      await clearCarnivalSyncCheckpoint(authenticatedEmail);
      setState((prev) => ({ ...prev, status: 'logged_in', hasResumableCarnivalCheckpoint: false }));
      const reason = validation.reason === 'account_mismatch'
        ? 'it belongs to a different Carnival account'
        : validation.reason === 'checkpoint_expired'
          ? 'it expired before a safe resume could be verified'
          : validation.reason === 'owner_mismatch'
            ? 'it belongs to a different signed-in EasySeas account'
            : 'it belongs to a different EasySeas profile';
      addLog(`Rejected Carnival checkpoint: ${reason}.`, 'error');
      return;
    }
    if (validation.requiresAccountVerification) {
      addLog('This checkpoint needs VIFP account verification before its saved rows can be restored. Sign in to Carnival, then start a fresh sync; the checkpoint remains protected.', 'warning');
      return;
    }

    carnivalResumeCheckpointRef.current = checkpoint;
    setState((prev) => ({ ...prev, status: 'resumable', hasResumableCarnivalCheckpoint: true }));
    await runIngestion();
  }, [addLog, authenticatedEmail, cruiseLine, currentUser?.carnivalVifpNumber, currentUser?.id, runIngestion]);

  const cancelSync = useCallback(() => {
    // Do not unlock ingestion here. Resolve its active waits immediately and
    // let runIngestion's finally block release both the local and module-wide
    // locks after the cancelled job has actually unwound.
    syncStopRequestedRef.current = true;
    const activeTransaction = activeSyncTransactionRef.current;
    activeSyncTransactionRef.current = null;
    if (activeTransaction) {
      void abortSyncTransaction(activeTransaction, 'SYNC_CANCELLED_BY_USER').catch(() => undefined);
    }
    if (pageLoadResolver.current) {
      pageLoadResolver.current();
      pageLoadResolver.current = null;
    }
    if (carnivalSearchPageResolver.current) {
      const waiter = carnivalSearchPageResolver.current;
      carnivalSearchPageResolver.current = null;
      waiter.resolve({
        requestId: waiter.requestId,
        runId: '', offerCode: '', offerName: '', offerExpiry: '', perks: '',
        pageNumber: 1, pageSize: CARNIVAL_SEARCH_PAGE_SIZE,
        totalResults: 0, hasNextPage: false, rows: waiter.rows,
        error: 'cancelled',
      });
    }
    pendingNavigationTargetRef.current = null;
    Object.values(stepCompleteResolvers.current).forEach((resolve) => resolve());
    stepCompleteResolvers.current = {};
    if (cruiseLine === 'carnival') {
      carnivalSyncCancelledRef.current = true;
      setState(prev => ({ ...prev, status: 'cancelled', hasResumableCarnivalCheckpoint: false }));
      addLog('Carnival sync cancellation requested. Saving a resumable checkpoint...', 'warning');
      void preserveCarnivalFailureCheckpoint(
        'cancelled_by_user',
        extractedOffersRef.current,
        state.extractedBookedCruises,
      ).then((checkpointStatus) => {
        if (checkpointStatus === 'saved') {
          setState((prev) => ({ ...prev, status: 'resumable', hasResumableCarnivalCheckpoint: true }));
          addLog('Carnival sync is safely paused and ready to resume.', 'success');
        } else if (checkpointStatus === 'failed') {
          setState((prev) => ({ ...prev, status: 'error', error: 'CARNIVAL_CHECKPOINT_SAVE_FAILED' }));
          addLog('Carnival sync was cancelled, but its checkpoint could not be saved.', 'error');
        }
      });
      return;
    }
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog, cruiseLine, preserveCarnivalFailureCheckpoint, state.extractedBookedCruises]);

  

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
    resumeCarnivalSync,
    handleWebViewMessage,
    addLog,
    getSyncLogs,
    extendedLoyaltyData,
    setExtendedLoyalty,
    staySignedIn,
    toggleStaySignedIn,
    webViewUrl,
    onPageLoaded
  }), [
    state, webViewRef, cruiseLine, setCruiseLine, config, openLogin, runIngestion,
    exportOffersCSV, exportBookedCruisesCSV, exportLog, resetState, syncToApp,
    cancelSync, resumeCarnivalSync, handleWebViewMessage, addLog, getSyncLogs, extendedLoyaltyData, setExtendedLoyalty,
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
