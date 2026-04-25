import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { trpc, trpcClient, isBackendReachable } from "@/lib/trpc";
import { useAuth } from "@/state/AuthProvider";
import { getUserScopedKey, ALL_STORAGE_KEYS } from "@/lib/storage/storageKeys";
import { clearUserSpecificData } from "@/lib/storage/storageOperations";
import { buildOwnerScopeId, getInstallationId } from "@/lib/storage/installationId";
import { filterRecordsForOwner, isOwnerScopeForEmail, isScopedDynamicKeyForOwner, stampRecordsForOwner, toOwnerScopedDynamicKey } from "@/lib/storage/dataOwnership";

const _BASE_LAST_SYNC_KEY = "easyseas_last_cloud_sync";
const MAX_RETRY_ATTEMPTS = 1;
const MIN_SYNC_INTERVAL_MS = 60000;
const PENDING_ACCOUNT_SWITCH_KEY = "easyseas_pending_account_switch";
const ASYNC_OPERATION_TIMEOUT_MS = 8000;
const ALERTS_STORAGE_BASE = '@easy_seas_alerts';
const ALERT_RULES_STORAGE_BASE = '@easy_seas_alert_rules';
const DISMISSED_ALERT_IDS_STORAGE_BASE = '@easy_seas_dismissed_alerts';
const DISMISSED_ALERT_ENTITIES_STORAGE_BASE = '@easy_seas_dismissed_entities';
const SAILING_WEATHER_CACHE_STORAGE_BASE = '@easy_seas_sailing_weather_cache_v1';
const CASINO_OPEN_HOURS_STORAGE_PREFIX = `${ALL_STORAGE_KEYS.CASINO_OPEN_HOURS}_`;

