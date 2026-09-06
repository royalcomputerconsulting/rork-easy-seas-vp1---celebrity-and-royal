import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { BookedCruise, ItineraryDay } from '@/types/models';
import { buildCasinoCruiseIdentity } from './casinoCruiseIdentity';
import { getCasinoProgramSeason, inferCasinoProgram, isDateInCasinoSeason, type CasinoProgramId } from './casinoProgramSeasons';

export type CasinoEvidenceKind = 'session_actual' | 'receipt_actual' | 'provider_reported' | 'user_entered' | 'derived' | 'estimated' | 'missing';

export interface CasinoEvidenceValue {
  value: number | null;
  kind: CasinoEvidenceKind;
  source: string;
  formula?: string;
}

export interface CasinoCruiseTruth {
  cruiseId: string;
  shipName: string;
  sailDate: string;
  program: CasinoProgramId;
  seasonLabel: string;
  points: CasinoEvidenceValue;
  hours: CasinoEvidenceValue;
  coinIn: CasinoEvidenceValue;
  theoreticalLoss: CasinoEvidenceValue;
  netGamingResult: CasinoEvidenceValue;
  certificateCreatedValue: CasinoEvidenceValue;
  estimatedCasinoOpportunityHours: number | null;
  casinoAvailabilityHours: number | null;
  casinoAvailableDays: number;
  casinoAvailabilitySource: 'itinerary' | 'saved_casino_open_days' | 'nights_fallback' | 'missing';
  seaDays: number;
  portDays: number;
  ratedGamingDays: number;
  ratedGamingDaysSource: 'explicit' | 'casino_availability_estimate' | 'missing';
  certificateCodes: string[];
  certificateLinks: Array<{ code: string; confidence: 'exact' | 'probable'; reason: string }>;
  warnings: string[];
}

export interface CasinoSeasonReconciliation {
  program: CasinoProgramId;
  seasonLabel: string;
  syncedPoints: number | null;
  attributedCruisePoints: number;
  unallocatedPoints: number | null;
  overAttributedPoints: number;
  cruiseCount: number;
  certificateCount: number;
  unlinkedCertificateCount: number;
}

/** Shared structural certificate shape used by both the retained-certificate UI
 * and the canonical model. Neither source is forced to invent a `used` flag. */
export interface CasinoCertificateRecord {
  certificateCode?: string;
  label?: string;
  cruiseId?: string;
  earnedOnCruise?: string;
  sourceRetrievedAt?: string;
  issueDate?: string;
  issuedDate?: string;
  sailingDate?: string;
  shipName?: string;
  awardType?: string;
  tradeInValue?: number;
  value?: number;
  pointRequirement?: number;
  pointsRequired?: number;
  pointsEarnedEstimate?: number;
  expiryDate?: string;
  createdAt?: string;
  earningLinkState?: 'confirmed' | 'unlinked' | 'inferred';
  earningMatchReason?: string;
}

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nonNegative = (value: unknown): number | null => {
  const parsed = finite(value);
  return parsed != null && parsed >= 0 ? parsed : null;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const CERTIFICATE_POINT_REQUIREMENTS: Record<string, number> = {
  VIP2: 40000,
  '01': 25000,
  '02': 15000,
  '02A': 9000,
  '03': 6500,
  '03A': 4000,
  '04': 3000,
  '05': 2000,
  '06': 1500,
  '07': 1200,
  '08': 800,
  '09': 600,
  '10': 400,
};

interface CertificateCodePointEvidence {
  certificateCode: string;
  family: string;
  levelCode: string;
  points: number;
  reason: string;
}

function normalizeCertificateLevelCode(value: string): string {
  const level = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d$/.test(level)) return `0${level}`;
  return level;
}

function parseCasinoCertificateCode(value: unknown): { code: string; family: string; levelCode: string } | null {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = code.match(/^(\d{4})([ACD])((?:VIP\d+)|\d{1,2}[A-Z]?)$/);
  if (!match) {
    return null;
  }
  return {
    code,
    family: match[2],
    levelCode: normalizeCertificateLevelCode(match[3]),
  };
}

function extractCertificateCodeCandidates(value: unknown): string[] {
  const text = String(value ?? '').toUpperCase();
  const exact = parseCasinoCertificateCode(text);
  if (exact) return [exact.code];
  return Array.from(text.matchAll(/\b\d{4}[ACD](?:VIP\d+|\d{1,2}[A-Z]?)\b/g)).map((match) => match[0]);
}

