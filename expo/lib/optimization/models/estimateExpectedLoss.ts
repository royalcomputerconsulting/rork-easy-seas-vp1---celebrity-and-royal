import type { CasinoCruiseOutcome } from '../history/types';
import type { ExpectedLossEstimate, PersonalOptimizerPriors } from './types';
import { clamp, confidenceBand, median, quantile, robustValues, round } from './statistics';

export function estimateExpectedLoss(input: {
  thresholdDefinitionId: string;
  currentPoints: number;
  targetPoints: number;
  comparableOutcomes: CasinoCruiseOutcome[];
  priors: PersonalOptimizerPriors;
}): ExpectedLossEstimate {
  const pointsRemaining = Math.max(0, input.targetPoints - input.currentPoints);
  const expectedAdditionalCoinIn = pointsRemaining * Math.max(0, input.priors.dollarsPerPoint);
  const empiricalRates = robustValues(input.comparableOutcomes.flatMap(outcome => {
    const coinIn = outcome.totalCoinIn.value;
    const result = outcome.actualResult.value;
    if (coinIn === null || result === null || coinIn <= 0) return [];
    return [Math.max(0, -result) / coinIn];
  }));
  const theoreticalRates = robustValues(input.comparableOutcomes.flatMap(outcome => {
    const coinIn = outcome.totalCoinIn.value;
    const theo = outcome.theoreticalLoss.value;
    if (coinIn === null || theo === null || coinIn <= 0) return [];
    return [Math.max(0, theo) / coinIn];
  }));
  const empiricalLossRate = median(empiricalRates);
  const observedQuality = input.comparableOutcomes.length === 0
    ? 0
    : input.comparableOutcomes.reduce((sum, outcome) => sum + outcome.dataHealth.score / 100, 0) / input.comparableOutcomes.length;
  const empiricalWeight = empiricalLossRate === null ? 0 : clamp(empiricalRates.length / 8 * observedQuality, 0.15, 0.8);
  const observedTheo = median(theoreticalRates);
  const theoreticalLossRate = clamp(observedTheo ?? input.priors.theoreticalLossRate, 0, 1);
  const blendedLossRate = clamp((empiricalLossRate ?? 0) * empiricalWeight + theoreticalLossRate * (1 - empiricalWeight), 0, 1);
  const uncertaintyRates = empiricalRates.length > 0 ? empiricalRates : [theoreticalLossRate * 0.65, theoreticalLossRate, theoreticalLossRate * 1.5];
  const downsideLowRate = Math.max(0, quantile(uncertaintyRates, 0.1) ?? blendedLossRate * 0.65);
  const downsideHighRate = Math.max(blendedLossRate, quantile(uncertaintyRates, 0.9) ?? blendedLossRate * 1.5);
  const expectedAdditionalLoss = expectedAdditionalCoinIn * blendedLossRate;
  const warnings: string[] = [];
  if (empiricalRates.length === 0) warnings.push('No reliable personal actual-loss rate was available; theoretical loss has greater weight.');
  if (input.comparableOutcomes.some(outcome => (outcome.actualResult.value ?? 0) > 0)) warnings.push('Historical wins do not make expected loss negative.');
  if (pointsRemaining === 0) warnings.push('Target is already reached; incremental loss is zero.');
  return {
    thresholdDefinitionId: input.thresholdDefinitionId,
    targetPoints: input.targetPoints,
    pointsRemaining,
    expectedAdditionalCoinIn: round(expectedAdditionalCoinIn, 2),
    empiricalLossRate: empiricalLossRate === null ? null : round(empiricalLossRate),
    theoreticalLossRate: round(theoreticalLossRate),
    blendedLossRate: round(blendedLossRate),
    empiricalWeight: round(empiricalWeight),
    expectedAdditionalLoss: round(expectedAdditionalLoss, 2),
    downsideLow: round(expectedAdditionalCoinIn * downsideLowRate, 2),
    downsideHigh: round(expectedAdditionalCoinIn * downsideHighRate, 2),
    costPerPoint: round(input.priors.dollarsPerPoint * blendedLossRate, 4),
    sampleCount: empiricalRates.length,
    confidence: confidenceBand(empiricalRates.length, observedQuality),
    assumptions: [
      'Expected loss is never reduced below zero by prior winning trips.',
      'Personal actual-loss evidence is blended with theoretical loss and its weight is disclosed.',
      'Outlier loss rates are winsorized by retaining the central personal distribution.',
    ],
    warnings,
  };
}
