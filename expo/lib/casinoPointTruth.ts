import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';
import { isCancelledBookedCruise } from '@/lib/bookedCruiseStatus';

export const CONFIRMED_CLUB_ROYALE_2025_POINTS = 58680;
export const CONFIRMED_CLUB_ROYALE_2025_COIN_IN = CONFIRMED_CLUB_ROYALE_2025_POINTS * DOLLARS_PER_POINT;
export const CONFIRMED_CLUB_ROYALE_2025_WINNINGS_HOME = 19457;
export const CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT = 15218.59;
/** Confirmed account total for the 2026-04-01 Club Royale earning year. */
export const CONFIRMED_CLUB_ROYALE_2026_POINTS = 23446;
export const CONFIRMED_CLUB_ROYALE_2026_COIN_IN = CONFIRMED_CLUB_ROYALE_2026_POINTS * DOLLARS_PER_POINT;
export const CLUB_ROYALE_SIGNATURE_RETAIN_POINTS = 25000;
export const DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR = 400;
export const TIER_CERTIFICATE_TRADE_IN_VALUE = 2400;

export const CERTIFICATE_POINT_REQUIREMENTS: Record<string, number> = {
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

export interface CertificateCodePointEvidence {
  certificateCode: string;
  family: string;
  levelCode: string;
  points: number;
  reason: string;
}

export interface KnownCasinoCruiseFact {
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  pointsEarned: number;
  winningsBroughtHome?: number;
  status: 'completed' | 'booked';
  calculationConfidence: 'actual' | 'estimated' | 'mixed';
  notes: string;
  certificateEvidenceCode?: string;
  certificatePointFloor?: number;
}

export const CURRENT_CLUB_ROYALE_SEASON_START = '2026-04-01';
export const CURRENT_CLUB_ROYALE_SEASON_END = '2027-04-01';
const CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE = 'Certificate-threshold point floor estimate; remaining provider/account points stay in reconciliation until an actual cruise closeout or certificate scan assigns them.';

export const KNOWN_CURRENT_CLUB_ROYALE_CRUISES: KnownCasinoCruiseFact[] = [
  {
    shipName: 'Quantum of the Seas',
    sailDate: '2026-04-07',
    returnDate: '2026-04-10',
    nights: 3,
    pointsEarned: 800,
    winningsBroughtHome: 1000,
    status: 'completed',
    calculationConfidence: 'actual',
    notes: 'Confirmed current Club Royale season result: 800 points / $1,000 brought home.',
  },
  {
    shipName: 'Quantum of the Seas',
    sailDate: '2026-04-10',
    returnDate: '2026-04-15',
    nights: 5,
    pointsEarned: 3000,
    winningsBroughtHome: 1000,
    status: 'completed',
    calculationConfidence: 'actual',
    notes: 'Confirmed current Club Royale season result: 3,000 points / $1,000 brought home.',
  },
  {
    shipName: 'Quantum of the Seas',
    sailDate: '2026-04-15',
    returnDate: '2026-04-21',
    nights: 6,
    pointsEarned: 2000,
    winningsBroughtHome: 1215,
    status: 'completed',
    calculationConfidence: 'actual',
    notes: 'Confirmed current Club Royale season result: 2,000 points / $1,215 brought home.',
  },
  {
    shipName: 'Quantum of the Seas',
    sailDate: '2026-04-21',
    returnDate: '2026-04-24',
    nights: 3,
    pointsEarned: 860,
    winningsBroughtHome: 3500,
    status: 'completed',
    calculationConfidence: 'actual',
    notes: 'Confirmed current Club Royale season result: 860 points / $3,500 brought home.',
  },
  { shipName: 'Icon of the Seas', sailDate: '2026-05-09', returnDate: '2026-05-16', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Symphony of the Seas', sailDate: '2026-05-17', returnDate: '2026-05-24', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Navigator of the Seas', sailDate: '2026-05-29', returnDate: '2026-06-05', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Quantum of the Seas', sailDate: '2026-06-05', returnDate: '2026-06-12', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Quantum of the Seas', sailDate: '2026-06-19', returnDate: '2026-06-26', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Star of the Seas', sailDate: '2026-07-05', returnDate: '2026-07-12', nights: 7, pointsEarned: 800, status: 'completed', calculationConfidence: 'estimated', certificateEvidenceCode: '2607C08', certificatePointFloor: 800, notes: 'User-confirmed 2607C08 certificate evidence; C08 is an 800-point instant certificate. Remaining provider/account points stay in reconciliation until assigned by a closeout or scan.' },
  { shipName: 'Navigator of the Seas', sailDate: '2026-07-17', returnDate: '2026-07-24', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
  { shipName: 'Navigator of the Seas', sailDate: '2026-07-24', returnDate: '2026-07-31', nights: 7, pointsEarned: 2000, status: 'completed', calculationConfidence: 'estimated', certificatePointFloor: 2000, notes: CURRENT_SEASON_CERTIFICATE_FLOOR_NOTE },
];

export function getCasinoCruiseKey(shipName?: string, sailDate?: string): string {
  return `${(shipName ?? '').trim().toLowerCase()}|${(sailDate ?? '').trim()}`;
}

const CURRENT_FACTS_BY_KEY = new Map(
  KNOWN_CURRENT_CLUB_ROYALE_CRUISES.map((fact) => [getCasinoCruiseKey(fact.shipName, fact.sailDate), fact]),
);

function firstFiniteNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function normalizeCertificateLevelCode(value: string): string {
  const level = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^\d$/.test(level)) return `0${level}`;
  return level;
}

export function parseCasinoCertificateCode(value: unknown): { code: string; family: string; levelCode: string } | null {
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

export function getCertificatePointRequirement(value: unknown): number | null {
  const parsed = parseCasinoCertificateCode(value);
  if (!parsed) return null;
  return CERTIFICATE_POINT_REQUIREMENTS[parsed.levelCode] ?? null;
}

function extractCertificateCodeCandidates(value: unknown): string[] {
  const text = String(value ?? '').toUpperCase();
  const exact = parseCasinoCertificateCode(text);
  if (exact) return [exact.code];
  return Array.from(text.matchAll(/\b\d{4}[ACD](?:VIP\d+|\d{1,2}[A-Z]?)\b/g)).map((match) => match[0]);
}

export function getCertificatePointEvidenceFromCodes(candidates: unknown[]): CertificateCodePointEvidence | null {
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

export function getRoyalTierCertificateTradeInValue(record: Record<string, unknown> | null | undefined): number {
  if (!record) return 0;
  const fields = [
    record.offerCode,
    record.packageCode,
    record.promoCode,
    record.specialServices,
    record.invoiceSpecialServices,
    record.awardType,
    record.description,
    record.offerName,
    record.title,
    record.category,
    record.tier,
    record.casinoTier,
    record.crownAnchorLevel,
    record.notes,
    Array.isArray(record.invoicePromotions) ? record.invoicePromotions.join(' ') : '',
    Array.isArray(record.perks) ? record.perks.join(' ') : '',
  ].map((value) => String(value ?? '')).join(' ');
  const text = fields.toLowerCase();
  const code = String(record.offerCode ?? record.packageCode ?? record.promoCode ?? '').trim().toUpperCase();
  const tierCode = code === 'TIER'
    || /\b\d{2}TIER\d*\b/i.test(fields)
    || /\bTIER\s*(?:ANNUAL|CRUISE|REWARD|CERTIFICATE)?\b/i.test(String(record.invoiceSpecialServices ?? record.specialServices ?? record.offerUsedCode ?? ''));
  const explicitTierReward = /\b(?:annual\s+(?:tier\s+)?cruise|(?:prime|signature|pinnacle)\s+(?:annual\s+)?cruise|(?:prime|signature|pinnacle)\s+certificate|(?:prime|signature|pinnacle)\s+reward|annual\s+(?:prime|signature|pinnacle)\s+reward)\b/i.test(fields);
  return tierCode || explicitTierReward ? TIER_CERTIFICATE_TRADE_IN_VALUE : 0;
}

export function getCruiseCertificatePointEvidence(cruise: BookedCruise): CertificateCodePointEvidence | null {
  const record = cruise as unknown as Record<string, unknown>;
  const direct = getCertificatePointEvidenceFromCodes([
    cruise.instantCertificateOfferCode,
    cruise.offerUsedCode,
    cruise.offerCode,
    cruise.packageCode,
    record.certificateCode,
    record.nextCruiseCertificateCode,
    record.invoiceSpecialServices,
    record.notes,
    Array.isArray(record.invoicePromotions) ? record.invoicePromotions.join(' ') : '',
  ]);
  if (direct) {
    return direct;
  }

  const floor = firstFiniteNumber(record.certificatePointFloor as number | undefined, record.pointsRequired as number | undefined, record.pointRequirement as number | undefined);
  if (floor !== null && floor > 0) {
    return {
      certificateCode: String(record.certificateEvidenceCode ?? record.instantCertificateOfferCode ?? 'certificate-floor').toUpperCase(),
      family: 'unknown',
      levelCode: 'floor',
      points: Math.round(floor),
      reason: `Saved certificate point floor supplies at least ${Math.round(floor).toLocaleString()} Club Royale points.`,
    };
  }

  return null;
}

function isAllocatedPointEstimate(cruise: Pick<BookedCruise, 'calculationConfidence' | 'notes'>): boolean {
  // An estimated calculation flag can refer to other cruise economics and
  // must not replace raw pasted/saved cruise points with a certificate floor.
  // Only explicit allocation language identifies a reconciled placeholder.
  return /(?:approved|equal|estimated|final).*allocat|allocat.*(?:unassigned|annual|point)|split.*(?:provider|annual|unassigned)/i.test(String(cruise.notes ?? ''));
}

function getSavedCruisePointValue(cruise: Pick<BookedCruise, 'pointsEarned' | 'earnedPoints' | 'casinoPoints'>): number | null {
  const candidates = [cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return candidates.find((value) => value > 0) ?? candidates[0] ?? null;
}

function isCompletedForCasino(cruise: BookedCruise, today: Date): boolean {
  if (isCancelledBookedCruise(cruise)) {
    return false;
  }
  if (cruise.status === 'completed' || cruise.completionState === 'completed') {
    return true;
  }
  if (!cruise.returnDate) {
    return false;
  }
  return createDateFromString(cruise.returnDate).getTime() <= today.getTime();
}

export function isClubRoyaleCasinoCruise(cruise: Pick<BookedCruise, 'shipName' | 'sailDate' | 'brand' | 'cruiseSource' | 'casinoProgram' | 'programCharter' | 'nights' | 'pointsEarned' | 'earnedPoints' | 'casinoPoints' | 'coinIn' | 'winningsBroughtHome' | 'winnings' | 'totalWinnings' | 'cashResult' | 'offerCode' | 'offerName' | 'freePlay' | 'instantCertificateOfferCode' | 'offerUsedCode' | 'packageCode'>): boolean {
  const brand = (cruise.brand ?? '').trim().toLowerCase();
  const shipName = (cruise.shipName ?? '').trim().toLowerCase();
  const programCharter = (cruise.programCharter ?? '').trim().toLowerCase();
  const casinoProgram = cruise.casinoProgram;

  if (getKnownCurrentClubRoyaleFact(cruise)) {
    return true;
  }

  if (casinoProgram && casinoProgram !== 'clubRoyale') {
    return false;
  }

  if (
    cruise.cruiseSource === 'celebrity'
    || brand.includes('celebrity')
    || shipName.startsWith('celebrity ')
    || brand.includes('virgin')
    || shipName.includes('scarlet lady')
    || shipName.includes('valiant lady')
    || programCharter.includes('vacaya')
  ) {
    return false;
  }

  const isRoyal = cruise.cruiseSource === 'royal' || brand.includes('royal') || isRoyalCaribbeanShip(cruise.shipName ?? '');
  if (!isRoyal) {
    return false;
  }

  if (casinoProgram === 'clubRoyale') {
    return true;
  }

  const explicitPoints = firstFiniteNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints) ?? 0;
  const loyaltyPointCeiling = Math.max(3, (cruise.nights ?? 0) * 3);
  const hasCertificateEvidence = Boolean(getCruiseCertificatePointEvidence(cruise as BookedCruise));
  const hasCasinoVolume = (cruise.coinIn ?? 0) > 0 || (cruise.freePlay ?? 0) > 0 || Boolean(cruise.offerCode || cruise.offerName || cruise.instantCertificateOfferCode || cruise.offerUsedCode || cruise.packageCode);
  const hasCasinoResult = firstFiniteNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.cashResult) !== null;

  return hasCasinoVolume || hasCasinoResult || hasCertificateEvidence || explicitPoints > loyaltyPointCeiling;
}

export function getKnownCurrentClubRoyaleFact(cruise: Pick<BookedCruise, 'shipName' | 'sailDate'>): KnownCasinoCruiseFact | undefined {
  return CURRENT_FACTS_BY_KEY.get(getCasinoCruiseKey(cruise.shipName, cruise.sailDate));
}

export function getBookedCruiseCasinoPoints(cruise: BookedCruise): number {
  if (isCancelledBookedCruise(cruise)) {
    return 0;
  }
  if (!isClubRoyaleCasinoCruise(cruise)) {
    return 0;
  }

  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  const explicitPoints = getSavedCruisePointValue(cruise);
  if (knownFact?.calculationConfidence === 'actual' && explicitPoints === null) {
    return knownFact.pointsEarned;
  }

  if (explicitPoints !== null && !isAllocatedPointEstimate(cruise)) {
    return Math.round(explicitPoints);
  }

  const certificateEvidence = getCruiseCertificatePointEvidence(cruise);
  if (certificateEvidence) {
    return certificateEvidence.points;
  }

  if (explicitPoints !== null) {
    return Math.round(explicitPoints);
  }

  if (knownFact) return knownFact.pointsEarned;

  const coinIn = firstFiniteNumber(cruise.coinIn);
  if (coinIn !== null && coinIn > 0) {
    return Math.round(coinIn / DOLLARS_PER_POINT);
  }

  return 0;
}

export function getBookedCruiseWinningsBroughtHome(cruise: BookedCruise): number {
  if (isCancelledBookedCruise(cruise)) {
    return 0;
  }
  if (!isClubRoyaleCasinoCruise(cruise)) {
    return 0;
  }

  const explicitWinnings = firstFiniteNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.netResult);
  if (explicitWinnings !== null) {
    return explicitWinnings;
  }

  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  if (knownFact && typeof knownFact.winningsBroughtHome === 'number') return knownFact.winningsBroughtHome;

  return 0;
}

export function normalizeCruiseCasinoPerformance(cruise: BookedCruise): BookedCruise {
  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  const certificateEvidence = getCruiseCertificatePointEvidence(cruise);
  if (!knownFact) {
    if (!isClubRoyaleCasinoCruise(cruise)) {
      return cruise;
    }

    const points = getBookedCruiseCasinoPoints(cruise);
    if (points <= 0) {
      return cruise;
    }
    return {
      ...cruise,
      pointsEarned: cruise.pointsEarned ?? points,
      earnedPoints: cruise.earnedPoints ?? points,
      casinoPoints: cruise.casinoPoints ?? points,
      coinIn: cruise.coinIn ?? points * DOLLARS_PER_POINT,
      coinInCalculationSource: cruise.coinInCalculationSource ?? 'club_royale_slot_points_estimate',
      slotPointsConfirmed: cruise.slotPointsConfirmed ?? Boolean(certificateEvidence),
      calculationConfidence: cruise.calculationConfidence ?? (certificateEvidence ? 'estimated' : undefined),
      notes: certificateEvidence && !String(cruise.notes ?? '').includes(certificateEvidence.reason)
        ? [cruise.notes, certificateEvidence.reason, 'Certificate point evidence is a floor until actual cruise closeout points are entered.'].filter(Boolean).join(' ')
        : cruise.notes,
    };
  }

  const storedPoints = getSavedCruisePointValue(cruise);
  const storedIsAllocatedEstimate = storedPoints !== null && isAllocatedPointEstimate(cruise);
  const points = knownFact.calculationConfidence === 'actual' && storedPoints === null
    ? knownFact.pointsEarned
    : storedPoints !== null && !storedIsAllocatedEstimate
      ? storedPoints
      : certificateEvidence?.points ?? storedPoints ?? knownFact.pointsEarned;
  const winnings = knownFact.winningsBroughtHome;
  const storedWinnings = firstFiniteNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.cashResult, cruise.netResult);
  const authoritativePoints = points;
  const authoritativeWinnings = storedWinnings ?? winnings;

  return {
    ...cruise,
    shipName: knownFact.shipName,
    sailDate: knownFact.sailDate,
    returnDate: knownFact.returnDate,
    nights: knownFact.nights,
    brand: 'Royal Caribbean',
    cruiseSource: 'royal',
    status: knownFact.status,
    completionState: knownFact.status === 'completed' ? 'completed' : 'upcoming',
    pointsEarned: Math.round(authoritativePoints),
    earnedPoints: Math.round(authoritativePoints),
    casinoPoints: Math.round(authoritativePoints),
    coinIn: cruise.coinIn ?? Math.round(authoritativePoints) * DOLLARS_PER_POINT,
    coinInCalculationSource: cruise.coinInCalculationSource ?? 'club_royale_slot_points_estimate',
    slotPointsConfirmed: cruise.slotPointsConfirmed ?? true,
    ...(knownFact.certificateEvidenceCode && !cruise.instantCertificateOfferCode ? {
      instantCertificateWon: true,
      instantCertificateOfferCode: knownFact.certificateEvidenceCode,
    } : {}),
    ...(knownFact.certificatePointFloor ? { certificatePointFloor: knownFact.certificatePointFloor } : {}),
    ...(typeof authoritativeWinnings === 'number' ? {
      winningsBroughtHome: authoritativeWinnings,
      winnings: authoritativeWinnings,
      totalWinnings: authoritativeWinnings,
      netResult: cruise.netResult ?? authoritativeWinnings,
    } : {}),
    calculationConfidence: storedPoints !== null && !storedIsAllocatedEstimate ? cruise.calculationConfidence : knownFact.calculationConfidence,
    notes: [cruise.notes, knownFact.notes, certificateEvidence?.reason, 'Saved app/manual cruise values are authoritative; certificate thresholds fill missing estimates; confirmed Club Royale totals stay as reconciliation evidence.']
      .filter((note): note is string => Boolean(note))
      .join(' '),
  };
}

export interface CurrentSeasonCasinoMetrics {
  seasonStart: string;
  seasonEnd: string;
  cruises: number;
  nights: number;
  attributedPoints: number;
  accountReportedPoints: number | null;
  unallocatedPoints: number | null;
  points: number;
  pointsNeededForSignature: number;
  coinIn: number;
  winningsBroughtHome: number;
  averagePointsPerCruise: number;
  averagePointsPerNight: number;
  estimatedPlayHours: number;
  averageDailyPlayHours: number;
  estimatedPointsPerPlayHour: number;
}

export function estimatePlayHoursFromPoints(points: number, pointsPerHour = DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR): number {
  if (points <= 0 || pointsPerHour <= 0) {
    return 0;
  }
  return Math.round((points / pointsPerHour + Number.EPSILON) * 100) / 100;
}

export function buildCurrentSeasonCasinoMetrics(cruises: BookedCruise[], today: Date = new Date()): CurrentSeasonCasinoMetrics {
  const currentSeasonCruises = cruises
    .map(normalizeCruiseCasinoPerformance)
    .filter((cruise) => {
      const sailDate = cruise.sailDate ?? '';
      return isClubRoyaleCasinoCruise(cruise)
        && isCompletedForCasino(cruise, today)
        && sailDate >= CURRENT_CLUB_ROYALE_SEASON_START
        && sailDate < CURRENT_CLUB_ROYALE_SEASON_END;
    });

  const points = currentSeasonCruises.reduce((sum, cruise) => sum + getBookedCruiseCasinoPoints(cruise), 0);
  const nights = currentSeasonCruises.reduce((sum, cruise) => sum + Math.max(0, cruise.nights ?? 0), 0);
  const winningsBroughtHome = currentSeasonCruises.reduce((sum, cruise) => sum + getBookedCruiseWinningsBroughtHome(cruise), 0);
  const estimatedPlayHours = estimatePlayHoursFromPoints(points);

  return {
    seasonStart: CURRENT_CLUB_ROYALE_SEASON_START,
    seasonEnd: CURRENT_CLUB_ROYALE_SEASON_END,
    cruises: currentSeasonCruises.length,
    nights,
    attributedPoints: points,
    accountReportedPoints: null,
    unallocatedPoints: null,
    points,
    pointsNeededForSignature: Math.max(0, CLUB_ROYALE_SIGNATURE_RETAIN_POINTS - points),
    coinIn: points * DOLLARS_PER_POINT,
    winningsBroughtHome,
    averagePointsPerCruise: currentSeasonCruises.length > 0 ? Math.round((points / currentSeasonCruises.length + Number.EPSILON) * 100) / 100 : 0,
    averagePointsPerNight: nights > 0 ? Math.round((points / nights + Number.EPSILON) * 100) / 100 : 0,
    estimatedPlayHours,
    averageDailyPlayHours: nights > 0 ? Math.round((estimatedPlayHours / nights + Number.EPSILON) * 100) / 100 : 0,
    estimatedPointsPerPlayHour: DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR,
  };
}

export interface ClubRoyaleDiscrepancy {
  appPoints: number;
  syncedPoints: number | null;
  difference: number;
  hasDiscrepancy: boolean;
  message: string | null;
}

export function buildClubRoyaleDiscrepancy(appPoints: number, syncedPoints: number | null | undefined): ClubRoyaleDiscrepancy {
  const normalizedSynced = typeof syncedPoints === 'number' && Number.isFinite(syncedPoints) ? Math.round(syncedPoints) : null;
  if (normalizedSynced === null) {
    return { appPoints, syncedPoints: null, difference: 0, hasDiscrepancy: false, message: null };
  }

  const difference = Math.round(appPoints - normalizedSynced);
  const hasDiscrepancy = difference !== 0;
  return {
    appPoints,
    syncedPoints: normalizedSynced,
    difference,
    hasDiscrepancy,
    message: hasDiscrepancy
      ? `Club Royale sources differ by ${Math.abs(difference).toLocaleString()} point${Math.abs(difference) === 1 ? '' : 's'} (${appPoints.toLocaleString()} saved app/cruise points vs ${normalizedSynced.toLocaleString()} provider-synced). Saved app and manual per-cruise points remain authoritative; the provider total is retained as reconciliation evidence.`
      : null,
  };
}
