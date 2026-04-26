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

export type EntitlementSource = 'iap' | 'dev' | 'grandfathered' | 'free_use' | 'unknown';
export type SubscriptionTier = 'trial' | 'view' | 'basic' | 'pro';
export type SubscriptionDisplayStatus = 'grace_period' | 'monthly' | 'annual' | 'free_use' | 'expired';

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
  isLoading: boolean;
  error: string | null;
  isGrandfathered: boolean;
  accountCreatedAt: Date | null;
  subscriptionDisplayStatus: SubscriptionDisplayStatus;
  subscriptionLevel: string | null;
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
const GRANDFATHERING_CUTOFF_DATE = new Date('2026-02-08T23:59:59.999Z');

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

export const BASIC_PRODUCT_ID_MONTHLY = 'easyseas_pro_monthly' as const;
export const PRO_PRODUCT_ID_MONTHLY = 'easyseas_pro_monthly' as const;
export const PRO_PRODUCT_ID_ANNUAL = 'easyseas_pro_annual' as const;

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
    if (active.includes(PRO_PRODUCT_ID_MONTHLY) || active.includes(PRO_PRODUCT_ID_ANNUAL)) return true;

    return false;
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
    if (active.includes(PRO_PRODUCT_ID_ANNUAL)) return 'annual';
    if (active.includes(PRO_PRODUCT_ID_MONTHLY) || active.includes(BASIC_PRODUCT_ID_MONTHLY)) return 'monthly';
    
    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements).map(k => k.toLowerCase().trim());
    if (entitlementIds.includes('pro') || entitlementIds.includes('pro access') || entitlementIds.includes('basic')) {
      if (active.some(s => s.toLowerCase().includes('annual') || s.toLowerCase().includes('yearly'))) return 'annual';
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
    if (active.includes(BASIC_PRODUCT_ID_MONTHLY)) return true;

    return false;
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
  const [isGrandfathered, setIsGrandfathered] = useState<boolean>(false);
  const [accountCreatedAt, setAccountCreatedAt] = useState<Date | null>(null);
  const [subscriptionDisplayStatus, setSubscriptionDisplayStatus] = useState<SubscriptionDisplayStatus>('grace_period');

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
          const existingUserDate = storedTrialStart ? new Date(storedTrialStart) : new Date('2026-01-01T00:00:00.000Z');
          accountDate = existingUserDate;
          console.log('[Entitlement] Existing user detected (has trial or data) - setting account creation to:', accountDate.toISOString());
        } else {
          accountDate = new Date();
          console.log('[Entitlement] New user - account creation date set to now:', accountDate.toISOString());
        }
        
        await AsyncStorage.setItem(storageKeys.FIRST_ACCOUNT_CREATED, accountDate.toISOString());
      }
      
      setAccountCreatedAt(accountDate);
      
      const isGrandfatheredUser = accountDate <= GRANDFATHERING_CUTOFF_DATE;
      setIsGrandfathered(isGrandfatheredUser);
      
      if (isGrandfatheredUser) {
        console.log('[Entitlement] ✅ GRANDFATHERED USER - Account created before cutoff date');
        console.log('[Entitlement] Account created:', accountDate.toISOString());
        console.log('[Entitlement] Cutoff date:', GRANDFATHERING_CUTOFF_DATE.toISOString());
      } else {
        console.log('[Entitlement] Not grandfathered - account created after:', GRANDFATHERING_CUTOFF_DATE.toISOString());
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

  const computeDisplayStatus = useCallback((info: CustomerInfo | null, currentTrialEnd: Date | null, currentIsGrandfathered: boolean, computedIsPro: boolean, computedIsBasic: boolean, currentHasFreeUse: boolean): SubscriptionDisplayStatus => {
    const subType = detectActiveSubscriptionType(info);
    console.log('[Entitlement] computeDisplayStatus', { subType, currentIsGrandfathered, computedIsPro, computedIsBasic, currentHasFreeUse, trialEnd: currentTrialEnd?.toISOString() });
    
    if (currentHasFreeUse) return 'free_use';
    if (subType === 'annual') return 'annual';
    if (subType === 'monthly') return 'monthly';
    
    if (currentIsGrandfathered) return 'monthly';
    
    if (computedIsPro || computedIsBasic) return 'monthly';
    
    if (currentTrialEnd) {
      const now = new Date();
      if (now < currentTrialEnd) return 'grace_period';
    }
    
    return 'expired';
  }, []);

  const setStateFromCustomerInfo = useCallback((info: CustomerInfo | null, currentTrialEnd: Date | null, currentIsGrandfathered: boolean) => {
    const computedIsPro = computeIsProFromCustomerInfo(info);
    const computedIsBasic = computeIsBasicFromCustomerInfo(info);
    const hasFreeUse = auth.isWhitelisted;
    const computedTier = hasFreeUse ? 'pro' : computeTier(computedIsPro, computedIsBasic, currentTrialEnd, currentIsGrandfathered);
    
    console.log('[Entitlement] setStateFromCustomerInfo', {
      computedIsPro,
      computedIsBasic,
      computedTier,
      isGrandfathered: currentIsGrandfathered,
      hasFreeUse,
      subscriptionLevel: auth.subscriptionLevel,
      activeSubscriptions: info?.activeSubscriptions ?? [],
      entitlementsActiveKeys: Object.keys(info?.entitlements?.active ?? {}),
    });

    const wasPro = lastIsProRef.current;
    const finalIsPro = hasFreeUse || currentIsGrandfathered || computedIsPro;

    setCustomerInfo(info);
    setIsPro(finalIsPro);
    setIsBasic(hasFreeUse || computedIsBasic);
    setTier(computedTier);
    setSource(hasFreeUse ? 'free_use' : currentIsGrandfathered ? 'grandfathered' : (computedIsPro || computedIsBasic ? 'iap' : 'unknown'));
    setLastCheckedAt(new Date().toISOString());
    
    const displayStatus = computeDisplayStatus(info, currentTrialEnd, currentIsGrandfathered, computedIsPro, computedIsBasic, hasFreeUse);
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
  }, [auth.isWhitelisted, auth.subscriptionLevel, computeDisplayStatus, computeTier]);

  const ensurePurchasesLoaded = useCallback(async (): Promise<PurchasesModule | null> => {
    if (Platform.OS === 'web') return null;

    const isExpoGo = Constants.appOwnership === 'expo';

    if (isExpoGo) {
      purchasesInitError = 'IAP not available in Expo Go. Use a development build or web preview for testing.';
      console.warn('[Entitlement] Skipping react-native-purchases in Expo Go — native module not available.');
      return null;
    }

    let apiKey = '';
    let keySource = '';

    if (Platform.OS === 'android') {
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
      const mod = (await import('react-native-purchases')) as unknown as { default: PurchasesModule };
      Purchases = mod.default;

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
      purchasesInitError =
        e instanceof Error
          ? `Failed to initialize purchases: ${e.message}`
          : 'Failed to initialize purchases.';
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
      if (currentAppUserId && !isAnonymous) {
        try {
          await withTimeout(purchases.logOut(), DEFAULT_TIMEOUT_MS, 'Clearing purchase session');
        } catch (e) {
          console.warn('[Entitlement] logOut failed (user may already be anonymous):', e);
        }
      }
      return;
    }

    if (currentAppUserId === normalizedAuthenticatedEmail) {
      return;
    }

    const loginResult = await withTimeout(
      purchases.logIn(normalizedAuthenticatedEmail),
      DEFAULT_TIMEOUT_MS,
      'Linking subscription to your email'
    );

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

    if (auth.isWhitelisted) {
      const wasPro = lastIsProRef.current;
      setIsPro(true);
      setIsBasic(true);
      setTier('pro');
      setSource('free_use');
      setLastCheckedAt(new Date().toISOString());
      setCustomerInfo(null);
      setOfferings([]);
      setSubscriptionDisplayStatus('free_use');
      lastIsProRef.current = true;
      if (!wasPro) {
        try {
          if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
            console.log('[Entitlement] Dispatching entitlementProUnlocked event for free-use user');
            window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
          }
        } catch (e) {
          console.error('[Entitlement] Failed to dispatch entitlementProUnlocked event for free-use user', e);
        }
      }
      setIsLoading(false);
      console.log('[Entitlement] Free-use whitelist entitlement active:', { email: auth.authenticatedEmail, subscriptionLevel: auth.subscriptionLevel });
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const stored = await AsyncStorage.getItem(storageKeys.WEB_IS_PRO);
        const storedIsPro = stored === 'true';
        const hasFreeUse = auth.isWhitelisted;
        console.log('[Entitlement] web refresh: storedIsPro', storedIsPro, 'isGrandfathered', currentIsGrandfathered, 'hasFreeUse', hasFreeUse);
        if (!mountedRef.current) return;
        const finalIsPro = hasFreeUse || currentIsGrandfathered || storedIsPro;
        setIsPro(finalIsPro);
        setIsBasic(hasFreeUse);
        setTier(hasFreeUse ? 'pro' : computeTier(storedIsPro, false, currentTrialEnd, currentIsGrandfathered));
        setSource(hasFreeUse ? 'free_use' : currentIsGrandfathered ? 'grandfathered' : (storedIsPro ? 'dev' : 'unknown'));
        setLastCheckedAt(new Date().toISOString());
        setCustomerInfo(null);
        setOfferings([]);
        const webDisplayStatus = computeDisplayStatus(null, currentTrialEnd, currentIsGrandfathered, storedIsPro, false, hasFreeUse);
        setSubscriptionDisplayStatus(webDisplayStatus);
        console.log('[Entitlement] Web display status set to:', webDisplayStatus);
      } catch (e) {
        console.error('[Entitlement] web refresh failed', e);
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
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
        console.warn('[Entitlement] refresh: Purchases unavailable', { message });
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
      setStateFromCustomerInfo(info, currentTrialEnd, currentIsGrandfathered);
    } catch (e) {
      console.error('[Entitlement] refresh failed', e);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [auth.authenticatedEmail, auth.isWhitelisted, auth.subscriptionLevel, computeDisplayStatus, computeTier, ensurePurchasesLoaded, initializeAccountTracking, initializeTrial, setStateFromCustomerInfo, storageKeys.TRIAL_END, storageKeys.WEB_IS_PRO, syncPurchasesIdentity]);

  useEffect(() => {
    console.log('[Entitlement] Provider mounted - refreshing entitlements');
    refresh().catch((e) => console.error('[Entitlement] initial refresh failed', e));
  }, [refresh]);

  useEffect(() => {
    lastIsProRef.current = isPro;
  }, [isPro]);

  const findPackageByProductId = useCallback((productId: string): PurchasesPackage | null => {
    try {
      console.log('[Entitlement] Searching for product:', productId, 'across', offerings.length, 'offerings');
      for (const offering of offerings) {
        console.log('[Entitlement] Checking offering:', offering.identifier, 'packages:', (offering.availablePackages ?? []).length);
        for (const p of offering.availablePackages ?? []) {
          const id = p.product.identifier;
          console.log('[Entitlement] Checking package product:', { id, priceString: p.product.priceString });
          if (id === productId) {
            console.log('[Entitlement] Found matching package in offering:', offering.identifier);
            return p;
          }
        }
      }
      console.warn('[Entitlement] No package found with store product ID:', productId);
      console.warn('[Entitlement] Available products:', offerings.flatMap(o => (o.availablePackages ?? []).map(p => p.product.identifier)));
      return null;
    } catch (e) {
      console.error('[Entitlement] findPackageByProductId failed', e);
      return null;
    }
  }, [offerings]);

  const subscribeToProduct = useCallback(async (productId: string, productName: string) => {
    console.log(`[Entitlement] subscribeToProduct called for ${productName}`);
    if (actionInFlightRef.current) {
      console.log(`[Entitlement] subscribeToProduct ignored: action already in flight`);
      return;
    }
    actionInFlightRef.current = true;
    setError(null);

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

      const pkg = findPackageByProductId(productId);
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
      setStateFromCustomerInfo(result.customerInfo, currentTrialEnd, isGrandfathered);
      const successStore = Platform.OS === 'android' ? 'Google Play' : 'App Store';
      Alert.alert('Success', `Full access unlocked via ${successStore}.`);
    } catch (e) {
      console.error(`[Entitlement] subscribeToProduct failed`, e);
      const message = e instanceof Error ? e.message : 'Subscription failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Subscription Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [ensurePurchasesLoaded, findPackageByProductId, isGrandfathered, setStateFromCustomerInfo, storageKeys.TRIAL_END, storageKeys.WEB_IS_PRO]);

  const subscribeBasicMonthly = useCallback(async () => {
    await subscribeToProduct(BASIC_PRODUCT_ID_MONTHLY, 'Basic monthly subscription');
  }, [subscribeToProduct]);

  const subscribeProMonthly = useCallback(async () => {
    await subscribeToProduct(PRO_PRODUCT_ID_MONTHLY, 'Pro monthly subscription');
  }, [subscribeToProduct]);

  const subscribeProAnnual = useCallback(async () => {
    await subscribeToProduct(PRO_PRODUCT_ID_ANNUAL, 'Pro annual subscription');
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
      actionInFlightRef.current = false;
      Alert.alert('Not Supported', 'Restore purchases is not supported in web preview.');
      return;
    }

    try {
      setIsLoading(true);
      
      let hasWhitelistAccess = false;
      if (auth.isWhitelisted && auth.authenticatedEmail) {
        console.log('[Entitlement] Whitelisted email detected during restore:', auth.authenticatedEmail);
        hasWhitelistAccess = true;
        
        setIsPro(true);
        setIsBasic(true);
        setTier('pro');
        setSource('free_use');
        setSubscriptionDisplayStatus('free_use');
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
          Alert.alert('Success', 'Free Use of App access is active for this email.');
        } else {
          Alert.alert('Not Available', message);
          setError(message);
        }
        return;
      }

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
      setStateFromCustomerInfo(info, currentTrialEnd, isGrandfathered);
      
      if (!mountedRef.current) return;
      
      if (hasWhitelistAccess && hasAnyActivePurchase) {
        const tierName = hasProPurchase ? 'Pro' : 'Basic';
        Alert.alert('Success', `Free Use of App access is active and active ${tierName} subscription was also restored.`);
      } else if (hasWhitelistAccess) {
        Alert.alert('Success', 'Free Use of App access is active for this email.');
      } else if (hasProPurchase) {
        Alert.alert('Restored', 'Pro subscription restored successfully.');
      } else if (hasBasicPurchase) {
        Alert.alert('Restored', 'Basic subscription restored successfully.');
      } else {
        Alert.alert('Restored', 'No active subscription found.');
      }
    } catch (e) {
      console.error('[Entitlement] restore failed', e);
      const message = e instanceof Error ? e.message : 'Restore failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Restore Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [auth.authenticatedEmail, auth.isWhitelisted, ensurePurchasesLoaded, isGrandfathered, setStateFromCustomerInfo, storageKeys.TRIAL_END]);

  const openManageSubscription = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Subscription management is available on your mobile device.');
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
      isLoading,
      error,
      isGrandfathered,
      accountCreatedAt,
      subscriptionDisplayStatus,
      subscriptionLevel: auth.isWhitelisted ? (auth.subscriptionLevel ?? 'Free Use of App') : null,
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
      isLoading,
      error,
      isGrandfathered,
      accountCreatedAt,
      subscriptionDisplayStatus,
      auth.isWhitelisted,
      auth.subscriptionLevel,
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
