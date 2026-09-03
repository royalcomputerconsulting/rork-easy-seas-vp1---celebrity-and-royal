import type { CasinoCruiseOutcome } from '../history/types';
import type { CertificateThresholdDefinition } from '../value/types';
import type { ThresholdMetricDistribution, ThresholdStatistics } from './types';
import { confidenceBand, mean, median, quantile, round, standardDeviation, variance, wilsonInterval } from './statistics';

function numeric(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
}

function distribution(values: number[]): ThresholdMetricDistribution {
  return {
    mean: mean(values) === null ? null : round(mean(values) ?? 0, 2),
    median: median(values) === null ? null : round(median(values) ?? 0, 2),
    low: quantile(values, 0.1) === null ? null : round(quantile(values, 0.1) ?? 0, 2),
    high: quantile(values, 0.9) === null ? null : round(quantile(values, 0.9) ?? 0, 2),
    standardDeviation: standardDeviation(values) === null ? null : round(standardDeviation(values) ?? 0, 2),
    sampleCount: values.length,
  };
}

function attemptFor(outcome: CasinoCruiseOutcome, thresholdPoints: number) {
  return outcome.thresholdAttempts.find(attempt => attempt.thresholdPoints === thresholdPoints) ?? null;
}

function isOpportunity(outcome: CasinoCruiseOutcome): boolean {
  return outcome.totalPoints.value !== null && outcome.eligibleForModeling;
}

function recentTrend(outcomes: CasinoCruiseOutcome[], thresholdPoints: number): number {
  const sorted = [...outcomes].sort((a, b) => a.sailDate.localeCompare(b.sailDate));
  if (sorted.length < 2) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, midpoint);
  const recent = sorted.slice(midpoint);
  const rate = (items: CasinoCruiseOutcome[]) => items.length === 0 ? 0 : items.filter(item => (item.totalPoints.value ?? -1) >= thresholdPoints).length / items.length;
  return round(rate(recent) - rate(early));
}

export function buildThresholdStatistics(input: {
  threshold: CertificateThresholdDefinition;
  outcomes: CasinoCruiseOutcome[];
  alphaPrior?: number;
  betaPrior?: number;
}): ThresholdStatistics {
  const thresholdPoints = input.threshold.thresholdPoints;
  const alphaPrior = Math.max(0.1, input.alphaPrior ?? 2);
  const betaPrior = Math.max(0.1, input.betaPrior ?? 2);
  const opportunities = input.outcomes.filter(isOpportunity);
  const successes = opportunities.filter(outcome => (outcome.totalPoints.value ?? -1) >= thresholdPoints);
  const explicitAttempts = opportunities.filter(outcome => {
    const attempt = attemptFor(outcome, thresholdPoints);
    return attempt?.attempted === true || attempt?.achieved === true;
  });
  const attemptSet = new Set([...successes, ...explicitAttempts].map(outcome => outcome.id));
  const relevant = opportunities.filter(outcome => attemptSet.has(outcome.id));
  const failures = relevant.filter(outcome => (outcome.totalPoints.value ?? -1) < thresholdPoints);
  const rawSuccessRate = relevant.length > 0 ? successes.length / relevant.length : null;
  const smoothedSuccessRate = (successes.length + alphaPrior) / (relevant.length + alphaPrior + betaPrior);
  const coinInValues = numeric(relevant.map(outcome => outcome.totalCoinIn.value));
  const actualResults = numeric(relevant.map(outcome => outcome.actualResult.value));
  const bankrollConsumed = actualResults.map(result => Math.max(0, -result));
  const tripLength = numeric(relevant.map(outcome => outcome.nights));
  const pointsPerDay = numeric(relevant.map(outcome => outcome.averagePointsPerDay));
  const pointsPerSession = numeric(relevant.map(outcome => outcome.averagePointsPerSession));
  const pointsPerHour = numeric(relevant.map(outcome => outcome.averagePointsPerHour));
  const lossRates = relevant.flatMap(outcome => {
    const coinIn = outcome.totalCoinIn.value;
    const result = outcome.actualResult.value;
    if (coinIn === null || result === null || coinIn <= 0) return [];
    return [Math.max(0, -result) / coinIn];
  });
  const losing = actualResults.filter(result => result < 0).map(result => -result);
  const winning = actualResults.filter(result => result > 0);
  const dataQuality = opportunities.length === 0
    ? 0
    : opportunities.reduce((sum, outcome) => sum + outcome.dataHealth.score / 100, 0) / opportunities.length;
  const warnings: string[] = [];
  if (relevant.length === 0) warnings.push('No explicit attempts or successes exist for this threshold.');
  if (relevant.length < 3) warnings.push('Threshold statistics have fewer than three personal observations.');
  if (coinInValues.length < relevant.length) warnings.push('Some threshold observations are missing coin-in.');
  if (actualResults.length < relevant.length) warnings.push('Some threshold observations are missing actual result.');

  return {
    thresholdDefinitionId: input.threshold.id,
    thresholdPoints,
    certificateCode: input.threshold.certificateCode,
    opportunities: opportunities.length,
    attempts: relevant.length,
    successes: successes.length,
    failures: failures.length,
    rawSuccessRate,
    smoothedSuccessRate: round(smoothedSuccessRate),
    successRateConfidenceInterval: wilsonInterval(successes.length, relevant.length),
    coinIn: distribution(coinInValues),
    actualResult: distribution(actualResults),
    bankrollConsumed: distribution(bankrollConsumed),
    tripLength: distribution(tripLength),
    pointsPerDay: distribution(pointsPerDay),
    pointsPerSession: distribution(pointsPerSession),
    pointsPerHour: distribution(pointsPerHour),
    lossRate: distribution(lossRates),
    averageLossOnLosingCruises: mean(losing) === null ? null : round(mean(losing) ?? 0, 2),
    averageWinOnWinningCruises: mean(winning) === null ? null : round(mean(winning) ?? 0, 2),
    resultVariance: variance(actualResults) === null ? null : round(variance(actualResults) ?? 0, 2),
    resultStandardDeviation: standardDeviation(actualResults) === null ? null : round(standardDeviation(actualResults) ?? 0, 2),
    recencyWeightedTrend: recentTrend(opportunities, thresholdPoints),
    dataQuality: round(dataQuality),
    confidence: confidenceBand(relevant.length, dataQuality),
    includedCruiseOutcomeIds: relevant.map(outcome => outcome.id),
    excludedCruiseOutcomeIds: input.outcomes.filter(outcome => !relevant.includes(outcome)).map(outcome => outcome.id),
    warnings,
  };
}
