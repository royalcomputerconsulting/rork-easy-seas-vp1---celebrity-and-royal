import type { OptimizationModelSnapshot } from '../models/types';
import type { LiveCasinoStateRecord, OneMoreSessionScenario } from './types';
import { round } from '../models/statistics';

export function evaluateOneMoreSession(
  state: LiveCasinoStateRecord,
  model: OptimizationModelSnapshot,
  requestedMinutes = 60,
): OneMoreSessionScenario {
  const sessionMinutes = Math.max(15, Math.min(90, Math.floor(requestedMinutes)));
  const reasons: string[] = [];
  const warnings: string[] = [];
  const pointsPerHour = state.currentPointsPerHour ?? state.baselinePointsPerHour ?? 0;
  const expectedAdditionalPoints = pointsPerHour * sessionMinutes / 60;
  const expectedAdditionalCoinIn = expectedAdditionalPoints * model.profile.priors.dollarsPerPoint;
  const lossPerPoint = state.currentLossPerPoint ?? state.baselineLossPerPoint
    ?? model.profile.priors.dollarsPerPoint * model.profile.priors.theoreticalLossRate;
  const expectedAdditionalLoss = Math.max(0, expectedAdditionalPoints * lossPerPoint);
  const remainingAfter = state.remainingBankroll === null ? null : state.remainingBankroll - expectedAdditionalLoss;
  const breachesDailyLimit = state.currentDailyLoss + expectedAdditionalLoss > state.hardDailyLossLimit;
  const breachesTripLimit = state.hardTripLossLimit !== null
    && state.currentTripLoss + expectedAdditionalLoss > state.hardTripLossLimit;
  const breachesProfitFloor = state.lockedProfitFloor !== null
    && state.currentResult - expectedAdditionalLoss < state.lockedProfitFloor;
  if (pointsPerHour <= 0) warnings.push('Personal points-per-hour pace is unavailable; one-session point gain is zero.');
  if (breachesDailyLimit) reasons.push('The bounded session would exceed the daily hard loss limit in expectation.');
  if (breachesTripLimit) reasons.push('The bounded session would exceed the trip hard loss limit in expectation.');
  if (breachesProfitFloor) reasons.push('The bounded session would expose profit below the locked profit floor.');
  if (remainingAfter !== null && remainingAfter < 0) reasons.push('Expected session loss exceeds remaining bankroll.');
  const permitted = !breachesDailyLimit && !breachesTripLimit && !breachesProfitFloor && (remainingAfter === null || remainingAfter >= 0);
  if (permitted) reasons.push('The session is bounded by time, bankroll, hard-loss limits, and the locked profit floor.');
  warnings.push('One-more-session analysis does not imply risk-free play or guaranteed points.');
  return {
    generatedAt: state.asOf,
    sessionMinutes,
    expectedAdditionalPoints: round(expectedAdditionalPoints, 1),
    expectedAdditionalCoinIn: round(expectedAdditionalCoinIn, 2),
    expectedAdditionalLoss: round(expectedAdditionalLoss, 2),
    projectedPointsAfterSession: Math.floor(state.currentPoints + expectedAdditionalPoints),
    remainingBankrollAfterExpectedLoss: remainingAfter === null ? null : round(remainingAfter, 2),
    breachesDailyLimit,
    breachesTripLimit,
    breachesProfitFloor,
    permitted,
    reasons,
    warnings,
  };
}
