import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';
import type { BookedCruise } from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import { DOLLARS_PER_POINT } from '@/types/models';
import { DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR, getBookedCruiseCasinoPoints } from '@/lib/casinoPointTruth';

export interface HistoricalSessionEstimate {
  cruiseId: string;
  estimatedHoursPlayed: number;
  estimatedSessions: SessionEstimate[];
  assumptions: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface SessionEstimate {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  pointsEarned: number;
  winLoss?: number;
  notes: string;
}

const TYPICAL_PPH = DEFAULT_ESTIMATED_POINTS_PER_PLAY_HOUR;
const DEFAULT_SESSION_MINUTES = 90;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCruiseWinLoss(cruise: BookedCruise): number | undefined {
  const value = cruise.winningsBroughtHome ?? cruise.winnings ?? cruise.totalWinnings ?? cruise.netResult ?? cruise.cashResult;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getCruiseHours(cruise: BookedCruise, pointsEarned: number, avgPPH: number): { hours: number; isEstimated: boolean } {
  if (typeof cruise.hoursPlayed === 'number' && Number.isFinite(cruise.hoursPlayed) && cruise.hoursPlayed > 0) {
    return { hours: cruise.hoursPlayed, isEstimated: false };
  }

  if (pointsEarned > 0) {
    return { hours: estimatePlayingHoursFromPoints(pointsEarned, avgPPH), isEstimated: true };
  }

  return { hours: 0, isEstimated: true };
}

function getCasinoOpenDays(cruise: BookedCruise): number {
  const itineraryOpenDays = Array.isArray(cruise.itinerary)
    ? cruise.itinerary.filter((day) => day.casinoOpen).length
    : 0;
  const fallback = cruise.casinoOpenDays || cruise.seaDays || Math.max(1, Math.ceil((cruise.nights || 1) * 0.4));
  return Math.max(1, itineraryOpenDays || fallback);
}

function splitIntegerTotal(total: number, count: number): number[] {
  if (count <= 0) return [];
  const roundedTotal = Math.round(total);
  const base = Math.trunc(roundedTotal / count);
  const remainder = Math.abs(roundedTotal - base * count);
  const sign = roundedTotal >= 0 ? 1 : -1;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? sign : 0));
}

function splitMoneyTotal(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / count);
  const remainder = Math.abs(cents - base * count);
  const sign = cents >= 0 ? 1 : -1;
  return Array.from({ length: count }, (_, index) => roundMoney((base + (index < remainder ? sign : 0)) / 100));
}

export function estimatePlayingHoursFromPoints(
  pointsEarned: number,
  pphRate: number = TYPICAL_PPH
): number {
  if (pointsEarned <= 0) return 0;
  return pointsEarned / Math.max(1, pphRate);
}

export function calculateHistoricalSessions(
  cruise: BookedCruise,
  preferredPlayingHoursPerDay: number = 3,
  avgPPH: number = TYPICAL_PPH
): HistoricalSessionEstimate | null {
  console.log('[HistoricalSessionCalculator] Calculating sessions for cruise:', cruise.id);

  const pointsEarned = getBookedCruiseCasinoPoints(cruise);
  const winLoss = getCruiseWinLoss(cruise);

  if (pointsEarned <= 0 && winLoss === undefined) {
    console.log('[HistoricalSessionCalculator] No points/win-loss data available for cruise:', cruise.id);
    return null;
  }

  const hoursInfo = getCruiseHours(cruise, pointsEarned, avgPPH);
  const totalHoursPlayed = hoursInfo.hours;
  const coinIn = pointsEarned * DOLLARS_PER_POINT;
  const casinoOpenDays = getCasinoOpenDays(cruise);
  const avgHoursPerDay = casinoOpenDays > 0 ? totalHoursPlayed / casinoOpenDays : 0;

  const assumptions = [
    pointsEarned > 0
      ? `${pointsEarned.toLocaleString()} actual cruise points used as the point total.`
      : 'No cruise point total available; sessions are based on win/loss only.',
    winLoss !== undefined
      ? `${winLoss >= 0 ? '+' : ''}$${Math.abs(winLoss).toLocaleString()} actual cruise win/loss distributed across derived sessions.`
      : 'No cruise win/loss available; derived session win/loss defaults to $0.',
    hoursInfo.isEstimated
      ? `Play hours estimated from points at ${avgPPH} points/hour.`
      : `${totalHoursPlayed.toFixed(1)} actual play hours used from the cruise row.`,
    `${casinoOpenDays} casino-open days on this cruise.`,
    `Total coin-in: $${coinIn.toLocaleString()}`,
  ];

  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (pointsEarned > 0 && winLoss !== undefined && !hoursInfo.isEstimated) {
    confidence = 'high';
  } else if (pointsEarned > 0 && winLoss !== undefined) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const sessions = generateSessionEstimates(
    cruise,
    pointsEarned,
    totalHoursPlayed,
    casinoOpenDays,
    preferredPlayingHoursPerDay,
    winLoss
  );

  console.log('[HistoricalSessionCalculator] Generated', sessions.length, 'sessions for cruise:', cruise.id);

  return {
    cruiseId: cruise.id,
    estimatedHoursPlayed: totalHoursPlayed,
    estimatedSessions: sessions,
    assumptions,
    confidence,
  };
}