function getCertificatePointEvidenceFromCodes(candidates: unknown[]): CertificateCodePointEvidence | null {
  const found: CertificateCodePointEvidence[] = [];
  for (const candidate of candidates) {
    for (const code of extractCertificateCodeCandidates(candidate)) {
      const parsed = parseCasinoCertificateCode(code);
      if (!parsed) continue;
      const points = CERTIFICATE_POINT_REQUIREMENTS[parsed.levelCode];
      if (!points) continue;
      found.push({
        certificateCode: parsed.code,
        family: parsed.family,
        levelCode: parsed.levelCode,
        points,
        reason: `${parsed.code} level ${parsed.levelCode} maps to ${points.toLocaleString()} Club Royale point${points === 1 ? '' : 's'}.`,
      });
    }
  }
  if (found.length === 0) return null;
  return found.sort((left, right) => right.points - left.points || left.certificateCode.localeCompare(right.certificateCode))[0];
}

export function isGeneratedCasinoSession(session: CasinoSession): boolean {
  return session.recordKind === 'generated' || /auto-calculated|generated|estimated historical/i.test(session.notes ?? '');
}

function itineraryOpportunity(cruise: BookedCruise): {
  seaDays: number;
  portDays: number;
  opportunityHours: number | null;
  casinoAvailabilityHours: number | null;
  casinoAvailableDays: number;
  casinoAvailabilitySource: CasinoCruiseTruth['casinoAvailabilitySource'];
} {
  const itinerary = Array.isArray(cruise.itinerary) ? cruise.itinerary : [];
  const usable = itinerary.filter((day): day is ItineraryDay => Boolean(day));
  const nights = Math.max(0, Math.floor(finite(cruise.nights) ?? 0));
  const savedOpenDays = Math.max(0, Math.floor(finite(cruise.casinoOpenDays) ?? 0));

  if (usable.length > 0) {
    let seaDays = 0;
    let portDays = 0;
    let casinoAvailabilityHours = 0;
    let casinoAvailableDays = 0;
    const hasDebarkationRow = nights > 0 && usable.length >= nights + 1;

    usable.forEach((day, index) => {
      const isSeaDay = day.isSeaDay || /sea day|at sea/i.test(day.port ?? '');
      const isDebarkation = hasDebarkationRow && index === usable.length - 1;
      if (!isDebarkation) {
        if (isSeaDay) seaDays += 1;
        else portDays += 1;
      }
      if (isDebarkation || day.casinoOpen === false) return;

      const hours = isSeaDay ? 16 : index === 0 ? 6 : 6;
      casinoAvailabilityHours += hours;
      casinoAvailableDays += 1;
    });

    return {
      seaDays,
      portDays,
      opportunityHours: casinoAvailabilityHours,
      casinoAvailabilityHours,
      casinoAvailableDays,
      casinoAvailabilitySource: 'itinerary',
    };
  }

  const explicitSeaDays = finite(cruise.seaDays);
  const explicitPortDays = finite(cruise.portDays);
  const hasExplicitSeaOrPortDays = explicitSeaDays != null || explicitPortDays != null;
  const seaDays = Math.max(0, explicitSeaDays ?? 0);
  const portDays = Math.max(0, explicitPortDays ?? (hasExplicitSeaOrPortDays ? Math.max(0, nights - seaDays) : 0));
  if (savedOpenDays > 0) {
    const hours = savedOpenDays * 8;
    return {
      seaDays,
      portDays,
      opportunityHours: hours,
      casinoAvailabilityHours: hours,
      casinoAvailableDays: savedOpenDays,
      casinoAvailabilitySource: 'saved_casino_open_days',
    };
  }
  if (seaDays + portDays > 0) {
    const hours = (seaDays * 16) + (portDays * 6);
    return {
      seaDays,
      portDays,
      opportunityHours: hours,
      casinoAvailabilityHours: hours,
      casinoAvailableDays: seaDays + portDays,
      casinoAvailabilitySource: 'itinerary',
    };
  }
  if (nights > 0) {
    const hours = 6 + (Math.max(0, nights - 1) * 10);
    return {
      seaDays: 0,
      portDays: nights,
      opportunityHours: hours,
      casinoAvailabilityHours: hours,
      casinoAvailableDays: nights,
      casinoAvailabilitySource: 'nights_fallback',
    };
  }
  return {
    seaDays,
    portDays,
    opportunityHours: null,
    casinoAvailabilityHours: null,
    casinoAvailableDays: 0,
    casinoAvailabilitySource: 'missing',
  };
}

