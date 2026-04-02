import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import Constants from 'expo-constants';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';

type PurchasesLogInResult = {
  customerInfo: CustomerInfo;
  created?: boolean;
};

type PurchasesModule = {
  getOfferings: () => Promise<{ all?: Record<string, PurchasesOffering> }>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getAppUserID: () => Promise<string>;
  logIn: (appUserID: string) => Promise<PurchasesLogInResult>;
  logOut: () => Promise<CustomerInfo>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ productIdentifier: string; customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  configure: (args: { apiKey: string; appUserID?: string }) => void;
};

let Purchases: PurchasesModule | null = null;
let purchasesInitError: string | null = null;
let purchasesRuntimeUnavailable = false;
let hasLoggedPurchasesRuntimeUnavailable = false;

function markPurchasesRuntimeUnavailable(message: string, error?: unknown): void {
  purchasesRuntimeUnavailable = true;
  purchasesInitError = message;

  if (hasLoggedPurchasesRuntimeUnavailable) {
    return;
  }

  hasLoggedPurchasesRuntimeUnavailable = true;

  if (error) {
    console.warn('[Entitlement] RevenueCat native module is unavailable in this runtime. Skipping react-native-purchases initialization.', error);
    return;
  }

  console.warn('[Entitlement] RevenueCat native module is unavailable in this runtime. Skipping react-native-purchases initialization.');
}

function isExpoGoPurchasesRuntime(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  const executionEnvironment = Constants.executionEnvironment;
  const appOwnership = Constants.appOwnership;

  return executionEnvironment === 'storeClient' || appOwnership === 'expo' || appOwnership === 'guest';
}

function isPurchasesModuleUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('requiring unknown module') ||
    message.includes('unknown module') ||
    message.includes('nativeeventemitter') ||
    message.includes('non-null argument') ||
    message.includes('native module') ||
    message.includes('rnpurchases')
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message.length > 0 ? message : fallbackMessage;
  }

  if (typeof error === 'string') {
    const message = error.trim();
    return message.length > 0 ? message : fallbackMessage;
  }

  if (typeof error === 'object' && error !== null) {
    const errorRecord = error as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
    };

    if (typeof errorRecord.message === 'string' && errorRecord.message.trim().length > 0) {
      return errorRecord.message.trim();
    }

    if (typeof errorRecord.error === 'string' && errorRecord.error.trim().length > 0) {
      return errorRecord.error.trim();
    }

    const formattedCode =
      typeof errorRecord.code === 'string' || typeof errorRecord.code === 'number'
        ? ` (${String(errorRecord.code)})`
        : '';

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}' && serialized !== '[object Object]') {
        return `${serialized}${formattedCode}`;
      }
    } catch {}
  }

  const fallbackString = String(error);
  if (fallbackString && fallbackString !== '[object Object]') {
    return fallbackString;
  }

  return fallbackMessage;
}

function formatPurchasesInitializationError(error: unknown): string {
  if (isPurchasesModuleUnavailableError(error)) {
    return 'In-app purchases are not available in this runtime. Use the web preview or a development build to test purchases on device.';
  }

  return `Failed to initialize purchases: ${getErrorMessage(error, 'Unknown initialization error')}`;
}

function resolvePurchasesModule(moduleValue: unknown): PurchasesModule | null {
  if (!moduleValue) {
    return null;
  }

  const candidates: unknown[] = [];
  let currentValue: unknown = moduleValue;

  for (let depth = 0; depth < 3 && currentValue; depth += 1) {
    candidates.push(currentValue);

    if (typeof currentValue === 'object' && currentValue !== null && 'default' in currentValue) {
      currentValue = (currentValue as { default?: unknown }).default;
      continue;
    }

    break;
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate !== 'object' && typeof candidate !== 'function') {
      continue;
    }

    const typedCandidate = candidate as Partial<PurchasesModule>;
    if (
      typeof typedCandidate.configure === 'function' &&
      typeof typedCandidate.getOfferings === 'function' &&
      typeof typedCandidate.getCustomerInfo === 'function' &&
      typeof typedCandidate.getAppUserID === 'function' &&
      typeof typedCandidate.logIn === 'function' &&
      typeof typedCandidate.logOut === 'function' &&
      typeof typedCandidate.purchasePackage === 'function' &&
      typeof typedCandidate.restorePurchases === 'function'
    ) {
      return typedCandidate as PurchasesModule;
    }
  }

  return null;
}

function describePurchasesModuleShape(moduleValue: unknown): Record<string, unknown> {
  if (!moduleValue) {
    return { kind: 'empty' };
  }

  const describeCandidate = (candidate: unknown, label: string) => {
    if (!candidate) {
      return {
        label,
        type: typeof candidate,
        keys: [],
      };
    }

    if (typeof candidate !== 'object' && typeof candidate !== 'function') {
      return {
        label,
        type: typeof candidate,
        keys: [],
      };
    }

    return {
      label,
      type: typeof candidate,
      keys: Object.keys(candidate as Record<string, unknown>).slice(0, 20),
      hasConfigure: typeof (candidate as Partial<PurchasesModule>).configure === 'function',
      hasGetOfferings: typeof (candidate as Partial<PurchasesModule>).getOfferings === 'function',
      hasGetCustomerInfo: typeof (candidate as Partial<PurchasesModule>).getCustomerInfo === 'function',
    };
  };

  const directDefault =
    typeof moduleValue === 'object' && moduleValue !== null && 'default' in moduleValue
      ? (moduleValue as { default?: unknown }).default
      : null;

  const nestedDefault =
    typeof directDefault === 'object' && directDefault !== null && 'default' in directDefault
      ? (directDefault as { default?: unknown }).default
      : null;

  return {
    root: describeCandidate(moduleValue, 'root'),
    defaultExport: describeCandidate(directDefault, 'default'),
    nestedDefaultExport: describeCandidate(nestedDefault, 'default.default'),
  };
}

