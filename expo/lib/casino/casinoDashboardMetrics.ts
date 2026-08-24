import type { CasinoSession, SessionAnalytics } from '@/state/CasinoSessionProvider';
import type { CasinoCruiseTruth } from './casinoTruthEngine';

export type CasinoMetricConfidence = 'actual' | 'mixed' | 'estimated' | 'missing';

export interface CasinoDashboardMetrics {
  tripCount: number;
  tripsWithPoints: number;
  totalPoints: number;
  totalHours: number | null;
  hoursConfidence: CasinoMetricConfidence;
  totalCoinIn: number | null;
  coinInConfidence: CasinoMetricConfidence;
  totalTheo: number | null;
  theoConfidence: CasinoMetricConfidence;
  totalNet: number | null;
  netConfidence: CasinoMetricConfidence;
  pointsPerHour: number | null;
  averagePointsPerTrip: number | null;
  averagePointsPerNight: number | null;
  adt: number | null;
  ratedGamingDays: number;
  winRate: number | null;
  lossRate: number | null;
  breakEvenRate: number | null;
  standardDeviation: number | null;
  medianResult: number | null;
  bestResult: number | null;
  worstResult: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  theoVariance: number | null;
  theoVariancePercent: number | null;
  dataCoverage: number;
  actualEvidenceCount: number;
  estimatedEvidenceCount: number;
  missingEvidenceCount: number;
  sustainabilityScore: number | null;
  offerSafetyIndex: number | null;
}

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sumKnown = (values: Array<number | null>): number | null => {
  const known = values.filter((value): value is number => value != null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
};

const confidenceFor = (rows: CasinoCruiseTruth[], key: 'hours' | 'coinIn' | 'theoreticalLoss' | 'netGamingResult'): CasinoMetricConfidence => {
  const evidence = rows.map((row) => row[key]).filter((item) => item.value != null);
  if (!evidence.length) return 'missing';
  const hasEstimate = evidence.some((item) => item.kind === 'estimated');
  const hasActual = evidence.some((item) => item.kind === 'actual' || item.kind === 'user_entered' || item.kind === 'provider_reported');
  if (hasEstimate && hasActual) return 'mixed';
  return hasEstimate ? 'estimated' : 'actual';
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function longestStreak(values: number[], predicate: (value: number) => boolean): number {
  let current = 0;
  let longest = 0;
  for (const value of values) {
    current = predicate(value) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * Builds display metrics only from the owner-scoped truth rows and actual
 * session analytics supplied by the providers.  It never injects profile
 * fixtures, historical floors, or arbitrary dollar totals.
 */
export function buildCasinoDashboardMetrics(input: {
  truths: CasinoCruiseTruth[];
  sessions: CasinoSession[];
  sessionAnalytics: SessionAnalytics;
}): CasinoDashboardMetrics {
  const truths = Array.isArray(input.truths) ? input.truths : [];
  const sessions = Array.isArray(input.sessions) ? input.sessions.filter((session) => session?.recordKind !== 'generated') : [];
  const points = truths.map((truth) => truth.points.value).filter((value): value is number => value != null);
  const hours = truths.map((truth) => truth.hours.value);
  const coinIn = truths.map((truth) => truth.coinIn.value);
  const theo = truths.map((truth) => truth.theoreticalLoss.value);
  const net = truths.map((truth) => truth.netGamingResult.value);
  const netValues = net.filter((value): value is number => value != null);
  const chronologicalNet = truths
    .filter((truth) => truth.netGamingResult.value != null)
    .sort((a, b) => a.sailDate.localeCompare(b.sailDate))
    .map((truth) => truth.netGamingResult.value as number);
  const totalHours = sumKnown(hours);
  const totalPoints = points.reduce((sum, value) => sum + value, 0);
  const totalTheo = sumKnown(theo);
  const totalNet = sumKnown(net);
  const ratedDays = new Set(sessions.map((session) => session.ratedDay || session.casinoDay || session.date).filter(Boolean)).size;
  // Cruise nights and itinerary days are not authoritative rated gaming
  // days. ADT remains unavailable until sessions/ratings identify the days.
  const ratedGamingDays = ratedDays;
  const totalNights = truths.reduce((sum, truth) => sum + Math.max(0, truth.seaDays + truth.portDays), 0);
  const wins = netValues.filter((value) => value > 0).length;
  const losses = netValues.filter((value) => value < 0).length;
  const breakEven = netValues.filter((value) => value === 0).length;
  const evidence = truths.flatMap((truth) => [truth.points, truth.hours, truth.coinIn, truth.theoreticalLoss, truth.netGamingResult]);
  const actualEvidenceCount = evidence.filter((item) => item.value != null && item.kind !== 'estimated').length;
  const estimatedEvidenceCount = evidence.filter((item) => item.value != null && item.kind === 'estimated').length;
  const missingEvidenceCount = evidence.filter((item) => item.value == null).length;
  const dataCoverage = evidence.length ? ((actualEvidenceCount + (estimatedEvidenceCount * 0.5)) / evidence.length) * 100 : 0;
  const deviation = standardDeviation(netValues);
  const meanAbsoluteResult = netValues.length ? netValues.reduce((sum, value) => sum + Math.abs(value), 0) / netValues.length : null;
  const relativeVolatility = deviation != null && meanAbsoluteResult && meanAbsoluteResult > 0 ? deviation / meanAbsoluteResult : null;
  const consistency = relativeVolatility == null ? null : Math.max(0, 100 - Math.min(100, relativeVolatility * 35));
  const coverageComponent = Math.min(100, dataCoverage);
  const sustainabilityScore = consistency == null ? (truths.length ? coverageComponent : null) : (consistency * 0.6) + (coverageComponent * 0.4);
  const offerSafetyIndex = truths.length < 2 ? null : Math.max(0, Math.min(100,
    ((sustainabilityScore ?? 0) * 0.55)
      + (Math.min(100, truths.length * 10) * 0.2)
      + (Math.min(100, (totalPoints / truths.length) / 50) * 0.25),
  ));

  return {
    tripCount: truths.length,
    tripsWithPoints: points.length,
    totalPoints,
    totalHours,
    hoursConfidence: confidenceFor(truths, 'hours'),
    totalCoinIn: sumKnown(coinIn),
    coinInConfidence: confidenceFor(truths, 'coinIn'),
    totalTheo,
    theoConfidence: confidenceFor(truths, 'theoreticalLoss'),
    totalNet,
    netConfidence: confidenceFor(truths, 'netGamingResult'),
    pointsPerHour: totalHours && totalHours > 0 ? totalPoints / totalHours : null,
    averagePointsPerTrip: points.length ? totalPoints / points.length : null,
    averagePointsPerNight: totalNights > 0 ? totalPoints / totalNights : null,
    adt: totalTheo != null && ratedGamingDays > 0 ? totalTheo / ratedGamingDays : null,
    ratedGamingDays,
    winRate: netValues.length ? (wins / netValues.length) * 100 : null,
    lossRate: netValues.length ? (losses / netValues.length) * 100 : null,
    breakEvenRate: netValues.length ? (breakEven / netValues.length) * 100 : null,
    standardDeviation: deviation,
    medianResult: median(netValues),
    bestResult: netValues.length ? Math.max(...netValues) : null,
    worstResult: netValues.length ? Math.min(...netValues) : null,
    longestWinStreak: longestStreak(chronologicalNet, (value) => value > 0),
    longestLossStreak: longestStreak(chronologicalNet, (value) => value < 0),
    theoVariance: totalTheo != null && totalNet != null ? totalNet + totalTheo : null,
    theoVariancePercent: totalTheo && totalTheo > 0 && totalNet != null ? ((totalNet + totalTheo) / totalTheo) * 100 : null,
    dataCoverage,
    actualEvidenceCount,
    estimatedEvidenceCount,
    missingEvidenceCount,
    sustainabilityScore,
    offerSafetyIndex,
  };
}

export function safeCasinoNumber(value: unknown): number {
  return finite(value) ?? 0;
}
