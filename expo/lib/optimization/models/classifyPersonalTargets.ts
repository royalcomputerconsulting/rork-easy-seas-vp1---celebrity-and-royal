import type { CertificateThresholdDefinition, CertificateValueSnapshot } from '../value/types';
import type {
  ExpectedLossEstimate,
  PersonalOptimizerPriors,
  PersonalTargetClassification,
  SuccessProbabilityEstimate,
  ThresholdStatistics,
} from './types';
import { round } from './statistics';

export function classifyPersonalTargets(input: {
  thresholds: CertificateThresholdDefinition[];
  valueSnapshots: CertificateValueSnapshot[];
  statistics: ThresholdStatistics[];
  losses: ExpectedLossEstimate[];
  probabilities: SuccessProbabilityEstimate[];
  priors: PersonalOptimizerPriors;
}): PersonalTargetClassification[] {
  const drafts = input.thresholds.map(threshold => {
    const value = input.valueSnapshots.find(snapshot => snapshot.thresholdDefinitionId === threshold.id)?.expectedRealizedValue ?? 0;
    const statistics = input.statistics.find(item => item.thresholdDefinitionId === threshold.id);
    const loss = input.losses.find(item => item.thresholdDefinitionId === threshold.id);
    const probability = input.probabilities.find(item => item.thresholdDefinitionId === threshold.id);
    const expectedTotalLoss = loss?.expectedAdditionalLoss ?? threshold.thresholdPoints * input.priors.dollarsPerPoint * input.priors.theoreticalLossRate;
    const successProbability = probability?.probability ?? statistics?.smoothedSuccessRate ?? 0;
    const expectedNetValue = value * successProbability - expectedTotalLoss;
    const downsidePenalty = Math.max(0, (loss?.downsideHigh ?? expectedTotalLoss) - expectedTotalLoss) * 0.35;
    const riskAdjustedExpectedNetValue = expectedNetValue - downsidePenalty;
    const normalBankrollRequired = loss?.downsideHigh ?? expectedTotalLoss;
    const evidenceSamples = Math.max(statistics?.attempts ?? 0, probability?.comparableSampleCount ?? 0);
    const priorLabel = input.priors.defaultThresholdLabels[threshold.thresholdPoints] ?? 'Normally Avoid';
    const promotionEligible = evidenceSamples >= input.priors.minimumPromotionSamples
      && successProbability >= input.priors.minimumStableSuccessProbability
      && expectedNetValue > 0;
    return { threshold, value, expectedTotalLoss, expectedNetValue, riskAdjustedExpectedNetValue, successProbability, normalBankrollRequired, evidenceSamples, priorLabel, promotionEligible };
  });
  const realistic = drafts.filter(item => item.successProbability >= 0.2 && item.normalBankrollRequired <= input.priors.dailyBankrollBudget * 8 && item.riskAdjustedExpectedNetValue > 0);
  const primary = realistic.sort((a, b) => b.riskAdjustedExpectedNetValue - a.riskAdjustedExpectedNetValue)[0] ?? null;

  return drafts.map(item => {
    let candidate: PersonalTargetClassification['label'];
    if (item.successProbability < 0.05 || item.normalBankrollRequired > input.priors.dailyBankrollBudget * 15) candidate = 'Unrealistic';
    else if (item.expectedNetValue < 0) candidate = 'Normally Avoid';
    else if (primary?.threshold.id === item.threshold.id) candidate = 'Primary Target';
    else if (item.successProbability >= 0.75 && item.normalBankrollRequired <= input.priors.dailyBankrollBudget * 5) candidate = 'Comfortable';
    else if (item.successProbability >= 0.3) candidate = 'Stretch Goal';
    else candidate = 'Exceptional Goal';
    const warnings: string[] = [];
    const reasons: string[] = [
      `Personal success probability is ${(item.successProbability * 100).toFixed(1)}%.`,
      `Probability-adjusted net value is $${round(item.expectedNetValue, 2).toFixed(2)}.`,
      `Normal downside estimate is $${round(item.normalBankrollRequired, 2).toFixed(2)}.`,
    ];
    let label = candidate;
    if (candidate !== item.priorLabel && !item.promotionEligible) {
      label = item.priorLabel;
      warnings.push('Automatic label change is held because minimum evidence and stability gates are not satisfied.');
    }
    if (item.evidenceSamples < input.priors.minimumPromotionSamples) warnings.push('Insufficient personal samples for automatic promotion or demotion.');
    if (item.expectedNetValue <= 0) warnings.push('Expected certificate value does not cover expected gambling loss.');
    return {
      thresholdDefinitionId: item.threshold.id,
      thresholdPoints: item.threshold.thresholdPoints,
      label,
      priorLabel: item.priorLabel,
      expectedCertificateValue: round(item.value, 2),
      expectedTotalLoss: round(item.expectedTotalLoss, 2),
      expectedNetValue: round(item.expectedNetValue, 2),
      riskAdjustedExpectedNetValue: round(item.riskAdjustedExpectedNetValue, 2),
      successProbability: round(item.successProbability),
      normalBankrollRequired: round(item.normalBankrollRequired, 2),
      evidenceSamples: item.evidenceSamples,
      promotionEligible: item.promotionEligible,
      changedFromPrior: label !== item.priorLabel,
      reasons,
      warnings,
    };
  });
}
