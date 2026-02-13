import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc, trpcClient, isBackendReachable } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { clearAllAppData } from "@/lib/dataManager";
import { safeDispatchEvent } from "@/lib/safeEventDispatch";
import { logger } from "@/lib/logger";

const LAST_SYNC_KEY = "easyseas_last_cloud_sync";
const MAX_RETRY_ATTEMPTS = 1;
const MIN_SYNC_INTERVAL_MS = 60000;
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasCloudData, setHasCloudData] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [lastRestoreTime, setLastRestoreTime] = useState<string | null>(null);
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedEmailRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const lastSyncAttemptRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveAllMutation = trpc.data.saveAllUserData.useMutation({
    retry: false,
  });

  const fetchAllUserDataByEmail = useCallback(async (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    logger.log("[UserDataSync] Fetching cloud data for:", normalizedEmail);
    return trpcClient.data.getAllUserData.query({ email: normalizedEmail });
  }, []);

  const gatherAllLocalData = useCallback(async () => {
    logger.log("[UserDataSync] Gathering all local data for sync...");
    
    try {
      const [
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
        loyaltyDataRaw,
        bankrollDataRaw,
        celebrityEmailRaw,
        celebrityCCNumberRaw,
        celebrityCCPointsRaw,
        celebrityBlueChipRaw,
        crewEntriesRaw,
        crewSailingsRaw,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.BOOKED_CRUISES),
        AsyncStorage.getItem(STORAGE_KEYS.CASINO_OFFERS),
        AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS),
        AsyncStorage.getItem(STORAGE_KEYS.CASINO_SESSIONS),
        AsyncStorage.getItem(STORAGE_KEYS.CLUB_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.USER_POINTS),
        AsyncStorage.getItem(STORAGE_KEYS.CERTIFICATES),
        AsyncStorage.getItem(STORAGE_KEYS.ALERTS),
        AsyncStorage.getItem(STORAGE_KEYS.ALERT_RULES),
        AsyncStorage.getItem(STORAGE_KEYS.MY_SLOT_ATLAS),
        AsyncStorage.getItem("easyseas_loyalty_data"),
        AsyncStorage.getItem("easyseas_bankroll_data"),
        AsyncStorage.getItem(STORAGE_KEYS.CELEBRITY_EMAIL),
        AsyncStorage.getItem(STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_NUMBER),
        AsyncStorage.getItem(STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS),
        AsyncStorage.getItem(STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS),
        AsyncStorage.getItem(STORAGE_KEYS.CREW_RECOGNITION_ENTRIES),
        AsyncStorage.getItem(STORAGE_KEYS.CREW_RECOGNITION_SAILINGS),
      ]);

      const celebrityData = {
        email: celebrityEmailRaw || null,
        captainsClubNumber: celebrityCCNumberRaw || null,
        captainsClubPoints: celebrityCCPointsRaw ? parseInt(celebrityCCPointsRaw, 10) : 0,
        blueChipPoints: celebrityBlueChipRaw ? parseInt(celebrityBlueChipRaw, 10) : 0,
      };

      const data = {
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
        loyaltyData: loyaltyDataRaw ? JSON.parse(loyaltyDataRaw) : null,
        bankrollData: bankrollDataRaw ? JSON.parse(bankrollDataRaw) : null,
        celebrityData,
        crewRecognitionEntries: crewEntriesRaw ? JSON.parse(crewEntriesRaw) : [],
        crewRecognitionSailings: crewSailingsRaw ? JSON.parse(crewSailingsRaw) : [],
      };

      logger.log("[UserDataSync] Gathered data:", { cruises: data.bookedCruises.length, offers: data.casinoOffers.length });

      return data;
    } catch (error) {
      logger.error("[UserDataSync] Error gathering local data:", error);
      return null;
    }
  }, []);

  const restoreDataToLocal = useCallback(async (cloudData: any) => {
    logger.log("[UserDataSync] Restoring cloud data to local storage...");

    try {
      const savePromises: Promise<void>[] = [];

      if (cloudData.bookedCruises !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(cloudData.bookedCruises ?? []))
        );
      }
      if (cloudData.casinoOffers !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(cloudData.casinoOffers ?? []))
        );
      }
      if (cloudData.calendarEvents !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(cloudData.calendarEvents ?? []))
        );
      }
      if (cloudData.casinoSessions !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CASINO_SESSIONS, JSON.stringify(cloudData.casinoSessions ?? []))
        );
      }
      if (cloudData.clubRoyaleProfile) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CLUB_PROFILE, JSON.stringify(cloudData.clubRoyaleProfile))
        );
      }
      if (cloudData.settings) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cloudData.settings))
        );
      }
      if (cloudData.userPoints !== undefined && cloudData.userPoints > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.USER_POINTS, cloudData.userPoints.toString())
        );
      }
      if (cloudData.certificates?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(cloudData.certificates))
        );
      }
      if (cloudData.alerts?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(cloudData.alerts))
        );
      }
      if (cloudData.alertRules?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.ALERT_RULES, JSON.stringify(cloudData.alertRules))
        );
      }
      if (cloudData.slotAtlas?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.MY_SLOT_ATLAS, JSON.stringify(cloudData.slotAtlas))
        );
      }
      if (cloudData.loyaltyData) {
        savePromises.push(
          AsyncStorage.setItem("easyseas_loyalty_data", JSON.stringify(cloudData.loyaltyData))
        );
      }
      if (cloudData.bankrollData) {
        savePromises.push(
          AsyncStorage.setItem("easyseas_bankroll_data", JSON.stringify(cloudData.bankrollData))
        );
      }
      if (cloudData.celebrityData) {
        if (cloudData.celebrityData.email) {
          savePromises.push(
            AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_EMAIL, cloudData.celebrityData.email)
          );
        }
        if (cloudData.celebrityData.captainsClubNumber) {
          savePromises.push(
            AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_NUMBER, cloudData.celebrityData.captainsClubNumber)
          );
        }
        if (cloudData.celebrityData.captainsClubPoints) {
          savePromises.push(
            AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS, cloudData.celebrityData.captainsClubPoints.toString())
          );
        }
        if (cloudData.celebrityData.blueChipPoints) {
          savePromises.push(
            AsyncStorage.setItem(STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS, cloudData.celebrityData.blueChipPoints.toString())
          );
        }
      }

      if (cloudData.crewRecognitionEntries?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CREW_RECOGNITION_ENTRIES, JSON.stringify(cloudData.crewRecognitionEntries))
        );
      }
      if (cloudData.crewRecognitionSailings?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CREW_RECOGNITION_SAILINGS, JSON.stringify(cloudData.crewRecognitionSailings))
        );
      }

      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, "true")
      );

      await Promise.all(savePromises);

      logger.log("[UserDataSync] Cloud data restored to local storage");

      return true;
    } catch (error) {
      logger.error("[UserDataSync] Error restoring data to local:", error);
      return false;
    }
  }, []);

  const checkCloudDataExists = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return false;
    const reachable = await isBackendReachable();
    if (!reachable) {
      logger.log("[UserDataSync] Backend not reachable, skipping cloud check");
      return false;
    }

    try {
      logger.log("[UserDataSync] Checking cloud data for:", email);
      const result = await fetchAllUserDataByEmail(email);

      const exists = !!(result?.found && result.data);
      logger.log("[UserDataSync] Cloud data exists:", exists);
      retryCountRef.current = 0;
      return exists;
    } catch (error) {
      logger.log("[UserDataSync] Error checking cloud data:", error);
      return false;
    }
  }, [fetchAllUserDataByEmail]);

  const loadFromCloud = useCallback(async (): Promise<boolean> => {
    if (!authenticatedEmail) {
      logger.log("[UserDataSync] No authenticated email, skipping cloud load");
      setInitialCheckComplete(true);
      return false;
    }

    const reachable = await isBackendReachable();
    if (!reachable) {
      logger.log("[UserDataSync] Backend not reachable, skipping cloud load");
      setInitialCheckComplete(true);
      return false;
    }

    const now = Date.now();
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      logger.log("[UserDataSync] Max retry attempts reached, skipping");
      setInitialCheckComplete(true);
      return false;
    }

    if (now - lastSyncAttemptRef.current < MIN_SYNC_INTERVAL_MS) {
      logger.log("[UserDataSync] Too soon since last sync, skipping");
      setInitialCheckComplete(true);
      return false;
    }

    lastSyncAttemptRef.current = now;
    logger.log("[UserDataSync] Loading from cloud for:", authenticatedEmail);
    setIsSyncing(true);
    setSyncError(null);

    try {
      const pendingSwitch = await AsyncStorage.getItem(PENDING_ACCOUNT_SWITCH_KEY);
      if (pendingSwitch === "true") {
        logger.log("[UserDataSync] Pending account switch detected");
      }

      const result = await fetchAllUserDataByEmail(authenticatedEmail);

      if (!isMountedRef.current) return false;

      if (result?.found && result.data) {
        if (pendingSwitch === "true") {
          logger.log("[UserDataSync] Cloud data found for new account - clearing local data");
          await clearAllAppData();
          await AsyncStorage.removeItem(PENDING_ACCOUNT_SWITCH_KEY);
        }
        logger.log("[UserDataSync] Cloud data found, restoring...");
        setHasCloudData(true);

        const restored = await restoreDataToLocal(result.data);
        
        if (restored) {
          const syncTime = new Date().toISOString();
          setLastSyncTime(syncTime);
          setLastRestoreTime(syncTime);
          await AsyncStorage.setItem(LAST_SYNC_KEY, syncTime);
          lastSyncedEmailRef.current = authenticatedEmail;
          retryCountRef.current = 0;
          logger.log("[UserDataSync] Successfully loaded and restored cloud data");
          safeDispatchEvent("cloudDataRestored", { email: authenticatedEmail });
          
          setInitialCheckComplete(true);
          return true;
        }
      } else {
        logger.log("[UserDataSync] No cloud data found");
        setHasCloudData(false);
        retryCountRef.current = 0;
      }
      
      setInitialCheckComplete(true);
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.log("[UserDataSync] Cloud load error:", errorMessage);
      retryCountRef.current += 1;
      
      const isNetworkError = 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('AbortError') ||
        ['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(errorMessage);
      
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
  }, [authenticatedEmail, fetchAllUserDataByEmail, restoreDataToLocal]);

  const syncToCloud = useCallback(async () => {
    if (!authenticatedEmail) {
      logger.log("[UserDataSync] No authenticated email, skipping cloud sync");
      return;
    }

    const reachable = await isBackendReachable();
    if (!reachable) {
      console.log("[UserDataSync] Backend not reachable, skipping cloud sync");
      return;
    }

    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      logger.log("[UserDataSync] Max retry attempts reached, skipping");
      return;
    }

    const now = Date.now();
    if (now - lastSyncAttemptRef.current < MIN_SYNC_INTERVAL_MS) {
      logger.log("[UserDataSync] Too soon since last sync, skipping");
      return;
    }

    lastSyncAttemptRef.current = now;
    logger.log("[UserDataSync] Syncing to cloud for:", authenticatedEmail);
    setIsSyncing(true);
    setSyncError(null);

    try {
      const localData = await gatherAllLocalData();
      
      if (!localData || !isMountedRef.current) {
        logger.log("[UserDataSync] No local data to sync");
        return;
      }

      const hasData = 
        localData.bookedCruises.length > 0 ||
        localData.casinoOffers.length > 0 ||
        localData.calendarEvents.length > 0 ||
        localData.casinoSessions.length > 0 ||
        localData.clubRoyaleProfile;

      if (!hasData) {
        logger.log("[UserDataSync] No meaningful data to sync, skipping");
        return;
      }

      await saveAllMutation.mutateAsync({
        email: authenticatedEmail,
        ...localData,
      });

      if (!isMountedRef.current) return;

      const syncTime = new Date().toISOString();
      setLastSyncTime(syncTime);
      setHasCloudData(true);
      await AsyncStorage.setItem(LAST_SYNC_KEY, syncTime);
      lastSyncedEmailRef.current = authenticatedEmail;
      retryCountRef.current = 0;
      
      logger.log("[UserDataSync] Successfully synced to cloud");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.log("[UserDataSync] Cloud sync error:", errorMessage);
      retryCountRef.current += 1;
      
      const isNetworkError = 
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('AbortError') ||
        ['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(errorMessage);
      
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
  }, [authenticatedEmail, gatherAllLocalData, saveAllMutation]);

  const forceSyncNow = useCallback(async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    await syncToCloud();
  }, [syncToCloud]);

  useEffect(() => {
    isMountedRef.current = true;
    logger.log('[UserDataSync] Provider mounted');
    
    return () => {
      isMountedRef.current = false;

    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !authenticatedEmail) {
      logger.log("[UserDataSync] User not authenticated, clearing sync state");
      setHasCloudData(false);
      setLastSyncTime(null);
      setInitialCheckComplete(false);
      lastSyncedEmailRef.current = null;
      hasInitializedRef.current = false;
      return;
    }

    // On hot reload, if initialCheckComplete is false but hasInitialized is true, reset
    if (hasInitializedRef.current && !initialCheckComplete) {
      logger.log("[UserDataSync] Detected incomplete initialization, resetting");
      hasInitializedRef.current = false;
    }

    if (hasInitializedRef.current && lastSyncedEmailRef.current === authenticatedEmail) {

      return;
    }

    logger.log("[UserDataSync] New user login detected, checking backend...");
    hasInitializedRef.current = true;
    
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !initialCheckComplete) {
        logger.log("[UserDataSync] Safety timeout reached");
        setInitialCheckComplete(true);
      }
    }, 6000);
    
    const initSync = async () => {
      const reachable = await isBackendReachable();
      if (!reachable) {
        logger.log("[UserDataSync] Backend not reachable, skipping initial sync");
        setInitialCheckComplete(true);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        return;
      }

      const cloudLoaded = await loadFromCloud();
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (!cloudLoaded && isMountedRef.current) {
        logger.log("[UserDataSync] No cloud data, will sync local data after delay");
        const timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            syncToCloud();
          }
        }, 5000);
        
        return () => clearTimeout(timeoutId);
      }
    };

    initSync();
  }, [isAuthenticated, authenticatedEmail, loadFromCloud, syncToCloud, initialCheckComplete]);

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

  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNC_KEY).then((time) => {
      if (time) setLastSyncTime(time);
    });
  }, []);

  return {
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
  };
});
