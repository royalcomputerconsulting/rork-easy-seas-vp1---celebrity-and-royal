import type {
  CertificateRedemptionHistory,
  PersonalRedeemabilityInput,
  PersonalRedeemabilityResult,
} from './types';
import { clamp, confidenceFromEvidence, roundMoney } from './statistics';

function matchingHistory(input: PersonalRedeemabilityInput): CertificateRedemptionHistory[] {
  return (input.history ?? []).filter(item => {
    if (item.thresholdDefinitionId && item.thresholdDefinitionId === input.threshold.id) return true;
    return item.family === input.threshold.family && item.thresholdPoints === input.threshold.thresholdPoints;
  });
}

export function calculatePersonalRedeemability(input: PersonalRedeemabilityInput): PersonalRedeemabilityResult {
  const history = matchingHistory(input);
  const earnedCount = history.reduce((sum, item) => sum + Math.max(0, item.earnedCount), 0);
  const redeemedCount = history.reduce((sum, item) => sum + Math.max(0, item.redeemedCount), 0);
  const rawHistoricalRate = earnedCount > 0 ? clamp(redeemedCount / earnedCount) : null;
  const smoothedHistoricalRate = (redeemedCount + 2) / (earnedCount + 4);
  const manualUseWeight = input.manualUseWeight === null || input.manualUseWeight === undefined
    ? null
    : clamp(input.manualUseWeight);
  const conflictPenalty = input.hasFutureBookingConflict ? 0.45 : 1;
  const expirationPenalty = input.daysUntilExpiration === null || input.daysUntilExpiration === undefined
    ? 0.9
    : input.daysUntilExpiration < 0
      ? 0
      : input.daysUntilExpiration < 7
        ? 0.45
        : input.daysUntilExpiration < 21
          ? 0.75
          : 1;
  const severeRestrictionCount = Math.max(0, input.severeRestrictionCount ?? 0);
  const restrictionPenalty = clamp(1 - severeRestrictionCount * 0.12, 0.4, 1);
  const availabilityFactor = input.eligibleSailings.length === 0
    ? 0
    : clamp(0.55 + Math.log2(input.eligibleSailings.length + 1) * 0.12, 0, 1);
  const preferenceRate = manualUseWeight ?? smoothedHistoricalRate;
  const probability = clamp(
    (smoothedHistoricalRate * 0.6 + preferenceRate * 0.4)
      * conflictPenalty
      * expirationPenalty
      * restrictionPenalty
      * availabilityFactor,
  );
  const evidenceCount = earnedCount + input.eligibleSailings.length;
  const completeness = input.eligibleSailings.length > 0 ? 0.7 + Math.min(0.3, earnedCount / 20) : 0;
  const warnings: string[] = [];
  if (earnedCount === 0) warnings.push('No personal redemption history exists for this threshold; a conservative smoothed prior is used.');
  if (input.eligibleSailings.length === 0) warnings.push('No eligible certificate sailings are available, so redeemability is zero.');
  if (input.hasFutureBookingConflict) warnings.push('Existing future bookings reduce the probability that this certificate would be used.');
  if (expirationPenalty < 1) warnings.push('A short or expired redemption window reduces likely use.');
  if (severeRestrictionCount > 0) warnings.push('Certificate restrictions reduce likely use.');
  if (manualUseWeight !== null) warnings.push('A user-entered likely-use weight is included and shown separately from observed history.');

  return {
    probability: roundMoney(probability * 100) / 100,
    rawHistoricalRate,
    smoothedHistoricalRate: roundMoney(smoothedHistoricalRate * 100) / 100,
    manualUseWeight,
    conflictPenalty,
    expirationPenalty,
    restrictionPenalty,
    availabilityFactor: roundMoney(availabilityFactor * 100) / 100,
    alternativeTradeInValue: roundMoney(Math.max(0, Number(input.alternativeTradeInValue ?? 0) || 0)),
    confidence: confidenceFromEvidence(evidenceCount, completeness),
    evidenceCount,
    warnings,
  };
}
