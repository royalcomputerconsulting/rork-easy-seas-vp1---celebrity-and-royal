import type { CertificateRecommendationSnapshot, LegacyCertificateChaseRecommendationShape } from './types';

export function adaptPersonalRecommendationToLegacyShape(
  recommendation: CertificateRecommendationSnapshot,
): LegacyCertificateChaseRecommendationShape {
  const selected = recommendation.recommendedTargetPoints === null
    ? null
    : { code: recommendation.recommendedTargetCertificateCode ?? String(recommendation.recommendedTargetPoints), pointsRequired: recommendation.recommendedTargetPoints };
  const current = recommendation.currentLockedThresholdPoints === null
    ? null
    : { code: recommendation.currentLockedCertificateCode ?? String(recommendation.currentLockedThresholdPoints), pointsRequired: recommendation.currentLockedThresholdPoints };
  let legacy: LegacyCertificateChaseRecommendationShape['recommendation'] = 'unknown';
  if (['HARD_STOP', 'STOP_NOW', 'BANK_YOUR_WIN'].includes(recommendation.action)) legacy = 'stop';
  else if (recommendation.action === 'DO_NOT_CHASE') legacy = 'do-not-chase';
  else if (recommendation.action === 'PLAY_ONE_MORE_SESSION') legacy = 'light-chase';
  else if (['CONTINUE_UNTIL_TARGET', 'PROFIT_PROTECTED_PUSH', 'EXCELLENT_OPPORTUNITY'].includes(recommendation.action)) legacy = 'worth-chasing';
  return {
    currentPoints: recommendation.currentPoints,
    currentLevel: current,
    nextLevel: selected,
    pointsNeeded: Math.max(0, (recommendation.recommendedTargetPoints ?? recommendation.currentPoints) - recommendation.currentPoints),
    estimatedSlotCoinInNeeded: recommendation.expectedAdditionalCoinIn,
    estimatedRoyalVpCoinInNeeded: recommendation.expectedAdditionalCoinIn * 3,
    valueUpgradeSummary: recommendation.recommendedTargetPoints === null
      ? recommendation.actionLabel
      : `$${recommendation.incrementalCertificateValue.toFixed(2)} incremental certificate value; $${recommendation.expectedAdditionalLoss.toFixed(2)} expected additional loss.`,
    recommendation: legacy,
    reasons: recommendation.topReasons,
    warnings: recommendation.warnings,
  };
}
