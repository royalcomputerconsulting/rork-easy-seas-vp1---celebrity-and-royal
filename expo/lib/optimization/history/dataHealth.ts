import type {
  CasinoCruiseOutcome,
  CasinoDataHealthComponents,
  CasinoDataHealthScore,
  FieldAuthority,
} from './types';

const WEIGHTS: Record<keyof CasinoDataHealthComponents, number> = {
  pointsCompleteness: 0.2,
  coinInCompleteness: 0.18,
  resultCompleteness: 0.2,
  sessionCompleteness: 0.12,
  certificateLinkageCompleteness: 0.1,
  valueCompleteness: 0.05,
  machineRtpCompleteness: 0.05,
  timingCompleteness: 0.1,
};

function fieldCompleteness(field: FieldAuthority<unknown>): number {
  if (field.value === null) return 0;
  if (field.authority === 'estimated' || field.authority === 'generated') return 0.5;
  if (field.authority === 'calculated' || field.authority === 'session-rollup') return 0.75;
  return 1;
}

export function scoreCasinoCruiseDataHealth(
  outcome: Pick<
    CasinoCruiseOutcome,
    | 'totalPoints'
    | 'totalCoinIn'
    | 'actualResult'
    | 'sessionCount'
    | 'certificateEarnedCode'
    | 'certificateEvidence'
    | 'machineMix'
    | 'timePlayedMinutes'
    | 'brand'
    | 'program'
    | 'shipName'
    | 'sailDate'
    | 'returnDate'
  >,
  sessionRtpCoverage: number,
): CasinoDataHealthScore {
  const components: CasinoDataHealthComponents = {
    pointsCompleteness: fieldCompleteness(outcome.totalPoints),
    coinInCompleteness: fieldCompleteness(outcome.totalCoinIn),
    resultCompleteness: fieldCompleteness(outcome.actualResult),
    sessionCompleteness: outcome.sessionCount > 0 ? 1 : 0,
    certificateLinkageCompleteness: outcome.certificateEarnedCode
      ? (outcome.certificateEvidence ? 1 : 0.35)
      : 0.5,
    valueCompleteness: outcome.certificateEvidence ? 0.5 : 0,
    machineRtpCompleteness: Math.max(0, Math.min(1, sessionRtpCoverage)),
    timingCompleteness: fieldCompleteness(outcome.timePlayedMinutes),
  };

  const rawScore = (Object.keys(WEIGHTS) as Array<keyof CasinoDataHealthComponents>)
    .reduce((sum, key) => sum + components[key] * WEIGHTS[key], 0);
  const score = Math.round(rawScore * 100);
  const criticalWarnings: string[] = [];
  const warnings: string[] = [];

  if (outcome.totalPoints.value === null) criticalWarnings.push('Casino points are missing.');
  if (outcome.actualResult.value === null) criticalWarnings.push('Actual gambling result is missing.');
  if (outcome.brand === 'unknown' || outcome.program === 'unknown') criticalWarnings.push('Casino brand or program is unknown.');
  if (!outcome.shipName || !outcome.sailDate || !outcome.returnDate) criticalWarnings.push('Cruise identity or dates are incomplete.');
  if (outcome.totalCoinIn.authority === 'estimated') warnings.push('Coin-in was estimated from points and cannot support high-confidence loss modeling by itself.');
  if (outcome.sessionCount === 0) warnings.push('No session observations are available for pace or variance modeling.');
  if (outcome.certificateEarnedCode && !outcome.certificateEvidence) warnings.push('Earned certificate code is not linked to Certificate Library evidence.');
  if (sessionRtpCoverage === 0) warnings.push('No machine/session RTP evidence is available.');

  const grade = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const eligibleForHighConfidenceModel = score >= 75
    && criticalWarnings.length === 0
    && outcome.totalPoints.value !== null
    && outcome.actualResult.value !== null
    && outcome.totalCoinIn.value !== null
    && outcome.totalCoinIn.authority !== 'generated';

  return {
    score,
    grade,
    eligibleForHighConfidenceModel,
    components,
    criticalWarnings,
    warnings,
  };
}

export function scoreOverallCasinoHistory(outcomes: CasinoCruiseOutcome[]): CasinoDataHealthScore {
  if (outcomes.length === 0) {
    return {
      score: 0,
      grade: 'low',
      eligibleForHighConfidenceModel: false,
      components: {
        pointsCompleteness: 0,
        coinInCompleteness: 0,
        resultCompleteness: 0,
        sessionCompleteness: 0,
        certificateLinkageCompleteness: 0,
        valueCompleteness: 0,
        machineRtpCompleteness: 0,
        timingCompleteness: 0,
      },
      criticalWarnings: ['No completed canonical casino cruise outcomes are available.'],
      warnings: [],
    };
  }

  const components = (Object.keys(WEIGHTS) as Array<keyof CasinoDataHealthComponents>)
    .reduce((aggregate, key) => {
      aggregate[key] = outcomes.reduce((sum, outcome) => sum + outcome.dataHealth.components[key], 0) / outcomes.length;
      return aggregate;
    }, {} as CasinoDataHealthComponents);
  const score = Math.round((Object.keys(WEIGHTS) as Array<keyof CasinoDataHealthComponents>)
    .reduce((sum, key) => sum + components[key] * WEIGHTS[key], 0) * 100);
  const grade = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const highConfidenceCount = outcomes.filter(outcome => outcome.dataHealth.eligibleForHighConfidenceModel).length;
  const criticalWarnings = highConfidenceCount === 0
    ? ['No cruise outcome currently meets the high-confidence modeling gate.']
    : [];
  const warnings = highConfidenceCount < outcomes.length
    ? [`${outcomes.length - highConfidenceCount} of ${outcomes.length} outcomes are descriptive-only or low confidence.`]
    : [];

  return {
    score,
    grade,
    eligibleForHighConfidenceModel: highConfidenceCount >= 2 && score >= 75,
    components,
    criticalWarnings,
    warnings,
  };
}
