import type { SubscriptionTier } from '@/state/EntitlementProvider';

export type GatedFeature = 
  | 'analytics'
  | 'agent-x'
  | 'alerts'
  | 'slots'
  | 'sync'
  | 'import'
  | 'add-edit'
  | 'sessions'
  | 'offer-optimizer';

export interface FeatureAccess {
  hasAccess: boolean;
  requiredTier: 'basic' | 'pro';
  reason?: string;
}

export function checkFeatureAccess(
  feature: GatedFeature,
  tier: SubscriptionTier
): FeatureAccess {
  switch (feature) {
    case 'analytics':
    case 'agent-x':
    case 'alerts':
    case 'slots':
      return {
        hasAccess: tier === 'pro',
        requiredTier: 'pro',
        reason: tier === 'view' 
          ? 'Upgrade to Pro to access this feature'
          : tier === 'trial'
          ? 'Upgrade to Pro to access this feature after your trial'
          : tier === 'basic'
          ? 'Upgrade to Pro to access this feature'
          : undefined,
      };

    case 'sync':
    case 'import':
    case 'add-edit':
    case 'sessions':
      return {
        hasAccess: tier !== 'view',
        requiredTier: 'basic',
        reason: tier === 'view'
          ? 'View-only mode. Reactivate with Basic or Pro to sync and add new data'
          : undefined,
      };

    case 'offer-optimizer':
      return {
        hasAccess: true,
        requiredTier: 'basic',
      };

    default:
      return {
        hasAccess: false,
        requiredTier: 'basic',
        reason: 'Unknown feature',
      };
  }
}

export function getFeatureGateMessage(feature: GatedFeature, tier: SubscriptionTier): string {
  const access = checkFeatureAccess(feature, tier);
  
  if (access.hasAccess) return '';
  
  if (access.reason) return access.reason;
  
  if (access.requiredTier === 'pro') {
    return 'This feature requires Pro subscription';
  }
  
  return 'This feature requires an active subscription';
}

export function canAccessFeature(feature: GatedFeature, tier: SubscriptionTier): boolean {
  return checkFeatureAccess(feature, tier).hasAccess;
}
