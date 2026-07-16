import type { CertificateCandidateEvaluation, BuildOptimalStoppingRecommendationInput, CertificateRecommendationAction, CertificateRecommendationSnapshot } from './types';
import { assessFatigueAndPerformance, hardStopReasons } from './assessSafetyModes';
import { determineCurrentLockedCertificate, selectApplicableThresholds } from './determineCurrentLockedCertificate';
import { evaluateCandidateTargets } from './evaluateCandidateTargets';
import { round, stableModelFingerprint } from '../models/statistics';

export const OPTIMAL_STOPPING_ENGINE_VERSION = 'opt4.0.0';

function actionLabel(action: CertificateRecommendationAction, target: number | null): string {
  if (action === 'DATA_UNAVAILABLE') return 'Data Unavailable / Refresh Needed';
  if (action === 'HARD_STOP') return 'Hard Stop — Bankroll Limit Reached';
  if (action === 'STOP_NOW') return 'STOP NOW';
  if (action === 'BANK_YOUR_WIN') return 'Bank Your Win';
  if (action === 'DO_NOT_CHASE') return 'Do Not Chase';
  if (action === 'PLAY_ONE_MORE_SESSION') return 'Play One More Session';
  if (action === 'CONTINUE_UNTIL_TARGET') return `Continue Until ${target?.toLocaleString() ?? 'Target'}`;
  if (action === 'PROFIT_PROTECTED_PUSH') return `Profit-Protected Push to ${target?.toLocaleString() ?? 'Target'}`;
  return 'Excellent Opportunity';
}

function bestPositive(candidates: CertificateCandidateEvaluation[]): CertificateCandidateEvaluation | null {
  return [...candidates]
    .filter(candidate => candidate.reachable && candidate.bankrollFeasible && candidate.riskAdjustedIncrementalExpectedValue > 0)
    .sort((a, b) => b.riskAdjustedIncrementalExpectedValue - a.riskAdjustedIncrementalExpectedValue)[0] ?? null;
}

function strongestCandidate(candidates: CertificateCandidateEvaluation[]): CertificateCandidateEvaluation | null {
  return [...candidates].sort((a, b) => b.riskAdjustedIncrementalExpectedValue - a.riskAdjustedIncrementalExpectedValue)[0] ?? null;
}

function selectedAction(input: {
  request: BuildOptimalStoppingRecommendationInput;
  candidates: CertificateCandidateEvaluation[];
  hardStops: string[];
}): { action: CertificateRecommendationAction; selected: CertificateCandidateEvaluation | null; overrides: string[] } {
  const { state } = input.request;
  const overrides: string[] = [];
  if (input.hardStops.length > 0) return { action: 'HARD_STOP', selected: null, overrides: input.hardStops };
  if (input.candidates.length === 0) return { action: 'STOP_NOW', selected: null, overrides: ['No higher applicable certificate threshold remains.'] };
  const best = bestPositive(input.candidates);
  const strongest = strongestCandidate(input.candidates);
  if (!best) {
    if (state.currentResult > 0) return { action: 'BANK_YOUR_WIN', selected: strongest, overrides: ['Current profit is exposed and no remaining target has positive risk-adjusted expected value.'] };
    if (input.candidates.every(candidate => candidate.rawIncrementalExpectedValue < 0)) return { action: 'STOP_NOW', selected: strongest, overrides: ['All remaining targets have negative raw incremental expected value.'] };
    return { action: 'DO_NOT_CHASE', selected: strongest, overrides: ['No remaining target passes risk-adjusted value, bankroll, and time gates.'] };
  }
  const isProfitProtected = state.currentResult > 0 && state.lockedProfitFloor !== null
    && best.profitProtectedRiskBudget !== null
    && best.rawIncrementalExpectedValue >= 0
    && best.downsideHigh <= best.profitProtectedRiskBudget
    && ['Stretch Goal', 'Exceptional Goal'].includes(best.targetLabel);
  if (isProfitProtected) return { action: 'PROFIT_PROTECTED_PUSH', selected: best, overrides };
  if (best.pointsRequired <= 250 && best.confidence !== 'high' && best.expectedAdditionalLoss <= Math.min(150, state.dailyBankrollBudget)) {
    return { action: 'PLAY_ONE_MORE_SESSION', selected: best, overrides: ['A small bounded session may resolve remaining uncertainty without committing to a long chase.'] };
  }
  if (best.probabilityOfSuccess >= 0.75 && best.confidence === 'high' && best.riskAdjustedIncrementalExpectedValue >= 500) {
    return { action: 'EXCELLENT_OPPORTUNITY', selected: best, overrides };
  }
  return { action: 'CONTINUE_UNTIL_TARGET', selected: best, overrides };
}

