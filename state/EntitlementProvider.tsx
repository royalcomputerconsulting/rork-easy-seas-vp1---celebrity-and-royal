import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

type PurchasesModule = {
  getOfferings: () => Promise<{ all?: Record<string, PurchasesOffering> }>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ productIdentifier: string; customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  configure: (args: { apiKey: string; appUserID?: string }) => void;
};

let Purchases: PurchasesModule | null = null;

export type EntitlementSource = 'iap' | 'dev' | 'unknown';

export interface EntitlementState {
  isPro: boolean;
  source: EntitlementSource;
  lastCheckedAt: string | null;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  subscribeMonthly: () => Promise<void>;
  restore: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
  openPrivacyPolicy: () => Promise<void>;
  openTerms: () => Promise<void>;
}

const KEYS = {
  WEB_IS_PRO: 'easyseas_entitlements_web_is_pro',
} as const;

export const PRO_PRODUCT_ID = 'com.easyseas.pro.monthly' as const;

const PRIVACY_URL = 'https://example.com/privacy' as const;
const TERMS_URL = 'https://example.com/terms' as const;
const MANAGE_SUBS_URL = 'https://apps.apple.com/account/subscriptions' as const;

function computeIsProFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;

  try {
    const active = (info.activeSubscriptions ?? []) as string[];
    if (active.includes(PRO_PRODUCT_ID)) return true;

    const entitlements = (info.entitlements?.active ?? {}) as Record<string, unknown>;
    const entitlementIds = Object.keys(entitlements);
    if (entitlementIds.includes('pro')) return true;

    return false;
  } catch (e) {
    console.error('[Entitlement] computeIsProFromCustomerInfo failed', e);
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
  const [isPro, setIsPro] = useState<boolean>(false);
  const [source, setSource] = useState<EntitlementSource>('unknown');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setStateFromCustomerInfo = useCallback((info: CustomerInfo | null) => {
    const computedIsPro = computeIsProFromCustomerInfo(info);
    console.log('[Entitlement] setStateFromCustomerInfo', {
      computedIsPro,
      activeSubscriptions: info?.activeSubscriptions ?? [],
      entitlementsActiveKeys: Object.keys(info?.entitlements?.active ?? {}),
    });

    setCustomerInfo(info);
    setIsPro(computedIsPro);
    setSource(computedIsPro ? 'iap' : 'unknown');
    setLastCheckedAt(new Date().toISOString());
  }, []);

  const ensurePurchasesLoaded = useCallback(async (): Promise<PurchasesModule | null> => {
    if (Platform.OS === 'web') return null;
    if (Purchases) return Purchases;

    try {
      const mod = (await import('react-native-purchases')) as unknown as { default: PurchasesModule };
      Purchases = mod.default;

      const apiKey = (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '').trim();
      if (apiKey) {
        console.log('[Entitlement] Configuring Purchases');
        Purchases.configure({ apiKey });
      } else {
        console.warn('[Entitlement] Missing EXPO_PUBLIC_REVENUECAT_API_KEY - purchases will be unavailable');
      }

      return Purchases;
    } catch (e) {
      console.error('[Entitlement] Failed to load react-native-purchases', e);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    console.log('[Entitlement] refresh called');
    setError(null);

    if (Platform.OS === 'web') {
      try {
        const stored = await AsyncStorage.getItem(KEYS.WEB_IS_PRO);
        const storedIsPro = stored === 'true';
        console.log('[Entitlement] web refresh: storedIsPro', storedIsPro);
        if (!mountedRef.current) return;
        setIsPro(storedIsPro);
        setSource(storedIsPro ? 'dev' : 'unknown');
        setLastCheckedAt(new Date().toISOString());
        setCustomerInfo(null);
        setOfferings([]);
        return;
      } catch (e) {
        console.error('[Entitlement] web refresh failed', e);
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
        return;
      }
    }

    try {
      setIsLoading(true);

      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        setError('In-app purchases are not configured.');
        return;
      }

      console.log('[Entitlement] Fetching offerings');
      const offers = await purchases.getOfferings();
      const allOfferings = Object.values(offers.all ?? {});
      console.log('[Entitlement] Offerings fetched:', allOfferings.map(o => ({ identifier: o.identifier, packages: o.availablePackages?.length ?? 0 })));
      if (!mountedRef.current) return;
      setOfferings(allOfferings);

      console.log('[Entitlement] Fetching customer info');
      const info = await purchases.getCustomerInfo();
      if (!mountedRef.current) return;
      setStateFromCustomerInfo(info);
    } catch (e) {
      console.error('[Entitlement] refresh failed', e);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to refresh entitlements.');
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [ensurePurchasesLoaded, setStateFromCustomerInfo]);

  useEffect(() => {
    console.log('[Entitlement] Provider mounted - refreshing entitlements');
    refresh().catch((e) => console.error('[Entitlement] initial refresh failed', e));
  }, [refresh]);

  const findMonthlyPackage = useCallback((): PurchasesPackage | null => {
    try {
      for (const offering of offerings) {
        for (const p of offering.availablePackages ?? []) {
          const id = p.product.identifier;
          if (id === PRO_PRODUCT_ID) return p;
        }
      }
      return null;
    } catch (e) {
      console.error('[Entitlement] findMonthlyPackage failed', e);
      return null;
    }
  }, [offerings]);

  const subscribeMonthly = useCallback(async () => {
    console.log('[Entitlement] subscribeMonthly called');
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
        console.error('[Entitlement] web subscribeMonthly failed', e);
        Alert.alert('Error', 'Unable to start subscription on web preview.');
        return;
      }
    }

    try {
      setIsLoading(true);
      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        Alert.alert('Not Available', 'In-app purchases are not configured.');
        return;
      }

      const pkg = findMonthlyPackage();
      if (!pkg) {
        console.warn('[Entitlement] Monthly package not found in offerings');
        Alert.alert('Not Available', 'Subscription is not available right now. Please try again later.');
        return;
      }

      console.log('[Entitlement] Purchasing package', { productId: pkg.product.identifier, offeringId: pkg.offeringIdentifier });
      const result = await purchases.purchasePackage(pkg);
      console.log('[Entitlement] purchasePackage result', {
        purchasedProductId: result.productIdentifier,
        activeSubscriptions: result.customerInfo?.activeSubscriptions ?? [],
      });

      if (!mountedRef.current) return;
      setStateFromCustomerInfo(result.customerInfo);
      Alert.alert('Success', 'Full access unlocked.');
    } catch (e) {
      console.error('[Entitlement] subscribeMonthly failed', e);
      const message = e instanceof Error ? e.message : 'Subscription failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Subscription Failed', message);
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [ensurePurchasesLoaded, findMonthlyPackage, setStateFromCustomerInfo]);

  const restore = useCallback(async () => {
    console.log('[Entitlement] restore called');
    setError(null);

    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Restore purchases is not supported in web preview.');
      return;
    }

    try {
      setIsLoading(true);
      const purchases = await ensurePurchasesLoaded();
      if (!purchases) {
        Alert.alert('Not Available', 'In-app purchases are not configured.');
        return;
      }

      const info = await purchases.restorePurchases();
      console.log('[Entitlement] restorePurchases customerInfo', {
        activeSubscriptions: info?.activeSubscriptions ?? [],
      });
      if (!mountedRef.current) return;
      setStateFromCustomerInfo(info);
      Alert.alert('Restored', computeIsProFromCustomerInfo(info) ? 'Pro restored successfully.' : 'No active subscription found.');
    } catch (e) {
      console.error('[Entitlement] restore failed', e);
      const message = e instanceof Error ? e.message : 'Restore failed.';
      if (!mountedRef.current) return;
      setError(message);
      Alert.alert('Restore Failed', message);
    } finally {
      if (!mountedRef.current) return;
      setIsLoading(false);
    }
  }, [ensurePurchasesLoaded, setStateFromCustomerInfo]);

  const openManageSubscription = useCallback(async () => {
    await safeOpenURL(MANAGE_SUBS_URL);
  }, []);

  const openPrivacyPolicy = useCallback(async () => {
    await safeOpenURL(PRIVACY_URL);
  }, []);

  const openTerms = useCallback(async () => {
    await safeOpenURL(TERMS_URL);
  }, []);

  return useMemo(
    () => ({
      isPro,
      source,
      lastCheckedAt,
      customerInfo,
      offerings,
      isLoading,
      error,
      refresh,
      subscribeMonthly,
      restore,
      openManageSubscription,
      openPrivacyPolicy,
      openTerms,
    }),
    [
      isPro,
      source,
      lastCheckedAt,
      customerInfo,
      offerings,
      isLoading,
      error,
      refresh,
      subscribeMonthly,
      restore,
      openManageSubscription,
      openPrivacyPolicy,
      openTerms,
    ]
  );
});