function linkedCertificates(cruise: BookedCruise, certificates: CasinoCertificateRecord[]): Array<{ code: string; confidence: 'exact' | 'probable'; reason: string }> {
  const identity = buildCasinoCruiseIdentity(cruise);
  const cruiseKeys = new Set([
    normalize(cruise.id),
    normalize(cruise.bookingId),
    normalize(cruise.reservationNumber),
    normalize(identity.matchKey),
    normalize(`${cruise.shipName}${cruise.sailDate}`),
  ].filter(Boolean));
  const directCode = String(cruise.instantCertificateOfferCode ?? '').trim().toUpperCase();
  const directCertificateEvidence = getCertificatePointEvidenceFromCodes([
    cruise.instantCertificateOfferCode,
    cruise.offerUsedCode,
    cruise.offerCode,
    cruise.packageCode,
  ]);
  const directCertificateCode = directCertificateEvidence?.certificateCode ?? parseCasinoCertificateCode(directCode)?.code ?? '';
  const sailDate = String(cruise.sailDate ?? '').slice(0, 10);
  const returnDate = String(cruise.returnDate ?? cruise.sailDate ?? '').slice(0, 10);
  const links = certificates.map((certificate) => {
    if (certificate.earningLinkState === 'unlinked') return null;
    const certKeys = [certificate.cruiseId, certificate.earnedOnCruise].map(normalize).filter(Boolean);
    const code = String(certificate.certificateCode ?? certificate.label ?? '').trim().toUpperCase();
    if (certKeys.some((key) => cruiseKeys.has(key))) return code ? { code, confidence: 'exact' as const, reason: certificate.earningLinkState === 'confirmed' ? certificate.earningMatchReason || 'user-confirmed earning cruise' : 'certificate cruise/reservation identity matches' } : null;
    const certificateCode = String(certificate.certificateCode ?? '').trim().toUpperCase();
    if (directCertificateCode && certificateCode && directCertificateCode === certificateCode) return { code: certificateCode, confidence: 'exact' as const, reason: 'saved cruise certificate code matches' };
    const certificateSailingDate = String(certificate.sailingDate ?? '').slice(0, 10);
    const certificateShip = normalize(certificate.shipName);
    const cruiseShip = normalize(cruise.shipName);
    const shipMatches = !certificateShip || !cruiseShip || certificateShip === cruiseShip || certificateShip.includes(cruiseShip) || cruiseShip.includes(certificateShip);
    if (code && certificateSailingDate && sailDate && certificateSailingDate === sailDate && shipMatches) return { code, confidence: 'exact' as const, reason: 'certificate sailing date and ship match this earning cruise' };
    const issueDate = String(certificate.issueDate ?? certificate.issuedDate ?? '').slice(0, 10);
    if (code && issueDate && sailDate && returnDate && issueDate >= sailDate && issueDate <= returnDate) return { code, confidence: 'probable' as const, reason: 'issue date falls within this sailing; review if multiple cruises overlap' };
    return null;
  }).filter((link): link is { code: string; confidence: 'exact' | 'probable'; reason: string } => link !== null);
  if (directCertificateCode && !links.some((link) => link.code === directCertificateCode)) links.push({ code: directCertificateCode, confidence: 'exact', reason: 'saved directly on cruise closeout' });
  const byCode = new Map<string, { code: string; confidence: 'exact' | 'probable'; reason: string }>();
  for (const link of links) {
    const existing = byCode.get(link.code);
    if (!existing || (existing.confidence === 'probable' && link.confidence === 'exact')) byCode.set(link.code, link);
  }
  return Array.from(byCode.values());
}

function pointDerivedCoinIn(program: CasinoProgramId, points: number): CasinoEvidenceValue {
  if (program === 'club_royale') {
    return { value: points * 5, kind: 'estimated', source: 'Club Royale slot-point conversion', formula: 'points × $5 slot coin-in; valid only when points came from eligible slot play' };
  }
  return { value: null, kind: 'missing', source: 'No verified cross-game point conversion', formula: 'Requires explicit coin-in or a documented game/program earning rule' };
}