export function buildOptimalStoppingRecommendation(input: BuildOptimalStoppingRecommendationInput): CertificateRecommendationSnapshot {
  if (input.state.ownerProfileId !== input.history.ownerProfileId || input.state.ownerProfileId !== input.model.ownerProfileId) {
    throw new Error('Profile mismatch across live state, history, and optimization model.');
  }
  const applicableThresholds = selectApplicableThresholds({
    thresholds: input.thresholds,
    program: input.state.program,
    family: input.state.certificateFamily,
    cruiseNights: input.state.cruiseNights,
    asOf: input.state.asOf,
  });
  const fatigue = assessFatigueAndPerformance(input.state, input.dismissFatigueSignal ?? false);
  const locked = determineCurrentLockedCertificate({ currentPoints: input.state.currentPoints, applicableThresholds, valueSnapshots: input.valueSnapshots });
  const dataWarnings: string[] = [];
  if (applicableThresholds.length === 0) dataWarnings.push('No applicable certificate threshold definitions are available.');
  if (input.model.profile.thresholdModels.length === 0) dataWarnings.push('Personal threshold model is unavailable.');
  if (input.valueSnapshots.length === 0) dataWarnings.push('Personal certificate value snapshots are unavailable.');
  const candidates = dataWarnings.length > 0 ? [] : evaluateCandidateTargets({ request: input, applicableThresholds, locked, fatigue });
  const hardStops = hardStopReasons(input.state);
  const choice = dataWarnings.length > 0
    ? { action: 'DATA_UNAVAILABLE' as const, selected: null, overrides: dataWarnings }
    : selectedAction({ request: input, candidates, hardStops });
  const selected = choice.selected;
  const selectedThresholdModel = selected
    ? input.model.profile.thresholdModels.find(item => item.threshold.id === selected.thresholdDefinitionId) ?? null
    : null;
  const warnings = [
    ...locked.warnings,
    ...dataWarnings,
    ...choice.overrides,
    ...(selected?.warnings ?? []),
    ...fatigue.triggeredSignals,
  ];
  const assumptions = [
    'Casino coin-in is wagering volume, not expected loss.',
    'Profit-Protected Mode changes available risk budget and does not change the mathematical house edge.',
    'Expected loss is nonnegative even when prior trips were profitable.',
    'Unknown certificate stacking is treated conservatively as replacement rather than additive value.',
    'No gambling continuation is described as risk-free.',
  ];
  const comparableIds = selectedThresholdModel?.successProbability.includedCruiseOutcomeIds ?? [];
  const evidence = {
    comparableCruiseOutcomeIds: comparableIds,
    comparableSampleCount: selectedThresholdModel?.successProbability.comparableSampleCount ?? 0,
    thresholdAttemptCount: selectedThresholdModel?.statistics.attempts ?? 0,
    thresholdSuccessCount: selectedThresholdModel?.statistics.successes ?? 0,
    redemptionSourceCount: selectedThresholdModel?.valueSnapshot?.sourceCount ?? 0,
  };
  const recommendedTargetPoints = selected?.targetPoints ?? null;
  const id = `certificate-recommendation:${stableModelFingerprint([
    input.state.ownerProfileId, input.state.asOf, input.state.currentPoints, input.state.currentResult,
    choice.action, recommendedTargetPoints, input.model.deterministicFingerprint, OPTIMAL_STOPPING_ENGINE_VERSION,
  ])}`;
  return {
    id,
    ownerProfileId: input.state.ownerProfileId,
    generatedAt: input.state.asOf,
    action: choice.action,
    actionLabel: actionLabel(choice.action, recommendedTargetPoints),
    recommendedTargetPoints,
    recommendedTargetCertificateCode: selected?.targetCertificateCode ?? null,
    currentLockedThresholdPoints: locked.definition?.thresholdPoints ?? null,
    currentLockedCertificateCode: locked.definition?.certificateCode ?? null,
    currentPoints: input.state.currentPoints,
    currentResult: input.state.currentResult,
    expectedEndOfCruisePoints: selected?.projectedEndOfCruisePoints ?? input.state.currentPoints,
    probabilityOfSuccess: selected?.probabilityOfSuccess ?? null,
    expectedAdditionalCoinIn: selected?.expectedAdditionalCoinIn ?? 0,
    expectedAdditionalLoss: selected?.expectedAdditionalLoss ?? 0,
    downsideRange: selected ? { low: selected.downsideLow, high: selected.downsideHigh } : null,
    incrementalCertificateValue: selected?.incrementalCertificateValue ?? 0,
    rawIncrementalExpectedValue: selected?.rawIncrementalExpectedValue ?? 0,
    riskAdjustedIncrementalExpectedValue: selected?.riskAdjustedIncrementalExpectedValue ?? 0,
    bankrollImpact: {
      remainingBankroll: input.state.remainingBankroll,
      availableRiskBudget: selected?.availableRiskBudget ?? input.state.remainingBankroll,
      lockedProfitFloor: input.state.lockedProfitFloor,
      profitProtectedRiskBudget: selected?.profitProtectedRiskBudget ?? null,
      probabilityOfExceedingRemainingBankroll: selected?.probabilityOfExceedingRemainingBankroll ?? null,
    },
    confidence: selected?.confidence ?? 'missing',
    topReasons: [...(selected?.reasons ?? []), ...choice.overrides].slice(0, 6),
    warnings: [...new Set(warnings)],
    assumptions,
    historicalEvidence: evidence,
    sourceFreshness: input.state.sourceFreshness,
    engineVersion: OPTIMAL_STOPPING_ENGINE_VERSION,
    modelVersion: input.model.modelVersion,
    candidateEvaluations: candidates,
    drillDown: {
      selectedCandidateId: selected?.thresholdDefinitionId ?? null,
      fatiguePerformanceAssessment: fatigue,
      lossModeActive: input.state.currentDailyLoss > 0 || input.state.currentTripLoss > 0,
      profitProtectedModeActive: choice.action === 'PROFIT_PROTECTED_PUSH',
      safetyOverrides: choice.overrides,
    },
  };
}
