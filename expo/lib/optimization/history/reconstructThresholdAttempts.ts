import type {
  CasinoSessionObservation,
  CertificateThresholdAttempt,
} from './types';
import { stableFingerprint } from './normalization';

const DEFAULT_THRESHOLDS = [400, 600, 800, 1200, 1500, 2000, 3000, 4000, 6500, 9000, 15000, 25000, 40000];

export function normalizeCertificateThresholds(thresholds?: number[]): number[] {
  const source = thresholds && thresholds.length > 0 ? thresholds : DEFAULT_THRESHOLDS;
  return [...new Set(source.filter(value => Number.isFinite(value) && value > 0).map(value => Math.round(value)))]
    .sort((first, second) => first - second);
}

export function highestThresholdReached(points: number | null, thresholds?: number[]): number | null {
  if (points === null) return null;
  const ladder = normalizeCertificateThresholds(thresholds);
  return [...ladder].reverse().find(threshold => points >= threshold) ?? null;
}

function sessionAtThreshold(
  sessions: CasinoSessionObservation[],
  threshold: number,
): CasinoSessionObservation | null {
  return sessions.find(session => (session.cumulativeCruisePointsAfterSession ?? -1) >= threshold) ?? null;
}

export function reconstructCertificateThresholdAttempts(input: {
  cruiseOutcomeId: string;
  finalPoints: number | null;
  totalCoinIn: number | null;
  actualResult: number | null;
  sessions: CasinoSessionObservation[];
  thresholds?: number[];
}): CertificateThresholdAttempt[] {
  if (input.finalPoints === null) return [];
  const ladder = normalizeCertificateThresholds(input.thresholds);
  const attempts: CertificateThresholdAttempt[] = [];
  const sortedSessions = [...input.sessions]
    .filter(session => session.reconciliationStatus === 'matched')
    .sort((first, second) => (first.sessionSequence ?? 0) - (second.sessionSequence ?? 0));

  for (const threshold of ladder) {
    if (threshold <= input.finalPoints) {
      const crossingSession = sessionAtThreshold(sortedSessions, threshold);
      const sessionsUsed = crossingSession?.sessionSequence ?? null;
      const timeUsedMinutes = sessionsUsed !== null
        ? sortedSessions.slice(0, sessionsUsed).reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0)
        : null;
      attempts.push({
        id: `threshold-attempt:${stableFingerprint([input.cruiseOutcomeId, threshold, 'achieved'])}`,
        cruiseOutcomeId: input.cruiseOutcomeId,
        thresholdPoints: threshold,
        pointsAtOpportunityStart: threshold === ladder[0] ? 0 : (ladder[ladder.indexOf(threshold) - 1] ?? 0),
        pointsRemainingAtStop: 0,
        attempted: true,
        achieved: true,
        pointsAtStop: input.finalPoints,
        incrementalCoinIn: null,
        incrementalResult: null,
        sessionsUsed,
        timeUsedMinutes,
        bankrollConsumed: null,
        resultWhenAttemptBegan: null,
        remainingCruiseOpportunity: null,
        recommendationIdAtStart: null,
        stopReason: null,
        status: crossingSession || sortedSessions.length === 0 ? 'complete' : 'incomplete',
        warnings: crossingSession || sortedSessions.length === 0
          ? []
          : ['Final points prove the threshold was achieved, but the crossing session is unavailable.'],
      });
      continue;
    }

    const gap = threshold - input.finalPoints;
    const nearThreshold = gap <= Math.max(250, Math.round(threshold * 0.1));
    if (nearThreshold) {
      attempts.push({
        id: `threshold-attempt:${stableFingerprint([input.cruiseOutcomeId, threshold, 'near-stop'])}`,
        cruiseOutcomeId: input.cruiseOutcomeId,
        thresholdPoints: threshold,
        pointsAtOpportunityStart: input.finalPoints,
        pointsRemainingAtStop: gap,
        attempted: null,
        achieved: false,
        pointsAtStop: input.finalPoints,
        incrementalCoinIn: null,
        incrementalResult: null,
        sessionsUsed: sortedSessions.length || null,
        timeUsedMinutes: sortedSessions.length > 0
          ? sortedSessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0)
          : null,
        bankrollConsumed: input.actualResult !== null && input.actualResult < 0 ? Math.abs(input.actualResult) : null,
        resultWhenAttemptBegan: null,
        remainingCruiseOpportunity: null,
        recommendationIdAtStart: null,
        stopReason: null,
        status: 'ambiguous',
        warnings: ['The cruise stopped near this threshold, but the available history does not prove it was intentionally attempted.'],
      });
    }
    break;
  }

  return attempts;
}