export function buildCasinoCruiseTruth(input: {
  cruise: BookedCruise;
  sessions?: CasinoSession[];
  certificates?: CasinoCertificateRecord[];
  pointsPerHourFallback?: number;
  houseEdgeFallback?: number;
}): CasinoCruiseTruth {
  const { cruise } = input;
  const sessions = (input.sessions ?? []).filter((session) => session.cruiseId === cruise.id && !isGeneratedCasinoSession(session));
  const program = inferCasinoProgram(cruise as unknown as Record<string, unknown>);
  const season = getCasinoProgramSeason(program, cruise.sailDate);
  const warnings: string[] = [];
  const certificateLinks = linkedCertificates(cruise, input.certificates ?? []);
  const certificatePointEvidence = getCertificatePointEvidenceFromCodes([
    ...certificateLinks.map((link) => link.code),
    cruise.instantCertificateOfferCode,
    cruise.offerUsedCode,
    cruise.offerCode,
    cruise.packageCode,
  ]);
  const sessionPoints = sessions.map((session) => nonNegative(session.pointsEarned)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const savedPointCandidates = [cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints]
    .map(nonNegative)
    .filter((value): value is number => value != null);
  // A stale zero in one legacy alias must not hide a positive raw value in a
  // later alias. Preserve a genuine all-zero closeout when no positive value
  // exists.
  const cruisePoints = savedPointCandidates.find((value) => value > 0) ?? savedPointCandidates[0] ?? null;
  // `calculationConfidence: estimated` may describe win/loss, paid value, or a
  // certificate floor. It is not enough to discard a pasted/saved cruise
  // points total. Only an explicitly documented allocation can yield to a
  // certificate threshold.
  const pointsAreAllocatedEstimate = /(?:approved|equal|estimated|final).*allocat|allocat.*(?:unassigned|annual|point)|split.*(?:provider|annual|unassigned)/i.test(String(cruise.notes ?? ''));
  const shouldUseCertificatePoints = certificatePointEvidence != null && (cruisePoints == null || pointsAreAllocatedEstimate);
  // A cruise closeout is the authoritative trip total. Sessions may be only a
  // partial subset of the cruise, so they are a fallback rather than a reason
  // to replace an explicitly saved per-cruise points total.
  const pointsValue = shouldUseCertificatePoints ? certificatePointEvidence.points : cruisePoints ?? (sessionPoints > 0 ? sessionPoints : null);
  const points: CasinoEvidenceValue = pointsValue == null
    ? { value: null, kind: 'missing', source: 'No points record' }
    : shouldUseCertificatePoints
      ? { value: pointsValue, kind: 'estimated', source: 'Certificate threshold evidence', formula: certificatePointEvidence.reason }
      : { value: pointsValue, kind: cruisePoints != null ? (pointsAreAllocatedEstimate ? 'estimated' : cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered') : 'session_actual', source: cruisePoints != null ? (pointsAreAllocatedEstimate ? 'User-approved estimated cruise allocation' : 'Cruise casino closeout/sync') : 'Actual saved sessions' };
  if (shouldUseCertificatePoints) warnings.push('Points use the certificate threshold floor; provider/account season balance remains reconciliation evidence until actual cruise closeout points are entered.');

  const actualMinutes = sessions.map((session) => nonNegative(session.durationMinutes)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const closeoutHours = nonNegative(cruise.hoursPlayed);
  const opportunity = itineraryOpportunity(cruise);
  const pph = Math.max(1, input.pointsPerHourFallback ?? 400);
  const pointsBasedHours = pointsValue != null ? pointsValue / pph : null;
  const estimatedHours = pointsBasedHours == null ? null : opportunity.opportunityHours == null ? pointsBasedHours : Math.min(pointsBasedHours, opportunity.opportunityHours);
  const hours: CasinoEvidenceValue = actualMinutes > 0
    ? { value: actualMinutes / 60, kind: 'session_actual', source: 'Actual saved session duration', formula: 'sum(session minutes) / 60' }
    : closeoutHours != null
      ? { value: closeoutHours, kind: 'user_entered', source: 'Cruise casino closeout' }
      : estimatedHours != null
        ? { value: estimatedHours, kind: 'estimated', source: 'Points and itinerary opportunity estimate', formula: `${pointsValue} points ÷ ${pph} historical points/hour, capped by ${opportunity.seaDays} sea day(s) × 16h + ${opportunity.portDays} port/embarkation day(s) × 6h` }
        : { value: null, kind: 'missing', source: 'No duration evidence' };
  if (hours.kind === 'estimated') warnings.push('Play hours are an estimate, not an actual casino record.');
  if (opportunity.casinoAvailabilitySource === 'nights_fallback') warnings.push('Casino availability uses cruise-night fallback because detailed itinerary hours were not saved.');

  const sessionCoinIn = sessions.map((session) => nonNegative(session.coinIn) ?? ((nonNegative(session.cashCoinIn) ?? 0) + (nonNegative(session.freeplayCoinIn) ?? 0) || null)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const cruiseCoinIn = nonNegative(cruise.coinIn);
  const estimatedPointCoinIn = pointsValue != null ? pointsValue * 5 : null;
  const coinIn = sessionCoinIn > 0
    ? { value: sessionCoinIn, kind: 'session_actual' as const, source: 'Actual saved session coin-in', formula: 'sum(session coin-in)' }
    : cruiseCoinIn != null
      ? cruise.coinInCalculationSource === 'club_royale_slot_points_estimate'
        ? { value: shouldUseCertificatePoints && estimatedPointCoinIn != null ? estimatedPointCoinIn : cruiseCoinIn, kind: 'estimated' as const, source: shouldUseCertificatePoints ? 'Certificate threshold slot-point estimate' : 'Club Royale slot-point estimate', formula: 'saved cruise points × $5; confirm slot eligibility or replace with actual coin-in' }
        : { value: cruiseCoinIn, kind: cruise.sourceAuthority === 'provider' || cruise.coinInCalculationSource === 'provider' ? 'provider_reported' as const : 'user_entered' as const, source: 'Cruise casino closeout' }
      : pointsValue != null && program === 'club_royale'
        ? shouldUseCertificatePoints
          ? { value: pointsValue * 5, kind: 'estimated' as const, source: 'Certificate threshold slot-point estimate', formula: 'certificate point threshold × $5 Club Royale slot coin-in floor' }
          : pointDerivedCoinIn(program, pointsValue)
        : { value: null, kind: 'missing' as const, source: 'No verified cross-game point conversion', formula: pointsValue != null ? 'Blue Chip and other programs require explicit coin-in or a documented game/program earning rule' : undefined };

  const recordedTheo = nonNegative(cruise.theoreticalLoss);
  const hold = Math.max(0, nonNegative(cruise.houseEdge) ?? input.houseEdgeFallback ?? 0.08);
  const theoreticalLoss: CasinoEvidenceValue = recordedTheo != null
    ? { value: recordedTheo, kind: cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered', source: 'Recorded cruise theoretical' }
    : coinIn.value != null
      ? { value: round2(coinIn.value * hold), kind: 'estimated', source: 'Coin-in and hold estimate', formula: `$${coinIn.value.toFixed(2)} coin-in × ${(hold * 100).toFixed(2)}% hold` }
      : { value: null, kind: 'missing', source: 'Coin-in or recorded theoretical required' };

  const sessionNet = sessions.map((session) => {
    if (finite(session.winLoss) != null) return finite(session.winLoss)!;
    const cashIn = nonNegative(session.cashIn ?? session.buyIn);
    const cashOut = nonNegative(session.cashOut);
    const handpay = nonNegative(session.handpayAmount) ?? 0;
    return cashIn != null && cashOut != null ? cashOut + (session.handpayIncludedInCashOut ? 0 : handpay) - cashIn : null;
  }).filter((value): value is number => value != null);
  const cruiseNet = finite(cruise.cashResult ?? cruise.netResult);
  const netGamingResult: CasinoEvidenceValue = cruiseNet != null
    ? { value: cruiseNet, kind: cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered', source: 'Cruise casino closeout; cruise fare excluded' }
    : sessionNet.length > 0
      ? { value: sessionNet.reduce((sum, value) => sum + value, 0), kind: 'session_actual', source: 'Actual saved sessions', formula: 'cash-out + separate handpays − cash-in' }
      : { value: null, kind: 'missing', source: 'No casino cash-result evidence' };
  const savedCertificateValue = nonNegative(cruise.instantCertificateValue);
  const linkedCertificateValueCandidates = certificateLinks.flatMap((link) => (input.certificates ?? [])
    .filter((certificate) => String(certificate.certificateCode ?? certificate.label ?? '').trim().toUpperCase() === link.code)
    .map((certificate) => ({
      value: nonNegative(certificate.tradeInValue ?? certificate.value),
      confidence: link.confidence,
      code: link.code,
    })))
    .filter((candidate): candidate is { value: number; confidence: 'exact' | 'probable'; code: string } => candidate.value != null);
  const linkedCertificateValue = linkedCertificateValueCandidates
    .sort((left, right) => right.value - left.value)[0] ?? null;
  const certificateCreatedValue: CasinoEvidenceValue = savedCertificateValue != null
    ? {
      value: savedCertificateValue,
      kind: cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered',
      source: 'Cruise closeout certificate value',
      formula: 'Saved value of the certificate earned on this cruise; counted once and not added to mutually exclusive eligible sailings.',
    }
    : linkedCertificateValue != null
      ? {
        value: linkedCertificateValue.value,
        kind: linkedCertificateValue.confidence === 'exact' ? 'provider_reported' : 'estimated',
        source: `${linkedCertificateValue.code} linked certificate award value`,
        formula: linkedCertificateValue.confidence === 'exact'
          ? 'Saved certificate trade/award value linked to this cruise identity.'
          : 'Probable issue-date link; review overlapping cruises before treating this value as confirmed.',
      }
      : {
        value: null,
        kind: 'missing',
        source: 'No saved certificate-created value',
        formula: 'Certificate thresholds and alternate sailing prices are not treated as realized certificate value.',
      };
  return {
    cruiseId: cruise.id,
    shipName: cruise.shipName || 'Unknown ship',
    sailDate: cruise.sailDate,
    program,
    seasonLabel: season.label,
    points,
    hours,
    coinIn,
    theoreticalLoss,
    netGamingResult,
    certificateCreatedValue,
    estimatedCasinoOpportunityHours: opportunity.opportunityHours,
    casinoAvailabilityHours: opportunity.casinoAvailabilityHours,
    casinoAvailableDays: opportunity.casinoAvailableDays,
    casinoAvailabilitySource: opportunity.casinoAvailabilitySource,
    seaDays: opportunity.seaDays,
    portDays: opportunity.portDays,
    ratedGamingDays: Math.max(0, Math.floor(nonNegative(cruise.ratedGamingDays) ?? opportunity.casinoAvailableDays)),
    ratedGamingDaysSource: nonNegative(cruise.ratedGamingDays) != null
      ? 'explicit'
      : opportunity.casinoAvailableDays > 0
        ? 'casino_availability_estimate'
        : 'missing',
    certificateCodes: certificateLinks.map((link) => link.code),
    certificateLinks,
    warnings,
  };
}

export function reconcileCasinoSeason(input: {
  program: CasinoProgramId;
  asOf?: Date | string;
  syncedPoints?: number | null;
  cruises: CasinoCruiseTruth[];
  certificates?: CasinoCertificateRecord[];
}): CasinoSeasonReconciliation {
  const season = getCasinoProgramSeason(input.program, input.asOf ?? new Date());
  const cruises = input.cruises.filter((cruise) => cruise.program === input.program && isDateInCasinoSeason(cruise.sailDate, season));
  const attributedCruisePoints = cruises.reduce((sum, cruise) => sum + (cruise.points.value ?? 0), 0);
  const syncedPoints = nonNegative(input.syncedPoints);
  const linkedCodes = new Set(cruises.flatMap((cruise) => cruise.certificateCodes));
  const relevantCertificates = (input.certificates ?? []).filter((certificate) => {
    const earned = String(certificate.issueDate ?? certificate.issuedDate ?? certificate.sailingDate ?? certificate.createdAt ?? certificate.sourceRetrievedAt ?? '').slice(0, 10);
    return !earned || isDateInCasinoSeason(earned, season);
  });
  return {
    program: input.program,
    seasonLabel: season.label,
    syncedPoints,
    attributedCruisePoints,
    unallocatedPoints: syncedPoints == null ? null : Math.max(0, syncedPoints - attributedCruisePoints),
    overAttributedPoints: syncedPoints == null ? 0 : Math.max(0, attributedCruisePoints - syncedPoints),
    cruiseCount: cruises.length,
    certificateCount: relevantCertificates.length,
    unlinkedCertificateCount: relevantCertificates.filter((certificate) => !linkedCodes.has(String(certificate.certificateCode ?? '').trim().toUpperCase())).length,
  };
}
