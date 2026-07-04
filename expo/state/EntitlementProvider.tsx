import { useCallback, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from './AuthProvider';

export type EntitlementSource = 'iap' | 'dev' | 'grandfathered' | 'free_use' | 'unknown';
export type SubscriptionTier = 'trial' | 'view' | 'basic' | 'pro';
export type SubscriptionDisplayStatus = 'grace_period' | 'monthly' | 'annual' | 'free_use' | 'expired';

type NoPurchaseCustomerInfo = null;
type NoPurchaseOffering = never;

export interface EntitlementState {
  isPro: boolean;
  isBasic: boolean;
  tier: SubscriptionTier;
  trialEnd: Date | null;
  trialDaysRemaining: number;
  source: EntitlementSource;
  lastCheckedAt: string | null;
  customerInfo: NoPurchaseCustomerInfo;
  offerings: NoPurchaseOffering[];
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

async function noopUnlock(): Promise<void> {
  return;
}

async function openUrl(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch (error) {
    console.warn('[Entitlement] Unable to open URL', error);
  }
}

export const [EntitlementProvider, useEntitlement] = createContextHook((): EntitlementState => {
  const auth = useAuth();
  const now = useMemo(() => new Date().toISOString(), []);

  const openManageSubscription = useCallback(async () => {
    await openUrl(Platform.OS === 'android' ? MANAGE_SUBS_ANDROID_URL : MANAGE_SUBS_IOS_URL);
  }, []);

  const openPrivacyPolicy = useCallback(async () => {
    await openUrl(PRIVACY_URL);
  }, []);

  const openTerms = useCallback(async () => {
    await openUrl(TERMS_URL);
  }, []);

  return useMemo(() => ({
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
    subscriptionLevel: auth.isWhitelisted ? (auth.subscriptionLevel ?? 'Free Use of App') : 'Free Use of App',
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
  }), [auth.isWhitelisted, auth.subscriptionLevel, now, openManageSubscription, openPrivacyPolicy, openTerms]);
});
