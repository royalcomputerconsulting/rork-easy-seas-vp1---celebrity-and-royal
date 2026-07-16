import type { CasinoCruiseOutcome } from '../history/types';
import type {
  BuildPersonalGamblingProfileInput,
  LiveTargetContext,
  OptimizationModelSnapshot,
  PersonalGamblingProfile,
} from './types';
import { buildThresholdStatistics } from './buildThresholdStatistics';
import { classifyPersonalTargets } from './classifyPersonalTargets';
import { estimateExpectedLoss } from './estimateExpectedLoss';
import { estimateSuccessProbability } from './estimateSuccessProbability';
import { selectComparableHistory } from './selectComparableHistory';
import { mean, round, stableModelFingerprint } from './statistics';

export const OPTIMIZATION_MODEL_VERSION = 'opt3.0.0';

function values(outcomes: CasinoCruiseOutcome[], selector: (outcome: CasinoCruiseOutcome) => number | null): number[] {
  return outcomes.flatMap(outcome => {
    const value = selector(outcome);
    return value === null || !Number.isFinite(value) ? [] : [value];
  });
}

export function buildPersonalGamblingProfile(input: BuildPersonalGamblingProfileInput): OptimizationModelSnapshot {
  if (input.ownerProfileId !== input.history.ownerProfileId) throw new Error('Profile mismatch between model input and canonical history.');
  if (input.priors.ownerProfileId !== input.ownerProfileId) throw new Error('Profile mismatch between model input and priors.');
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const outcomes = input.history.outcomes;
  const statistics = input.thresholds.map(threshold => buildThresholdStatistics({ threshold, outcomes }));
  const selections = input.thresholds.map(threshold => {
    const context: LiveTargetContext = {
      ownerProfileId: input.ownerProfileId,
      program: threshold.program,
      brand: outcomes.find(outcome => outcome.program === threshold.program)?.brand ?? 'royal',
      cruiseNights: statistics.find(item => item.thresholdDefinitionId === threshold.id)?.tripLength.median ?? null,
      currentPoints: 0,
      targetPoints: threshold.thresholdPoints,
      remainingCasinoHours: statistics.find(item => item.thresholdDefinitionId === threshold.id)?.pointsPerHour.median
        ? threshold.thresholdPoints / Math.max(1, statistics.find(item => item.thresholdDefinitionId === threshold.id)?.pointsPerHour.median ?? 1)
        : null,
      remainingCasinoDays: null,
      currentResult: 0,
      remainingBankroll: input.priors.tripBankrollBudget ?? input.priors.dailyBankrollBudget * 5,
      asOf: generatedAt,
    };
    return { threshold, context, selection: selectComparableHistory({ context, outcomes, minimumSimilarity: 0.25 }) };
  });
  const losses = selections.map(item => estimateExpectedLoss({
    thresholdDefinitionId: item.threshold.id,
    currentPoints: 0,
    targetPoints: item.threshold.thresholdPoints,
    comparableOutcomes: item.selection.includedOutcomes,
    priors: input.priors,
  }));
  const probabilities = selections.map((item, index) => estimateSuccessProbability({
    thresholdDefinitionId: item.threshold.id,
    context: item.context,
    comparableOutcomes: item.selection.includedOutcomes,
    expectedLoss: losses[index],
    seed: [input.ownerProfileId, item.threshold.id, generatedAt, OPTIMIZATION_MODEL_VERSION].join('|'),
  }));
  const classifications = classifyPersonalTargets({ thresholds: input.thresholds, valueSnapshots: input.valueSnapshots, statistics, losses, probabilities, priors: input.priors });
  const thresholdModels = input.thresholds.map(threshold => ({
    threshold,
    valueSnapshot: input.valueSnapshots.find(snapshot => snapshot.thresholdDefinitionId === threshold.id) ?? null,
    statistics: statistics.find(item => item.thresholdDefinitionId === threshold.id)!,
    expectedLoss: losses.find(item => item.thresholdDefinitionId === threshold.id)!,
    successProbability: probabilities.find(item => item.thresholdDefinitionId === threshold.id)!,
    classification: classifications.find(item => item.thresholdDefinitionId === threshold.id)!,
  }));
  const losingResults = values(outcomes, outcome => outcome.actualResult.value).filter(value => value < 0).map(value => -value);
  const winningResults = values(outcomes, outcome => outcome.actualResult.value).filter(value => value > 0);
  const bankroll = values(outcomes, outcome => outcome.actualResult.value).map(value => Math.max(0, -value));
  const modelMaturity: PersonalGamblingProfile['modelMaturity'] = outcomes.length >= 10 && input.history.overallDataHealth.score >= 75
    ? 'established'
    : outcomes.length >= 3
      ? 'developing'
      : 'insufficient';
  const currentPrimaryTarget = classifications.find(item => item.label === 'Primary Target')?.thresholdPoints ?? null;
  const highestExpectedValueTarget = [...classifications].sort((a, b) => b.riskAdjustedExpectedNetValue - a.riskAdjustedExpectedNetValue)[0]?.thresholdPoints ?? null;
  const warnings = [...input.history.warnings];
  if (modelMaturity !== 'established') warnings.push('Personal optimization model is not yet established; labels remain evidence-gated.');
  if (input.valueSnapshots.length < input.thresholds.length) warnings.push('One or more thresholds are missing a personal certificate value snapshot.');
  const profile: PersonalGamblingProfile = {
    id: `personal-gambling-profile:${stableModelFingerprint([input.ownerProfileId, generatedAt, OPTIMIZATION_MODEL_VERSION])}`,
    ownerProfileId: input.ownerProfileId,
    generatedAt,
    priors: input.priors,
    averageBankrollConsumed: mean(bankroll) === null ? null : round(mean(bankroll) ?? 0, 2),
    averageActualLoss: mean(losingResults) === null ? null : round(mean(losingResults) ?? 0, 2),
    averageActualWin: mean(winningResults) === null ? null : round(mean(winningResults) ?? 0, 2),
    averagePointsPerDay: mean(values(outcomes, outcome => outcome.averagePointsPerDay)) === null ? null : round(mean(values(outcomes, outcome => outcome.averagePointsPerDay)) ?? 0, 2),
    averagePointsPerSession: mean(values(outcomes, outcome => outcome.averagePointsPerSession)) === null ? null : round(mean(values(outcomes, outcome => outcome.averagePointsPerSession)) ?? 0, 2),
    modelMaturity,
    thresholdModels,
    currentPrimaryTarget,
    highestExpectedValueTarget,
    warnings: [...new Set(warnings)],
    version: OPTIMIZATION_MODEL_VERSION,
  };
  const deterministicFingerprint = stableModelFingerprint([
    input.ownerProfileId, input.history.id, ...input.valueSnapshots.map(snapshot => snapshot.id).sort(),
    ...thresholdModels.map(model => `${model.threshold.id}:${model.successProbability.probability}:${model.expectedLoss.blendedLossRate}`).sort(),
    OPTIMIZATION_MODEL_VERSION,
  ]);
  return {
    id: `optimization-model:${deterministicFingerprint}`,
    ownerProfileId: input.ownerProfileId,
    generatedAt,
    canonicalHistorySnapshotId: input.history.id,
    certificateValueSnapshotIds: input.valueSnapshots.map(snapshot => snapshot.id),
    profile,
    modelVersion: OPTIMIZATION_MODEL_VERSION,
    priorSnapshotId: input.priorSnapshotId ?? null,
    deterministicFingerprint,
  };
}
