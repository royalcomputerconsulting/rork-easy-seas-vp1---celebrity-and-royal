import type { FatiguePerformanceAssessment, LiveOptimizationState } from './types';
import { clamp } from '../models/statistics';

export function assessFatigueAndPerformance(state: LiveOptimizationState, dismissed = false): FatiguePerformanceAssessment {
  if (dismissed) return { penalty: 0, triggeredSignals: ['User dismissed the fatigue/performance signal.'], dismissed: true };
  const signals: string[] = [];
  let penalty = 0;
  if ((state.fatigueRating ?? 0) >= 7) { signals.push('User-entered fatigue rating is high.'); penalty += 0.12; }
  if ((state.sessionDurationMinutes ?? 0) >= 120) { signals.push('Current session has exceeded two hours.'); penalty += 0.08; }
  if ((state.sameDayPlayMinutes ?? 0) >= 240) { signals.push('Total same-day play has exceeded four hours.'); penalty += 0.1; }
  if (state.currentPointsPerHour !== null && state.currentPointsPerHour !== undefined && state.baselinePointsPerHour) {
    if (state.currentPointsPerHour < state.baselinePointsPerHour * 0.7) { signals.push('Points-per-hour pace has materially deteriorated.'); penalty += 0.08; }
  }
  if (state.currentLossPerPoint !== null && state.currentLossPerPoint !== undefined && state.baselineLossPerPoint) {
    if (state.currentLossPerPoint > state.baselineLossPerPoint * 1.3) { signals.push('Loss per point is materially worse than the personal baseline.'); penalty += 0.1; }
  }
  return { penalty: clamp(penalty, 0, 0.35), triggeredSignals: signals, dismissed: false };
}

export function hardStopReasons(state: LiveOptimizationState): string[] {
  const reasons: string[] = [];
  if (state.remainingBankroll !== null && state.remainingBankroll <= 0) reasons.push('No remaining bankroll is available.');
  if (state.currentDailyLoss >= state.hardDailyLossLimit) reasons.push('Daily hard loss limit has been reached.');
  if (state.hardTripLossLimit !== null && state.currentTripLoss >= state.hardTripLossLimit) reasons.push('Trip hard loss limit has been reached.');
  return reasons;
}

export function lossModePenalty(state: LiveOptimizationState): number {
  const dailyRatio = state.hardDailyLossLimit > 0 ? state.currentDailyLoss / state.hardDailyLossLimit : 0;
  const tripRatio = state.hardTripLossLimit && state.hardTripLossLimit > 0 ? state.currentTripLoss / state.hardTripLossLimit : 0;
  return clamp(Math.max(dailyRatio, tripRatio) * 0.25, 0, 0.25);
}

export function availableRiskBudget(state: LiveOptimizationState): { ordinary: number | null; profitProtected: number | null } {
  const ordinary = state.remainingBankroll === null ? null : Math.max(0, state.remainingBankroll);
  if (state.currentResult <= 0 || state.lockedProfitFloor === null) return { ordinary, profitProtected: null };
  const riskableProfit = Math.max(0, state.currentResult - state.lockedProfitFloor);
  return { ordinary, profitProtected: ordinary === null ? riskableProfit : Math.min(ordinary, riskableProfit) };
}
