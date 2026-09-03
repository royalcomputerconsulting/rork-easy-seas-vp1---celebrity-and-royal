import type { CasinoCruiseOutcome } from '../history/types';
import type { ComparableHistoryDecision, ComparableHistorySelection, LiveTargetContext } from './types';
import { clamp, round } from './statistics';

function closeness(a: number | null | undefined, b: number | null | undefined, scale: number): number {
  if (a === null || a === undefined || b === null || b === undefined) return 0.5;
  return clamp(1 - Math.abs(a - b) / Math.max(scale, 1));
}

function monthsOld(date: string, asOf: string): number {
  const from = new Date(`${date}T00:00:00Z`).getTime();
  const to = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 24;
  return Math.max(0, (to - from) / (30.4375 * 86400000));
}

function resultBand(value: number): 'ahead' | 'near-even' | 'behind' {
  if (value >= 250) return 'ahead';
  if (value <= -250) return 'behind';
  return 'near-even';
}

export function selectComparableHistory(input: {
  context: LiveTargetContext;
  outcomes: CasinoCruiseOutcome[];
  minimumSimilarity?: number;
}): ComparableHistorySelection {
  const minimumSimilarity = clamp(input.minimumSimilarity ?? 0.42);
  const decisions: ComparableHistoryDecision[] = input.outcomes.map(outcome => {
    const exclusions: string[] = [];
    const reasons: string[] = [];
    if (!outcome.eligibleForModeling) exclusions.push('Not eligible for modeling.');
    if (outcome.ownerProfileId !== input.context.ownerProfileId) exclusions.push('Different profile.');
    if (outcome.program !== input.context.program) exclusions.push('Different casino program.');
    if (outcome.totalPoints.value === null) exclusions.push('Missing cruise casino points.');
    const sameBrand = outcome.brand === input.context.brand ? 1 : 0.35;
    const sameShip = input.context.shipName && outcome.shipName.toLowerCase() === input.context.shipName.toLowerCase() ? 1 : 0.5;
    const lengthScore = closeness(outcome.nights, input.context.cruiseNights, 7);
    const currentPaceReference = outcome.averagePointsPerHour === null || input.context.remainingCasinoHours === null
      ? 0.5
      : clamp((outcome.averagePointsPerHour * input.context.remainingCasinoHours) / Math.max(1, input.context.targetPoints - input.context.currentPoints));
    const resultScore = outcome.actualResult.value === null
      ? 0.5
      : resultBand(outcome.actualResult.value) === resultBand(input.context.currentResult) ? 1 : 0.45;
    const bankrollScore = outcome.actualResult.value === null || input.context.remainingBankroll === null
      ? 0.5
      : closeness(Math.max(0, -outcome.actualResult.value), input.context.remainingBankroll, Math.max(200, input.context.remainingBankroll));
    const recencyScore = clamp(1 - monthsOld(outcome.sailDate, input.context.asOf) / 36, 0.2, 1);
    const score = round(
      sameBrand * 0.1 + sameShip * 0.05 + lengthScore * 0.15 + currentPaceReference * 0.2
      + resultScore * 0.1 + bankrollScore * 0.1 + recencyScore * 0.15 + outcome.dataHealth.score / 100 * 0.15,
    );
    if (sameBrand === 1) reasons.push('Same brand.');
    if (sameShip === 1) reasons.push('Same ship.');
    if (lengthScore >= 0.75) reasons.push('Similar cruise length.');
    if (currentPaceReference >= 0.75) reasons.push('Historical pace can cover a similar remaining point gap.');
    if (recencyScore >= 0.75) reasons.push('Recent personal history.');
    if (score < minimumSimilarity) exclusions.push(`Similarity ${score.toFixed(2)} is below ${minimumSimilarity.toFixed(2)}.`);
    return { cruiseOutcomeId: outcome.id, included: exclusions.length === 0, similarityScore: score, reasons, exclusions };
  });
  const includedIds = new Set(decisions.filter(decision => decision.included).map(decision => decision.cruiseOutcomeId));
  const includedOutcomes = input.outcomes.filter(outcome => includedIds.has(outcome.id));
  const excludedOutcomes = input.outcomes.filter(outcome => !includedIds.has(outcome.id));
  const warnings: string[] = [];
  if (includedOutcomes.length === 0) warnings.push('No personal cruises met the comparable-history threshold.');
  if (includedOutcomes.length < 3) warnings.push('Comparable-history sample is small; probability confidence is limited.');
  return { targetPoints: input.context.targetPoints, includedOutcomes, excludedOutcomes, decisions, minimumSimilarity, warnings };
}
