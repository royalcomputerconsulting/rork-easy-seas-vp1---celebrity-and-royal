import type {
  BuildCertificateValueSnapshotInput,
  CertificateValueDistribution,
  CertificateValueSnapshot,
  ValuedCertificateSailing,
} from './types';
import { calculatePersonalRedeemability } from './calculatePersonalRedeemability';
import { confidenceFromEvidence, mean, quantile, roundMoney, stableValueId } from './statistics';
import { valueCertificateSailing } from './valueCertificateSailing';

export const CERTIFICATE_VALUE_MODEL_VERSION = 'opt2.0.0';

function distribution(values: number[]): CertificateValueDistribution {
  if (values.length === 0) {
    return { low: 0, median: 0, mean: 0, high: 0, bestRealistic: 0, maximumRaw: 0, sampleCount: 0 };
  }
  return {
    low: roundMoney(quantile(values, 0.1)),
    median: roundMoney(quantile(values, 0.5)),
    mean: roundMoney(mean(values)),
    high: roundMoney(quantile(values, 0.9)),
    bestRealistic: roundMoney(quantile(values, 0.8)),
    maximumRaw: roundMoney(Math.max(...values)),
    sampleCount: values.length,
  };
}

function sourceCount(sailings: ValuedCertificateSailing[]): number {
  return new Set(sailings.flatMap(sailing => sailing.sourceEvidence.map(evidence => (
    `${evidence.documentId ?? evidence.source}:${evidence.versionId ?? ''}:${evidence.pageNumber ?? ''}`
  )))).size;
}

export function buildCertificateValueSnapshot(input: BuildCertificateValueSnapshotInput): CertificateValueSnapshot {
  if (!input.ownerProfileId.trim()) throw new Error('ownerProfileId is required.');
  if (input.threshold.thresholdPoints <= 0) throw new Error('thresholdPoints must be positive.');
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const allValuedSailings = input.sailings
    .filter(sailing => sailing.thresholdDefinitionId === input.threshold.id)
    .map(valueCertificateSailing);
  const eligibleSailings = allValuedSailings.filter(sailing => sailing.eligible);
  const redeemability = calculatePersonalRedeemability({
    ownerProfileId: input.ownerProfileId,
    threshold: input.threshold,
    eligibleSailings,
    ...input.redemption,
  });
  const grossReplacementValue = distribution(eligibleSailings.map(sailing => sailing.grossReplacementValue));
  const netReplacementValue = distribution(eligibleSailings.map(sailing => sailing.netReplacementValue));
  const expectedUserPaidCost = roundMoney(mean(eligibleSailings.map(sailing => sailing.expectedUserPaidCost)));
  const expectedAlternativeValue = roundMoney(redeemability.alternativeTradeInValue * (1 - redeemability.probability));
  const expectedRealizedValue = roundMoney(
    netReplacementValue.mean * redeemability.probability + expectedAlternativeValue,
  );
  const componentPresence = new Set(eligibleSailings.flatMap(sailing => (
    Object.entries(sailing.componentTotals).filter(([, value]) => value > 0).map(([kind]) => kind)
  ))).size;
  const completeness = eligibleSailings.length === 0
    ? 0
    : Math.min(1, 0.35 + Math.min(0.35, eligibleSailings.length / 20) + Math.min(0.3, componentPresence / 10));
  const sources = sourceCount(eligibleSailings);
  const warnings = [
    ...input.threshold.warnings,
    ...redeemability.warnings,
    ...allValuedSailings.flatMap(sailing => sailing.warnings),
  ];
  if (input.threshold.isFallback) warnings.push('Threshold definition comes from the static fallback ladder rather than a verified certificate document.');
  if (eligibleSailings.length === 0) warnings.push('No eligible sailings were available for this threshold.');
  if (sources === 0) warnings.push('Certificate Library source evidence is incomplete.');
  if (allValuedSailings.some(sailing => sailing.suppressedDuplicateComponentIds.length > 0)) {
    warnings.push('Duplicate non-stackable benefits were suppressed to prevent double counting.');
  }
  const confidence = confidenceFromEvidence(sources + eligibleSailings.length, completeness);

  return {
    id: `certificate-value:${stableValueId([input.ownerProfileId, input.threshold.id, generatedAt, CERTIFICATE_VALUE_MODEL_VERSION])}`,
    ownerProfileId: input.ownerProfileId,
    thresholdDefinitionId: input.threshold.id,
    certificateCode: input.threshold.certificateCode,
    family: input.threshold.family,
    thresholdPoints: input.threshold.thresholdPoints,
    effectiveStart: input.threshold.effectiveStart,
    effectiveEnd: input.threshold.effectiveEnd,
    generatedAt,
    grossReplacementValue,
    netReplacementValue,
    redemptionProbability: redeemability.probability,
    expectedRealizedValue,
    expectedAlternativeValue,
    expectedUserPaidCost,
    tradeInAlternativeValue: redeemability.alternativeTradeInValue,
    eligibleSailingCount: eligibleSailings.length,
    sourceCount: sources,
    completeness: Math.round(completeness * 100) / 100,
    confidence,
    assumptions: [
      'Gross replacement value and expected realized value are intentionally stored separately.',
      'Observed redemption history is Bayesian-smoothed so zero-history thresholds are not treated as certainty.',
      'User-paid mandatory costs are subtracted before redemption probability is applied.',
      'Non-stackable benefits with the same benefit key are counted once.',
    ],
    warnings: [...new Set(warnings)],
    valuedSailings: allValuedSailings,
    version: CERTIFICATE_VALUE_MODEL_VERSION,
  };
}
