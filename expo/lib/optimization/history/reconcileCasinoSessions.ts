import type {
  CasinoCruiseRecordLike,
  CasinoSessionObservation,
  CasinoSessionRecordLike,
  OptimizationCasinoBrand,
  OptimizationCasinoProgram,
  SessionReconciliationResult,
} from './types';
import {
  authorityConfidence,
  cruiseStrongKey,
  dateWithinCruise,
  finiteNumber,
  minutesFromTime,
  normalizeBrand,
  normalizeDate,
  normalizeProgram,
  normalizeText,
  sessionFingerprint,
} from './normalization';

interface ReconcileContext {
  ownerProfileId: string;
}

interface CruiseCandidate {
  cruise: CasinoCruiseRecordLike;
  id: string;
  ownerProfileId: string;
  brand: OptimizationCasinoBrand;
  program: OptimizationCasinoProgram;
  sailDate: string | null;
  returnDate: string | null;
  strongKey: string;
}

function toCandidate(cruise: CasinoCruiseRecordLike, ownerProfileId: string): CruiseCandidate {
  const brand = normalizeBrand(cruise.brand ?? cruise.cruiseSource, cruise.shipName);
  const program = normalizeProgram(cruise.casinoProgram ?? cruise.programCharter, brand);
  return {
    cruise,
    id: cruise.id,
    ownerProfileId: cruise.ownerProfileId ?? ownerProfileId,
    brand,
    program,
    sailDate: normalizeDate(cruise.sailDate),
    returnDate: normalizeDate(cruise.returnDate),
    strongKey: cruiseStrongKey(cruise),
  };
}

function sessionAuthority(session: CasinoSessionRecordLike): 'imported' | 'closeout-user-entered' | 'estimated' | 'generated' {
  const pointsSource = normalizeText(session.pointsSource);
  const notes = normalizeText(session.notes);
  if (notes.includes('auto-calculated') || notes.includes('generated')) return 'generated';
  if (pointsSource === 'estimated' || pointsSource === 'calculated') return 'estimated';
  if (pointsSource === 'imported') return 'imported';
  return 'closeout-user-entered';
}

function sameScope(
  sessionBrand: OptimizationCasinoBrand,
  sessionProgram: OptimizationCasinoProgram,
  cruise: CruiseCandidate,
): boolean {
  const brandMatches = sessionBrand === 'unknown' || cruise.brand === 'unknown' || sessionBrand === cruise.brand;
  const programMatches = sessionProgram === 'unknown' || cruise.program === 'unknown' || sessionProgram === cruise.program;
  return brandMatches && programMatches;
}

function calculateSessionResult(session: CasinoSessionRecordLike): number | null {
  const explicit = finiteNumber(session.winLoss);
  if (explicit !== null) return explicit;
  const coinOut = finiteNumber(session.coinOut);
  const cashCoinIn = finiteNumber(session.cashCoinIn ?? session.coinIn);
  if (coinOut === null || cashCoinIn === null) {
    const cashOut = finiteNumber(session.cashOut);
    const buyIn = finiteNumber(session.buyIn);
    return cashOut !== null && buyIn !== null ? cashOut - buyIn : null;
  }
  return coinOut
    + (finiteNumber(session.jackpots) ?? 0)
    + (finiteNumber(session.handPays) ?? 0)
    - cashCoinIn
    - (finiteNumber(session.taxesWithheld) ?? 0);
}

