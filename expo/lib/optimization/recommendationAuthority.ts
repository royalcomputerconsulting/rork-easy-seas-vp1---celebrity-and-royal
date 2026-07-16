import {
  getPersonalCertificateOptimizerFeatureFlags,
  type PersonalCertificateOptimizerFeatureFlags,
} from '@/lib/optimization/featureFlags';

export type CertificateRecommendationAuthority = 'legacy-static' | 'personal-optimizer';

/**
 * One rollback-safe decision point for recommendation authority.
 * No UI is switched to the new engine during OPT-0; defaults resolve to the
 * legacy Build 314 behavior.
 */
export function getCertificateRecommendationAuthority(
  overrides: Partial<PersonalCertificateOptimizerFeatureFlags> = {},
): CertificateRecommendationAuthority {
  return getPersonalCertificateOptimizerFeatureFlags(overrides).personalCertificateOptimizerEnabled
    ? 'personal-optimizer'
    : 'legacy-static';
}
