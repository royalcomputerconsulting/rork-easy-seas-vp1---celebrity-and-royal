import type { CasinoSession, SessionAnalytics } from '@/state/CasinoSessionProvider';
import type { CasinoCruiseTruth } from './casinoTruthEngine';

export type CasinoMetricConfidence = 'actual' | 'mixed' | 'estimated' | 'missing';

export interface CasinoDashboardMetrics {
  tripCount: number;
  tripsWithPoints: number;
  totalPoints: number;
  totalHours: number | null;
  actualHours: number | null;
  estimatedHours: number | null;
  hoursConfidence: CasinoMetricConfidence;
  totalCasinoAvailabilityHours: number | null;
  casinoAvailableDays: number;
  availabilityConfidence: CasinoMetricConfidence;
  totalCoinIn: number | null;
  coinInConfidence: CasinoMetricConfidence;
  totalTheo: number | null;
  theoConfidence: CasinoMetricConfidence;
  totalNet: number | null;
  netConfidence: CasinoMetricConfidence;
  totalCertificateCreatedValue: number | null;
  certificateCreatedValueConfidence: CasinoMetricConfidence;
  pointsPerHour: number | null;
  pointsUsedForPointsPerHour: number | null;
  averagePointsPerTrip: number | null;
  averagePointsPerNight: number | null;
  pointsPerAvailableHour: number | null;
  modeledPointsPerEstimatedHour: number | null;
  coinInPerEstimatedHour: number | null;
  theoPerEstimatedHour: number | null;
  adt: number | null;
  adtConfidence: CasinoMetricConfidence;
  explicitRatedGamingDays: number;
  estimatedRatedGamingDays: number;
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

const confidenceFor = (rows: CasinoCruiseTruth[], key: 'hours' | 'coinIn' | 'theoreticalLoss' | 'netGamingResult' | 'certificateCreatedValue'): CasinoMetricConfidence => {
  const evidence = rows.map((row) => row[key]).filter((item) => item && item.value != null);
  if (!evidence.length) return 'missing';
  const hasEstimate = evidence.some((item) => item.kind === 'estimated');
  const hasActual = evidence.some((item) => item.kind === 'session_actual' || item.kind === 'receipt_actual' || item.kind === 'user_entered' || item.kind === 'provider_reported' || item.kind === 'derived');
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
  const certificateCreatedValues = truths.map((truth) => truth.certificateCreatedValue?.value ?? null);
  const netValues = net.filter((value): value is number => value != null);
  const chronologicalNet = truths
    .filter((truth) => truth.netGamingResult.value != null)
    .sort((a, b) => a.sailDate.localeCompare(b.sailDate))
    .map((truth) => truth.netGamingResult.value as number);
  const totalHours = sumKnown(hours);
  const actualHourTruths = truths.filter((truth) => truth.hours.value != null && truth.hours.kind !== 'estimated');
  const estimatedHourTruths = truths.filter((truth) => truth.hours.value != null && truth.hours.kind === 'estimated');
  const actualHours = sumKnown(actualHourTruths.map((truth) => truth.hours.value));
  const estimatedHours = sumKnown(estimatedHourTruths.map((truth) => truth.hours.value));
  const pointsUsedForPointsPerHour = sumKnown(actualHourTruths.map((truth) => truth.points.value));
  const totalPoints = points.reduce((sum, value) => sum + value, 0);
  const totalCoinIn = sumKnown(coinIn);
  const totalTheo = sumKnown(theo);
  const totalNet = sumKnown(net);
  const totalCertificateCreatedValue = sumKnown(certificateCreatedValues);
  const casinoAvailabilityHours = truths.map((truth) => truth.casinoAvailabilityHours ?? null);
  const totalCasinoAvailabilityHours = sumKnown(casinoAvailabilityHours);
  const casinoAvailableDays = truths.reduce((sum, truth) => sum + Math.max(0, truth.casinoAvailableDays || 0), 0);
  const tripsWithAvailability = truths.filter((truth) => (truth.casinoAvailabilityHours ?? 0) > 0 || (truth.casinoAvailableDays ?? 0) > 0).length;
  const ratedSessionDays = new Set(sessions.map((session) => session.ratedDay || session.casinoDay || session.date).filter(Boolean)).size;
  const explicitRatedGamingDays = truths.reduce((sum, truth) => sum + (truth.ratedGamingDaysSource === 'explicit' ? Math.max(0, truth.ratedGamingDays || 0) : 0), 0);
  const estimatedRatedGamingDays = truths.reduce((sum, truth) => sum + (truth.ratedGamingDaysSource === 'casino_availability_estimate' ? Math.max(0, truth.ratedGamingDays || 0) : 0), 0);
  const ratedCruiseDays = explicitRatedGamingDays + estimatedRatedGamingDays;
  const ratedGamingDays = ratedCruiseDays > 0 ? ratedCruiseDays : ratedSessionDays;
  const adtConfidence: CasinoMetricConfidence = totalTheo == null || ratedGamingDays <= 0
    ? 'missing'
    : estimatedRatedGamingDays > 0
      ? explicitRatedGamingDays > 0 ? 'mixed' : 'estimated'
      : 'actual';
  const totalNights = truths.reduce((sum, truth) => sum + Math.max(0, truth.seaDays + truth.portDays), 0);
  const wins = netValues.filter((value) => value > 0).length;
  const losses = netValues.filter((value) => value < 0).length;
  const breakEven = netValues.filter((value) => value === 0).length;
  const evidence = truths.flatMap((truth) => [truth.points, truth.hours, truth.coinIn, truth.theoreticalLoss, truth.netGamingResult, truth.certificateCreatedValue].filter(Boolean));
  const actualEvidenceCount = evidence.filter((item) => item.value != null && item.kind !== 'estimated').length;
  const estimatedEvidenceCount = evidence.filter((item) => item.value != null && item.kind === 'estimated').length;
  const missingEvidenceCount = evidence.filter((item) => item.value == null).length;
  const dataCoverage = evidence.length ? ((actualEvidenceCount + (estimatedEvidenceCount * 0.5)) / evidence.length) * 100 : 0;
  const deviation = standardDeviation(netValues);
  const meanAbsoluteResult = netValues.length ? netValues.reduce((sum, value) => sum + Math.abs(value), 0) / netValues.length : null;
  const relativeVolatility = deviation != null && meanAbsoluteResult && meanAbsoluteResult > 0 ? deviation / meanAbsoluteResult : null;
  const consistency = relativeVolatility == null ? null : Math.max(0, 100 - Math.min(100, relativeVolatility * 35));
  const coverageComponent = Math.min(100, dataCoverage);
  // A coverage percentage alone cannot establish sustainable play. Require
  // multiple observed cash results before presenting a stability score.
  const sustainabilityScore = consistency == null || netValues.length < 2 ? null : (consistency * 0.6) + (coverageComponent * 0.4);
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
    actualHours,
    estimatedHours,
    hoursConfidence: confidenceFor(truths, 'hours'),
    totalCasinoAvailabilityHours,
    casinoAvailableDays,
    availabilityConfidence: tripsWithAvailability === 0 ? 'missing' : tripsWithAvailability === truths.length ? 'estimated' : 'mixed',
    totalCoinIn,
    coinInConfidence: confidenceFor(truths, 'coinIn'),
    totalTheo,
    theoConfidence: confidenceFor(truths, 'theoreticalLoss'),
    totalNet,
    netConfidence: confidenceFor(truths, 'netGamingResult'),
    totalCertificateCreatedValue,
    certificateCreatedValueConfidence: confidenceFor(truths, 'certificateCreatedValue'),
    pointsPerHour: actualHours && actualHours > 0 && pointsUsedForPointsPerHour != null
      ? pointsUsedForPointsPerHour / actualHours
      : null,
    pointsUsedForPointsPerHour,
    averagePointsPerTrip: points.length ? totalPoints / points.length : null,
    averagePointsPerNight: totalNights > 0 ? totalPoints / totalNights : null,
    pointsPerAvailableHour: totalCasinoAvailabilityHours && totalCasinoAvailabilityHours > 0 ? totalPoints / totalCasinoAvailabilityHours : null,
    modeledPointsPerEstimatedHour: estimatedHours && estimatedHours > 0 ? totalPoints / estimatedHours : null,
    coinInPerEstimatedHour: estimatedHours && estimatedHours > 0 && totalCoinIn != null ? totalCoinIn / estimatedHours : null,
    theoPerEstimatedHour: estimatedHours && estimatedHours > 0 && totalTheo != null ? totalTheo / estimatedHours : null,
    adt: totalTheo != null && ratedGamingDays > 0 ? totalTheo / ratedGamingDays : null,
    adtConfidence,
    explicitRatedGamingDays,
    estimatedRatedGamingDays,
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
