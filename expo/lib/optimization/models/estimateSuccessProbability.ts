import type { CasinoCruiseOutcome } from '../history/types';
import type { ExpectedLossEstimate, LiveTargetContext, SuccessProbabilityEstimate } from './types';
import { clamp, confidenceBand, median, round, seededRandom } from './statistics';

export function estimateSuccessProbability(input: {
  thresholdDefinitionId: string;
  context: LiveTargetContext;
  comparableOutcomes: CasinoCruiseOutcome[];
  expectedLoss: ExpectedLossEstimate;
  simulationCount?: number;
  seed?: string;
}): SuccessProbabilityEstimate {
  const pointsRemaining = Math.max(0, input.context.targetPoints - input.context.currentPoints);
  const attempts = input.comparableOutcomes.filter(outcome => outcome.totalPoints.value !== null);
  const successes = attempts.filter(outcome => (outcome.totalPoints.value ?? -1) >= input.context.targetPoints).length;
  const historicalProbability = (successes + 2) / (attempts.length + 4);
  const paceRates = attempts.flatMap(outcome => outcome.averagePointsPerHour === null ? [] : [outcome.averagePointsPerHour]);
  const medianPace = median(paceRates);
  const hoursNeeded = medianPace && medianPace > 0 ? pointsRemaining / medianPace : Infinity;
  const paceFeasibility = pointsRemaining === 0
    ? 1
    : input.context.remainingCasinoHours === null || !Number.isFinite(hoursNeeded)
      ? 0.5
      : clamp(input.context.remainingCasinoHours / Math.max(hoursNeeded, 0.01));
  const bankrollFeasibility = pointsRemaining === 0
    ? 1
    : input.context.remainingBankroll === null
      ? 0.5
      : clamp(input.context.remainingBankroll / Math.max(input.expectedLoss.downsideHigh, 1));
  const simulationCount = Math.max(100, Math.min(10000, Math.floor(input.simulationCount ?? 2000)));
  const seed = input.seed ?? [input.context.ownerProfileId, input.context.asOf, input.context.currentPoints, input.context.targetPoints, attempts.map(value => value.id).join(',')].join('|');
  const random = seededRandom(seed);
  const sampledPaces = paceRates.length > 0 ? paceRates : [medianPace ?? 0];
  const lossPerPointSamples = attempts.flatMap(outcome => {
    const result = outcome.actualResult.value;
    const points = outcome.totalPoints.value;
    if (result === null || points === null || points <= 0) return [];
    return [Math.max(0, -result) / points];
  });
  const sampledLossPerPoint = lossPerPointSamples.length > 0
    ? lossPerPointSamples
    : [input.expectedLoss.costPerPoint];
  let simulatedSuccesses = 0;
  for (let index = 0; index < simulationCount; index += 1) {
    const pace = sampledPaces[Math.floor(random() * sampledPaces.length)] ?? 0;
    const lossPerPoint = sampledLossPerPoint[Math.floor(random() * sampledLossPerPoint.length)] ?? input.expectedLoss.costPerPoint;
    const paceNoise = 0.75 + random() * 0.5;
    const lossNoise = 0.7 + random() * 0.7;
    const pointsCapacity = input.context.remainingCasinoHours === null
      ? pointsRemaining * (0.75 + random() * 0.75)
      : Math.max(0, pace * paceNoise * input.context.remainingCasinoHours);
    const requiredLossCapacity = pointsRemaining * Math.max(0, lossPerPoint) * lossNoise;
    const bankrollCapacity = input.context.remainingBankroll === null ? true : requiredLossCapacity <= input.context.remainingBankroll;
    if (pointsCapacity >= pointsRemaining && bankrollCapacity) simulatedSuccesses += 1;
  }
  const simulationProbability = pointsRemaining === 0 ? 1 : simulatedSuccesses / simulationCount;
  const probability = pointsRemaining === 0
    ? 1
    : clamp(historicalProbability * 0.35 + simulationProbability * 0.4 + paceFeasibility * 0.15 + bankrollFeasibility * 0.1);
  const quality = attempts.length === 0 ? 0 : attempts.reduce((sum, outcome) => sum + outcome.dataHealth.score / 100, 0) / attempts.length;
  const warnings: string[] = [];
  if (attempts.length < 3) warnings.push('Fewer than three comparable personal cruises are available.');
  if (paceRates.length === 0) warnings.push('Points-per-hour history is missing; pace feasibility uses a neutral fallback.');
  if (input.context.remainingCasinoHours === null) warnings.push('Remaining casino hours are unknown.');
  if (input.context.remainingBankroll === null) warnings.push('Remaining bankroll is unknown.');
  return {
    thresholdDefinitionId: input.thresholdDefinitionId,
    targetPoints: input.context.targetPoints,
    pointsRemaining,
    historicalProbability: round(historicalProbability),
    paceFeasibility: round(paceFeasibility),
    bankrollFeasibility: round(bankrollFeasibility),
    simulationProbability: round(simulationProbability),
    probability: round(probability),
    confidence: confidenceBand(attempts.length, quality),
    comparableSampleCount: attempts.length,
    simulationCount,
    seed,
    includedCruiseOutcomeIds: attempts.map(outcome => outcome.id),
    warnings,
  };
}
