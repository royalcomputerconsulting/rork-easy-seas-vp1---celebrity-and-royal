import type {
  CasinoCruiseOutcome,
  CasinoCruiseRecordLike,
  CasinoSessionObservation,
  CertificateEvidenceLink,
  FieldAuthority,
  PointEarningRateEvidence,
} from './types';
import {
  field,
  finiteNumber,
  missingField,
  normalizeBrand,
  normalizeDate,
  normalizeProgram,
  normalizeText,
  stableFingerprint,
} from './normalization';
import { scoreCasinoCruiseDataHealth } from './dataHealth';
import {
  highestThresholdReached,
  reconstructCertificateThresholdAttempts,
} from './reconstructThresholdAttempts';

export interface CanonicalizeCasinoCruiseContext {
  ownerProfileId: string;
  asOf: string;
  pointEarningRates: PointEarningRateEvidence[];
  certificateEvidence: CertificateEvidenceLink[];
  certificateThresholds?: number[];
  tombstonedCruiseIds: Set<string>;
  tombstonedCruiseKeys: Set<string>;
  duplicateCruiseIds: Set<string>;
}

function chooseExplicitNumber(
  cruise: CasinoCruiseRecordLike,
  names: string[],
  label: string,
  freshness: string | null,
): FieldAuthority<number> | null {
  const present = names
    .map(name => ({ name, value: finiteNumber(cruise[name]) }))
    .filter(candidate => candidate.value !== null) as Array<{ name: string; value: number }>;
  if (present.length === 0) return null;
  const selected = present[0];
  const conflicts = present.filter(candidate => candidate.value !== selected.value);
  return field(
    selected.value,
    `cruise-closeout:${selected.name}`,
    cruise.calculationConfidence === 'actual' ? 'closeout-verified' : 'closeout-user-entered',
    freshness,
    conflicts.length > 0 ? [`Conflicting ${label} fields were present; ${selected.name} took precedence.`] : [],
  );
}