function buildObservation(
  session: CasinoSessionRecordLike,
  ownerProfileId: string,
  status: CasinoSessionObservation['reconciliationStatus'],
  cruiseId: string | null,
  warnings: string[],
): CasinoSessionObservation {
  const brand = normalizeBrand(session.brand, session.machineName);
  const program = normalizeProgram(session.program ?? session.casinoProgram, brand);
  const authority = sessionAuthority(session);
  const confidence = authorityConfidence(authority).band;
  const date = normalizeDate(session.sessionDate ?? session.date);
  const pointsEarned = finiteNumber(session.pointsEarned);
  const winLoss = calculateSessionResult(session);
  const coinIn = finiteNumber(session.coinIn ?? session.cashCoinIn);
  return {
    id: `session-observation:${sessionFingerprint(session, ownerProfileId)}`,
    sourceSessionId: session.id,
    ownerProfileId,
    brand,
    program,
    cruiseId,
    reconciliationStatus: status,
    reconciliationWarnings: warnings,
    sessionSequence: null,
    date,
    startTime: typeof session.startTime === 'string' ? session.startTime : null,
    endTime: typeof session.endTime === 'string' ? session.endTime : null,
    durationMinutes: finiteNumber(session.durationMinutes),
    pointsEarned,
    pointsAtSessionStart: null,
    pointsAtSessionEnd: null,
    cumulativeCruisePointsAfterSession: null,
    winLoss,
    cumulativeTripResultAfterSession: null,
    buyIn: finiteNumber(session.buyIn),
    cashOut: finiteNumber(session.cashOut),
    coinIn,
    coinOut: finiteNumber(session.coinOut),
    freePlayUsed: finiteNumber(session.freePlayUsed ?? session.freeplayIn),
    estimatedTheo: finiteNumber(session.estimatedTheo),
    estimatedExpectedLoss: finiteNumber(session.estimatedExpectedLoss),
    casinoDay: finiteNumber(session.casinoDay),
    dayType: 'unknown',
    machineId: typeof session.machineId === 'string' ? session.machineId : null,
    machineName: typeof session.machineName === 'string' ? session.machineName : null,
    machineFamily: typeof session.gameCategory === 'string'
      ? session.gameCategory
      : (typeof session.machineType === 'string' ? session.machineType : null),
    rtp: finiteNumber(session.rtp),
    rtpAuthority: finiteNumber(session.rtp) !== null ? authority : 'missing',
    volatility: typeof session.volatility === 'string' ? session.volatility : null,
    remainingDailyBankrollBefore: null,
    remainingDailyBankrollAfter: null,
    remainingCasinoHoursEstimate: null,
    fatigueRating: null,
    stopReason: null,
    recommendationId: null,
    source: `casino-session:${session.id}`,
    authority,
    confidence,
    fingerprint: sessionFingerprint(session, ownerProfileId),
  };
}

function rangesOverlap(first: CasinoSessionObservation, second: CasinoSessionObservation): boolean {
  if (!first.date || first.date !== second.date) return false;
  const firstStart = minutesFromTime(first.startTime);
  const secondStart = minutesFromTime(second.startTime);
  if (firstStart === null || secondStart === null) return false;
  const firstEnd = minutesFromTime(first.endTime) ?? (first.durationMinutes !== null ? firstStart + first.durationMinutes : null);
  const secondEnd = minutesFromTime(second.endTime) ?? (second.durationMinutes !== null ? secondStart + second.durationMinutes : null);
  if (firstEnd === null || secondEnd === null) return false;
  return firstStart < secondEnd && secondStart < firstEnd;
}

function assignSequences(observations: CasinoSessionObservation[]): void {
  const sorted = [...observations].sort((a, b) => {
    const dateCompare = (a.date ?? '').localeCompare(b.date ?? '');
    if (dateCompare !== 0) return dateCompare;
    return (minutesFromTime(a.startTime) ?? Number.MAX_SAFE_INTEGER) - (minutesFromTime(b.startTime) ?? Number.MAX_SAFE_INTEGER);
  });
  let cumulativePoints = 0;
  let cumulativeResult = 0;
  let pointsKnown = true;
  let resultKnown = true;
  sorted.forEach((observation, index) => {
    observation.sessionSequence = index + 1;
    observation.pointsAtSessionStart = pointsKnown ? cumulativePoints : null;
    if (observation.pointsEarned === null) pointsKnown = false;
    else cumulativePoints += observation.pointsEarned;
    observation.pointsAtSessionEnd = pointsKnown ? cumulativePoints : null;
    observation.cumulativeCruisePointsAfterSession = pointsKnown ? cumulativePoints : null;
    if (observation.winLoss === null) resultKnown = false;
    else cumulativeResult += observation.winLoss;
    observation.cumulativeTripResultAfterSession = resultKnown ? cumulativeResult : null;
  });
}

