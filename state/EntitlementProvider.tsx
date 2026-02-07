import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import Constants from 'expo-constants';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthProvider';

type PurchasesModule = {
  getOfferings: () => Promise<{ all?: Record<string, PurchasesOffering> }>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ productIdentifier: string; customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  configure: (args: { apiKey: string; appUserID?: string }) => void;
};

let Purchases: PurchasesModule | null = null;
let purchasesInitError: string | null = null;

export type EntitlementSource = 'iap' | 'dev' | 'unknown';
export type SubscriptionTier = 'trial' | 'view' | 'basic' | 'pro';

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

const KEYS = {
  WEB_IS_PRO: 'easyseas_entitlements_web_is_pro',
  TRIAL_START: 'easyseas_trial_start',
  TRIAL_END: 'easyseas_trial_end',
} as const;

const TRIAL_DURATION_DAYS = 30;

const DEFAULT_TIMEOUT_MS = 20000 as const;

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

const PRIVACY_URL = 'https://example.com/privacy' as const;
const TERMS_URL = 'https://example.com/terms' as const;
const MANAGE_SUBS_IOS_URL = 'https://apps.apple.com/account/subscriptions' as const;
const MANAGE_SUBS_ANDROID_URL = 'https://play.google.com/store/account/subscriptions' as const;

function computeIsProFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  try {
    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements);
    if (entitlementIds.includes('pro')) return true;

    const active = (info.activeSubscriptions ?? []) as string[];
    if (active.includes(PRO_PRODUCT_ID_MONTHLY) || active.includes(PRO_PRODUCT_ID_ANNUAL)) return true;

    return false;
  } catch (e) {
    console.error('[Entitlement] computeIsProFromCustomerInfo failed', e);
    return false;
  }
}

function computeIsBasicFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  try {
    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements);
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

  const mountedRef = useRef<boolean>(true);
  const actionInFlightRef = useRef<boolean>(false);
  const lastIsProRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initializeTrial = useCallback(async () => {
    try {
      const storedTrialStart = await AsyncStorage.getItem(KEYS.TRIAL_START);
      const storedTrialEnd = await AsyncStorage.getItem(KEYS.TRIAL_END);

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
      
      await AsyncStorage.setItem(KEYS.TRIAL_START, now.toISOString());
      await AsyncStorage.setItem(KEYS.TRIAL_END, end.toISOString());
      
      console.log('[Entitlement] Trial initialized', { start: now.toISOString(), end: end.toISOString() });
      setTrialEnd(end);
      setTrialDaysRemaining(TRIAL_DURATION_DAYS);
    } catch (e) {
      console.error('[Entitlement] Failed to initialize trial', e);
    }
  }, []);

  const computeTier = useCallback((isPro: boolean, isBasic: boolean, trialEnd: Date | null): SubscriptionTier => {
    if (isPro) return 'pro';
    if (isBasic) return 'basic';
    if (trialEnd && new Date() < trialEnd) return 'trial';
    return 'view';
  }, []);

  const setStateFromCustomerInfo = useCallback((info: CustomerInfo | null, currentTrialEnd: Date | null) => {
    const computedIsPro = computeIsProFromCustomerInfo(info);
    const computedIsBasic = computeIsBasicFromCustomerInfo(info);
    const computedTier = computeTier(computedIsPro, computedIsBasic, currentTrialEnd);
    
    console.log('[Entitlement] setStateFromCustomerInfo', {
      computedIsPro,
      computedIsBasic,
      computedTier,
      activeSubscriptions: info?.activeSubscriptions ?? [],
      entitlementsActiveKeys: Object.keys(info?.entitlements?.active ?? {}),
    });

    const wasPro = lastIsProRef.current;

    setCustomerInfo(info);
    setIsPro(computedIsPro);
    setIsBasic(computedIsBasic);
    setTier(computedTier);
    setSource(computedIsPro || computedIsBasic ? 'iap' : 'unknown');
    setLastCheckedAt(new Date().toISOString());

    lastIsProRef.current = computedIsPro;

    if (!wasPro && computedIsPro) {
      try {
        if (typeof window !== 'undefined') {
          console.log('[Entitlement] Dispatching entitlementProUnlocked event');
          window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
        }
      } catch (e) {
        console.error('[Entitlement] Failed to dispatch entitlementProUnlocked event', e);
      }
    }
  }, [computeTier]);

  const ensurePurchasesLoaded = useCallback(async (): Promise<PurchasesModule | null> => {
    if (Platform.OS === 'web') return null;

    const isExpoGo = Constants.appOwnership === 'expo';
    
    let apiKey: string;
    if (isExpoGo) {
      apiKey = (
        process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ??
        ''
      ).trim();
      
      if (!apiKey) {
        purchasesInitError = 'IAP not available in Expo Go. Use a development build or web preview for testing.';
        console.warn('[Entitlement] RevenueCat IAP requires a development build or Test Store API Key for Expo Go. See https://rev.cat/sdk-test-store');
        return null;
      }
    } else {
      apiKey = (
        process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY ??
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ??
        process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ??
        process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
        process.env.EXPO_PUBLIC_REVENUECAT_KEY ??
        'appl_ByMylGXTSwaAUxxRUwhteOFaJjL'
      ).trim();
    }

    if (!apiKey) {
      purchasesInitError = 'Missing RevenueCat API Key. Set EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY or EXPO_PUBLIC_REVENUECAT_API_KEY.';
      console.warn('[Entitlement] Missing RevenueCat API Key.');
      return null;
    }

    if (apiKey.startsWith('sk_')) {
      purchasesInitError =
        'Invalid RevenueCat key provided. This looks like a secret key (sk_...). Please use the Public SDK Key from RevenueCat (typically starts with appl_...).';
      console.warn('[Entitlement] Refusing to initialize Purchases with a secret key (sk_...)');
      return null;
    }

    if (Purchases) return Purchases;

    try {
      const mod = (await import('react-native-purchases')) as unknown as { default: PurchasesModule };
      Purchases = mod.default;

      console.log('[Entitlement] Configuring Purchases', {
        hasApiKey: !!apiKey,
        platform: Platform.OS,
        isExpoGo,
        keyType: isExpoGo ? 'test' : 'production',
      });

      Purchases.configure({ apiKey });
      purchasesInitError = null;

      return Purchases;
    } catch (e) {
      purchasesInitError =
        e instanceof Error
          ? `Failed to initialize purchases: ${e.message}`
          : 'Failed to initialize purchases.';
      console.error('[Entitlement] Failed to load/initialize react-native-purchases', e);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    console.log('[Entitlement] refresh called');
    setError(null);

    if (!mountedRef.current) return;
    setIsLoading(true);

    await initializeTrial();

    const storedTrialEnd = await AsyncStorage.getItem(KEYS.TRIAL_END);
    const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;

    if (Platform.OS === 'web') {
      try {
        const stored = await AsyncStorage.getItem(KEYS.WEB_IS_PRO);
        const storedIsPro = stored === 'true';
        console.log('[Entitlement] web refresh: storedIsPro', storedIsPro);
        if (!mountedRef.current) return;
        setIsPro(storedIsPro);
        setIsBasic(false);
        setTier(computeTier(storedIsPro, false, currentTrialEnd));
        setSource(storedIsPro ? 'dev' : 'unknown');
        setLastCheckedAt(new Date().toISOString());
        setCustomerInfo(null);
        setOfferings([]);
      } catch (e) {
        console.error('[Entitlement] web refresh failed', e);
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
      } finally {
        if (!mountedRef.current) return;
        setIsLoading(false);
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

      console.log('[Entitlement] Fetching offerings');
      const offers = await withTimeout(purchases.getOfferings(), DEFAULT_TIMEOUT_MS, 'Loading subscription options');
      const allOfferings = Object.values(offers.all ?? {});
      console.log('[Entitlement] Offerings fetched:', allOfferings.map(o => ({ identifier: o.identifier, packages: o.availablePackages?.length ?? 0 })));
      if (!mountedRef.current) return;
      setOfferings(allOfferings);

      console.log('[Entitlement] Fetching customer info');
      const info = await withTimeout(purchases.getCustomerInfo(), DEFAULT_TIMEOUT_MS, 'Checking subscription status');
      if (!mountedRef.current) return;
      setStateFromCustomerInfo(info, currentTrialEnd);
    } catch (e) {
      console.error('[Entitlement] refresh failed', e);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [ensurePurchasesLoaded, setStateFromCustomerInfo, initializeTrial, computeTier]);

  useEffect(() => {
    console.log('[Entitlement] Provider mounted - refreshing entitlements');
    refresh().catch((e) => console.error('[Entitlement] initial refresh failed', e));
  }, [refresh]);

  useEffect(() => {
    lastIsProRef.current = isPro;
  }, [isPro]);

  const findPackageByProductId = useCallback((productId: string): PurchasesPackage | null => {
    try {
      const paywallOffering = offerings.find(o => o.identifier === 'PAYWALL');
      if (paywallOffering) {
        for (const p of paywallOffering.availablePackages ?? []) {
          const id = p.product.identifier;
          console.log('[Entitlement] Checking package in PAYWALL offering:', { id, priceString: p.product.priceString });
          if (id === productId) {
            console.log('[Entitlement] Found matching package in PAYWALL offering');
            return p;
          }
        }
      }
      
      console.log('[Entitlement] PAYWALL offering not found, searching all offerings');
      for (const offering of offerings) {
        for (const p of offering.availablePackages ?? []) {
          const id = p.product.identifier;
          if (id === productId) {
            console.log('[Entitlement] Found matching package in offering:', offering.identifier);
            return p;
          }
        }
      }
      console.warn('[Entitlement] No package found with product ID:', productId);
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
        await AsyncStorage.setItem(KEYS.WEB_IS_PRO, 'true');
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

      console.log('[Entitlement] Purchasing package', { productId: pkg.product.identifier, offeringId: pkg.offeringIdentifier });
      const result = await withTimeout(purchases.purchasePackage(pkg), DEFAULT_TIMEOUT_MS, 'Purchasing subscription');
      console.log('[Entitlement] purchasePackage result', {
        purchasedProductId: result.productIdentifier,
        activeSubscriptions: result.customerInfo?.activeSubscriptions ?? [],
      });

      if (!mountedRef.current) return;
      const storedTrialEnd = await AsyncStorage.getItem(KEYS.TRIAL_END);
      const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;
      setStateFromCustomerInfo(result.customerInfo, currentTrialEnd);
      Alert.alert('Success', 'Full access unlocked.');
    } catch (e) {
      console.error(`[Entitlement] subscribeToProduct failed`, e);
      const message = e instanceof Error ? e.message : 'Subscription failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Subscription Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [ensurePurchasesLoaded, findPackageByProductId, setStateFromCustomerInfo]);

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
    console.log('[Entitlement] restore called');
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
        setSource('dev');
        setLastCheckedAt(new Date().toISOString());
        
        const wasPro = lastIsProRef.current;
        lastIsProRef.current = true;
        
        if (!wasPro) {
          try {
            if (typeof window !== 'undefined') {
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

      const info = await withTimeout(purchases.restorePurchases(), DEFAULT_TIMEOUT_MS, 'Restoring purchases');
      console.log('[Entitlement] restorePurchases customerInfo', {
        activeSubscriptions: info?.activeSubscriptions ?? [],
        entitlements: Object.keys(info?.entitlements?.active ?? {}),
      });
      if (!mountedRef.current) return;
      
      const hasProPurchase = computeIsProFromCustomerInfo(info);
      const hasBasicPurchase = computeIsBasicFromCustomerInfo(info);
      const hasAnyActivePurchase = hasProPurchase || hasBasicPurchase;
      
      const storedTrialEnd = await AsyncStorage.getItem(KEYS.TRIAL_END);
      const currentTrialEnd = storedTrialEnd ? new Date(storedTrialEnd) : null;
      setStateFromCustomerInfo(info, currentTrialEnd);
      
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
      console.error('[Entitlement] restore failed', e);
      const message = e instanceof Error ? e.message : 'Restore failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Restore Failed', message);
    } finally {
      actionInFlightRef.current = false;
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [auth.isWhitelisted, auth.authenticatedEmail, ensurePurchasesLoaded, setStateFromCustomerInfo]);

  const openManageSubscription = useCallback(async () => {
    const url = Platform.OS === 'android' ? MANAGE_SUBS_ANDROID_URL : MANAGE_SUBS_IOS_URL;
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
      await AsyncStorage.setItem(KEYS.WEB_IS_PRO, 'true');
      if (!mountedRef.current) return;
      
      const wasPro = lastIsProRef.current;
      
      setIsPro(true);
      setSource('dev');
      setLastCheckedAt(new Date().toISOString());
      
      lastIsProRef.current = true;
      
      if (!wasPro) {
        try {
          if (typeof window !== 'undefined') {
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
  }, []);

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
