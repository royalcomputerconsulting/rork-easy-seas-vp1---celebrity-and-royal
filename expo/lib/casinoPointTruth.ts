import { isRoyalCaribbeanShip } from '@/constants/shipInfo';
import { createDateFromString } from '@/lib/date';
import type { BookedCruise } from '@/types/models';
import { DOLLARS_PER_POINT } from '@/types/models';

export const CONFIRMED_CLUB_ROYALE_2025_POINTS = 58680;
export const CONFIRMED_CLUB_ROYALE_2025_COIN_IN = CONFIRMED_CLUB_ROYALE_2025_POINTS * DOLLARS_PER_POINT;
export const CONFIRMED_CLUB_ROYALE_2025_WINNINGS_HOME = 19457;
export const CONFIRMED_CLUB_ROYALE_2025_NET_CASH_RESULT = 15218.59;
export const CONFIRMED_CLUB_ROYALE_2026_POINTS = 6660;
export const CONFIRMED_CLUB_ROYALE_2026_COIN_IN = CONFIRMED_CLUB_ROYALE_2026_POINTS * DOLLARS_PER_POINT;
export const CLUB_ROYALE_SIGNATURE_RETAIN_POINTS = 25000;
export const DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR = 400;

export interface KnownCasinoCruiseFact {
  shipName: string;
  sailDate: string;
  returnDate: string;
  nights: number;
  pointsEarned: number;
  winningsBroughtHome: number;
  status: 'completed' | 'booked';
  calculationConfidence: 'actual' | 'estimated' | 'mixed';
  notes: string;
}

export const CURRENT_CLUB_ROYALE_SEASON_START = '2026-04-01';
export const CURRENT_CLUB_ROYALE_SEASON_END = '2027-04-01';

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

function isCompletedForCasino(cruise: BookedCruise, today: Date): boolean {
  if (cruise.status === 'completed' || cruise.completionState === 'completed') {
    return true;
  }
  if (!cruise.returnDate) {
    return false;
  }
  return createDateFromString(cruise.returnDate).getTime() <= today.getTime();
}

export function isClubRoyaleCasinoCruise(cruise: Pick<BookedCruise, 'shipName' | 'sailDate' | 'brand' | 'cruiseSource' | 'casinoProgram' | 'programCharter' | 'nights' | 'pointsEarned' | 'earnedPoints' | 'casinoPoints' | 'coinIn' | 'winningsBroughtHome' | 'winnings' | 'totalWinnings' | 'cashResult' | 'offerCode' | 'offerName' | 'freePlay'>): boolean {
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
  const hasCasinoVolume = (cruise.coinIn ?? 0) > 0 || (cruise.freePlay ?? 0) > 0 || Boolean(cruise.offerCode || cruise.offerName);
  const hasCasinoResult = firstFiniteNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.cashResult) !== null;

  return hasCasinoVolume || hasCasinoResult || explicitPoints > loyaltyPointCeiling;
}

export function getKnownCurrentClubRoyaleFact(cruise: Pick<BookedCruise, 'shipName' | 'sailDate'>): KnownCasinoCruiseFact | undefined {
  return CURRENT_FACTS_BY_KEY.get(getCasinoCruiseKey(cruise.shipName, cruise.sailDate));
}

export function getBookedCruiseCasinoPoints(cruise: BookedCruise): number {
  // A real, explicitly-recorded points value on the cruise itself is always authoritative --
  // it must never be silently overridden by an older hardcoded season snapshot below, or the
  // app would keep showing stale/frozen totals after the user updates their actual results.
  const explicitPoints = firstFiniteNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints);
  if (explicitPoints !== null && explicitPoints > 0) {
    return Math.round(explicitPoints);
  }

  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  if (knownFact) {
    return knownFact.pointsEarned;
  }

  if (!isClubRoyaleCasinoCruise(cruise)) {
    return 0;
  }

  const coinIn = firstFiniteNumber(cruise.coinIn);
  if (coinIn !== null && coinIn > 0) {
    return Math.round(coinIn / DOLLARS_PER_POINT);
  }

  return 0;
}

export function getBookedCruiseWinningsBroughtHome(cruise: BookedCruise): number {
  // Same rule as points above: an explicit recorded win/loss on the cruise is authoritative
  // over the hardcoded season-snapshot fallback (including 0 or negative -- those are real data too).
  const explicitWinnings = firstFiniteNumber(cruise.winningsBroughtHome, cruise.winnings, cruise.totalWinnings, cruise.netResult);
  if (explicitWinnings !== null) {
    return explicitWinnings;
  }

  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  if (knownFact) {
    return knownFact.winningsBroughtHome;
  }

  if (!isClubRoyaleCasinoCruise(cruise)) {
    return 0;
  }

  return 0;
}

export function normalizeCruiseCasinoPerformance(cruise: BookedCruise): BookedCruise {
  const knownFact = getKnownCurrentClubRoyaleFact(cruise);
  // If the cruise already has its own explicitly-recorded points, that's real user data and it
  // must win over the hardcoded season-snapshot fact below (which otherwise freezes the cruise at
  // an old, lower total forever, even after the user records more accurate/updated results).
  const explicitPointsCheck = firstFiniteNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints);
  const hasExplicitPoints = explicitPointsCheck !== null && explicitPointsCheck > 0;
  if (!knownFact || hasExplicitPoints) {
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
    };
  }

  const points = knownFact.pointsEarned;
  const winnings = knownFact.winningsBroughtHome;

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
    pointsEarned: Math.round(points),
    earnedPoints: Math.round(points),
    casinoPoints: Math.round(points),
    coinIn: Math.round(points) * DOLLARS_PER_POINT,
    winningsBroughtHome: winnings,
    winnings,
    totalWinnings: winnings,
    netResult: winnings,
    calculationConfidence: knownFact.calculationConfidence,
    notes: [cruise.notes, knownFact.notes, 'Confirmed Club Royale season facts are authoritative for current-season casino points and win/loss.']
      .filter((note): note is string => Boolean(note))
      .join(' '),
  };
}

export interface CurrentSeasonCasinoMetrics {
  seasonStart: string;
  seasonEnd: string;
  cruises: number;
  nights: number;
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
      ? `Club Royale sync differs by ${Math.abs(difference).toLocaleString()} point${Math.abs(difference) === 1 ? '' : 's'} (${appPoints.toLocaleString()} in app vs ${normalizedSynced.toLocaleString()} synced). App-entered points are authoritative.`
      : null,
  };
}
