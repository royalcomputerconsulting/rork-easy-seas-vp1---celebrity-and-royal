import { useCallback, useMemo } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from './AuthProvider';

export type EntitlementSource = 'iap' | 'dev' | 'grandfathered' | 'free_use' | 'unknown';
export type SubscriptionTier = 'trial' | 'view' | 'basic' | 'pro';
export type SubscriptionDisplayStatus = 'grace_period' | 'monthly' | 'annual' | 'free_use' | 'expired';

export type StoreProduct = {
  identifier?: string;
  priceString?: string;
  title?: string;
  description?: string;
};

export type StorePackage = {
  identifier?: string;
  product?: StoreProduct;
  offeringIdentifier?: string;
};

export type StoreOffering = {
  identifier?: string;
  availablePackages?: StorePackage[];
};

export interface EntitlementState {
  isPro: boolean;
  isBasic: boolean;
  tier: SubscriptionTier;
  trialEnd: Date | null;
  trialDaysRemaining: number;
  source: EntitlementSource;
  lastCheckedAt: string | null;
  customerInfo: null;
  offerings: StoreOffering[];
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
  redeemOfferCode: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
  openPrivacyPolicy: () => Promise<void>;
  openTerms: () => Promise<void>;
  manualUnlock: () => Promise<void>;
}

export const BASIC_PRODUCT_ID_MONTHLY = 'easyseas_pro_monthly' as const;
export const PRO_PRODUCT_ID_MONTHLY = 'easyseas_pro_monthly' as const;
export const PRO_PRODUCT_ID_ANNUAL = 'easyseas_pro_annual' as const;

const PRIVACY_URL = 'https://www.royalcomputerconsulting.com/privacy-policy' as const;
const TERMS_URL = 'https://www.royalcomputerconsulting.com/support-policy' as const;
const MANAGE_SUBS_IOS_URL = 'https://apps.apple.com/account/subscriptions' as const;
const MANAGE_SUBS_ANDROID_URL = 'https://play.google.com/store/account/subscriptions' as const;

async function safeOpenURL(url: string): Promise<void> {
  try {
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

function emitUnlockedEvent(): void {
  try {
    const target = globalThis as typeof globalThis & {
      window?: { dispatchEvent?: (event: Event) => void };
      dispatchEvent?: (event: Event) => void;
    };
    const event = new Event('entitlementProUnlocked');
    if (typeof target.dispatchEvent === 'function') {
      target.dispatchEvent(event);
    } else if (typeof target.window?.dispatchEvent === 'function') {
      target.window.dispatchEvent(event);
    }
  } catch {
    // Optional web-only compatibility event. Never block app startup.
  }
}

export const [EntitlementProvider, useEntitlement] = createContextHook((): EntitlementState => {
  const auth = useAuth();
  const now = useMemo(() => new Date().toISOString(), []);
  const subscriptionLevel = auth.subscriptionLevel || 'Free Use of App';

  const noopUnlock = useCallback(async () => {
    emitUnlockedEvent();
  }, []);

  const openManageSubscription = useCallback(async () => {
    await safeOpenURL(Platform.OS === 'android' ? MANAGE_SUBS_ANDROID_URL : MANAGE_SUBS_IOS_URL);
  }, []);

  const openPrivacyPolicy = useCallback(async () => {
    await safeOpenURL(PRIVACY_URL);
  }, []);

  const openTerms = useCallback(async () => {
    await safeOpenURL(TERMS_URL);
  }, []);

  return {
    isPro: true,
    isBasic: true,
    tier: 'pro',
    trialEnd: null,
    trialDaysRemaining: 0,
    source: 'free_use',
    lastCheckedAt: now,
    customerInfo: null,
    offerings: [],
    isLoading: false,
    error: null,
    isGrandfathered: true,
    accountCreatedAt: null,
    subscriptionDisplayStatus: 'free_use',
    subscriptionLevel,
    refresh: noopUnlock,
    subscribeBasicMonthly: noopUnlock,
    subscribeProMonthly: noopUnlock,
    subscribeProAnnual: noopUnlock,
    restore: noopUnlock,
    redeemOfferCode: noopUnlock,
    openManageSubscription,
    openPrivacyPolicy,
    openTerms,
    manualUnlock: noopUnlock,
  };
});