function parseStoredJson<T>(value: string | null, fallback: T, label: string): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[UserDataSync] Failed to parse ${label}:`, error);
    return fallback;
  }
}

async function loadStoredEntriesByPrefix(prefix: string, email: string | null): Promise<Record<string, string>> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = allKeys.filter((key) => isScopedDynamicKeyForOwner(key, prefix, email));

    if (matchingKeys.length === 0) {
      return {};
    }

    const entries = await Promise.all(
      matchingKeys.map(async (key) => {
        const value = await AsyncStorage.getItem(key);
        return value === null ? null : [key, value] as const;
      })
    );

    return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
  } catch (error) {
    console.error('[UserDataSync] Failed to load storage entries by prefix:', { prefix, error });
    return {};
  }
}

function getRecordKeys(value: unknown): string[] {
  return value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>) : [];
}

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function getRecordSize(value: unknown): number {
  return getRecordKeys(value).length;
}

function isMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }

  return Boolean(value);
}

function parseStoredStringArray(value: string | null, label: string): string[] {
  return parseStoredJson<string[]>(value, [], label);
}

function parseStoredRecord(value: string | null, label: string): Record<string, unknown> {
  return parseStoredJson<Record<string, unknown>>(value, {}, label);
}

function parseStoredUnknownArray(value: string | null, label: string): unknown[] {
  return parseStoredJson<unknown[]>(value, [], label);
}

function parseStoredUnknown(value: string | null, label: string): unknown {
  return parseStoredJson<unknown>(value, null, label);
}

function normalizeStoredEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseStoredInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeDynamicStorageEntries(entries: Record<string, string>, label: string): Record<string, unknown> {
  return Object.entries(entries).reduce<Record<string, unknown>>((accumulator, [key, rawValue]) => {
    accumulator[key] = parseStoredUnknown(rawValue, `${label}:${key}`);
    return accumulator;
  }, {});
}

function hasSyncableData(data: Record<string, unknown>): boolean {
  return Object.values(data).some((value) => isMeaningfulValue(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function prepareOwnedRecords<T extends object>(records: T[], ownerScopeId: string | null | undefined, email: string | null | undefined, label: string): T[] {
  return stampRecordsForOwner(filterRecordsForOwner(records, ownerScopeId, email, label), ownerScopeId, email);
}

function prepareOwnedUnknownArray(value: unknown, ownerScopeId: string | null | undefined, email: string | null | undefined, label: string): unknown[] {
  return prepareOwnedRecords<Record<string, unknown>>(asArray(value).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeId, email, label);
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asNullableRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function hasDefinedProperty(value: unknown, propertyName: string): boolean {
  return Boolean(value) && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, propertyName);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function appendPromise(target: Promise<void>[], promise: Promise<void> | undefined): void {
  if (promise) {
    target.push(promise);
  }
}

function buildJsonSetPromise(key: string, value: unknown, options?: { removeWhenNull?: boolean }): Promise<void> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if ((value === null || value === '') && options?.removeWhenNull) {
    return AsyncStorage.removeItem(key);
  }

  return AsyncStorage.setItem(key, JSON.stringify(value));
}

function buildStringSetPromise(key: string, value: string | null | undefined): Promise<void> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.length === 0) {
    return AsyncStorage.removeItem(key);
  }

  return AsyncStorage.setItem(key, value);
}

function buildNumberSetPromise(key: string, value: number | null | undefined): Promise<void> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || Number.isNaN(value)) {
    return AsyncStorage.removeItem(key);
  }

  return AsyncStorage.setItem(key, value.toString());
}

function buildDualJsonSetPromises(primaryKey: string, secondaryKey: string, value: unknown): Promise<void>[] {
  const primaryPromise = buildJsonSetPromise(primaryKey, value);
  const secondaryPromise = buildJsonSetPromise(secondaryKey, value);
  return [primaryPromise, secondaryPromise].filter(isDefined);
}

function resolveAlertStorageKey(email: string | null): string {
  return getUserScopedKey(ALERTS_STORAGE_BASE, email);
}

function resolveAlertRulesStorageKey(email: string | null): string {
  return getUserScopedKey(ALERT_RULES_STORAGE_BASE, email);
}

function resolveDismissedAlertIdsStorageKey(email: string | null): string {
  return getUserScopedKey(DISMISSED_ALERT_IDS_STORAGE_BASE, email);
}

function resolveDismissedAlertEntitiesStorageKey(email: string | null): string {
  return getUserScopedKey(DISMISSED_ALERT_ENTITIES_STORAGE_BASE, email);
}

function resolveSailingWeatherStorageKey(email: string | null): string {
  return getUserScopedKey(SAILING_WEATHER_CACHE_STORAGE_BASE, email);
}

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
  const ownerScopeIdRef = useRef<string | null>(null);
  const [ownerScopeId, setOwnerScopeId] = useState<string | null>(null);
  useEffect(() => { emailRef.current = authenticatedEmail; }, [authenticatedEmail]);
  useEffect(() => {
    let isMounted = true;

    if (!authenticatedEmail) {
      ownerScopeIdRef.current = null;
      setOwnerScopeId(null);
      return;
    }

    void getInstallationId()
      .then((installationId) => {
        if (!isMounted) {
          return;
        }
        const nextOwnerScopeId = buildOwnerScopeId(authenticatedEmail, installationId);
        ownerScopeIdRef.current = nextOwnerScopeId;
        setOwnerScopeId(nextOwnerScopeId);
        console.log('[UserDataSync] Owner data scope resolved:', { email: authenticatedEmail, ownerScopeId: nextOwnerScopeId });
      })
      .catch((error) => {
        console.error('[UserDataSync] Failed to resolve owner data scope:', error);
      });

    return () => {
      isMounted = false;
    };
  }, [authenticatedEmail]);
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
    console.log("[UserDataSync] Fetching cloud data for:", normalizedEmail);
    const currentOwnerScopeId = ownerScopeIdRef.current;
    if (!currentOwnerScopeId) {
      console.log('[UserDataSync] Cloud fetch skipped until owner scope is ready');
      return { found: false, data: null };
    }
    return trpcClient.data.getAllUserData.query({ email: normalizedEmail, ownerScopeId: currentOwnerScopeId });
  }, []);

  const gatherAllLocalData = useCallback(async () => {
    console.log("[UserDataSync] Gathering all local data for sync...");

    try {
      const scopedAlertsKey = resolveAlertStorageKey(emailRef.current);
      const scopedAlertRulesKey = resolveAlertRulesStorageKey(emailRef.current);
      const scopedDismissedAlertIdsKey = resolveDismissedAlertIdsStorageKey(emailRef.current);
      const scopedDismissedAlertEntitiesKey = resolveDismissedAlertEntitiesStorageKey(emailRef.current);
      const scopedBankrollLimitsKey = sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS);
      const scopedBankrollAlertsKey = sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS);
      const scopedFavoriteStateroomsKey = sk(ALL_STORAGE_KEYS.FAVORITE_STATEROOMS);
      const scopedSailingWeatherKey = resolveSailingWeatherStorageKey(emailRef.current);

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
        legacyAlertsRaw,
        legacyAlertRulesRaw,
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
        scopedAlertsRaw,
        scopedAlertRulesRaw,
        dismissedAlertIdsRaw,
        dismissedAlertEntitiesRaw,
        bankrollLimitsRaw,
        bankrollAlertsRaw,
        userSlotMachinesRaw,
        deckPlanLocationsRaw,
        favoriteStateroomsRaw,
        sailingWeatherCacheRaw,
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
        AsyncStorage.getItem(scopedAlertsKey),
        AsyncStorage.getItem(scopedAlertRulesKey),
        AsyncStorage.getItem(scopedDismissedAlertIdsKey),
        AsyncStorage.getItem(scopedDismissedAlertEntitiesKey),
        AsyncStorage.getItem(scopedBankrollLimitsKey),
        AsyncStorage.getItem(scopedBankrollAlertsKey),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES)),
        AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS)),
        AsyncStorage.getItem(scopedFavoriteStateroomsKey),
        AsyncStorage.getItem(scopedSailingWeatherKey),
      ]);

      const casinoOpenHoursEntries = await loadStoredEntriesByPrefix(CASINO_OPEN_HOURS_STORAGE_PREFIX, emailRef.current);
      const alertsRaw = scopedAlertsRaw ?? legacyAlertsRaw;
      const alertRulesRaw = scopedAlertRulesRaw ?? legacyAlertRulesRaw;

      const celebrityEmail = normalizeStoredEmail(celebrityEmailRaw);
      const celebrityCaptainsClubNumber = normalizeStoredEmail(celebrityCCNumberRaw);
      const celebrityCaptainsClubPoints = parseStoredInteger(celebrityCCPointsRaw, 0);
      const celebrityBlueChipPoints = parseStoredInteger(celebrityBlueChipRaw, 0);
      const celebrityData = celebrityEmail
        || celebrityCaptainsClubNumber
        || celebrityCaptainsClubPoints > 0
        || celebrityBlueChipPoints > 0
        ? {
            email: celebrityEmail,
            captainsClubNumber: celebrityCaptainsClubNumber,
            captainsClubPoints: celebrityCaptainsClubPoints,
            blueChipPoints: celebrityBlueChipPoints,
          }
        : null;

      const parsedLegacyLoyaltyData = parseStoredUnknown(loyaltyDataRaw, 'legacyLoyaltyData');
      const parsedExtendedLoyaltyData = parseStoredUnknown(extendedLoyaltyDataRaw, 'extendedLoyaltyData');
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
        cruises: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(cruisesRaw, 'cruises').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync available cruises'),
        bookedCruises: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(bookedCruisesRaw, 'bookedCruises').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync booked cruises'),
        casinoOffers: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(casinoOffersRaw, 'casinoOffers').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync casino offers'),
        calendarEvents: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(calendarEventsRaw, 'calendarEvents').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync calendar events'),
        casinoSessions: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(casinoSessionsRaw, 'casinoSessions').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync casino sessions'),
        clubRoyaleProfile: parseStoredUnknown(clubProfileRaw, 'clubRoyaleProfile'),
        settings: parseStoredUnknown(settingsRaw, 'settings'),
        userPoints: parseStoredInteger(userPointsRaw, 0),
        certificates: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(certificatesRaw, 'certificates').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync certificates'),
        alerts: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(alertsRaw, 'alerts').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync alerts'),
        alertRules: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(alertRulesRaw, 'alertRules').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync alert rules'),
        dismissedAlertIds: parseStoredStringArray(dismissedAlertIdsRaw, 'dismissedAlertIds'),
        dismissedAlertEntities: parseStoredStringArray(dismissedAlertEntitiesRaw, 'dismissedAlertEntities'),
        slotAtlas: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(slotAtlasRaw, 'slotAtlas').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync slot atlas'),
        loyaltyData,
        bankrollData: parseStoredUnknown(bankrollDataRaw, 'bankrollData'),
        bankrollLimits: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(bankrollLimitsRaw, 'bankrollLimits').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync bankroll limits'),
        bankrollAlerts: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(bankrollAlertsRaw, 'bankrollAlerts').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync bankroll alerts'),
        celebrityData,
        crewRecognitionEntries: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(crewEntriesRaw, 'crewRecognitionEntries').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync crew entries'),
        crewRecognitionSailings: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(crewSailingsRaw, 'crewRecognitionSailings').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync crew sailings'),
        userSlotMachines: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(userSlotMachinesRaw, 'userSlotMachines').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync user slot machines'),
        deckPlanLocations: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(deckPlanLocationsRaw, 'deckPlanLocations').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync deck plan locations'),
        favoriteStaterooms: prepareOwnedRecords<Record<string, unknown>>(parseStoredUnknownArray(favoriteStateroomsRaw, 'favoriteStaterooms').filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)), ownerScopeIdRef.current, emailRef.current, 'cloud-sync favorite staterooms'),
        sailingWeatherCache: parseStoredRecord(sailingWeatherCacheRaw, 'sailingWeatherCache'),
        casinoOpenHours: normalizeDynamicStorageEntries(casinoOpenHoursEntries, 'casinoOpenHours'),
      };

      console.log("[UserDataSync] Gathered data:", {
        availableCruises: getArrayLength(data.cruises),
        cruises: getArrayLength(data.bookedCruises),
        offers: getArrayLength(data.casinoOffers),
        events: getArrayLength(data.calendarEvents),
        sessions: getArrayLength(data.casinoSessions),
        alerts: getArrayLength(data.alerts),
        dismissedAlertIds: getArrayLength(data.dismissedAlertIds),
        bankrollLimits: getArrayLength(data.bankrollLimits),
        userSlotMachines: getArrayLength(data.userSlotMachines),
        deckPlanLocations: getArrayLength(data.deckPlanLocations),
        favoriteStaterooms: getArrayLength(data.favoriteStaterooms),
        weatherCacheEntries: getRecordSize(data.sailingWeatherCache),
        casinoOpenHoursEntries: getRecordSize(data.casinoOpenHours),
        crewEntries: getArrayLength(data.crewRecognitionEntries),
        crewSailings: getArrayLength(data.crewRecognitionSailings),
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
      const currentOwnerScopeId = ownerScopeIdRef.current;
      const currentEmail = emailRef.current;
      const cloudOwnerScopeId = typeof cloudData?.ownerScopeId === 'string' ? cloudData.ownerScopeId : currentOwnerScopeId;
      if (!currentOwnerScopeId || !cloudOwnerScopeId || cloudOwnerScopeId !== currentOwnerScopeId || !isOwnerScopeForEmail(cloudOwnerScopeId, currentEmail)) {
        console.warn('[UserDataSync] Refusing cloud restore for mismatched owner scope:', {
          currentEmail,
          currentOwnerScopeId,
          cloudOwnerScopeId,
        });
        return false;
      }

      const savePromises: Promise<void>[] = [];
      const scopedAlertsKey = resolveAlertStorageKey(emailRef.current);
      const scopedAlertRulesKey = resolveAlertRulesStorageKey(emailRef.current);
      const scopedDismissedAlertIdsKey = resolveDismissedAlertIdsStorageKey(emailRef.current);
      const scopedDismissedAlertEntitiesKey = resolveDismissedAlertEntitiesStorageKey(emailRef.current);
      const scopedBankrollLimitsKey = sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS);
      const scopedBankrollAlertsKey = sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS);
      const scopedFavoriteStateroomsKey = sk(ALL_STORAGE_KEYS.FAVORITE_STATEROOMS);
      const scopedSailingWeatherKey = resolveSailingWeatherStorageKey(emailRef.current);

      if (hasDefinedProperty(cloudData, 'cruises')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CRUISES), prepareOwnedUnknownArray(cloudData.cruises, currentOwnerScopeId, currentEmail, 'cloud-restore available cruises')));
      }
      if (hasDefinedProperty(cloudData, 'bookedCruises')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES), prepareOwnedUnknownArray(cloudData.bookedCruises, currentOwnerScopeId, currentEmail, 'cloud-restore booked cruises')));
      }
      if (hasDefinedProperty(cloudData, 'casinoOffers')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CASINO_OFFERS), prepareOwnedUnknownArray(cloudData.casinoOffers, currentOwnerScopeId, currentEmail, 'cloud-restore casino offers')));
      }
      if (hasDefinedProperty(cloudData, 'calendarEvents')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS), prepareOwnedUnknownArray(cloudData.calendarEvents, currentOwnerScopeId, currentEmail, 'cloud-restore calendar events')));
      }
      if (hasDefinedProperty(cloudData, 'casinoSessions')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS), prepareOwnedUnknownArray(cloudData.casinoSessions, currentOwnerScopeId, currentEmail, 'cloud-restore casino sessions')));
      }
      if (hasDefinedProperty(cloudData, 'clubRoyaleProfile')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CLUB_PROFILE), cloudData.clubRoyaleProfile ?? null, { removeWhenNull: true }));
      }
      if (hasDefinedProperty(cloudData, 'settings')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.SETTINGS), cloudData.settings ?? null, { removeWhenNull: true }));
      }
      if (hasDefinedProperty(cloudData, 'userPoints')) {
        appendPromise(savePromises, buildNumberSetPromise(sk(ALL_STORAGE_KEYS.USER_POINTS), asNumber(cloudData.userPoints) ?? 0));
      }
      if (hasDefinedProperty(cloudData, 'certificates')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CERTIFICATES), prepareOwnedUnknownArray(cloudData.certificates, currentOwnerScopeId, currentEmail, 'cloud-restore certificates')));
      }
      if (hasDefinedProperty(cloudData, 'alerts')) {
        savePromises.push(...buildDualJsonSetPromises(scopedAlertsKey, sk(ALL_STORAGE_KEYS.ALERTS), prepareOwnedUnknownArray(cloudData.alerts, currentOwnerScopeId, currentEmail, 'cloud-restore alerts')));
      }
      if (hasDefinedProperty(cloudData, 'alertRules')) {
        savePromises.push(...buildDualJsonSetPromises(scopedAlertRulesKey, sk(ALL_STORAGE_KEYS.ALERT_RULES), prepareOwnedUnknownArray(cloudData.alertRules, currentOwnerScopeId, currentEmail, 'cloud-restore alert rules')));
      }
      if (hasDefinedProperty(cloudData, 'dismissedAlertIds')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedDismissedAlertIdsKey, asArray(cloudData.dismissedAlertIds)));
      }
      if (hasDefinedProperty(cloudData, 'dismissedAlertEntities')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedDismissedAlertEntitiesKey, asArray(cloudData.dismissedAlertEntities)));
      }
      if (hasDefinedProperty(cloudData, 'slotAtlas')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS), prepareOwnedUnknownArray(cloudData.slotAtlas, currentOwnerScopeId, currentEmail, 'cloud-restore slot atlas')));
      }
      if (hasDefinedProperty(cloudData, 'loyaltyData')) {
        const normalizedLoyaltyData = normalizeSyncedLoyaltyPayload(cloudData.loyaltyData);
        const extendedLoyaltyData = normalizedLoyaltyData?.extendedLoyaltyData ?? null;
        const manualClubRoyalePoints = normalizedLoyaltyData?.manualClubRoyalePoints ?? null;
        const manualCrownAnchorPoints = normalizedLoyaltyData?.manualCrownAnchorPoints ?? null;

        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA), extendedLoyaltyData, { removeWhenNull: true }));
        appendPromise(savePromises, buildNumberSetPromise(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS), manualClubRoyalePoints));
        appendPromise(savePromises, buildNumberSetPromise(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS), manualCrownAnchorPoints));
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.LOYALTY_DATA), cloudData.loyaltyData ?? null, { removeWhenNull: true }));
      }
      if (hasDefinedProperty(cloudData, 'bankrollData')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.BANKROLL_DATA), cloudData.bankrollData ?? null, { removeWhenNull: true }));
      }
      if (hasDefinedProperty(cloudData, 'bankrollLimits')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedBankrollLimitsKey, prepareOwnedUnknownArray(cloudData.bankrollLimits, currentOwnerScopeId, currentEmail, 'cloud-restore bankroll limits')));
      }
      if (hasDefinedProperty(cloudData, 'bankrollAlerts')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedBankrollAlertsKey, prepareOwnedUnknownArray(cloudData.bankrollAlerts, currentOwnerScopeId, currentEmail, 'cloud-restore bankroll alerts')));
      }
      if (hasDefinedProperty(cloudData, 'celebrityData')) {
        const celebrityDataRecord = asNullableRecord(cloudData.celebrityData);
        appendPromise(savePromises, buildStringSetPromise(sk(ALL_STORAGE_KEYS.CELEBRITY_EMAIL), asString(celebrityDataRecord?.email ?? null)));
        appendPromise(savePromises, buildStringSetPromise(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_NUMBER), asString(celebrityDataRecord?.captainsClubNumber ?? null)));
        appendPromise(savePromises, buildNumberSetPromise(sk(ALL_STORAGE_KEYS.CELEBRITY_CAPTAINS_CLUB_POINTS), asNumber(celebrityDataRecord?.captainsClubPoints ?? null)));
        appendPromise(savePromises, buildNumberSetPromise(sk(ALL_STORAGE_KEYS.CELEBRITY_BLUE_CHIP_POINTS), asNumber(celebrityDataRecord?.blueChipPoints ?? null)));
      }
      if (hasDefinedProperty(cloudData, 'crewRecognitionEntries')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES), prepareOwnedUnknownArray(cloudData.crewRecognitionEntries, currentOwnerScopeId, currentEmail, 'cloud-restore crew entries')));
      }
      if (hasDefinedProperty(cloudData, 'crewRecognitionSailings')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS), prepareOwnedUnknownArray(cloudData.crewRecognitionSailings, currentOwnerScopeId, currentEmail, 'cloud-restore crew sailings')));
      }
      if (hasDefinedProperty(cloudData, 'userSlotMachines')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES), prepareOwnedUnknownArray(cloudData.userSlotMachines, currentOwnerScopeId, currentEmail, 'cloud-restore user slot machines')));
      }
      if (hasDefinedProperty(cloudData, 'deckPlanLocations')) {
        appendPromise(savePromises, buildJsonSetPromise(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS), prepareOwnedUnknownArray(cloudData.deckPlanLocations, currentOwnerScopeId, currentEmail, 'cloud-restore deck plan locations')));
      }
      if (hasDefinedProperty(cloudData, 'favoriteStaterooms')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedFavoriteStateroomsKey, prepareOwnedUnknownArray(cloudData.favoriteStaterooms, currentOwnerScopeId, currentEmail, 'cloud-restore favorite staterooms')));
      }
      if (hasDefinedProperty(cloudData, 'sailingWeatherCache')) {
        appendPromise(savePromises, buildJsonSetPromise(scopedSailingWeatherKey, asRecord(cloudData.sailingWeatherCache)));
      }
      if (hasDefinedProperty(cloudData, 'casinoOpenHours')) {
        const existingCasinoOpenHoursEntries = await loadStoredEntriesByPrefix(CASINO_OPEN_HOURS_STORAGE_PREFIX, currentEmail);
        const nextCasinoOpenHours = asRecord(cloudData.casinoOpenHours);
        const normalizedCasinoOpenHours = Object.entries(nextCasinoOpenHours).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
          const scopedKey = toOwnerScopedDynamicKey(key, CASINO_OPEN_HOURS_STORAGE_PREFIX, currentEmail);
          if (scopedKey) {
            accumulator[scopedKey] = value;
          }
          return accumulator;
        }, {});
        const nextCasinoOpenHoursKeys = new Set(getRecordKeys(normalizedCasinoOpenHours));

        Object.keys(existingCasinoOpenHoursEntries).forEach((key) => {
          if (!nextCasinoOpenHoursKeys.has(key)) {
            savePromises.push(AsyncStorage.removeItem(key));
          }
        });

        Object.entries(normalizedCasinoOpenHours).forEach(([key, value]) => {
          appendPromise(savePromises, buildJsonSetPromise(key, value));
        });
      }

      appendPromise(savePromises, buildStringSetPromise(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), "true"));

      await Promise.all(savePromises);

      console.log("[UserDataSync] Cloud data restored to local storage:", {
        availableCruises: getArrayLength(cloudData.cruises),
        cruises: getArrayLength(cloudData.bookedCruises),
        offers: getArrayLength(cloudData.casinoOffers),
        events: getArrayLength(cloudData.calendarEvents),
        sessions: getArrayLength(cloudData.casinoSessions),
        alerts: getArrayLength(cloudData.alerts),
        bankrollLimits: getArrayLength(cloudData.bankrollLimits),
        userSlotMachines: getArrayLength(cloudData.userSlotMachines),
        deckPlanLocations: getArrayLength(cloudData.deckPlanLocations),
        favoriteStaterooms: getArrayLength(cloudData.favoriteStaterooms),
        weatherCacheEntries: getRecordSize(cloudData.sailingWeatherCache),
        casinoOpenHoursEntries: getRecordSize(cloudData.casinoOpenHours),
        crewEntries: getArrayLength(cloudData.crewRecognitionEntries),
        crewSailings: getArrayLength(cloudData.crewRecognitionSailings),
      });

      return true;
    } catch (error) {
      console.error("[UserDataSync] Error restoring data to local:", error);
      return false;
    }
  }, []);

  const checkCloudDataExists = useCallback(async (email: string): Promise<boolean> => {
    if (!email) return false;
    const reachable = await isBackendReachable();
    if (!reachable) {
      console.log("[UserDataSync] Backend not reachable, skipping cloud check");
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
  }, [fetchAllUserDataByEmail]);

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
      isBackendReachable(),
      ASYNC_OPERATION_TIMEOUT_MS,
      '[UserDataSync] Checking backend reachability during cloud load'
    );
    if (!reachable) {
      console.log("[UserDataSync] Backend not reachable, skipping cloud load");
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
      console.log("[UserDataSync] No authenticated email, skipping cloud sync");
      return;
    }

    const reachable = await isBackendReachable();
    if (!reachable) {
      console.log("[UserDataSync] Backend not reachable, skipping cloud sync");
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

      const hasData = hasSyncableData(localData as Record<string, unknown>);

      if (!hasData) {
        console.log("[UserDataSync] No meaningful data to sync, skipping");
        return;
      }

      const currentOwnerScopeId = ownerScopeIdRef.current;
      if (!currentOwnerScopeId) {
        console.log('[UserDataSync] Cloud sync skipped until owner scope is ready');
        return;
      }

      await saveAllMutation.mutateAsync({
        email: authenticatedEmail,
        ownerScopeId: currentOwnerScopeId,
        ...localData,
      });

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
    lastSyncAttemptRef.current = 0;
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
    if (!isAuthenticated || !authenticatedEmail) {
      console.log("[UserDataSync] User not authenticated, clearing sync state");
      setHasCloudData(false);
      setLastSyncTime(null);
      setInitialCheckComplete(false);
      lastSyncedEmailRef.current = null;
      hasInitializedRef.current = false;
      return;
    }

    // On hot reload, if initialCheckComplete is false but hasInitialized is true, reset
    if (hasInitializedRef.current && !initialCheckComplete) {
      console.log("[UserDataSync] Detected incomplete initialization (hot reload?), resetting");
      hasInitializedRef.current = false;
    }

    if (hasInitializedRef.current && lastSyncedEmailRef.current === authenticatedEmail) {
      console.log("[UserDataSync] Already initialized for this email, skipping");
      return;
    }

    if (!ownerScopeId) {
      console.log('[UserDataSync] Waiting for owner data scope before cloud initialization');
      return;
    }

    console.log("[UserDataSync] New user login detected, checking backend...");
    hasInitializedRef.current = true;
    
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
      const reachable = await withTimeout(
        isBackendReachable(),
        ASYNC_OPERATION_TIMEOUT_MS,
        '[UserDataSync] Checking backend reachability during initialization'
      );
      if (!reachable) {
        console.log("[UserDataSync] Backend not reachable, skipping initial sync");
        setInitialCheckComplete(true);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        return;
      }

      const cloudLoaded = await withTimeout(
        loadFromCloud(),
        ASYNC_OPERATION_TIMEOUT_MS + 2000,
        '[UserDataSync] Initial cloud restore'
      );
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      if (isMountedRef.current) {
        const syncDelayMs = cloudLoaded ? 3000 : 5000;
        console.log(cloudLoaded
          ? "[UserDataSync] Cloud data restored, scheduling post-restore sync to backfill latest local-only data"
          : "[UserDataSync] No cloud data, scheduling initial cloud backup");

        syncTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) {
            return;
          }

          console.log('[UserDataSync] Running post-initialization cloud sync');
          lastSyncAttemptRef.current = 0;
          void syncToCloud();
        }, syncDelayMs);
      }
    };

    void initSync();
  }, [isAuthenticated, authenticatedEmail, ownerScopeId, loadFromCloud, syncToCloud, initialCheckComplete]);

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
    setHasCloudData(false);
    setLastSyncTime(null);
    setLastRestoreTime(null);
    setSyncError(null);
    setInitialCheckComplete(false);
    lastSyncedEmailRef.current = null;
    retryCountRef.current = 0;
    lastSyncAttemptRef.current = 0;
    hasInitializedRef.current = false;

    if (!authenticatedEmail) {
      return;
    }

    void AsyncStorage.getItem(lastSyncKey()).then((time) => {
      if (time) {
        setLastSyncTime(time);
      }
    });
  }, [authenticatedEmail]);

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
