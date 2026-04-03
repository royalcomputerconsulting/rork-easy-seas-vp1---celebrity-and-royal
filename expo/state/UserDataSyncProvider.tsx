import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc, trpcClient, isBackendReachable } from "@/lib/trpc";
import {
  getCloudUserDataFallback,
  isDirectCloudStoreConfigured,
  isDirectCloudStoreReachable,
  saveCloudUserDataFallback,
  type CloudUserDataPayload,
} from "@/lib/cloudUserDataStore";
import { useAuth } from "@/state/AuthProvider";
import { getUserScopedKey, ALL_STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { clearUserSpecificData } from "@/lib/storage/storageOperations";

const _BASE_LAST_SYNC_KEY = "easyseas_last_cloud_sync";
const MAX_RETRY_ATTEMPTS = 1;
const MIN_SYNC_INTERVAL_MS = 60000;
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";
const ASYNC_OPERATION_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

interface SyncedLoyaltyPayload {
  extendedLoyaltyData: unknown;
  manualClubRoyalePoints: number | null;
  manualCrownAnchorPoints: number | null;
}

function parseStoredNumber(value: string | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsedValue = parseInt(value, 10);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseUnknownNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = parseInt(value, 10);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  return null;
}

function normalizeSyncedLoyaltyPayload(loyaltyData: unknown): SyncedLoyaltyPayload | null {
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
      manualClubRoyalePoints: parseUnknownNumber(loyaltyRecord.manualClubRoyalePoints),
      manualCrownAnchorPoints: parseUnknownNumber(loyaltyRecord.manualCrownAnchorPoints),
    };
  }

  return {
    extendedLoyaltyData: loyaltyData,
    manualClubRoyalePoints: null,
    manualCrownAnchorPoints: null,
  };
}

function isNonBlockingCloudError(errorMessage: string): boolean {
  const BLOCKING_NEVER = true;
  if (BLOCKING_NEVER) return true;

  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('abort') ||
    lower.includes('websocket') ||
    lower.includes('connection') ||
    lower.includes('not_found') ||
    lower.includes('not found') ||
    lower.includes('internal server') ||
    lower.includes('database') ||
    lower.includes('surreal') ||
    lower.includes('offline') ||
    lower.includes('unavailable') ||
    lower.includes('configured') ||
    lower.includes('unreachable') ||
    ['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR', 'BACKEND_OFFLINE', 'DIRECT_CLOUD_STORE_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'DIRECT_CLOUD_STORE_NOT_CONFIGURED', 'DIRECT_CLOUD_STORE_TIMEOUT'].includes(errorMessage)
  );
}

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  lastRestoreTime: string | null;
  syncError: string | null;
  hasCloudData: boolean;
  initialCheckComplete: boolean;
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<boolean>;
  forceSyncNow: () => Promise<void>;
  checkCloudDataExists: (email: string) => Promise<boolean>;
}

