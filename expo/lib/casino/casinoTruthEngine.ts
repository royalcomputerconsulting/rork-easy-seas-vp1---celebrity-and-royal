import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { BookedCruise, ItineraryDay } from '@/types/models';
import { buildCasinoCruiseIdentity } from './casinoCruiseIdentity';
import { getCasinoProgramSeason, inferCasinoProgram, isDateInCasinoSeason, type CasinoProgramId } from './casinoProgramSeasons';

export type CasinoEvidenceKind = 'actual' | 'provider_reported' | 'user_entered' | 'estimated' | 'missing';

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
  estimatedCasinoOpportunityHours: number | null;
  seaDays: number;
  portDays: number;
  certificateCodes: string[];
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
  expiryDate?: string;
  createdAt?: string;
}

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nonNegative = (value: unknown): number | null => {
  const parsed = finite(value);
  return parsed != null && parsed >= 0 ? parsed : null;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export function isGeneratedCasinoSession(session: CasinoSession): boolean {
  return session.recordKind === 'generated' || /auto-calculated|generated|estimated historical/i.test(session.notes ?? '');
}

function itineraryOpportunity(cruise: BookedCruise): { seaDays: number; portDays: number; opportunityHours: number | null } {
  const itinerary = Array.isArray(cruise.itinerary) ? cruise.itinerary : [];
  const usable = itinerary.filter((day): day is ItineraryDay => Boolean(day));
  const seaDays = usable.length > 0 ? usable.filter((day) => day.isSeaDay || /sea day|at sea/i.test(day.port ?? '')).length : Math.max(0, finite(cruise.seaDays) ?? 0);
  const portDays = usable.length > 0 ? usable.filter((day) => !(day.isSeaDay || /sea day|at sea/i.test(day.port ?? ''))).length : Math.max(0, finite(cruise.portDays) ?? Math.max(0, (finite(cruise.nights) ?? 0) - seaDays));
  if (seaDays + portDays <= 0) return { seaDays, portDays, opportunityHours: null };
  // Opportunity is not claimed play time. Sea days permit a wider window;
  // port days get only an evening-weighted window after scheduled calls.
  return { seaDays, portDays, opportunityHours: (seaDays * 10) + (portDays * 4) };
}

function linkedCertificateCodes(cruise: BookedCruise, certificates: CasinoCertificateRecord[]): string[] {
  const identity = buildCasinoCruiseIdentity(cruise);
  const cruiseKeys = new Set([
    normalize(cruise.id),
    normalize(cruise.bookingId),
    normalize(cruise.reservationNumber),
    normalize(identity.matchKey),
    normalize(`${cruise.shipName}${cruise.sailDate}`),
  ].filter(Boolean));
  const directCode = String(cruise.instantCertificateOfferCode ?? '').trim().toUpperCase();
  const sailDate = String(cruise.sailDate ?? '').slice(0, 10);
  const returnDate = String(cruise.returnDate ?? cruise.sailDate ?? '').slice(0, 10);
  const codes = certificates.filter((certificate) => {
    const certKeys = [certificate.cruiseId, certificate.earnedOnCruise].map(normalize).filter(Boolean);
    if (certKeys.some((key) => cruiseKeys.has(key))) return true;
    const issueDate = String(certificate.issueDate ?? '').slice(0, 10);
    if (issueDate && sailDate && returnDate && issueDate >= sailDate && issueDate <= returnDate) return true;
    const certificateCode = String(certificate.certificateCode ?? '').trim().toUpperCase();
    return Boolean(directCode && certificateCode && directCode === certificateCode);
  }).map((certificate) => String(certificate.certificateCode ?? certificate.label ?? '').trim().toUpperCase()).filter(Boolean);
  if (directCode) codes.push(directCode);
  return Array.from(new Set(codes));
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
  const sessionPoints = sessions.map((session) => nonNegative(session.pointsEarned)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const cruisePoints = nonNegative(cruise.pointsEarned ?? cruise.earnedPoints ?? cruise.casinoPoints);
  // A cruise closeout is the authoritative trip total. Sessions may be only a
  // partial subset of the cruise, so they are a fallback rather than a reason
  // to replace an explicitly saved per-cruise points total.
  const pointsValue = cruisePoints ?? (sessionPoints > 0 ? sessionPoints : null);
  const points: CasinoEvidenceValue = pointsValue == null
    ? { value: null, kind: 'missing', source: 'No points record' }
    : { value: pointsValue, kind: cruisePoints != null ? (cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered') : 'actual', source: cruisePoints != null ? 'Cruise casino closeout/sync' : 'Actual saved sessions' };

  const actualMinutes = sessions.map((session) => nonNegative(session.durationMinutes)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const closeoutHours = nonNegative(cruise.hoursPlayed);
  const opportunity = itineraryOpportunity(cruise);
  const pph = Math.max(1, input.pointsPerHourFallback ?? 400);
  const pointsBasedHours = pointsValue != null ? pointsValue / pph : null;
  const estimatedHours = pointsBasedHours == null ? null : opportunity.opportunityHours == null ? pointsBasedHours : Math.min(pointsBasedHours, opportunity.opportunityHours);
  const hours: CasinoEvidenceValue = actualMinutes > 0
    ? { value: actualMinutes / 60, kind: 'actual', source: 'Actual saved session duration', formula: 'sum(session minutes) / 60' }
    : closeoutHours != null
      ? { value: closeoutHours, kind: 'user_entered', source: 'Cruise casino closeout' }
      : estimatedHours != null
        ? { value: estimatedHours, kind: 'estimated', source: 'Points and itinerary opportunity estimate', formula: `${pointsValue} points ÷ ${pph} historical points/hour, capped by ${opportunity.seaDays} sea day(s) × 10h + ${opportunity.portDays} port day(s) × 4h` }
        : { value: null, kind: 'missing', source: 'No duration evidence' };
  if (hours.kind === 'estimated') warnings.push('Play hours are an estimate, not an actual casino record.');

  const sessionCoinIn = sessions.map((session) => nonNegative(session.coinIn) ?? ((nonNegative(session.cashCoinIn) ?? 0) + (nonNegative(session.freeplayCoinIn) ?? 0) || null)).filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const cruiseCoinIn = nonNegative(cruise.coinIn);
  const coinIn = sessionCoinIn > 0
    ? { value: sessionCoinIn, kind: 'actual' as const, source: 'Actual saved session coin-in', formula: 'sum(session coin-in)' }
    : cruiseCoinIn != null
      ? { value: cruiseCoinIn, kind: cruise.sourceAuthority === 'provider' ? 'provider_reported' as const : 'user_entered' as const, source: 'Cruise casino closeout' }
      : pointsValue != null
        ? pointDerivedCoinIn(program, pointsValue)
        : { value: null, kind: 'missing' as const, source: 'No coin-in evidence' };

  const recordedTheo = nonNegative(cruise.theoreticalLoss);
  const hold = Math.max(0, nonNegative(cruise.houseEdge) ?? input.houseEdgeFallback ?? 0.08);
  const theoreticalLoss: CasinoEvidenceValue = recordedTheo != null
    ? { value: recordedTheo, kind: cruise.sourceAuthority === 'provider' ? 'provider_reported' : 'user_entered', source: 'Recorded cruise theoretical' }
    : coinIn.value != null
      ? { value: coinIn.value * hold, kind: 'estimated', source: 'Coin-in and hold estimate', formula: `$${coinIn.value.toFixed(2)} coin-in × ${(hold * 100).toFixed(2)}% hold` }
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
      ? { value: sessionNet.reduce((sum, value) => sum + value, 0), kind: 'actual', source: 'Actual saved sessions', formula: 'cash-out + separate handpays − cash-in' }
      : { value: null, kind: 'missing', source: 'No casino cash-result evidence' };

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
    estimatedCasinoOpportunityHours: opportunity.opportunityHours,
    seaDays: opportunity.seaDays,
    portDays: opportunity.portDays,
    certificateCodes: linkedCertificateCodes(cruise, input.certificates ?? []),
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
    const earned = String(certificate.issueDate ?? certificate.createdAt ?? certificate.sourceRetrievedAt ?? '').slice(0, 10);
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