export type EntitlementSource = 'iap' | 'dev' | 'grandfathered' | 'unknown';
export type SubscriptionTier = 'trial' | 'view' | 'basic' | 'pro';
export type SubscriptionDisplayStatus = 'grace_period' | 'monthly' | 'annual' | 'expired';
export type RevenueCatEnvironment = 'test_store' | 'app_store' | 'play_store' | 'unknown';

export interface EntitlementState {
  isPro: boolean;
  isBasic: boolean;
  tier: SubscriptionTier;
  trialEnd: Date | null;
  trialDaysRemaining: number;
  source: EntitlementSource;
  lastCheckedAt: string | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering[];
  availableProductIds: string[];
  hasAnyOffering: boolean;
  isLoading: boolean;
  error: string | null;
  isGrandfathered: boolean;
  accountCreatedAt: Date | null;
  subscriptionDisplayStatus: SubscriptionDisplayStatus;
  billingStoreLabel: string;
  billingEnvironment: RevenueCatEnvironment;
  expectedRevenueCatKeyName: string;
  revenueCatAppUserId: string | null;
  refresh: () => Promise<void>;
  subscribeBasicMonthly: () => Promise<void>;
  subscribeProMonthly: () => Promise<void>;
  subscribeProAnnual: () => Promise<void>;
  restore: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
  openPrivacyPolicy: () => Promise<void>;
  openTerms: () => Promise<void>;
  manualUnlock: () => Promise<void>;
}

const BASE_KEYS = {
  WEB_IS_PRO: 'easyseas_entitlements_web_is_pro',
  TRIAL_START: 'easyseas_trial_start',
  TRIAL_END: 'easyseas_trial_end',
  FIRST_ACCOUNT_CREATED: 'easyseas_first_account_created',
} as const;

const TRIAL_DURATION_DAYS = 5;
const CURRENT_USER_ACCESS_LOCKIN_DATE = new Date('2026-03-31T23:59:59.999Z');
const CURRENT_USER_ACCESS_END_DATE = new Date('2027-03-31T23:59:59.999Z');

const DEFAULT_TIMEOUT_MS = 10000 as const;
const PURCHASE_TIMEOUT_MS = 120000 as const;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please try again.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const BASIC_PRODUCT_ID_MONTHLY = 'easyseas_basic_monthly' as const;
export const PRO_PRODUCT_ID_MONTHLY = 'easyseas_pro_monthly' as const;
export const PRO_PRODUCT_ID_ANNUAL = 'easyseas_pro_annual' as const;

const MONTHLY_PRODUCT_IDS = ['easyseas_pro_monthly', 'easyseas_pro_monthly:monthly-base'] as const;
const ANNUAL_PRODUCT_IDS = [
  'easyseas_pro_annual',
  'easyseas_pro_annual:annual-base',
  'easyseas_pro_yearly',
  'easyseas_pro_yearly:yearly-base',
  'annualplan:annualplan',
  'annual:easyseasmonthly',
] as const;
const BASIC_PRODUCT_IDS = ['easyseas_basic_monthly', 'easyseas_basic_monthly:monthly-base'] as const;

const PRIVACY_URL = 'https://www.royalcomputerconsulting.com/privacy-policy' as const;
const TERMS_URL = 'https://www.royalcomputerconsulting.com/support-policy' as const;
const MANAGE_SUBS_IOS_URL = 'https://apps.apple.com/account/subscriptions' as const;
const MANAGE_SUBS_ANDROID_URL = 'https://play.google.com/store/account/subscriptions' as const;

function normalizeEntitlementIdentity(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

function normalizeProductIdentifier(productId: string | null | undefined): string {
  return (productId ?? '').toLowerCase().trim();
}

function productIdentifierMatches(productId: string | null | undefined, candidates: readonly string[]): boolean {
  const normalizedProductId = normalizeProductIdentifier(productId);
  if (!normalizedProductId) {
    return false;
  }

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeProductIdentifier(candidate);
    return normalizedProductId === normalizedCandidate || normalizedProductId.startsWith(`${normalizedCandidate}:`);
  });
}

function isProMonthlyProductId(productId: string | null | undefined): boolean {
  return productIdentifierMatches(productId, MONTHLY_PRODUCT_IDS);
}

function isProAnnualProductId(productId: string | null | undefined): boolean {
  return productIdentifierMatches(productId, ANNUAL_PRODUCT_IDS);
}

function isBasicProductId(productId: string | null | undefined): boolean {
  return productIdentifierMatches(productId, BASIC_PRODUCT_IDS);
}

function getScopedEntitlementKeys(email: string | null) {
  return {
    WEB_IS_PRO: getUserScopedKey(BASE_KEYS.WEB_IS_PRO, email),
    TRIAL_START: getUserScopedKey(BASE_KEYS.TRIAL_START, email),
    TRIAL_END: getUserScopedKey(BASE_KEYS.TRIAL_END, email),
    FIRST_ACCOUNT_CREATED: getUserScopedKey(BASE_KEYS.FIRST_ACCOUNT_CREATED, email),
  } as const;
}

function computeIsProFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  try {
    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements).map(k => k.toLowerCase().trim());
    if (entitlementIds.includes('pro') || entitlementIds.includes('pro access')) return true;

    const active = (info.activeSubscriptions ?? []) as string[];
    return active.some((subscriptionId) => isProMonthlyProductId(subscriptionId) || isProAnnualProductId(subscriptionId));
  } catch (e) {
    console.error('[Entitlement] computeIsProFromCustomerInfo failed', e);
    return false;
  }
}

function detectActiveSubscriptionType(info: CustomerInfo | null): 'monthly' | 'annual' | null {
  if (!info) return null;
  try {
    const active = (info.activeSubscriptions ?? []) as string[];
    console.log('[Entitlement] Detecting subscription type from active subs:', active);
    if (active.some((subscriptionId) => isProAnnualProductId(subscriptionId))) return 'annual';
    if (active.some((subscriptionId) => isProMonthlyProductId(subscriptionId) || isBasicProductId(subscriptionId))) return 'monthly';

    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements).map(k => k.toLowerCase().trim());
    if (entitlementIds.includes('pro') || entitlementIds.includes('pro access') || entitlementIds.includes('basic')) {
      if (active.some((subscriptionId) => isProAnnualProductId(subscriptionId) || subscriptionId.toLowerCase().includes('annual') || subscriptionId.toLowerCase().includes('yearly'))) return 'annual';
      return 'monthly';
    }
    return null;
  } catch (e) {
    console.error('[Entitlement] detectActiveSubscriptionType failed', e);
    return null;
  }
}

function computeIsBasicFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  try {
    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements).map(k => k.toLowerCase().trim());
    if (entitlementIds.includes('basic')) return true;

    const active = (info.activeSubscriptions ?? []) as string[];
    return active.some((subscriptionId) => isBasicProductId(subscriptionId));
  } catch (e) {
    console.error('[Entitlement] computeIsBasicFromCustomerInfo failed', e);
    return false;
  }
}

async function safeOpenURL(url: string): Promise<void> {
  try {
    console.log('[Entitlement] Opening URL:', url);
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('Cannot Open Link', 'Your device cannot open this link.');
      return;
    }
    await Linking.openURL(url);
  } catch (e) {
    console.error('[Entitlement] openURL failed', e);
    Alert.alert('Error', 'Failed to open the link.');
  }
}

export const [EntitlementProvider, useEntitlement] = createContextHook((): EntitlementState => {
  const auth = useAuth();
  const normalizedAuthenticatedEmail = useMemo(
    () => normalizeEntitlementIdentity(auth.authenticatedEmail),
    [auth.authenticatedEmail]
  );
  const storageKeys = useMemo(
    () => getScopedEntitlementKeys(normalizedAuthenticatedEmail),
    [normalizedAuthenticatedEmail]
  );
  const billingDetails = useMemo(() => {
    const isExpoGo = isExpoGoPurchasesRuntime();

    if (Platform.OS === 'web' || isExpoGo) {
      return {
        billingStoreLabel: 'RevenueCat Test Store',
        billingEnvironment: 'test_store' as RevenueCatEnvironment,
        expectedRevenueCatKeyName: 'EXPO_PUBLIC_REVENUECAT_TEST_API_KEY',
      };
    }

    if (Platform.OS === 'android') {
      return {
        billingStoreLabel: 'Google Play',
        billingEnvironment: 'play_store' as RevenueCatEnvironment,
        expectedRevenueCatKeyName: 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
      };
    }

    return {
      billingStoreLabel: 'App Store',
      billingEnvironment: 'app_store' as RevenueCatEnvironment,
      expectedRevenueCatKeyName: 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    };
  }, []);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isBasic, setIsBasic] = useState<boolean>(false);
  const [tier, setTier] = useState<SubscriptionTier>('trial');
  const [trialEnd, setTrialEnd] = useState<Date | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number>(TRIAL_DURATION_DAYS);
  const [source, setSource] = useState<EntitlementSource>('unknown');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [revenueCatAppUserId, setRevenueCatAppUserId] = useState<string | null>(null);
  const [isGrandfathered, setIsGrandfathered] = useState<boolean>(false);
  const [accountCreatedAt, setAccountCreatedAt] = useState<Date | null>(null);
  const [subscriptionDisplayStatus, setSubscriptionDisplayStatus] = useState<SubscriptionDisplayStatus>('grace_period');
  const hasPrivilegedAccess = useMemo(() => auth.isAdmin || auth.isWhitelisted, [auth.isAdmin, auth.isWhitelisted]);
  const availableProductIds = useMemo(
    () => offerings.flatMap((offering) => (offering.availablePackages ?? []).map((pkg) => pkg.product.identifier)),
    [offerings]
  );
  const hasAnyOffering = useMemo(() => availableProductIds.length > 0, [availableProductIds]);

  const mountedRef = useRef<boolean>(true);
  const actionInFlightRef = useRef<boolean>(false);
  const lastIsProRef = useRef<boolean>(false);
  const lastIdentityRef = useRef<string | null>(normalizedAuthenticatedEmail);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (lastIdentityRef.current === normalizedAuthenticatedEmail) {
      return;
    }

    console.log('[Entitlement] Authenticated identity changed - resetting in-memory subscription state', {
      previousEmail: lastIdentityRef.current,
      nextEmail: normalizedAuthenticatedEmail,
    });

    lastIdentityRef.current = normalizedAuthenticatedEmail;
    actionInFlightRef.current = false;
    lastIsProRef.current = false;
    setIsPro(false);
    setIsBasic(false);
    setTier('trial');
    setCustomerInfo(null);
    setSource('unknown');
    setError(null);
    setLastCheckedAt(null);
    setRevenueCatAppUserId(null);
    setOfferings([]);
    setIsLoading(true);
  }, [normalizedAuthenticatedEmail]);

  const initializeAccountTracking = useCallback(async () => {
    try {
      const storedAccountCreated = await AsyncStorage.getItem(storageKeys.FIRST_ACCOUNT_CREATED);
      
      let accountDate: Date;
      if (storedAccountCreated) {
        accountDate = new Date(storedAccountCreated);
        console.log('[Entitlement] Account creation date found:', storedAccountCreated);
      } else {
        const storedTrialStart = await AsyncStorage.getItem(storageKeys.TRIAL_START);
        const hasImportedData = await AsyncStorage.getItem('easyseas_has_imported_data');
        
        if (storedTrialStart || hasImportedData) {
          const existingUserDate = storedTrialStart ? new Date(storedTrialStart) : new Date(CURRENT_USER_ACCESS_LOCKIN_DATE);
          accountDate = existingUserDate;
          console.log('[Entitlement] Existing user detected (has trial or data) - setting account creation to:', accountDate.toISOString());
        } else {
          accountDate = new Date();
          console.log('[Entitlement] New user - account creation date set to now:', accountDate.toISOString());
        }
        
        await AsyncStorage.setItem(storageKeys.FIRST_ACCOUNT_CREATED, accountDate.toISOString());
      }
      
      setAccountCreatedAt(accountDate);
      
      const now = new Date();
      const isGrandfatheredUser = accountDate <= CURRENT_USER_ACCESS_LOCKIN_DATE && now <= CURRENT_USER_ACCESS_END_DATE;
      setIsGrandfathered(isGrandfatheredUser);
      
      if (isGrandfatheredUser) {
        console.log('[Entitlement] ✅ CURRENT USER ACCESS ACTIVE - account qualifies for one-year legacy access');
        console.log('[Entitlement] Account created:', accountDate.toISOString());
        console.log('[Entitlement] Access lock-in date:', CURRENT_USER_ACCESS_LOCKIN_DATE.toISOString());
        console.log('[Entitlement] Access end date:', CURRENT_USER_ACCESS_END_DATE.toISOString());
      } else {
        console.log('[Entitlement] Current-user access inactive for this account', {
          accountCreatedAt: accountDate.toISOString(),
          accessLockInDate: CURRENT_USER_ACCESS_LOCKIN_DATE.toISOString(),
          accessEndDate: CURRENT_USER_ACCESS_END_DATE.toISOString(),
          now: now.toISOString(),
        });
      }
      
      return isGrandfatheredUser;
    } catch (e) {
      console.error('[Entitlement] Failed to initialize account tracking', e);
      return false;
    }
  }, [storageKeys.FIRST_ACCOUNT_CREATED, storageKeys.TRIAL_START]);

  const initializeTrial = useCallback(async () => {
    try {
      const storedTrialStart = await AsyncStorage.getItem(storageKeys.TRIAL_START);
      const storedTrialEnd = await AsyncStorage.getItem(storageKeys.TRIAL_END);

      if (storedTrialStart && storedTrialEnd) {
        console.log('[Entitlement] Trial already initialized', { storedTrialStart, storedTrialEnd });
        const trialEndDate = new Date(storedTrialEnd);
        setTrialEnd(trialEndDate);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        setTrialDaysRemaining(daysRemaining);
        return;
      }

      const now = new Date();
      const end = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
      
      await AsyncStorage.setItem(storageKeys.TRIAL_START, now.toISOString());
      await AsyncStorage.setItem(storageKeys.TRIAL_END, end.toISOString());
      
      console.log('[Entitlement] Trial initialized', { start: now.toISOString(), end: end.toISOString() });
      setTrialEnd(end);
      setTrialDaysRemaining(TRIAL_DURATION_DAYS);
    } catch (e) {
      console.error('[Entitlement] Failed to initialize trial', e);
    }
  }, [storageKeys.TRIAL_END, storageKeys.TRIAL_START]);

  const computeTier = useCallback((isPro: boolean, isBasic: boolean, _trialEnd: Date | null, isGrandfathered: boolean): SubscriptionTier => {
    if (isGrandfathered) return 'pro';
    if (isPro) return 'pro';
    if (isBasic) return 'basic';
    return 'basic';
  }, []);

  const computeDisplayStatus = useCallback((
    info: CustomerInfo | null,
    currentTrialEnd: Date | null,
    currentIsGrandfathered: boolean,
    currentHasPrivilegedAccess: boolean,
    computedIsPro: boolean,
    computedIsBasic: boolean,
  ): SubscriptionDisplayStatus => {
    const subType = detectActiveSubscriptionType(info);
    console.log('[Entitlement] computeDisplayStatus', {
      subType,
      currentIsGrandfathered,
      currentHasPrivilegedAccess,
      computedIsPro,
      computedIsBasic,
      trialEnd: currentTrialEnd?.toISOString(),
    });

    if (subType === 'annual') return 'annual';
    if (subType === 'monthly') return 'monthly';

    if (currentIsGrandfathered || currentHasPrivilegedAccess) return 'annual';

    if (computedIsPro || computedIsBasic) return 'monthly';

    if (currentTrialEnd) {
      const now = new Date();
      if (now < currentTrialEnd) return 'grace_period';
    }

    return 'expired';
  }, []);

  const setStateFromCustomerInfo = useCallback((
    info: CustomerInfo | null,
    currentTrialEnd: Date | null,
    currentIsGrandfathered: boolean,
    currentHasPrivilegedAccess: boolean,
  ) => {
    const computedIsPro = computeIsProFromCustomerInfo(info);
    const computedIsBasic = computeIsBasicFromCustomerInfo(info);
    const effectiveIsPro = currentHasPrivilegedAccess || computedIsPro;
    const computedTier = computeTier(effectiveIsPro, computedIsBasic, currentTrialEnd, currentIsGrandfathered);
    
    console.log('[Entitlement] setStateFromCustomerInfo', {
      computedIsPro,
      computedIsBasic,
      effectiveIsPro,
      currentHasPrivilegedAccess,
      computedTier,
      isGrandfathered: currentIsGrandfathered,
      activeSubscriptions: info?.activeSubscriptions ?? [],
      entitlementsActiveKeys: Object.keys(info?.entitlements?.active ?? {}),
    });

    const wasPro = lastIsProRef.current;
    const finalIsPro = currentIsGrandfathered || effectiveIsPro;

    setCustomerInfo(info);
    setIsPro(finalIsPro);
    setIsBasic(computedIsBasic);
    setTier(computedTier);
    setSource(
      currentIsGrandfathered
        ? 'grandfathered'
        : currentHasPrivilegedAccess
          ? 'dev'
          : (effectiveIsPro || computedIsBasic ? 'iap' : 'unknown')
    );
    setLastCheckedAt(new Date().toISOString());
    
    const displayStatus = computeDisplayStatus(
      info,
      currentTrialEnd,
      currentIsGrandfathered,
      currentHasPrivilegedAccess,
      effectiveIsPro,
      computedIsBasic,
    );
    setSubscriptionDisplayStatus(displayStatus);
    console.log('[Entitlement] Display status set to:', displayStatus);

    lastIsProRef.current = finalIsPro;

    if (!wasPro && finalIsPro) {
      try {
        if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
          console.log('[Entitlement] Dispatching entitlementProUnlocked event');
          window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
        }
      } catch (e) {
        console.error('[Entitlement] Failed to dispatch entitlementProUnlocked event', e);
      }
    }
  }, [computeDisplayStatus, computeTier]);

  const applyStoredWebEntitlementFallback = useCallback(async (
    currentTrialEnd: Date | null,
    currentIsGrandfathered: boolean,
  ) => {
    const stored = await AsyncStorage.getItem(storageKeys.WEB_IS_PRO);
    const storedIsPro = stored === 'true';
    console.log('[Entitlement] Applying stored web entitlement fallback', {
      storedIsPro,
      isGrandfathered: currentIsGrandfathered,
      hasPrivilegedAccess,
    });

    if (!mountedRef.current) {
      return;
    }

    const finalIsPro = currentIsGrandfathered || storedIsPro || hasPrivilegedAccess;
    setIsPro(finalIsPro);
    setIsBasic(false);
    setTier(computeTier(finalIsPro, false, currentTrialEnd, currentIsGrandfathered));
    setSource(currentIsGrandfathered ? 'grandfathered' : (finalIsPro ? 'dev' : 'unknown'));
    setLastCheckedAt(new Date().toISOString());
    setCustomerInfo(null);
    setOfferings([]);
    setRevenueCatAppUserId(null);
    const webDisplayStatus = computeDisplayStatus(
      null,
      currentTrialEnd,
      currentIsGrandfathered,
      hasPrivilegedAccess,
      finalIsPro,
      false,
    );
    setSubscriptionDisplayStatus(webDisplayStatus);
    setError(null);
    console.log('[Entitlement] Web fallback display status set to:', webDisplayStatus);
  }, [computeDisplayStatus, computeTier, hasPrivilegedAccess, storageKeys.WEB_IS_PRO]);

  const ensurePurchasesLoaded = useCallback(async (): Promise<PurchasesModule | null> => {
    const isExpoGo = isExpoGoPurchasesRuntime();
    const isWeb = Platform.OS === 'web';

    if (!isWeb && purchasesRuntimeUnavailable) {
      purchasesInitError = purchasesInitError ?? 'In-app purchases are not available in this runtime. Use the web preview or a development build to test purchases on device.';
      return null;
    }

    let apiKey = '';
    let keySource = '';

    if (isWeb) {
      apiKey = (process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? '').trim();
      keySource = 'test-store (web preview)';
      if (!apiKey) {
        purchasesInitError = 'RevenueCat web preview is not configured. Set EXPO_PUBLIC_REVENUECAT_TEST_API_KEY.';
        console.warn('[Entitlement] RevenueCat web preview requires EXPO_PUBLIC_REVENUECAT_TEST_API_KEY.');
        return null;
      }
    } else if (isExpoGo) {
      markPurchasesRuntimeUnavailable('In-app purchases are not available in Expo Go. Use the web preview or a development build to test purchases on device.');
      return null;
    } else if (Platform.OS === 'android') {
      apiKey = (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '').trim();
      keySource = 'android-production (Google Play)';
      console.log('[Entitlement] ANDROID PATH: Using Google Play Store RevenueCat API key');
    } else {
      apiKey = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '').trim();
      keySource = 'ios-production (App Store / StoreKit)';
      console.log('[Entitlement] iOS PATH: Using Apple App Store RevenueCat API key');
    }

    if (!apiKey) {
      const storeName = Platform.OS === 'android'
        ? 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'
        : 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY';
      purchasesInitError = `Missing RevenueCat API Key for ${Platform.OS}. Set ${storeName}.`;
      console.warn(`[Entitlement] Missing RevenueCat API Key for ${Platform.OS}. Expected env: ${storeName}`);
      return null;
    }

    if (apiKey.startsWith('sk_')) {
      purchasesInitError = 'Invalid RevenueCat key provided. This looks like a secret key (sk_...). Please use the Public SDK Key from RevenueCat.';
      console.warn('[Entitlement] Refusing to initialize Purchases with a secret key (sk_...)');
      return null;
    }

    if (Purchases) return Purchases;

    try {
      const mod = require('react-native-purchases') as unknown;
      Purchases = resolvePurchasesModule(mod);

      if (!Purchases) {
        purchasesInitError = 'Failed to initialize purchases.';
        console.error('[Entitlement] react-native-purchases resolved to an invalid module shape', describePurchasesModuleShape(mod));
        return null;
      }

      console.log('[Entitlement] Configuring Purchases', {
        platform: Platform.OS,
        keySource,
        isExpoGo,
        keyPrefix: apiKey.substring(0, 5) + '...',
      });

      Purchases.configure({
        apiKey,
        appUserID: normalizedAuthenticatedEmail ?? undefined,
      });
      purchasesInitError = null;

      console.log(`[Entitlement] RevenueCat initialized successfully for ${Platform.OS} via ${keySource}`);
      return Purchases;
    } catch (e) {
      const formattedError = formatPurchasesInitializationError(e);
      purchasesInitError = formattedError;

      if (!isWeb && isPurchasesModuleUnavailableError(e)) {
        markPurchasesRuntimeUnavailable(formattedError, e);
        return null;
      }

      console.error('[Entitlement] Failed to load/initialize react-native-purchases', e);
      return null;
    }
  }, [normalizedAuthenticatedEmail]);

  const syncPurchasesIdentity = useCallback(async (purchases: PurchasesModule): Promise<void> => {
    const currentAppUserId = await purchases.getAppUserID();
    const isAnonymous = !currentAppUserId || currentAppUserId.startsWith('$RCAnonymousID:');
    console.log('[Entitlement] Syncing RevenueCat identity', {
      currentAppUserId,
      isAnonymous,
      authenticatedEmail: normalizedAuthenticatedEmail,
    });

    if (!normalizedAuthenticatedEmail) {
      if (mountedRef.current) {
        setRevenueCatAppUserId(isAnonymous ? null : currentAppUserId);
      }
      if (currentAppUserId && !isAnonymous) {
        try {
          await withTimeout(purchases.logOut(), DEFAULT_TIMEOUT_MS, 'Clearing purchase session');
          if (mountedRef.current) {
            setRevenueCatAppUserId(null);
          }
        } catch (e) {
          console.warn('[Entitlement] logOut failed (user may already be anonymous):', e);
        }
      }
      return;
    }

    if (currentAppUserId === normalizedAuthenticatedEmail) {
      if (mountedRef.current) {
        setRevenueCatAppUserId(currentAppUserId);
      }
      return;
    }

    const loginResult = await withTimeout(
      purchases.logIn(normalizedAuthenticatedEmail),
      DEFAULT_TIMEOUT_MS,
      'Linking subscription to your email'
    );

    if (mountedRef.current) {
      setRevenueCatAppUserId(normalizedAuthenticatedEmail);
    }

    console.log('[Entitlement] RevenueCat identity updated', {
      authenticatedEmail: normalizedAuthenticatedEmail,
      created: loginResult.created ?? false,
      activeSubscriptions: loginResult.customerInfo.activeSubscriptions ?? [],
    });
  }, [normalizedAuthenticatedEmail]);

  const refresh = useCallback(async () => {
    console.log('[Entitlement] refresh called');
    setError(null);

    if (!mountedRef.current) return;
    setIsLoading(true);

    const currentIsGrandfathered = await initializeAccountTracking();
    await initializeTrial();

    const storedTrialEnd = await AsyncStorage.getItem(storageKeys.TRIAL_END);
    const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;

    if (Platform.OS === 'web') {
      try {
        const purchases = await ensurePurchasesLoaded();
        if (purchases) {
          await syncPurchasesIdentity(purchases);

          console.log('[Entitlement] Fetching web offerings');
          try {
            const offers = await withTimeout(purchases.getOfferings(), DEFAULT_TIMEOUT_MS, 'Loading subscription options');
            const allOfferings = Object.values(offers.all ?? {});
            console.log('[Entitlement] Web offerings fetched:', allOfferings.map(o => ({ identifier: o.identifier, packages: o.availablePackages?.length ?? 0 })));
            if (!mountedRef.current) return;
            setOfferings(allOfferings);
          } catch (offerError) {
            console.warn('[Entitlement] Failed to fetch web offerings, continuing anyway:', offerError);
          }

          console.log('[Entitlement] Fetching web customer info');
          const info = await withTimeout(purchases.getCustomerInfo(), DEFAULT_TIMEOUT_MS, 'Checking subscription status');
          if (!mountedRef.current) return;
          setStateFromCustomerInfo(info, currentTrialEnd, currentIsGrandfathered, hasPrivilegedAccess);
          setError(null);
          return;
        }

        await applyStoredWebEntitlementFallback(currentTrialEnd, currentIsGrandfathered);
      } catch (e) {
        const message = getErrorMessage(e, 'Failed to refresh entitlements.');
        console.error('[Entitlement] web refresh failed:', message, e);

        try {
          await applyStoredWebEntitlementFallback(currentTrialEnd, currentIsGrandfathered);
        } catch (fallbackError) {
          const fallbackMessage = getErrorMessage(fallbackError, 'Failed to load web entitlement fallback.');
          console.error('[Entitlement] web entitlement fallback failed:', fallbackMessage, fallbackError);
          if (!mountedRef.current) return;
          setError(message);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
      return;
    }

    try {
      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        const message = purchasesInitError ?? 'In-app purchases are not configured.';
        console.warn('[Entitlement] refresh: Purchases unavailable', { message, hasPrivilegedAccess });

        if (hasPrivilegedAccess) {
          setIsPro(true);
          setIsBasic(false);
          setTier(computeTier(true, false, currentTrialEnd, currentIsGrandfathered));
          setSource(currentIsGrandfathered ? 'grandfathered' : 'dev');
          setLastCheckedAt(new Date().toISOString());
          setCustomerInfo(null);
          setOfferings([]);
          setSubscriptionDisplayStatus(
            computeDisplayStatus(null, currentTrialEnd, currentIsGrandfathered, hasPrivilegedAccess, true, false),
          );
          setError(null);
          return;
        }

        setError(message);
        return;
      }

      await syncPurchasesIdentity(purchases);

      console.log('[Entitlement] Fetching offerings');
      try {
        const offers = await withTimeout(purchases.getOfferings(), DEFAULT_TIMEOUT_MS, 'Loading subscription options');
        const allOfferings = Object.values(offers.all ?? {});
        console.log('[Entitlement] Offerings fetched:', allOfferings.map(o => ({ identifier: o.identifier, packages: o.availablePackages?.length ?? 0 })));
        if (!mountedRef.current) return;
        setOfferings(allOfferings);
      } catch (offerError) {
        console.warn('[Entitlement] Failed to fetch offerings, continuing anyway:', offerError);
      }

      console.log('[Entitlement] Fetching customer info');
      const info = await withTimeout(purchases.getCustomerInfo(), DEFAULT_TIMEOUT_MS, 'Checking subscription status');
      if (!mountedRef.current) return;
      setStateFromCustomerInfo(info, currentTrialEnd, currentIsGrandfathered, hasPrivilegedAccess);
    } catch (e) {
      const message = getErrorMessage(e, 'Failed to refresh entitlements.');
      console.error('[Entitlement] refresh failed:', message, e);
      if (!mountedRef.current) return;
      setError(message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [applyStoredWebEntitlementFallback, computeDisplayStatus, computeTier, ensurePurchasesLoaded, hasPrivilegedAccess, initializeAccountTracking, initializeTrial, setStateFromCustomerInfo, storageKeys.TRIAL_END, syncPurchasesIdentity]);

  useEffect(() => {
    console.log('[Entitlement] Provider mounted - refreshing entitlements');
    refresh().catch((e) => console.error('[Entitlement] initial refresh failed', e));
  }, [refresh]);

  useEffect(() => {
    lastIsProRef.current = isPro;
  }, [isPro]);

  const findPackageByProductIds = useCallback((productIds: readonly string[], productName: string): PurchasesPackage | null => {
    try {
      console.log('[Entitlement] Searching for products:', productIds, 'across', offerings.length, 'offerings');
      for (const offering of offerings) {
        console.log('[Entitlement] Checking offering:', offering.identifier, 'packages:', (offering.availablePackages ?? []).length);
        for (const p of offering.availablePackages ?? []) {
          const id = p.product.identifier;
          console.log('[Entitlement] Checking package product:', { id, priceString: p.product.priceString });
          if (productIdentifierMatches(id, productIds)) {
            console.log('[Entitlement] Found matching package in offering:', offering.identifier);
            return p;
          }
        }
      }
      console.warn('[Entitlement] No package found with store product IDs:', productIds);
      console.warn('[Entitlement] Requested product name:', productName);
      console.warn('[Entitlement] Available products:', offerings.flatMap(o => (o.availablePackages ?? []).map(p => p.product.identifier)));
      return null;
    } catch (e) {
      console.error('[Entitlement] findPackageByProductIds failed', e);
      return null;
    }
  }, [offerings]);

  const subscribeToProduct = useCallback(async (productIds: readonly string[], productName: string) => {
    console.log(`[Entitlement] subscribeToProduct called for ${productName}`);
    if (actionInFlightRef.current) {
      console.log(`[Entitlement] subscribeToProduct ignored: action already in flight`);
      return;
    }
    actionInFlightRef.current = true;
    setError(null);

    if (!auth.isAdmin) {
      console.warn('[Entitlement] Purchase attempt blocked for non-admin user');
      actionInFlightRef.current = false;
      Alert.alert('Admin Only', 'Purchasing subscriptions is temporarily restricted to admin users.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        await AsyncStorage.setItem(storageKeys.WEB_IS_PRO, 'true');
        if (!mountedRef.current) return;
        setIsPro(true);
        setSource('dev');
        setLastCheckedAt(new Date().toISOString());
        Alert.alert('Unlocked (Web)', 'Pro has been enabled for web preview.');
        return;
      } catch (e) {
        console.error(`[Entitlement] web subscribeToProduct failed`, e);
        Alert.alert('Error', 'Unable to start subscription on web preview.');
        return;
      } finally {
        actionInFlightRef.current = false;
      }
    }

    try {
      setIsLoading(true);
      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        const message = purchasesInitError ?? 'In-app purchases are not configured.';
        console.warn(`[Entitlement] subscribeToProduct: Purchases unavailable`, { message });
        Alert.alert('Not Available', message);
        setError(message);
        return;
      }

      const pkg = findPackageByProductIds(productIds, productName);
      if (!pkg) {
        console.warn(`[Entitlement] ${productName} package not found in offerings`);
        Alert.alert('Not Available', 'Subscription is not available right now. Please try again later.');
        return;
      }

      const storePath = Platform.OS === 'android' ? 'Google Play' : 'Apple App Store';
      console.log(`[Entitlement] Purchasing package via ${storePath}`, { productId: pkg.product.identifier, offeringId: pkg.offeringIdentifier, platform: Platform.OS });
      const result = await withTimeout(purchases.purchasePackage(pkg), PURCHASE_TIMEOUT_MS, 'Purchasing subscription');
      console.log('[Entitlement] purchasePackage result', {
        purchasedProductId: result.productIdentifier,
        activeSubscriptions: result.customerInfo?.activeSubscriptions ?? [],
      });

      if (!mountedRef.current) return;
      const storedTrialEnd = await AsyncStorage.getItem(storageKeys.TRIAL_END);
      const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;
      setStateFromCustomerInfo(result.customerInfo, currentTrialEnd, isGrandfathered, hasPrivilegedAccess);
      const successStore = Platform.OS === 'android' ? 'Google Play' : 'App Store';
      Alert.alert('Success', `Full access unlocked via ${successStore}.`);
    } catch (e) {
      const message = getErrorMessage(e, 'Subscription failed.');
      console.error('[Entitlement] subscribeToProduct failed:', message, e);
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Subscription Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [auth.isAdmin, ensurePurchasesLoaded, findPackageByProductIds, hasPrivilegedAccess, isGrandfathered, setStateFromCustomerInfo, storageKeys.TRIAL_END, storageKeys.WEB_IS_PRO]);

  const subscribeBasicMonthly = useCallback(async () => {
    await subscribeToProduct(BASIC_PRODUCT_IDS, 'Basic monthly subscription');
  }, [subscribeToProduct]);

  const subscribeProMonthly = useCallback(async () => {
    await subscribeToProduct(MONTHLY_PRODUCT_IDS, 'Pro monthly subscription');
  }, [subscribeToProduct]);

  const subscribeProAnnual = useCallback(async () => {
    await subscribeToProduct(ANNUAL_PRODUCT_IDS, 'Pro annual subscription');
  }, [subscribeToProduct]);

  const restore = useCallback(async () => {
    const restoreStoreName = Platform.OS === 'android' ? 'Google Play' : Platform.OS === 'ios' ? 'App Store' : 'Web';
    console.log(`[Entitlement] restore called on ${restoreStoreName} (${Platform.OS})`);
    if (actionInFlightRef.current) {
      console.log('[Entitlement] restore ignored: action already in flight');
      return;
    }
    actionInFlightRef.current = true;
    setError(null);

    if (Platform.OS === 'web') {
      try {
        await refresh();
        const accessRecovered = hasPrivilegedAccess || isGrandfathered || lastIsProRef.current;
        Alert.alert(
          'Restore Complete',
          accessRecovered
            ? 'Your access status has been refreshed for this account.'
            : 'No active purchase was found in this web preview. If you purchased on mobile, use Manage Subscriptions or restore on that device.'
        );
      } finally {
        actionInFlightRef.current = false;
      }
      return;
    }

    try {
      setIsLoading(true);
      
      let hasWhitelistAccess = false;
      if (auth.isWhitelisted && auth.authenticatedEmail) {
        console.log('[Entitlement] Whitelisted email detected during restore:', auth.authenticatedEmail);
        hasWhitelistAccess = true;
        
        setIsPro(true);
        setSource('dev');
        setLastCheckedAt(new Date().toISOString());
        
        const wasPro = lastIsProRef.current;
        lastIsProRef.current = true;
        
        if (!wasPro) {
          try {
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
              console.log('[Entitlement] Dispatching entitlementProUnlocked event for whitelisted user');
              window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
            }
          } catch (e) {
            console.error('[Entitlement] Failed to dispatch entitlementProUnlocked event', e);
          }
        }
      }
      
      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        const message = purchasesInitError ?? 'In-app purchases are not configured.';
        console.warn('[Entitlement] restore: Purchases unavailable', { message });
        
        if (hasWhitelistAccess) {
          Alert.alert('Success', 'Full access unlocked via whitelisted email.');
        } else {
          Alert.alert('Not Available', message);
          setError(message);
        }
        return;
      }

      await syncPurchasesIdentity(purchases);
      console.log(`[Entitlement] Restoring purchases via ${restoreStoreName}`);
      const info = await withTimeout(purchases.restorePurchases(), DEFAULT_TIMEOUT_MS, 'Restoring purchases');
      console.log('[Entitlement] restorePurchases customerInfo', {
        activeSubscriptions: info?.activeSubscriptions ?? [],
        entitlements: Object.keys(info?.entitlements?.active ?? {}),
      });
      if (!mountedRef.current) return;
      
      const hasProPurchase = computeIsProFromCustomerInfo(info);
      const hasBasicPurchase = computeIsBasicFromCustomerInfo(info);
      const hasAnyActivePurchase = hasProPurchase || hasBasicPurchase;
      
      const storedTrialEnd = await AsyncStorage.getItem(storageKeys.TRIAL_END);
      const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;
      setStateFromCustomerInfo(info, currentTrialEnd, isGrandfathered, hasPrivilegedAccess);
      
      if (!mountedRef.current) return;
      
      if (hasWhitelistAccess && hasAnyActivePurchase) {
        const tierName = hasProPurchase ? 'Pro' : 'Basic';
        Alert.alert('Success', `Full access unlocked via whitelisted email and active ${tierName} subscription restored.`);
      } else if (hasWhitelistAccess) {
        Alert.alert('Success', 'Full access unlocked via whitelisted email.');
      } else if (hasProPurchase) {
        Alert.alert('Restored', 'Pro subscription restored successfully.');
      } else if (hasBasicPurchase) {
        Alert.alert('Restored', 'Basic subscription restored successfully.');
      } else {
        Alert.alert('Restored', 'No active subscription found.');
      }
    } catch (e) {
      const message = getErrorMessage(e, 'Restore failed.');
      console.error('[Entitlement] restore failed:', message, e);
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Restore Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [auth.authenticatedEmail, auth.isWhitelisted, ensurePurchasesLoaded, hasPrivilegedAccess, isGrandfathered, refresh, setStateFromCustomerInfo, storageKeys.TRIAL_END, syncPurchasesIdentity]);

  const openManageSubscription = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Manage Subscriptions', 'Choose the store where you purchased Easy Seas.', [
        {
          text: 'Apple ID',
          onPress: () => {
            void safeOpenURL(MANAGE_SUBS_IOS_URL);
          },
        },
        {
          text: 'Google Play',
          onPress: () => {
            void safeOpenURL(MANAGE_SUBS_ANDROID_URL);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]);
      return;
    }
    const url = Platform.OS === 'android' ? MANAGE_SUBS_ANDROID_URL : MANAGE_SUBS_IOS_URL;
    const storeName = Platform.OS === 'android' ? 'Google Play' : 'App Store';
    console.log(`[Entitlement] Opening ${storeName} subscription management: ${url}`);
    await safeOpenURL(url);
  }, []);

  const openPrivacyPolicy = useCallback(async () => {
    await safeOpenURL(PRIVACY_URL);
  }, []);

  const openTerms = useCallback(async () => {
    await safeOpenURL(TERMS_URL);
  }, []);

  const manualUnlock = useCallback(async () => {
    console.log('[Entitlement] manualUnlock called');
    try {
      await AsyncStorage.setItem(storageKeys.WEB_IS_PRO, 'true');
      if (!mountedRef.current) return;
      
      const wasPro = lastIsProRef.current;
      
      setIsPro(true);
      setTier('pro');
      setSource('dev');
      setLastCheckedAt(new Date().toISOString());
      
      lastIsProRef.current = true;
      
      if (!wasPro) {
        try {
          if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            console.log('[Entitlement] Dispatching entitlementProUnlocked event for manual unlock');
            window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
          }
        } catch (e) {
          console.error('[Entitlement] Failed to dispatch entitlementProUnlocked event', e);
        }
      }
      
      console.log('[Entitlement] Manual unlock successful');
    } catch (e) {
      console.error('[Entitlement] manualUnlock failed', e);
      throw e;
    }
  }, [storageKeys.WEB_IS_PRO]);

  return useMemo(
    () => ({
      isPro,
      isBasic,
      tier,
      trialEnd,
      trialDaysRemaining,
      source,
      lastCheckedAt,
      customerInfo,
      offerings,
      availableProductIds,
      hasAnyOffering,
      isLoading,
      error,
      isGrandfathered,
      accountCreatedAt,
      subscriptionDisplayStatus,
      billingStoreLabel: billingDetails.billingStoreLabel,
      billingEnvironment: billingDetails.billingEnvironment,
      expectedRevenueCatKeyName: billingDetails.expectedRevenueCatKeyName,
      revenueCatAppUserId,
      refresh,
      subscribeBasicMonthly,
      subscribeProMonthly,
      subscribeProAnnual,
      restore,
      openManageSubscription,
      openPrivacyPolicy,
      openTerms,
      manualUnlock,
    }),
    [
      isPro,
      isBasic,
      tier,
      trialEnd,
      trialDaysRemaining,
      source,
      lastCheckedAt,
      customerInfo,
      offerings,
      availableProductIds,
      hasAnyOffering,
      isLoading,
      error,
      isGrandfathered,
      accountCreatedAt,
      subscriptionDisplayStatus,
      billingDetails.billingStoreLabel,
      billingDetails.billingEnvironment,
      billingDetails.expectedRevenueCatKeyName,
      revenueCatAppUserId,
      refresh,
      subscribeBasicMonthly,
      subscribeProMonthly,
      subscribeProAnnual,
      restore,
      openManageSubscription,
      openPrivacyPolicy,
      openTerms,
      manualUnlock,
    ]
  );
});