function getSessionDates(cruise: BookedCruise, casinoOpenDays: number): string[] {
  const itinerary = Array.isArray(cruise.itinerary) ? cruise.itinerary : [];
  const casinoDays = itinerary.filter((day) => day.casinoOpen);
  const sourceDays = casinoDays.length > 0 ? casinoDays : [];

  if (sourceDays.length > 0) {
    return sourceDays.map((day) => {
      const cruiseDateObj = new Date(cruise.sailDate);
      cruiseDateObj.setDate(cruiseDateObj.getDate() + Math.max(0, (day.day || 1) - 1));
      return cruiseDateObj.toISOString().split('T')[0];
    });
  }

  return Array.from({ length: casinoOpenDays }, (_, dayIndex) => {
    const cruiseDateObj = new Date(cruise.sailDate);
    cruiseDateObj.setDate(cruiseDateObj.getDate() + dayIndex + 1);
    return cruiseDateObj.toISOString().split('T')[0];
  });
}

function generateSessionEstimates(
  cruise: BookedCruise,
  totalPoints: number,
  totalHours: number,
  casinoOpenDays: number,
  preferredPlayingHoursPerDay: number,
  winnings?: number
): SessionEstimate[] {
  const dates = getSessionDates(cruise, casinoOpenDays);
  const totalSessionCount = Math.max(
    1,
    Math.round(totalHours > 0 ? (totalHours * 60) / DEFAULT_SESSION_MINUTES : (dates.length * preferredPlayingHoursPerDay * 60) / DEFAULT_SESSION_MINUTES),
  );
  const sessionsPerDayBase = Math.max(1, Math.floor(totalSessionCount / dates.length));
  const extraSessions = totalSessionCount % dates.length;
  const pointSplits = splitIntegerTotal(totalPoints, totalSessionCount);
  const winLossSplits = splitMoneyTotal(winnings ?? 0, totalSessionCount);
  const durationSplits = splitIntegerTotal(Math.round(totalHours > 0 ? totalHours * 60 : totalSessionCount * DEFAULT_SESSION_MINUTES), totalSessionCount);
  const startTimes = [
    { start: 10, fallbackDuration: 85 },
    { start: 13, fallbackDuration: 95 },
    { start: 16, fallbackDuration: 100 },
    { start: 19, fallbackDuration: 90 },
    { start: 22, fallbackDuration: 110 },
    { start: 1, fallbackDuration: 75 },
  ];
  const sessions: SessionEstimate[] = [];
  let sessionIndex = 0;

  dates.forEach((sessionDate, dayIndex) => {
    const sessionsForDay = sessionsPerDayBase + (dayIndex < extraSessions ? 1 : 0);
    for (let i = 0; i < sessionsForDay; i += 1) {
      const timeSlot = startTimes[i % startTimes.length];
      const startHour = timeSlot.start;
      const durationMinutes = Math.max(15, durationSplits[sessionIndex] || timeSlot.fallbackDuration);
      const endMinutes = (startHour * 60) + durationMinutes;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const startTime = `${startHour.toString().padStart(2, '0')}:00`;
      const endTime = endHour >= 24
        ? `${(endHour - 24).toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
        : `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

      sessions.push({
        date: sessionDate,
        startTime,
        endTime,
        durationMinutes,
        pointsEarned: pointSplits[sessionIndex] || 0,
        winLoss: winLossSplits[sessionIndex] || 0,
        notes: `Derived from ${cruise.shipName || 'cruise'} actual cruise totals${totalPoints > 0 ? ` (${totalPoints.toLocaleString()} pts)` : ''}`,
      });
      sessionIndex += 1;
    }
  });

  return sessions;
}

export function convertEstimateToSession(
  estimate: SessionEstimate,
  cruiseId: string
): Omit<CasinoSession, 'id' | 'createdAt'> {
  return {
    date: estimate.date,
    cruiseId,
    startTime: estimate.startTime,
    endTime: estimate.endTime,
    durationMinutes: estimate.durationMinutes,
    pointsEarned: estimate.pointsEarned,
    pointsSource: 'estimated',
    sessionSource: 'extrapolated',
    cashCoinIn: estimateCoinInForPoints({ targetPoints: estimate.pointsEarned, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0,
    coinIn: estimateCoinInForPoints({ targetPoints: estimate.pointsEarned, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0,
    gameCategory: 'reel-slot',
    winLoss: estimate.winLoss,
    notes: `${estimate.notes} (Auto-calculated from cruise totals)`,
    machineType: 'penny-slots',
    denomination: 0.01,
  };
}

export function generateSessionsFromCruise(
  cruise: BookedCruise,
  avgPPH: number = TYPICAL_PPH
): Omit<CasinoSession, 'id' | 'createdAt'>[] {
  console.log('[GenerateSessionsFromCruise] Processing cruise:', {
    id: cruise.id,
    ship: cruise.shipName,
    sailDate: cruise.sailDate,
    earnedPoints: getBookedCruiseCasinoPoints(cruise),
    winningsBroughtHome: getCruiseWinLoss(cruise),
    cashResult: cruise.cashResult,
  });

  const estimate = calculateHistoricalSessions(cruise, 3, avgPPH);

  if (!estimate) {
    console.log('[GenerateSessionsFromCruise] No estimate generated for cruise:', cruise.id);
    return [];
  }

  const sessions = estimate.estimatedSessions.map(sessionEstimate =>
    convertEstimateToSession(sessionEstimate, cruise.id)
  );

  console.log('[GenerateSessionsFromCruise] Generated', sessions.length, 'sessions for cruise:', cruise.id);
  return sessions;
}