export const [UserDataSyncProvider, useUserDataSync] = createContextHook((): SyncState => {
  const { authenticatedEmail, isAuthenticated } = useAuth();

  const emailRef = useRef<string | null>(authenticatedEmail);
  useEffect(() => { emailRef.current = authenticatedEmail; }, [authenticatedEmail]);
  const sk = (baseKey: string) => getUserScopedKey(baseKey, emailRef.current);
  const lastSyncKey = () => getUserScopedKey(_BASE_LAST_SYNC_KEY, emailRef.current);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasCloudData, setHasCloudData] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [lastRestoreTime, setLastRestoreTime] = useState<string | null>(null);
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedEmailRef = useRef<string | null>(null);
  const previousAuthenticatedEmailRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const lastSyncAttemptRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const initializationInFlightRef = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canUseCloudDataStoreRef = useRef<() => Promise<boolean>>(async () => false);
  const loadFromCloudRef = useRef<() => Promise<boolean>>(async () => false);
  const syncToCloudRef = useRef<() => Promise<void>>(async () => {});

  const saveAllMutation = trpc.data.saveAllUserData.useMutation({
    retry: false,
  });

  const canUseCloudDataStore = useCallback(async (): Promise<boolean> => {
    const backendReachable = await isBackendReachable();
    if (backendReachable) {
      return true;
    }

    if (!isDirectCloudStoreConfigured()) {
      console.log("[UserDataSync] Direct cloud store is not configured");
      return false;
    }

    const directCloudReachable = await isDirectCloudStoreReachable();
    console.log("[UserDataSync] Direct cloud store reachability:", directCloudReachable);
    return directCloudReachable;
  }, []);

  const saveAllUserDataToCloud = useCallback(async (payload: CloudUserDataPayload) => {
    try {
      return await saveAllMutation.mutateAsync(payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log("[UserDataSync] Primary cloud save failed, trying direct cloud store:", errorMessage);

      if (!isDirectCloudStoreConfigured()) {
        throw error;
      }

      return saveCloudUserDataFallback(payload);
    }
  }, [saveAllMutation]);

  const fetchAllUserDataByEmail = useCallback(async (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    console.log("[UserDataSync] Fetching cloud data for:", normalizedEmail);

    try {
      return await trpcClient.data.getAllUserData.query({ email: normalizedEmail });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log("[UserDataSync] Primary cloud fetch failed, trying direct cloud store:", errorMessage);

      if (!isDirectCloudStoreConfigured()) {
        throw error;
      }

      return getCloudUserDataFallback(normalizedEmail);
    }
  }, []);

  const gatherAllLocalData = useCallback(async () => {
    console.log("[UserDataSync] Gathering all local data for sync...");
    
    try {
      const [
        cruisesRaw,
        bookedCruisesRaw,
        casinoOffersRaw,
        calendarEventsRaw,
        casinoSessionsRaw,
        clubProfileRaw,
        settingsRaw,
        userPointsRaw,
        certificatesRaw,
        alertsRaw,
        alertRulesRaw,
        slotAtlasRaw,
        extendedLoyaltyDataRaw,
        manualClubRoyalePointsRaw,
        manualCrownAnchorPointsRaw,
        loyaltyDataRaw,
        bankrollDataRaw,
        celebrityEmailRaw,
        celebrityCCNumberRaw,
        celebrityCCPointsRaw,
        celebrityBlueChipRaw,
        crewEntriesRaw,
        crewSailingsRaw,
      ] = await Promise.all([
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CRUISES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.SETTINGS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.USER_POINTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CERTIFICATES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.ALERTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.ALERT_RULES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.LOYALTY_DATA)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.BANKROLL_DATA)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CELEBRITY_EMAIL)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_NUMBER)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS)),
      ]);

      const celebrityData = {
        email: celebrityEmailRaw || null,
        captainsClubNumber: celebrityCCNumberRaw || null,
        captainsClubPoints: celebrityCCPointsRaw ? parseInt(celebrityCCPointsRaw, 10) : 0,
        blueChipPoints: celebrityBlueChipRaw ? parseInt(celebrityBlueChipRaw, 10) : 0,
      };

      const parsedLegacyLoyaltyData = loyaltyDataRaw ? JSON.parse(loyaltyDataRaw) : null;
      const parsedExtendedLoyaltyData = extendedLoyaltyDataRaw ? JSON.parse(extendedLoyaltyDataRaw) : null;
      const manualClubRoyalePoints = parseStoredNumber(manualClubRoyalePointsRaw);
      const manualCrownAnchorPoints = parseStoredNumber(manualCrownAnchorPointsRaw);
      const normalizedLegacyLoyaltyData = normalizeSyncedLoyaltyPayload(parsedLegacyLoyaltyData);
      const loyaltyData = parsedExtendedLoyaltyData !== null
        || manualClubRoyalePoints !== null
        || manualCrownAnchorPoints !== null
        ? {
            extendedLoyaltyData: parsedExtendedLoyaltyData,
            manualClubRoyalePoints,
            manualCrownAnchorPoints,
          }
        : normalizedLegacyLoyaltyData;

      const data = {
        cruises: cruisesRaw ? JSON.parse(cruisesRaw) : [],
        bookedCruises: bookedCruisesRaw ? JSON.parse(bookedCruisesRaw) : [],
        casinoOffers: casinoOffersRaw ? JSON.parse(casinoOffersRaw) : [],
        calendarEvents: calendarEventsRaw ? JSON.parse(calendarEventsRaw) : [],
        casinoSessions: casinoSessionsRaw ? JSON.parse(casinoSessionsRaw) : [],
        clubRoyaleProfile: clubProfileRaw ? JSON.parse(clubProfileRaw) : null,
        settings: settingsRaw ? JSON.parse(settingsRaw) : null,
        userPoints: userPointsRaw ? parseInt(userPointsRaw, 10) : 0,
        certificates: certificatesRaw ? JSON.parse(certificatesRaw) : [],
        alerts: alertsRaw ? JSON.parse(alertsRaw) : [],
        alertRules: alertRulesRaw ? JSON.parse(alertRulesRaw) : [],
        slotAtlas: slotAtlasRaw ? JSON.parse(slotAtlasRaw) : [],
        loyaltyData,
        bankrollData: bankrollDataRaw ? JSON.parse(bankrollDataRaw) : null,
        celebrityData,
        crewRecognitionEntries: crewEntriesRaw ? JSON.parse(crewEntriesRaw) : [],
        crewRecognitionSailings: crewSailingsRaw ? JSON.parse(crewSailingsRaw) : [],
      };

      console.log("[UserDataSync] Gathered data:", {
        availableCruises: data.cruises.length,
        cruises: data.bookedCruises.length,
        offers: data.casinoOffers.length,
        events: data.calendarEvents.length,
        sessions: data.casinoSessions.length,
        hasProfile: !!data.clubRoyaleProfile,
        hasSettings: !!data.settings,
        crewEntries: data.crewRecognitionEntries.length,
        crewSailings: data.crewRecognitionSailings.length,
      });

      return data;
    } catch (error) {
      console.error("[UserDataSync] Error gathering local data:", error);
      return null;
    }
  }, []);

  const restoreDataToLocal = useCallback(async (cloudData: any) => {
    console.log("[UserDataSync] Restoring cloud data to local storage...");

    try {
      const savePromises: Promise<void>[] = [];

      if (cloudData.cruises !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CRUISES), JSON.stringify(cloudData.cruises ?? []))
        );
      }
      if (cloudData.bookedCruises !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES), JSON.stringify(cloudData.bookedCruises ?? []))
        );
      }
      if (cloudData.casinoOffers !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS), JSON.stringify(cloudData.casinoOffers ?? []))
        );
      }
      if (cloudData.calendarEvents !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS), JSON.stringify(cloudData.calendarEvents ?? []))
        );
      }
      if (cloudData.casinoSessions !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS), JSON.stringify(cloudData.casinoSessions ?? []))
        );
      }
      if (cloudData.clubRoyaleProfile) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE), JSON.stringify(cloudData.clubRoyaleProfile))
        );
      }
      if (cloudData.settings) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.SETTINGS), JSON.stringify(cloudData.settings))
        );
      }
      if (cloudData.userPoints !== undefined && cloudData.userPoints > 0) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.USER_POINTS), cloudData.userPoints.toString())
        );
      }
      if (cloudData.certificates?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CERTIFICATES), JSON.stringify(cloudData.certificates))
        );
      }
      if (cloudData.alerts?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.ALERTS), JSON.stringify(cloudData.alerts))
        );
      }
      if (cloudData.alertRules?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.ALERT_RULES), JSON.stringify(cloudData.alertRules))
        );
      }
      if (cloudData.slotAtlas?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS), JSON.stringify(cloudData.slotAtlas))
        );
      }
      if (cloudData.loyaltyData !== undefined) {
        const normalizedLoyaltyData = normalizeSyncedLoyaltyPayload(cloudData.loyaltyData);
        const extendedLoyaltyData = normalizedLoyaltyData?.extendedLoyaltyData ?? null;
        const manualClubRoyalePoints = normalizedLoyaltyData?.manualClubRoyalePoints ?? null;
        const manualCrownAnchorPoints = normalizedLoyaltyData?.manualCrownAnchorPoints ?? null;

        if (extendedLoyaltyData !== null) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA), JSON.stringify(extendedLoyaltyData))
          );
        } else {
          savePromises.push(AsyncStorage.removeItem(sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA)));
        }

        if (manualClubRoyalePoints !== null) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS), manualClubRoyalePoints.toString())
          );
        } else {
          savePromises.push(AsyncStorage.removeItem(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS)));
        }

        if (manualCrownAnchorPoints !== null) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS), manualCrownAnchorPoints.toString())
          );
        } else {
          savePromises.push(AsyncStorage.removeItem(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS)));
        }

        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.LOYALTY_DATA), JSON.stringify(cloudData.loyaltyData))
        );
      }
      if (cloudData.bankrollData) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.BANKROLL_DATA), JSON.stringify(cloudData.bankrollData))
        );
      }
      if (cloudData.celebrityData) {
        if (cloudData.celebrityData.email) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CELEBRITY_EMAIL), cloudData.celebrityData.email)
          );
        }
        if (cloudData.celebrityData.captainsClubNumber) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_NUMBER), cloudData.celebrityData.captainsClubNumber)
          );
        }
        if (cloudData.celebrityData.captainsClubPoints) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS), cloudData.celebrityData.captainsClubPoints.toString())
          );
        }
        if (cloudData.celebrityData.blueChipPoints) {
          savePromises.push(
            AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS), cloudData.celebrityData.blueChipPoints.toString())
          );
        }
      }

      if (cloudData.crewRecognitionEntries !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES), JSON.stringify(cloudData.crewRecognitionEntries ?? []))
        );
      }
      if (cloudData.crewRecognitionSailings !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS), JSON.stringify(cloudData.crewRecognitionSailings ?? []))
        );
      }

      savePromises.push(
        AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), "true")
      );

      await Promise.all(savePromises);

      console.log("[UserDataSync] Cloud data restored to local storage:", {
        availableCruises: cloudData.cruises?.length ?? 0,
        cruises: cloudData.bookedCruises?.length ?? 0,
        offers: cloudData.casinoOffers?.length ?? 0,
        events: cloudData.calendarEvents?.length ?? 0,
        sessions: cloudData.casinoSessions?.length ?? 0,
        crewEntries: cloudData.crewRecognitionEntries?.length ?? 0,
        crewSailings: cloudData.crewRecognitionSailings?.length ?? 0,
      });

      return true;
    } catch (error) {
      console.error("[UserDataSync] Error restoring data to local:", error);
      return false;
    }
  }, []);

  const checkCloudDataExists = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return false;
    const reachable = await canUseCloudDataStore();
    if (!reachable) {
      console.log("[UserDataSync] No cloud store is reachable, skipping cloud check");
      return false;
    }

    try {
      console.log("[UserDataSync] Checking if cloud data exists for:", email);
      const result = await fetchAllUserDataByEmail(email);

      const exists = !!(result?.found && result.data);
      console.log("[UserDataSync] Cloud data exists:", exists);
      retryCountRef.current = 0;
      return exists;
    } catch (error) {
      console.log("[UserDataSync] Error checking cloud data (backend may be unavailable):", error);
      return false;
    }
  }, [canUseCloudDataStore, fetchAllUserDataByEmail]);

  const loadFromCloud = useCallback(async (): Promise<boolean> => {
    if (!authenticatedEmail) {
      console.log("[UserDataSync] No authenticated email, skipping cloud load");
      setInitialCheckComplete(true);
      return false;
    }

    const pendingSwitchEarly = await withTimeout(
      AsyncStorage.getItem(PENDING_ACCOUNT_SWITCH_KEY),
      ASYNC_OPERATION_TIMEOUT_MS,
      '[UserDataSync] Reading pending account switch flag'
    );
    if (pendingSwitchEarly === "true") {
      console.log("[UserDataSync] Account switch detected early - clearing local user data regardless of backend status");
      await withTimeout(
        clearUserSpecificData(),
        ASYNC_OPERATION_TIMEOUT_MS,
        '[UserDataSync] Clearing local data for account switch'
      );
      await withTimeout(
        AsyncStorage.removeItem(PENDING_ACCOUNT_SWITCH_KEY),
        ASYNC_OPERATION_TIMEOUT_MS,
        '[UserDataSync] Removing pending account switch flag'
      );
      console.log("[UserDataSync] Local user data cleared for account switch (early)");
    }

    const reachable = await withTimeout(
      canUseCloudDataStore(),
      ASYNC_OPERATION_TIMEOUT_MS,
      '[UserDataSync] Checking cloud store reachability during cloud load'
    );
    if (!reachable) {
      console.log("[UserDataSync] No cloud store is reachable, skipping cloud load");
      setInitialCheckComplete(true);
      return false;
    }

    const now = Date.now();
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      console.log("[UserDataSync] Max retry attempts reached, skipping sync");
      setInitialCheckComplete(true);
      return false;
    }

    if (now - lastSyncAttemptRef.current < MIN_SYNC_INTERVAL_MS) {
      console.log("[UserDataSync] Too soon since last sync attempt, skipping");
      setInitialCheckComplete(true);
      return false;
    }

    lastSyncAttemptRef.current = now;
    console.log("[UserDataSync] Loading data from cloud for:", authenticatedEmail);
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await withTimeout(
        fetchAllUserDataByEmail(authenticatedEmail),
        ASYNC_OPERATION_TIMEOUT_MS,
        '[UserDataSync] Fetching cloud data'
      );

      if (!isMountedRef.current) return false;

      if (result?.found && result.data) {
        console.log("[UserDataSync] Cloud data found, restoring...");
        setHasCloudData(true);

        const restored = await withTimeout(
          restoreDataToLocal(result.data),
          ASYNC_OPERATION_TIMEOUT_MS,
          '[UserDataSync] Restoring cloud data to local storage'
        );
        
        if (restored) {
          const syncTime = new Date().toISOString();
          setLastSyncTime(syncTime);
          setLastRestoreTime(syncTime);
          await AsyncStorage.setItem(lastSyncKey(), syncTime);
          lastSyncedEmailRef.current = authenticatedEmail;
          retryCountRef.current = 0;
          console.log("[UserDataSync] Successfully loaded and restored cloud data");
          
          if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
            console.log("[UserDataSync] Emitting cloudDataRestored event");
            window.dispatchEvent(new CustomEvent("cloudDataRestored", { 
              detail: { email: authenticatedEmail } 
            }));
          }
          
          setInitialCheckComplete(true);
          return true;
        }
      } else {
        console.log("[UserDataSync] No cloud data found for this user - starting fresh");
        setHasCloudData(false);
        retryCountRef.current = 0;
      }
      
      setInitialCheckComplete(true);
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log("[UserDataSync] Cloud load error (backend may be unavailable):", errorMessage);
      retryCountRef.current += 1;
      
      const isNetworkError = isNonBlockingCloudError(errorMessage);
      
      if (!isNetworkError) {
        setSyncError(errorMessage);
      }
      
      setInitialCheckComplete(true);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [authenticatedEmail, canUseCloudDataStore, fetchAllUserDataByEmail, restoreDataToLocal]);
  loadFromCloudRef.current = loadFromCloud;

  const syncToCloud = useCallback(async () => {
    if (!authenticatedEmail) {
      console.log("[UserDataSync] No authenticated email, skipping cloud sync");
      return;
    }

    const reachable = await canUseCloudDataStore();
    if (!reachable) {
      console.log("[UserDataSync] No cloud store is reachable, skipping cloud sync");
      return;
    }

    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      console.log("[UserDataSync] Max retry attempts reached, skipping sync");
      return;
    }

    const now = Date.now();
    if (now - lastSyncAttemptRef.current < MIN_SYNC_INTERVAL_MS) {
      console.log("[UserDataSync] Too soon since last sync attempt, skipping");
      return;
    }

    lastSyncAttemptRef.current = now;
    console.log("[UserDataSync] Syncing data to cloud for:", authenticatedEmail);
    setIsSyncing(true);
    setSyncError(null);

    try {
      const localData = await gatherAllLocalData();
      
      if (!localData || !isMountedRef.current) {
        console.log("[UserDataSync] No local data to sync or component unmounted");
        return;
      }

      const hasData = 
        localData.cruises.length > 0 ||
        localData.bookedCruises.length > 0 ||
        localData.casinoOffers.length > 0 ||
        localData.calendarEvents.length > 0 ||
        localData.casinoSessions.length > 0 ||
        localData.clubRoyaleProfile ||
        localData.loyaltyData;

      if (!hasData) {
        console.log("[UserDataSync] No meaningful data to sync, skipping");
        return;
      }

      const payload: CloudUserDataPayload = {
        email: authenticatedEmail,
        ...localData,
      };

      await saveAllUserDataToCloud(payload);

      if (!isMountedRef.current) return;

      const syncTime = new Date().toISOString();
      setLastSyncTime(syncTime);
      setHasCloudData(true);
      await AsyncStorage.setItem(lastSyncKey(), syncTime);
      lastSyncedEmailRef.current = authenticatedEmail;
      retryCountRef.current = 0;
      
      console.log("[UserDataSync] Successfully synced to cloud");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log("[UserDataSync] Cloud sync error (backend may be unavailable):", errorMessage);
      retryCountRef.current += 1;
      
      const isNetworkError = isNonBlockingCloudError(errorMessage);
      
      if (!isNetworkError) {
        if (isMountedRef.current) {
          setSyncError(errorMessage);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [authenticatedEmail, canUseCloudDataStore, gatherAllLocalData, saveAllUserDataToCloud]);
  canUseCloudDataStoreRef.current = canUseCloudDataStore;
  syncToCloudRef.current = syncToCloud;

  const forceSyncNow = useCallback(async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    await syncToCloud();
  }, [syncToCloud]);

  useEffect(() => {
    isMountedRef.current = true;
    console.log('[UserDataSync] Provider mounted/remounted, resetting initialization');
    
    return () => {
      isMountedRef.current = false;
      console.log('[UserDataSync] Provider unmounting');
    };
  }, []);

  useEffect(() => {
    const normalizedAuthenticatedEmail = authenticatedEmail?.toLowerCase().trim() ?? null;
    const didAuthenticatedEmailChange = previousAuthenticatedEmailRef.current !== normalizedAuthenticatedEmail;

    if (didAuthenticatedEmailChange) {
      console.log('[UserDataSync] Authenticated email changed, resetting sync state', {
        previousEmail: previousAuthenticatedEmailRef.current,
        nextEmail: normalizedAuthenticatedEmail,
      });
      previousAuthenticatedEmailRef.current = normalizedAuthenticatedEmail;
      setHasCloudData(false);
      setLastSyncTime(null);
      setLastRestoreTime(null);
      setSyncError(null);
      setInitialCheckComplete(false);
      lastSyncedEmailRef.current = null;
      retryCountRef.current = 0;
      lastSyncAttemptRef.current = 0;
      hasInitializedRef.current = false;
      initializationInFlightRef.current = false;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      if (normalizedAuthenticatedEmail) {
        void AsyncStorage.getItem(getUserScopedKey(_BASE_LAST_SYNC_KEY, normalizedAuthenticatedEmail)).then((time) => {
          if (time && isMountedRef.current && previousAuthenticatedEmailRef.current === normalizedAuthenticatedEmail) {
            setLastSyncTime(time);
          }
        });
      }
    }

    if (!isAuthenticated || !normalizedAuthenticatedEmail) {
      console.log("[UserDataSync] User not authenticated, clearing sync state");
      return;
    }

    if (hasInitializedRef.current || initializationInFlightRef.current) {
      console.log("[UserDataSync] Initialization already started for this account, skipping duplicate run");
      return;
    }

    console.log("[UserDataSync] New user login detected, checking backend...");
    hasInitializedRef.current = true;
    initializationInFlightRef.current = true;

    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !initialCheckComplete) {
        console.log("[UserDataSync] Safety timeout reached - forcing initialCheckComplete");
        setInitialCheckComplete(true);
      }
    }, 6000);

    const initSync = async () => {
      try {
        const reachable = await withTimeout(
          canUseCloudDataStoreRef.current(),
          ASYNC_OPERATION_TIMEOUT_MS,
          '[UserDataSync] Checking cloud store reachability during initialization'
        );
        if (!reachable) {
          console.log("[UserDataSync] No cloud store is reachable, skipping initial sync");
          setInitialCheckComplete(true);
          return;
        }

        const cloudLoaded = await withTimeout(
          loadFromCloudRef.current(),
          ASYNC_OPERATION_TIMEOUT_MS + 2000,
          '[UserDataSync] Initial cloud restore'
        );

        if (!cloudLoaded && isMountedRef.current) {
          console.log("[UserDataSync] No cloud data, will sync local data after delay");
          const timeoutId = setTimeout(() => {
            if (isMountedRef.current) {
              void syncToCloudRef.current();
            }
          }, 5000);
          syncTimeoutRef.current = timeoutId;
        }
      } catch (error) {
        console.error('[UserDataSync] Initial sync failed:', error);
        if (isMountedRef.current) {
          setInitialCheckComplete(true);
        }
      } finally {
        initializationInFlightRef.current = false;
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
      }
    };

    void initSync();
  }, [authenticatedEmail, initialCheckComplete, isAuthenticated]);

  // Removed automatic storage change listener to prevent continuous sync loops
  // Users can manually trigger sync via forceSyncNow() if needed
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, []);

  return useMemo(() => ({
    isSyncing,
    lastSyncTime,
    lastRestoreTime,
    syncError,
    hasCloudData,
    initialCheckComplete,
    syncToCloud,
    loadFromCloud,
    forceSyncNow,
    checkCloudDataExists,
  }), [isSyncing, lastSyncTime, lastRestoreTime, syncError, hasCloudData, initialCheckComplete, syncToCloud, loadFromCloud, forceSyncNow, checkCloudDataExists]);
});
