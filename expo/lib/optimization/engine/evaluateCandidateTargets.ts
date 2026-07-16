import type { CertificateValueSnapshot } from '../value/types';
import { estimateExpectedLoss } from '../models/estimateExpectedLoss';
import { estimateSuccessProbability } from '../models/estimateSuccessProbability';
import { selectComparableHistory } from '../models/selectComparableHistory';
import { clamp, round } from '../models/statistics';
import type { BuildOptimalStoppingRecommendationInput, CertificateCandidateEvaluation, FatiguePerformanceAssessment } from './types';
import { availableRiskBudget, lossModePenalty } from './assessSafetyModes';
import type { LockedCertificateResult } from './determineCurrentLockedCertificate';

function valueFor(definitionId: string, snapshots: CertificateValueSnapshot[]): CertificateValueSnapshot | null {
  return snapshots.find(snapshot => snapshot.thresholdDefinitionId === definitionId) ?? null;
}

function mergeConfidence(values: Array<'high' | 'medium' | 'low' | 'missing'>): 'high' | 'medium' | 'low' | 'missing' {
  if (values.includes('missing')) return 'missing';
  if (values.includes('low')) return 'low';
  if (values.includes('medium')) return 'medium';
  return values.length > 0 ? 'high' : 'missing';
}

export function evaluateCandidateTargets(input: {
  request: BuildOptimalStoppingRecommendationInput;
  applicableThresholds: BuildOptimalStoppingRecommendationInput['thresholds'];
  locked: LockedCertificateResult;
  fatigue: FatiguePerformanceAssessment;
}): CertificateCandidateEvaluation[] {
  const { state, history, model, valueSnapshots } = input.request;
  const priors = model.profile.priors;
  const riskBudgets = availableRiskBudget(state);
  const lossPenalty = lossModePenalty(state);
  const currentValue = input.locked.valueSnapshot?.expectedRealizedValue ?? 0;
  return input.applicableThresholds.filter(threshold => threshold.thresholdPoints > state.currentPoints).map(threshold => {
    const thresholdModel = model.profile.thresholdModels.find(item => item.threshold.id === threshold.id) ?? null;
    const targetValueSnapshot = valueFor(threshold.id, valueSnapshots);
    const context = {
      ownerProfileId: state.ownerProfileId,
      program: state.program,
      brand: state.brand,
      shipName: state.shipName,
      cruiseNights: state.cruiseNights,
      currentPoints: state.currentPoints,
      targetPoints: threshold.thresholdPoints,
      remainingCasinoHours: state.remainingCasinoHours,
      remainingCasinoDays: state.remainingCasinoDays,
      currentResult: state.currentResult,
      remainingBankroll: state.remainingBankroll,
      asOf: state.asOf,
    };
    const comparable = selectComparableHistory({ context, outcomes: history.outcomes, minimumSimilarity: 0.3 });
    const expectedLoss = estimateExpectedLoss({
      thresholdDefinitionId: threshold.id,
      currentPoints: state.currentPoints,
      targetPoints: threshold.thresholdPoints,
      comparableOutcomes: comparable.includedOutcomes,
      priors,
    });
    const success = estimateSuccessProbability({
      thresholdDefinitionId: threshold.id,
      context,
      comparableOutcomes: comparable.includedOutcomes,
      expectedLoss,
      seed: [model.deterministicFingerprint, state.currentPoints, state.currentResult, threshold.id, state.asOf].join('|'),
    });
    const replacementAssumption = threshold.replacesLowerCertificate !== false;
    const targetValue = targetValueSnapshot?.expectedRealizedValue ?? 0;
    const incrementalCertificateValue = Math.max(0, replacementAssumption ? targetValue - currentValue : targetValue);
    const rawEv = success.probability * incrementalCertificateValue - expectedLoss.expectedAdditionalLoss;
    const volatilityPenaltyRate = priors.volatilityTolerance === 'conservative' ? 0.5 : priors.volatilityTolerance === 'aggressive' ? 0.15 : 0.3;
    const downsidePenalty = Math.max(0, expectedLoss.downsideHigh - expectedLoss.expectedAdditionalLoss) * volatilityPenaltyRate;
    const fatiguePenaltyDollars = expectedLoss.expectedAdditionalLoss * input.fatigue.penalty;
    const lossModePenaltyDollars = expectedLoss.expectedAdditionalLoss * lossPenalty;
    const riskAdjustedEv = rawEv - downsidePenalty - fatiguePenaltyDollars - lossModePenaltyDollars;
    const expectedTime = thresholdModel?.statistics.pointsPerHour.median && thresholdModel.statistics.pointsPerHour.median > 0
      ? expectedLoss.pointsRemaining / thresholdModel.statistics.pointsPerHour.median
      : null;
    const timeFeasible = expectedTime === null || state.remainingCasinoHours === null ? success.paceFeasibility >= 0.5 : expectedTime <= state.remainingCasinoHours;
    const availableRisk = riskBudgets.ordinary;
    const bankrollFeasible = availableRisk === null ? success.bankrollFeasibility >= 0.5 : expectedLoss.downsideHigh <= availableRisk;
    const exceedProbability = availableRisk === null
      ? null
      : expectedLoss.downsideHigh <= 0
        ? 0
        : clamp((expectedLoss.downsideHigh - availableRisk) / expectedLoss.downsideHigh);
    const reachable = timeFeasible && success.probability >= 0.05;
    const projectedEndOfCruisePoints = Math.round(state.currentPoints + Math.max(0, (state.remainingCasinoHours ?? 0) * (thresholdModel?.statistics.pointsPerHour.median ?? 0)));
    const warnings = [
      ...comparable.warnings,
      ...expectedLoss.warnings,
      ...success.warnings,
    ];
    if (!targetValueSnapshot) warnings.push('Target certificate is missing a personal value snapshot.');
    if (threshold.replacesLowerCertificate === null) warnings.push('Conservative replacement assumption used because stacking behavior is unknown.');
    if (!timeFeasible) warnings.push('Remaining casino time is insufficient at the learned personal pace.');
    if (!bankrollFeasible) warnings.push('The high-downside estimate exceeds the remaining risk budget.');
    if (input.fatigue.penalty > 0) warnings.push('Fatigue/performance penalty reduced risk-adjusted expected value.');
    if (lossPenalty > 0) warnings.push('Loss Mode reduced risk-adjusted expected value.');
    const reasons = [
      `${expectedLoss.pointsRemaining.toLocaleString()} additional points are required.`,
      `Expected additional loss is $${round(expectedLoss.expectedAdditionalLoss, 2).toFixed(2)} against $${round(incrementalCertificateValue, 2).toFixed(2)} of incremental certificate value.`,
      `Personal probability of success is ${(success.probability * 100).toFixed(1)}%.`,
    ];
    return {
      thresholdDefinitionId: threshold.id,
      targetCertificateCode: threshold.certificateCode,
      targetPoints: threshold.thresholdPoints,
      targetLabel: thresholdModel?.classification.label ?? 'Normally Avoid',
      currentLockedThresholdPoints: input.locked.definition?.thresholdPoints ?? null,
      pointsRequired: expectedLoss.pointsRemaining,
      expectedAdditionalCoinIn: expectedLoss.expectedAdditionalCoinIn,
      expectedAdditionalTimeHours: expectedTime === null ? null : round(expectedTime, 2),
      probabilityOfSuccess: success.probability,
      expectedAdditionalLoss: expectedLoss.expectedAdditionalLoss,
      downsideLow: expectedLoss.downsideLow,
      downsideHigh: expectedLoss.downsideHigh,
      incrementalCertificateValue: round(incrementalCertificateValue, 2),
      rawIncrementalExpectedValue: round(rawEv, 2),
      riskAdjustedIncrementalExpectedValue: round(riskAdjustedEv, 2),
      incrementalRoi: expectedLoss.expectedAdditionalLoss > 0 ? round(rawEv / expectedLoss.expectedAdditionalLoss) : null,
      probabilityOfExceedingRemainingBankroll: exceedProbability === null ? null : round(exceedProbability),
      projectedEndOfCruisePoints,
      availableRiskBudget: availableRisk,
      profitProtectedRiskBudget: riskBudgets.profitProtected,
      fatiguePerformancePenalty: input.fatigue.penalty,
      lossModePenalty: lossPenalty,
      confidence: mergeConfidence([expectedLoss.confidence, success.confidence, targetValueSnapshot?.confidence ?? 'missing']),
      reachable,
      bankrollFeasible,
      timeFeasible,
      reasons,
      warnings: [...new Set(warnings)],
    };
  });
}