function completeSessionValues(
  sessions: CasinoSessionObservation[],
  selector: (session: CasinoSessionObservation) => number | null,
): number[] | null {
  if (sessions.length === 0) return null;
  if (sessions.some(session => session.reconciliationWarnings.some(warning => warning.toLowerCase().includes('overlap')))) return null;
  const values = sessions.map(selector);
  if (values.some(value => value === null)) return null;
  return values as number[];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function resolvePoints(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  freshness: string | null,
): FieldAuthority<number> {
  const closeout = chooseExplicitNumber(cruise, ['pointsEarned', 'earnedPoints', 'casinoPoints'], 'points', freshness);
  if (closeout) return closeout;
  const sessionValues = completeSessionValues(sessions, session => session.pointsEarned);
  if (sessionValues) return field(sum(sessionValues), 'complete-session-rollup:pointsEarned', 'session-rollup', freshness);
  return missingField('Casino points');
}

function resolveCoinIn(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  points: FieldAuthority<number>,
  context: CanonicalizeCasinoCruiseContext,
  freshness: string | null,
  program: ReturnType<typeof normalizeProgram>,
): FieldAuthority<number> {
  const explicit = chooseExplicitNumber(cruise, ['coinIn'], 'coin-in', freshness);
  if (explicit) return explicit;
  const sessionValues = completeSessionValues(sessions, session => session.coinIn);
  if (sessionValues) return field(sum(sessionValues), 'complete-session-rollup:coinIn', 'session-rollup', freshness);
  const rate = context.pointEarningRates.find(candidate => candidate.program === program);
  if (points.value !== null && rate && rate.dollarsPerPoint > 0) {
    return field(
      points.value * rate.dollarsPerPoint,
      `point-rate:${rate.source}`,
      'estimated',
      rate.verifiedAt ?? freshness,
      [`Coin-in estimated as ${points.value.toLocaleString()} points × $${rate.dollarsPerPoint.toFixed(2)} per point.`],
    );
  }
  return missingField('Coin-in');
}

function resolveActualResult(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  freshness: string | null,
): FieldAuthority<number> {
  const closeout = chooseExplicitNumber(cruise, ['netResult', 'cashResult'], 'actual result', freshness);
  if (closeout) return closeout;

  const signedWin = chooseExplicitNumber(cruise, ['winningsBroughtHome', 'winnings', 'totalWinnings'], 'signed winnings/result', freshness);
  if (signedWin) {
    return {
      ...signedWin,
      warnings: [...signedWin.warnings, 'The stored winnings field is treated as a signed net trip result.'],
    };
  }

  const actualLoss = finiteNumber(cruise.actualLoss);
  if (actualLoss !== null) {
    return field(-Math.abs(actualLoss), 'cruise-closeout:actualLoss', 'closeout-user-entered', freshness);
  }

  const sessionValues = completeSessionValues(sessions, session => session.winLoss);
  if (sessionValues) return field(sum(sessionValues), 'complete-session-rollup:winLoss', 'session-rollup', freshness);
  return missingField('Actual gambling result');
}

function resolveSimpleField(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  cruiseNames: string[],
  selector: (session: CasinoSessionObservation) => number | null,
  label: string,
  freshness: string | null,
): FieldAuthority<number> {
  const explicit = chooseExplicitNumber(cruise, cruiseNames, label, freshness);
  if (explicit) return explicit;
  const sessionValues = completeSessionValues(sessions, selector);
  if (sessionValues) return field(sum(sessionValues), `complete-session-rollup:${label}`, 'session-rollup', freshness);
  return missingField(label);
}

function resolveTheoreticalLoss(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  freshness: string | null,
): FieldAuthority<number> {
  const explicit = chooseExplicitNumber(cruise, ['theoreticalLoss'], 'theoretical loss', freshness);
  if (explicit) return explicit;
  const values = completeSessionValues(sessions, session => finiteNumber(session.estimatedExpectedLoss ?? session.estimatedTheo));
  if (values) return field(sum(values), 'complete-session-rollup:estimatedTheo', 'estimated', freshness);
  return missingField('Theoretical loss');
}

function isCompleted(cruise: CasinoCruiseRecordLike, asOf: string): boolean {
  const status = normalizeText(cruise.status ?? cruise.completionState ?? cruise.bookingStatus);
  if (status.includes('cancel') || status.includes('upcoming') || status.includes('in-progress') || status.includes('courtesy')) return false;
  if (status.includes('completed') || status.includes('sailed')) return true;
  const returnDate = normalizeDate(cruise.returnDate);
  return returnDate !== null && returnDate <= asOf;
}

function findCertificateEvidence(
  code: string | null,
  sailDate: string,
  ownerProfileId: string,
  program: ReturnType<typeof normalizeProgram>,
  evidence: CertificateEvidenceLink[],
): CertificateEvidenceLink | null {
  if (!code) return null;
  const normalizedCode = normalizeText(code);
  const matches = evidence.filter(candidate => {
    if (normalizeText(candidate.certificateCode) !== normalizedCode) return false;
    if (candidate.program !== program) return false;
    if (candidate.ownerProfileId && candidate.ownerProfileId !== ownerProfileId) return false;
    if (candidate.effectiveStart && sailDate < candidate.effectiveStart) return false;
    if (candidate.effectiveEnd && sailDate > candidate.effectiveEnd) return false;
    return true;
  });
  return matches.sort((first, second) => (second.confidence === 'high' ? 1 : 0) - (first.confidence === 'high' ? 1 : 0))[0] ?? null;
}

export function canonicalizeCasinoCruiseOutcome(
  cruise: CasinoCruiseRecordLike,
  sessions: CasinoSessionObservation[],
  context: CanonicalizeCasinoCruiseContext,
): CasinoCruiseOutcome {
  const ownerProfileId = cruise.ownerProfileId ?? context.ownerProfileId;
  const shipName = String(cruise.shipName ?? '').trim();
  const sailDate = normalizeDate(cruise.sailDate) ?? '';
  const returnDate = normalizeDate(cruise.returnDate) ?? '';
  const reservationId = String(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber ?? '').trim() || null;
  const brand = normalizeBrand(cruise.brand ?? cruise.cruiseSource, shipName);
  const program = normalizeProgram(cruise.casinoProgram ?? cruise.programCharter, brand);
  const freshness = normalizeDate(cruise.updatedAt ?? cruise.createdAt) ?? context.asOf;
  const outputId = `casino-cruise-outcome:${stableFingerprint([ownerProfileId, brand, program, reservationId, shipName, sailDate, returnDate])}`;
  const warnings: string[] = [];
  const exclusionReasons: string[] = [];
  const tombstoneKey = `${normalizeText(ownerProfileId)}|${normalizeText(shipName)}|${sailDate}|${returnDate}`;

  if (ownerProfileId !== context.ownerProfileId) exclusionReasons.push('profile-mismatch');
  if (!isCompleted(cruise, context.asOf)) exclusionReasons.push('not-completed');
  if (context.tombstonedCruiseIds.has(cruise.id) || context.tombstonedCruiseKeys.has(tombstoneKey)) exclusionReasons.push('tombstoned');
  if (context.duplicateCruiseIds.has(cruise.id)) exclusionReasons.push('duplicate-cruise-record');
  if (!shipName || !sailDate || !returnDate) exclusionReasons.push('incomplete-cruise-identity');
  if (brand === 'unknown' || program === 'unknown') exclusionReasons.push('unknown-brand-or-program');

  const totalPoints = resolvePoints(cruise, sessions, freshness);
  const totalCoinIn = resolveCoinIn(cruise, sessions, totalPoints, context, freshness, program);
  const actualResult = resolveActualResult(cruise, sessions, freshness);
  const theoreticalLoss = resolveTheoreticalLoss(cruise, sessions, freshness);
  const buyIn = resolveSimpleField(cruise, sessions, ['buyIn'], session => session.buyIn, 'Buy-in', freshness);
  const cashOut = resolveSimpleField(cruise, sessions, ['cashOut'], session => session.cashOut, 'Cash-out', freshness);
  const freePlayUsed = resolveSimpleField(cruise, sessions, ['freePlayUsed'], session => session.freePlayUsed, 'FreePlay used', freshness);
  let timePlayedMinutes = chooseExplicitNumber(cruise, ['hoursPlayed'], 'hours played', freshness);
  if (timePlayedMinutes?.value !== null && timePlayedMinutes) {
    timePlayedMinutes = { ...timePlayedMinutes, value: timePlayedMinutes.value * 60, source: `${timePlayedMinutes.source}:converted-to-minutes` };
  } else {
    const durationValues = completeSessionValues(sessions, session => session.durationMinutes);
    timePlayedMinutes = durationValues
      ? field(sum(durationValues), 'complete-session-rollup:durationMinutes', 'session-rollup', freshness)
      : missingField('Time played');
  }

  const machineMix: Record<string, number> = {};
  for (const session of sessions) {
    const key = session.machineFamily ?? session.machineName ?? 'unknown';
    machineMix[key] = (machineMix[key] ?? 0) + 1;
  }
  const rtpCoverage = sessions.length === 0 ? 0 : sessions.filter(session => session.rtp !== null).length / sessions.length;
  const casinoOpenDays = finiteNumber(cruise.casinoOpenDays) ?? (new Set(sessions.map(session => session.date).filter(Boolean)).size || null);
  const sessionCount = sessions.length;
  const totalHours = timePlayedMinutes.value !== null ? timePlayedMinutes.value / 60 : null;
  const averagePointsPerDay = totalPoints.value !== null && casinoOpenDays ? totalPoints.value / casinoOpenDays : null;
  const averagePointsPerSession = totalPoints.value !== null && sessionCount > 0 ? totalPoints.value / sessionCount : null;
  const averagePointsPerHour = totalPoints.value !== null && totalHours && totalHours > 0 ? totalPoints.value / totalHours : null;
  const certificateEarnedCode = String(cruise.instantCertificateOfferCode ?? '').trim() || null;
  const thresholdReached = highestThresholdReached(totalPoints.value, context.certificateThresholds);
  const certificateEvidence = findCertificateEvidence(certificateEarnedCode, sailDate, ownerProfileId, program, context.certificateEvidence);

  const preliminary = {
    totalPoints,
    totalCoinIn,
    actualResult,
    sessionCount,
    certificateEarnedCode,
    certificateEvidence,
    machineMix,
    timePlayedMinutes,
    brand,
    program,
    shipName,
    sailDate,
    returnDate,
  };
  const dataHealth = scoreCasinoCruiseDataHealth(preliminary, rtpCoverage);
  const thresholdAttempts = reconstructCertificateThresholdAttempts({
    cruiseOutcomeId: outputId,
    finalPoints: totalPoints.value,
    totalCoinIn: totalCoinIn.value,
    actualResult: actualResult.value,
    sessions,
    thresholds: context.certificateThresholds,
  });

  warnings.push(...totalPoints.warnings, ...totalCoinIn.warnings, ...actualResult.warnings, ...dataHealth.warnings);
  if (sessions.some(session => session.reconciliationWarnings.length > 0)) warnings.push('One or more linked sessions have reconciliation warnings.');
  if (certificateEarnedCode && !certificateEvidence) warnings.push('Certificate code is not yet linked to durable Certificate Library evidence.');

  const fieldAuthority: Record<string, FieldAuthority<unknown>> = {
    totalPoints,
    totalCoinIn,
    actualResult,
    theoreticalLoss,
    buyIn,
    cashOut,
    freePlayUsed,
    timePlayedMinutes,
  };

  return {
    id: outputId,
    sourceCruiseId: cruise.id,
    ownerProfileId,
    brand,
    program,
    cruiseId: cruise.id,
    reservationId,
    shipName,
    sailDate,
    returnDate,
    nights: finiteNumber(cruise.nights),
    casinoOpenDays,
    casinoOpenHours: totalHours,
    seaDayCount: finiteNumber(cruise.seaDays),
    portDayCount: finiteNumber(cruise.portDays),
    privateIslandDayCount: null,
    totalPoints,
    totalCoinIn,
    actualResult,
    theoreticalLoss,
    buyIn,
    cashOut,
    freePlayUsed,
    timePlayedMinutes,
    sessionCount,
    machineMix,
    averagePointsPerDay,
    averagePointsPerSession,
    averagePointsPerHour,
    certificateEarnedCode,
    thresholdReached,
    certificateEvidence,
    certificateValueSnapshotId: null,
    fieldAuthority,
    dataHealth,
    thresholdAttempts,
    eligibleForModeling: exclusionReasons.length === 0 && dataHealth.score >= 45,
    exclusionReasons,
    warnings: [...new Set(warnings)],
    createdAt: context.asOf,
    updatedAt: context.asOf,
  };
}
