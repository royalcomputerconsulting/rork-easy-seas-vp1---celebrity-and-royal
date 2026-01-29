import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc, isBackendAvailable } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
import { STORAGE_KEYS } from "@/lib/storage/storageKeys";

const LAST_SYNC_KEY = "easyseas_last_cloud_sync";
const MAX_RETRY_ATTEMPTS = 2;
const MIN_SYNC_INTERVAL_MS = 60000;

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
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
  
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedEmailRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const lastSyncAttemptRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const hasInitializedRef = useRef(false);

  const saveAllMutation = trpc.data.saveAllUserData.useMutation();
  const { refetch: fetchAllUserData } = trpc.data.getAllUserData.useQuery(
    { email: authenticatedEmail || "" },
    { 
      enabled: false, 
      retry: false,
      staleTime: Infinity,
      gcTime: Infinity,
    }
  );

  const gatherAllLocalData = useCallback(async () => {
    console.log("[UserDataSync] Gathering all local data for sync...");
    
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
      };

      console.log("[UserDataSync] Gathered data:", {
        cruises: data.bookedCruises.length,
        offers: data.casinoOffers.length,
        events: data.calendarEvents.length,
        sessions: data.casinoSessions.length,
        hasProfile: !!data.clubRoyaleProfile,
        hasSettings: !!data.settings,
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

      if (cloudData.bookedCruises?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.BOOKED_CRUISES, JSON.stringify(cloudData.bookedCruises))
        );
      }
      if (cloudData.casinoOffers?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CASINO_OFFERS, JSON.stringify(cloudData.casinoOffers))
        );
      }
      if (cloudData.calendarEvents?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(cloudData.calendarEvents))
        );
      }
      if (cloudData.casinoSessions?.length > 0) {
        savePromises.push(
          AsyncStorage.setItem(STORAGE_KEYS.CASINO_SESSIONS, JSON.stringify(cloudData.casinoSessions))
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

      savePromises.push(
        AsyncStorage.setItem(STORAGE_KEYS.HAS_IMPORTED_DATA, "true")
      );

      await Promise.all(savePromises);

      console.log("[UserDataSync] Cloud data restored to local storage:", {
        cruises: cloudData.bookedCruises?.length ?? 0,
        offers: cloudData.casinoOffers?.length ?? 0,
        events: cloudData.calendarEvents?.length ?? 0,
        sessions: cloudData.casinoSessions?.length ?? 0,
      });

      return true;
    } catch (error) {
      console.error("[UserDataSync] Error restoring data to local:", error);
      return false;
    }
  }, []);

  const checkCloudDataExists = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return false;
    if (!isBackendAvailable()) {
      console.log("[UserDataSync] Backend not available, skipping cloud check");
      return false;
    }
    
    try {
      console.log("[UserDataSync] Checking if cloud data exists for:", email);
      const result = await fetchAllUserData();
      
      const exists = !!(result.data?.found && result.data.data);
      console.log("[UserDataSync] Cloud data exists:", exists);
      retryCountRef.current = 0;
      return exists;
    } catch (error) {
      console.log("[UserDataSync] Error checking cloud data (backend may be unavailable):", error);
      return false;
    }
  }, [fetchAllUserData]);

  const loadFromCloud = useCallback(async (): Promise<boolean> => {
    if (!authenticatedEmail) {
      console.log("[UserDataSync] No authenticated email, skipping cloud load");
      setInitialCheckComplete(true);
      return false;
    }

    if (!isBackendAvailable()) {
      console.log("[UserDataSync] Backend not available, skipping cloud load");
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
      const result = await fetchAllUserData();
      
      if (!isMountedRef.current) return false;
      
      if (result.data?.found && result.data.data) {
        console.log("[UserDataSync] Cloud data found, restoring...");
        setHasCloudData(true);
        
        const restored = await restoreDataToLocal(result.data.data);
        
        if (restored) {
          const syncTime = new Date().toISOString();
          setLastSyncTime(syncTime);
          await AsyncStorage.setItem(LAST_SYNC_KEY, syncTime);
          lastSyncedEmailRef.current = authenticatedEmail;
          retryCountRef.current = 0;
          console.log("[UserDataSync] Successfully loaded and restored cloud data");
          
          if (typeof window !== "undefined") {
            console.log("[UserDataSync] Emitting cloudDataRestored event");
            window.dispatchEvent(new CustomEvent("cloudDataRestored", { 
              detail: { email: authenticatedEmail } 
            }));
          }
          
          setInitialCheckComplete(true);
          return true;
        }
      } else {
        console.log("[UserDataSync] No cloud data found for this user");
        setHasCloudData(false);
        retryCountRef.current = 0;
      }
      
      setInitialCheckComplete(true);
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log("[UserDataSync] Cloud load error (backend may be unavailable):", errorMessage);
      retryCountRef.current += 1;
      
      // Don't set user-facing error for known backend issues
      if (!['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(errorMessage)) {
        setSyncError(errorMessage);
      }
      
      setInitialCheckComplete(true);
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [authenticatedEmail, fetchAllUserData, restoreDataToLocal]);

  const syncToCloud = useCallback(async () => {
    if (!authenticatedEmail) {
      console.log("[UserDataSync] No authenticated email, skipping cloud sync");
      return;
    }

    if (!isBackendAvailable()) {
      console.log("[UserDataSync] Backend not available, skipping cloud sync");
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
        localData.bookedCruises.length > 0 ||
        localData.casinoOffers.length > 0 ||
        localData.calendarEvents.length > 0 ||
        localData.casinoSessions.length > 0 ||
        localData.clubRoyaleProfile;

      if (!hasData) {
        console.log("[UserDataSync] No meaningful data to sync, skipping");
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
      
      console.log("[UserDataSync] Successfully synced to cloud");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log("[UserDataSync] Cloud sync error (backend may be unavailable):", errorMessage);
      retryCountRef.current += 1;
      
      // Don't set user-facing error for known backend issues
      if (!['BACKEND_NOT_CONFIGURED', 'BACKEND_TEMPORARILY_DISABLED', 'RATE_LIMITED', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(errorMessage)) {
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
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !authenticatedEmail) {
      console.log("[UserDataSync] User not authenticated, clearing sync state");
      setHasCloudData(false);
      setLastSyncTime(null);
      setInitialCheckComplete(false);
      lastSyncedEmailRef.current = null;
      hasInitializedRef.current = false;
      return;
    }

    if (hasInitializedRef.current && lastSyncedEmailRef.current === authenticatedEmail) {
      console.log("[UserDataSync] Already initialized for this email, skipping");
      return;
    }

    if (!isBackendAvailable()) {
      console.log("[UserDataSync] Backend not available, skipping initial sync");
      setInitialCheckComplete(true);
      hasInitializedRef.current = true;
      return;
    }

    console.log("[UserDataSync] New user login detected, loading cloud data...");
    hasInitializedRef.current = true;
    
    const initSync = async () => {
      const cloudLoaded = await loadFromCloud();
      
      // Only try to sync local data once if no cloud data and backend is still available
      if (!cloudLoaded && isBackendAvailable() && isMountedRef.current) {
        console.log("[UserDataSync] No cloud data, will sync local data after delay");
        const timeoutId = setTimeout(() => {
          if (isBackendAvailable() && isMountedRef.current) {
            syncToCloud();
          }
        }, 5000);
        
        return () => clearTimeout(timeoutId);
      }
    };

    initSync();
  }, [isAuthenticated, authenticatedEmail, loadFromCloud, syncToCloud]);

  // Removed automatic storage change listener to prevent continuous sync loops
  // Users can manually trigger sync via forceSyncNow() if needed
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
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
    syncError,
    hasCloudData,
    initialCheckComplete,
    syncToCloud,
    loadFromCloud,
    forceSyncNow,
    checkCloudDataExists,
  };
});
