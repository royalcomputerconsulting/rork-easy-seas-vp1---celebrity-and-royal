import { diffDays, normalizeDateOnly, todayDateOnly } from '@/lib/dates/appDate';
import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';

type CruiseLike = {
  id?: string;
  shipName?: string;
  sailDate?: string;
  returnDate?: string;
  nights?: number;
  itinerary?: { day?: number; port?: string; isSeaDay?: boolean }[];
};

export type BestPlayTodayPlan = {
  activeCruise: CruiseLike | null;
  shipName: string;
  date: string;
  cruiseDay: number | null;
  dayType: 'sea' | 'port' | 'private-island' | 'embarkation' | 'debarkation' | 'unknown';
  recommendedAction: 'play' | 'light-play' | 'freeplay-only' | 'avoid' | 'unknown';
  targetPoints: number;
  estimatedCoinIn: number;
  bankrollCap: number;
  betRange: string;
  sessionLength: string;
  reason: string;
  warnings: string[];
  recommendedMachines: string[];
};

function classifyDay(cruise: CruiseLike, cruiseDay: number | null): BestPlayTodayPlan['dayType'] {
  if (!cruiseDay) return 'unknown';
  const nights = Number(cruise.nights ?? 0) || 0;
  if (cruiseDay === 1) return 'embarkation';
  if (nights && cruiseDay >= nights + 1) return 'debarkation';
  const day = cruise.itinerary?.find(item => item.day === cruiseDay) ?? cruise.itinerary?.[cruiseDay - 1];
  const port = String(day?.port ?? '').toLowerCase();
  if (day?.isSeaDay || port.includes('sea day')) return 'sea';
  if (port.includes('cococay') || port.includes('perfect day') || port.includes('labadee')) return 'private-island';
  if (port) return 'port';
  return 'unknown';
}

export function buildBestPlayTodayPlan(input: { cruises?: CruiseLike[]; today?: string; bankrollCap?: number; targetPointsOverride?: number }): BestPlayTodayPlan {
  const date = normalizeDateOnly(input.today) ?? todayDateOnly();
  const cruises = input.cruises ?? [];
  const activeCruise = cruises.find(cruise => {
    const start = normalizeDateOnly(cruise.sailDate);
    const end = normalizeDateOnly(cruise.returnDate);
    return !!start && !!end && date >= start && date <= end;
  }) ?? null;

  if (!activeCruise) {
    return { activeCruise: null, shipName: 'No active cruise', date, cruiseDay: null, dayType: 'unknown', recommendedAction: 'unknown', targetPoints: 0, estimatedCoinIn: 0, bankrollCap: input.bankrollCap ?? 200, betRange: '$0', sessionLength: 'None', reason: 'No active cruise was found for today.', warnings: ['Best Play Today requires an active cruise with sail and return dates.'], recommendedMachines: [] };
  }

  const start = normalizeDateOnly(activeCruise.sailDate);
  const cruiseDay = start ? (diffDays(start, date) ?? 0) + 1 : null;
  const dayType = classifyDay(activeCruise, cruiseDay);
  const bankrollCap = input.bankrollCap ?? 200;

  let recommendedAction: BestPlayTodayPlan['recommendedAction'] = 'light-play';
  let targetPoints = input.targetPointsOverride ?? 75;
  let sessionLength = '45–90 minutes';
  let betRange = '$2.50–$5.00';
  let reason = 'Controlled play day using bankroll cap.';

  if (dayType === 'sea') {
    recommendedAction = 'play';
    targetPoints = input.targetPointsOverride ?? 125;
    sessionLength = '90–150 minutes';
    betRange = '$2.50–$8.80';
    reason = 'Sea days usually provide the best casino availability.';
  } else if (dayType === 'private-island' || dayType === 'embarkation') {
    recommendedAction = 'freeplay-only';
    targetPoints = input.targetPointsOverride ?? 25;
    sessionLength = '20–45 minutes';
    betRange = '$1.76–$3.52';
    reason = 'Casino time may be restricted; protect cash and use FreePlay/light play.';
  } else if (dayType === 'debarkation') {
    recommendedAction = 'avoid';
    targetPoints = 0;
    sessionLength = 'None';
    betRange = '$0';
    reason = 'Debarkation is not a good casino chase day.';
  }

  const estimatedCoinIn = estimateCoinInForPoints({ targetPoints, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0;
  return { activeCruise, shipName: activeCruise.shipName ?? 'Unknown Ship', date, cruiseDay, dayType, recommendedAction, targetPoints, estimatedCoinIn, bankrollCap, betRange, sessionLength, reason, warnings: ['Estimated coin-in is wagering volume, not expected loss or cost.'], recommendedMachines: ['Known high-comfort machines', 'Visible overlay progress machines', 'Avoid chasing pots without a defined stop'] };
}
