import { stableModelFingerprint, mean, round } from '../models/statistics';
import type { CasinoCruiseOutcome } from '../history/types';
import type { BuildPersonalDashboardInput, PersonalGamblingDashboardSnapshot, PersonalThresholdDashboardRow, PersonalTripSummary } from './types';
import { buildOptimizationCharts } from './buildOptimizationCharts';

function trip(outcome: CasinoCruiseOutcome): PersonalTripSummary {
  return { cruiseOutcomeId: outcome.id, shipName: outcome.shipName, sailDate: outcome.sailDate, points: outcome.totalPoints.value, result: outcome.actualResult.value, bankrollConsumed: outcome.buyIn.value, certificateCode: outcome.certificateEarnedCode };
}
function mostFrequent(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>(); values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
export function buildPersonalGamblingDashboard(input: BuildPersonalDashboardInput): PersonalGamblingDashboardSnapshot {
  if (input.history.ownerProfileId !== input.model.ownerProfileId) throw new Error('Profile mismatch between history and model.');
  const generatedAt = new Date(input.generatedAt ?? input.model.generatedAt).toISOString();
  const outcomes = input.history.outcomes;
  const completedResults = outcomes.filter(o => o.actualResult.value !== null);
  const winning = completedResults.filter(o => (o.actualResult.value ?? 0) > 0);
  const losing = completedResults.filter(o => (o.actualResult.value ?? 0) < 0);
  const thresholds: PersonalThresholdDashboardRow[] = input.model.profile.thresholdModels
    .map(m => ({
      thresholdDefinitionId: m.threshold.id, certificateCode: m.threshold.certificateCode, thresholdPoints: m.threshold.thresholdPoints,
      label: m.classification.label, successProbability: m.successProbability.probability, expectedCertificateValue: m.classification.expectedCertificateValue,
      expectedLoss: m.classification.expectedTotalLoss, expectedNetValue: m.classification.expectedNetValue,
      riskAdjustedExpectedNetValue: m.classification.riskAdjustedExpectedNetValue, normalBankrollRequired: m.classification.normalBankrollRequired,
      attempts: m.statistics.attempts, successes: m.statistics.successes, confidence: m.statistics.confidence,
      sourceEvidence: m.threshold.sourceEvidence, reasons: [...m.classification.reasons], warnings: [...new Set([...m.statistics.warnings, ...m.classification.warnings, ...(m.valueSnapshot?.warnings ?? [])])],
    }))
    .sort((a, b) => a.thresholdPoints - b.thresholdPoints);
  const best = [...completedResults].sort((a, b) => (b.actualResult.value ?? -Infinity) - (a.actualResult.value ?? -Infinity))[0] ?? null;
  const worst = [...completedResults].sort((a, b) => (a.actualResult.value ?? Infinity) - (b.actualResult.value ?? Infinity))[0] ?? null;
  const profitableCodes = new Map<string, number[]>();
  for (const o of completedResults) if (o.certificateEarnedCode) profitableCodes.set(o.certificateEarnedCode, [...(profitableCodes.get(o.certificateEarnedCode) ?? []), o.actualResult.value ?? 0]);
  const mostProfitable = [...profitableCodes.entries()].map(([code, values]) => ({ code, average: mean(values) ?? -Infinity })).sort((a, b) => b.average - a.average)[0]?.code ?? null;
  const highestEv = [...thresholds].sort((a, b) => b.riskAdjustedExpectedNetValue - a.riskAdjustedExpectedNetValue)[0]?.certificateCode ?? null;
  const certificatePointValues = outcomes.map(o => o.thresholdReached).filter((v): v is number => typeof v === 'number');
  const warnings = [...input.history.warnings, ...input.model.profile.warnings];
  if (outcomes.length < 4) warnings.push('Dashboard metrics are based on a small personal sample.');
  return {
    id: `personal-gambling-dashboard:${stableModelFingerprint([input.model.id, input.history.id, generatedAt])}`,
    ownerProfileId: input.model.ownerProfileId, generatedAt, modelVersion: input.model.modelVersion, historySnapshotId: input.history.id,
    averageCertificatePoints: mean(certificatePointValues) === null ? null : round(mean(certificatePointValues) ?? 0, 0),
    favoriteCertificateCode: mostFrequent(outcomes.map(o => o.certificateEarnedCode).filter((v): v is string => Boolean(v))),
    mostProfitableCertificateCode: mostProfitable, highestExpectedValueCertificateCode: highestEv,
    averageBankroll: input.model.profile.averageBankrollConsumed,
    averageGamblingLoss: losing.length ? round(mean(losing.map(o => Math.abs(o.actualResult.value ?? 0))) ?? 0, 2) : null,
    averageGamblingWin: winning.length ? round(mean(winning.map(o => o.actualResult.value ?? 0)) ?? 0, 2) : null,
    bestTrip: best ? trip(best) : null, worstTrip: worst ? trip(worst) : null,
    currentRecommendedTarget: input.latestRecommendation?.recommendedTargetPoints ?? input.model.profile.currentPrimaryTarget,
    recommendationAccuracy: input.recommendationAccuracy ?? null, modelMaturity: input.model.profile.modelMaturity,
    thresholds, charts: buildOptimizationCharts(input.history, input.model), latestRecommendation: input.latestRecommendation ?? null,
    warnings: [...new Set(warnings)],
  };
}