export function reconcileCasinoSessions(
  cruises: CasinoCruiseRecordLike[],
  sessions: CasinoSessionRecordLike[],
  context: ReconcileContext,
): SessionReconciliationResult {
  const candidates = cruises.map(cruise => toCandidate(cruise, context.ownerProfileId));
  const fingerprintOwner = new Map<string, string>();
  const observations: CasinoSessionObservation[] = [];
  const duplicateSessionIds: string[] = [];
  const orphanSessionIds: string[] = [];
  const ambiguousSessionIds: string[] = [];
  const profileMismatchSessionIds: string[] = [];

  for (const session of sessions) {
    const sessionOwner = session.ownerProfileId ?? context.ownerProfileId;
    if (sessionOwner !== context.ownerProfileId) {
      profileMismatchSessionIds.push(session.id);
      observations.push(buildObservation(session, sessionOwner, 'profile-mismatch', null, ['Session belongs to a different profile.']));
      continue;
    }

    const fingerprint = sessionFingerprint(session, context.ownerProfileId);
    const prior = fingerprintOwner.get(fingerprint);
    if (prior) {
      duplicateSessionIds.push(session.id);
      observations.push(buildObservation(session, context.ownerProfileId, 'duplicate', null, [`Exact duplicate of session ${prior}.`]));
      continue;
    }
    fingerprintOwner.set(fingerprint, session.id);

    const sessionBrand = normalizeBrand(session.brand, session.machineName);
    const sessionProgram = normalizeProgram(session.program ?? session.casinoProgram, sessionBrand);
    const sessionDate = normalizeDate(session.sessionDate ?? session.date ?? session.sailingDate);
    let matches: CruiseCandidate[] = [];

    if (session.cruiseId) {
      matches = candidates.filter(candidate => candidate.id === session.cruiseId && sameScope(sessionBrand, sessionProgram, candidate));
    }
    if (matches.length === 0) {
      matches = candidates.filter(candidate => {
        if (!sameScope(sessionBrand, sessionProgram, candidate)) return false;
        if (candidate.ownerProfileId !== context.ownerProfileId) return false;
        const sailingDate = normalizeDate(session.sailingDate);
        if (sailingDate && candidate.sailDate === sailingDate) return true;
        return dateWithinCruise(sessionDate, candidate.sailDate, candidate.returnDate);
      });
    }

    if (matches.length === 1) {
      observations.push(buildObservation(session, context.ownerProfileId, 'matched', matches[0].id, []));
    } else if (matches.length === 0) {
      orphanSessionIds.push(session.id);
      observations.push(buildObservation(session, context.ownerProfileId, 'orphan', null, ['No profile/program/cruise match was found.']));
    } else {
      ambiguousSessionIds.push(session.id);
      observations.push(buildObservation(session, context.ownerProfileId, 'ambiguous', null, [`Session matched ${matches.length} cruises and was not assigned.`]));
    }
  }

  const matchedByCruiseId: Record<string, CasinoSessionObservation[]> = {};
  for (const observation of observations) {
    if (observation.reconciliationStatus !== 'matched' || !observation.cruiseId) continue;
    (matchedByCruiseId[observation.cruiseId] ??= []).push(observation);
  }

  const overlappingSessionIds = new Set<string>();
  for (const cruiseSessions of Object.values(matchedByCruiseId)) {
    assignSequences(cruiseSessions);
    for (let firstIndex = 0; firstIndex < cruiseSessions.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cruiseSessions.length; secondIndex += 1) {
        const first = cruiseSessions[firstIndex];
        const second = cruiseSessions[secondIndex];
        if (rangesOverlap(first, second)) {
          overlappingSessionIds.add(first.sourceSessionId);
          overlappingSessionIds.add(second.sourceSessionId);
          first.reconciliationWarnings.push(`Time overlaps session ${second.sourceSessionId}.`);
          second.reconciliationWarnings.push(`Time overlaps session ${first.sourceSessionId}.`);
        }
      }
    }
  }

  const warnings: string[] = [];
  if (duplicateSessionIds.length > 0) warnings.push(`${duplicateSessionIds.length} duplicate sessions were excluded from rollups.`);
  if (overlappingSessionIds.size > 0) warnings.push(`${overlappingSessionIds.size} sessions have overlapping time ranges and require review.`);
  if (orphanSessionIds.length > 0) warnings.push(`${orphanSessionIds.length} sessions could not be linked to a cruise.`);
  if (ambiguousSessionIds.length > 0) warnings.push(`${ambiguousSessionIds.length} sessions matched multiple cruises.`);
  if (profileMismatchSessionIds.length > 0) warnings.push(`${profileMismatchSessionIds.length} sessions belong to another profile.`);

  return {
    observations,
    matchedByCruiseId,
    duplicateSessionIds,
    overlappingSessionIds: [...overlappingSessionIds],
    orphanSessionIds,
    ambiguousSessionIds,
    profileMismatchSessionIds,
    warnings,
  };
}
