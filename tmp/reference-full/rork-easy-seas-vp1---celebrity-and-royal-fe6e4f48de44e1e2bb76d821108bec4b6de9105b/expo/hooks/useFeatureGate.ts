import { useState, useCallback } from 'react';
import { useEntitlement } from '@/state/EntitlementProvider';
import { checkFeatureAccess, getFeatureGateMessage, type GatedFeature } from '@/lib/featureGating';

export function useFeatureGate(feature: GatedFeature) {
  const entitlement = useEntitlement();
  const [paywallVisible, setPaywallVisible] = useState(false);

  const access = checkFeatureAccess(feature, entitlement.tier);
  const message = getFeatureGateMessage(feature, entitlement.tier);

  const checkAccess = useCallback(() => {
    if (!access.hasAccess) {
      setPaywallVisible(true);
      return false;
    }
    return true;
  }, [access.hasAccess]);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  return {
    hasAccess: access.hasAccess,
    requiredTier: access.requiredTier,
    message,
    paywallVisible,
    checkAccess,
    closePaywall,
    tier: entitlement.tier,
    isPro: entitlement.isPro,
    isBasic: entitlement.isBasic,
    trialDaysRemaining: entitlement.trialDaysRemaining,
  };
}
