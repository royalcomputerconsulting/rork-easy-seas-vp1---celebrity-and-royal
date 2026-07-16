import type { OptimizationModelSnapshot } from '../models/types';
import type { EndOfCruisePointProjection, LiveCasinoStateRecord } from './types';
import { round } from '../models/statistics';

export function projectEndOfCruisePoints(
  state: LiveCasinoStateRecord,
  model: OptimizationModelSnapshot,
): EndOfCruisePointProjection {
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const profileRate = model.profile.averagePointsPerDay !== null && state.remainingCasinoDays !== null && state.remainingCasinoDays > 0
    ? model.profile.averagePointsPerDay / Math.max(1, 5)
    : null;
  const rate = state.currentPointsPerHour ?? state.baselinePointsPerHour ?? profileRate;
  if (rate === null || state.remainingCasinoHours === null) {
    warnings.push('Remaining casino hours or personal points-per-hour pace is unavailable.');
    return {
      generatedAt: state.asOf,
      currentPoints: state.currentPoints,
      conservativePoints: state.currentPoints,
      expectedPoints: state.currentPoints,
      optimisticPoints: state.currentPoints,
      expectedAdditionalPoints: 0,
      remainingCasinoHours: state.remainingCasinoHours,
      pointsPerHourUsed: rate,
      confidence: 'missing',
      assumptions,
      warnings,
    };
  }
  assumptions.push('Projection uses personal observed points-per-hour pace and remaining casino hours.');
  assumptions.push('The conservative and optimistic bands are planning ranges, not guarantees.');
  const fatigueFactor = state.fatigueRating !== null && state.fatigueRating >= 7 ? 0.75 : 1;
  const expectedAdditional = Math.max(0, rate * state.remainingCasinoHours * fatigueFactor);
  return {
    generatedAt: state.asOf,
    currentPoints: state.currentPoints,
    conservativePoints: Math.floor(state.currentPoints + expectedAdditional * 0.65),
    expectedPoints: Math.floor(state.currentPoints + expectedAdditional),
    optimisticPoints: Math.floor(state.currentPoints + expectedAdditional * 1.25),
    expectedAdditionalPoints: round(expectedAdditional, 1),
    remainingCasinoHours: state.remainingCasinoHours,
    pointsPerHourUsed: round(rate, 2),
    confidence: model.profile.modelMaturity === 'established' ? 'high' : model.profile.modelMaturity === 'developing' ? 'medium' : 'low',
    assumptions,
    warnings,
  };
}
