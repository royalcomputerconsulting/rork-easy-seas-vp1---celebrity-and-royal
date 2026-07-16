import type { PersonalCertificateOptimizerFeatureFlags } from '../featureFlags';
import type { CertificateRecommendationAuthority } from '../recommendationAuthority';
import type { OptimizerReleaseGateSnapshot } from './types';

export function getReleaseGatedRecommendationAuthority(
  requestedFlags: Partial<PersonalCertificateOptimizerFeatureFlags>,
  releaseGate: OptimizerReleaseGateSnapshot | null,
): CertificateRecommendationAuthority {
  return requestedFlags.personalCertificateOptimizerEnabled === true
    && releaseGate?.productionEnableAllowed === true
    && releaseGate.effectiveFlags.personalCertificateOptimizerEnabled === true
    ? 'personal-optimizer'
    : 'legacy-static';
}
