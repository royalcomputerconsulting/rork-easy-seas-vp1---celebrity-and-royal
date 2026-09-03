import type { CertificateValueSnapshot } from '../value/types';
import { estimateExpectedLoss } from '../models/estimateExpectedLoss';
import { estimateSuccessProbability } from '../models/estimateSuccessProbability';
import { selectComparableHistory } from '../models/selectComparableHistory';
import { round } from '../models/statistics';
import type { BuildOptimalStoppingRecommendationInput, CertificateCandidateEvaluation, FatiguePerformanceAssessment } from './types';
import { availableRiskBudget, lossModePenalty } from './assessSafetyModes';
import type { LockedCertificateResult } from './determineCurrentLockedCertificate';
import { calculateBankrollSurvival } from './calculateBankrollSurvival';
import { calculateExpectedNetVacationValue } from './calculateExpectedNetVacationValue';
import { estimatePersonalPlayRates } from '../models/estimatePersonalPlayRates';

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
  const personalRates = estimatePersonalPlayRates({
    history,
    program: state.program,
    shipName: state.shipName,
    machineId: state.currentMachineId,
    machineFamily: state.currentMachineFamily,
    dayType: state.currentDayType,
    asOf: state.asOf,
    genericDollarsPerPoint: priors.dollarsPerPoint,
    genericLossRate: priors.theoreticalLossRate,
  });
  const dollarsPerPoint = personalRates.coinInPerPoint.trimmedMean ?? personalRates.coinInPerPoint.median ?? priors.dollarsPerPoint;
  const personalLossRate = (personalRates.actualLossPerThousandCoinIn.trimmedMean ?? personalRates.actualLossPerThousandCoinIn.median ?? (priors.theoreticalLossRate * 1000)) / 1000;
  const personalizedPriors = { ...priors, dollarsPerPoint, theoreticalLossRate: personalLossRate };
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
      priors: personalizedPriors,
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
    const adjustments = input.request.valueAdjustmentsByThresholdId?.[threshold.id] ?? {};
    const incrementalFutureOfferValue = Math.max(0, adjustments.incrementalFutureOfferValue ?? 0);
    const incrementalTierValue = Math.max(0, adjustments.incrementalTierValue ?? 0);
    const incrementalAncillaryValue = Math.max(0, adjustments.incrementalAncillaryValue ?? 0);
    const incrementalTravelCost = Math.max(0, adjustments.incrementalTravelCost ?? 0);
    const incrementalCruiseCost = Math.max(0, adjustments.incrementalCruiseCost ?? 0);
    const expectedUnredeemedValueLoss = Math.max(0, adjustments.expectedUnredeemedValueLoss ?? 0);
    // Certificate snapshots are already redemption-adjusted. Applying success
    // probability again would discount the same uncertainty twice.
    const rawValue = calculateExpectedNetVacationValue({
      realizedCertificateValue: incrementalCertificateValue,
      futureOfferValue: incrementalFutureOfferValue,
      tierValue: incrementalTierValue,
      ancillaryValue: incrementalAncillaryValue,
      expectedGamblingLoss: expectedLoss.expectedAdditionalLoss,
      incrementalTravelCost,
      incrementalCruiseCost,
      expectedUnredeemedValueLoss,
    });
    const rawEv = rawValue.expectedNetVacationValue;
    const volatilityPenaltyRate = priors.volatilityTolerance === 'conservative' ? 0.5 : priors.volatilityTolerance === 'aggressive' ? 0.15 : 0.3;
    const downsidePenalty = Math.max(0, expectedLoss.downsideHigh - expectedLoss.expectedAdditionalLoss) * volatilityPenaltyRate;
    const fatiguePenaltyDollars = expectedLoss.expectedAdditionalLoss * input.fatigue.penalty;
    const lossModePenaltyDollars = expectedLoss.expectedAdditionalLoss * lossPenalty;
    const bankroll = calculateBankrollSurvival({
      expectedLoss: expectedLoss.expectedAdditionalLoss,
      downsideLow: expectedLoss.downsideLow,
      downsideHigh: expectedLoss.downsideHigh,
      remainingBankroll: state.remainingBankroll,
      sampleCount: expectedLoss.sampleCount,
    });
    const survivalPenalty = expectedLoss.expectedAdditionalLoss * (1 - (bankroll.survivalProbability ?? success.bankrollFeasibility));
    const riskPenalty = downsidePenalty + fatiguePenaltyDollars + lossModePenaltyDollars + survivalPenalty;
    const riskAdjustedEv = calculateExpectedNetVacationValue({
      realizedCertificateValue: incrementalCertificateValue,
      futureOfferValue: incrementalFutureOfferValue,
      tierValue: incrementalTierValue,
      ancillaryValue: incrementalAncillaryValue,
      expectedGamblingLoss: expectedLoss.expectedAdditionalLoss,
      incrementalTravelCost,
      incrementalCruiseCost,
      expectedUnredeemedValueLoss,
      riskPenalty,
    }).expectedNetVacationValue;
    const expectedTime = thresholdModel?.statistics.pointsPerHour.median && thresholdModel.statistics.pointsPerHour.median > 0
      ? expectedLoss.pointsRemaining / thresholdModel.statistics.pointsPerHour.median
      : null;
    const timeFeasible = expectedTime === null || state.remainingCasinoHours === null ? success.paceFeasibility >= 0.5 : expectedTime <= state.remainingCasinoHours;
    const availableRisk = riskBudgets.ordinary;
    const bankrollFeasible = (bankroll.survivalProbability ?? success.bankrollFeasibility) >= 0.5
      && (availableRisk === null || expectedLoss.downsideHigh <= availableRisk);
    const exceedProbability = bankroll.riskOfRuinProbability;
    const reachable = timeFeasible && success.probability >= 0.05;
    const projectedEndOfCruisePoints = Math.round(state.currentPoints + Math.max(0, (state.remainingCasinoHours ?? 0) * (thresholdModel?.statistics.pointsPerHour.median ?? 0)));
    const warnings = [
      ...comparable.warnings,
      ...expectedLoss.warnings,
      ...success.warnings,
      ...personalRates.warnings,
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
      `Bankroll survival probability is ${bankroll.survivalProbability === null ? 'unavailable' : `${(bankroll.survivalProbability * 100).toFixed(1)}%`}.`,
      `Expected net vacation value is $${round(riskAdjustedEv, 2).toFixed(2)} after $${round(riskPenalty, 2).toFixed(2)} of modeled risk penalty.`,
    ];
    return {
      thresholdDefinitionId: threshold.id,
      targetCertificateCode: threshold.certificateCode,
      targetPoints: threshold.thresholdPoints,
      targetLabel: thresholdModel?.classification.label ?? 'Normally Avoid',
      currentLockedThresholdPoints: input.locked.definition?.thresholdPoints ?? null,
      pointsRequired: expectedLoss.pointsRemaining,
      expectedAdditionalCoinIn: expectedLoss.expectedAdditionalCoinIn,
      personalCoinInPerPoint: round(dollarsPerPoint, 4),
      personalActualLossPerThousandPoints: round(personalRates.actualLossPerThousandPoints.trimmedMean ?? personalRates.actualLossPerThousandPoints.median ?? (dollarsPerPoint * personalLossRate * 1000), 2),
      personalRateContext: personalRates.selectedContext,
      expectedAdditionalTimeHours: expectedTime === null ? null : round(expectedTime, 2),
      probabilityOfSuccess: success.probability,
      expectedAdditionalLoss: expectedLoss.expectedAdditionalLoss,
      downsideLow: expectedLoss.downsideLow,
      downsideHigh: expectedLoss.downsideHigh,
      incrementalCertificateValue: round(incrementalCertificateValue, 2),
      incrementalFutureOfferValue: round(incrementalFutureOfferValue, 2),
      incrementalTierValue: round(incrementalTierValue, 2),
      incrementalAncillaryValue: round(incrementalAncillaryValue, 2),
      incrementalTravelCost: round(incrementalTravelCost, 2),
      incrementalCruiseCost: round(incrementalCruiseCost, 2),
      expectedUnredeemedValueLoss: round(expectedUnredeemedValueLoss, 2),
      riskPenalty: round(riskPenalty, 2),
      expectedNetVacationValue: round(riskAdjustedEv, 2),
      rawIncrementalExpectedValue: round(rawEv, 2),
      riskAdjustedIncrementalExpectedValue: round(riskAdjustedEv, 2),
      incrementalRoi: expectedLoss.expectedAdditionalLoss > 0 ? round(rawEv / expectedLoss.expectedAdditionalLoss) : null,
      probabilityOfExceedingRemainingBankroll: exceedProbability === null ? null : round(exceedProbability),
      bankrollSurvivalProbability: bankroll.survivalProbability,
      requiredBankrollP50: bankroll.requiredBankrollP50,
      requiredBankrollP75: bankroll.requiredBankrollP75,
      requiredBankrollP90: bankroll.requiredBankrollP90,
      recommendedBankrollBuffer: bankroll.recommendedBuffer,
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
