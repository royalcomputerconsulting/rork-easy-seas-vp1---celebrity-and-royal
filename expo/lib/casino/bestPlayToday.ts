import { addDays, daysBetweenDates, getTodayLocal, normalizeDateOnly } from '../dates/appDate';
import {
  calculateCasinoOpportunityScore,
  classifyCruiseDay,
  CruiseDayType,
  estimateCasinoHoursForDay,
} from '../cruise/casinoOpportunityScore';
import { estimateCoinInForPoints as estimateCoinInWithProfile, normalizeGameCategory } from './pointsEarning';

export type BestPlayTodayAction = 'play' | 'light-play' | 'freeplay-only' | 'avoid' | 'unknown';
export type CasinoAvailability = 'strong' | 'moderate' | 'limited' | 'closed' | 'unknown';

export type BestPlayTodayPlan = {
  cruiseId?: string;
  cruiseName?: string;
  shipName?: string;
  date: string;
  cruiseDay: number | null;
  dayType: CruiseDayType;
  casinoAvailability: CasinoAvailability;
  recommendedAction: BestPlayTodayAction;
  targetPoints: number;
  estimatedCoinIn: number;
  suggestedBankrollCap: number;
  suggestedBetRange: string;
  suggestedSessionLengthMinutes: number;
  reason: string;
  warnings: string[];
  recommendedMachines?: string[];
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStartDate(cruise: any): string | null {
  return normalizeDateOnly(
    cruise?.startDate || cruise?.sailingDate || cruise?.sailDate || cruise?.departureDate || cruise?.date
  );
}

function getEndDate(cruise: any): string | null {
  const explicitEnd = normalizeDateOnly(cruise?.endDate || cruise?.returnDate || cruise?.arrivalDate);
  if (explicitEnd) return explicitEnd;
  const start = getStartDate(cruise);
  const nights = numeric(cruise?.nights ?? cruise?.durationNights ?? cruise?.length ?? cruise?.nightCount, 0);
  if (start && nights > 0) return addDays(start, nights);
  return null;
}

function getCruiseId(cruise: any): string | undefined {
  return text(cruise?.id || cruise?.cruiseId || cruise?.reservationNumber || cruise?.reservationId) || undefined;
}

function getShipName(cruise: any): string {
  return text(cruise?.shipName || cruise?.ship || cruise?.ship_name || cruise?.vesselName);
}

function getCruiseName(cruise: any): string {
  return text(cruise?.title || cruise?.name || cruise?.itinerary || cruise?.itineraryName || getShipName(cruise));
}

export function findActiveCruise(bookedCruises: any[], today?: string): any | null {
  const normalizedToday = normalizeDateOnly(today ?? getTodayLocal());
  if (!normalizedToday || !Array.isArray(bookedCruises)) return null;
  return (
    bookedCruises.find((cruise) => {
      const start = getStartDate(cruise);
      const end = getEndDate(cruise);
      if (!start || !end) return false;
      const fromStart = daysBetweenDates(start, normalizedToday);
      const toEnd = daysBetweenDates(normalizedToday, end);
      return fromStart !== null && toEnd !== null && fromStart >= 0 && toEnd >= 0;
    }) ?? null
  );
}

export function getCruiseDayNumber(cruise: any, today?: string): number | null {
  const start = getStartDate(cruise);
  const normalizedToday = normalizeDateOnly(today ?? getTodayLocal());
  if (!start || !normalizedToday) return null;
  const diff = daysBetweenDates(start, normalizedToday);
  return diff === null ? null : diff + 1;
}

function getDayTypeForActiveCruise(cruise: any, today: string): CruiseDayType {
  const score = calculateCasinoOpportunityScore(cruise);
  const cruiseDay = getCruiseDayNumber(cruise, today);
  const matchedDay = score.dayBreakdown.find((day) => day.dayNumber === cruiseDay);
  if (matchedDay) return matchedDay.type;
  const end = getEndDate(cruise);
  const totalDays = end && getStartDate(cruise) ? (daysBetweenDates(getStartDate(cruise) as string, end) ?? 0) + 1 : null;
  return classifyCruiseDay({ dayNumber: cruiseDay, label: cruise?.itinerary }, { totalDays, dayNumber: cruiseDay });
}

function availabilityForDayType(dayType: CruiseDayType): CasinoAvailability {
  switch (dayType) {
    case 'sea':
      return 'strong';
    case 'port':
      return 'moderate';
    case 'private-island':
    case 'embarkation':
      return 'limited';
    case 'debarkation':
      return 'closed';
    case 'unknown':
    default:
      return 'unknown';
  }
}

export function getTargetPointsForDay(input: {
  dayType: string;
  userProfile?: any;
  userSettings?: any;
  recentSessions?: any[];
}): number {
  const settings = input.userSettings ?? {};
  const fromSettings = numeric(settings?.targetPointsByDayType?.[input.dayType], NaN);
  if (Number.isFinite(fromSettings) && fromSettings >= 0) return Math.round(fromSettings);

  switch (input.dayType) {
    case 'sea':
      return 300;
    case 'port':
      return 100;
    case 'private-island':
      return 75;
    case 'embarkation':
      return 75;
    case 'debarkation':
    case 'unknown':
    default:
      return 0;
  }
}

export function estimateCoinInForPoints(points: number, coinInPerPoint = 5): number {
  const result = estimateCoinInWithProfile({
    targetPoints: Math.max(0, numeric(points, 0)),
    brand: 'royal',
    gameCategory: coinInPerPoint === 15 ? 'video-poker' : 'reel-slot',
    profile: {
      id: `legacy-best-play-${coinInPerPoint}`,
      brand: 'royal',
      program: 'club-royale',
      mode: 'club-royale-points',
      gameCategory: normalizeGameCategory(coinInPerPoint === 15 ? 'video-poker' : 'reel-slot'),
      coinInPerPoint: numeric(coinInPerPoint, 5) || 5,
      sourceLabel: 'Best Play Today user-configured points profile',
    },
  });
  return Math.round(result.coinIn ?? 0);
}

export function getRecommendedActionForDay(input: {
  dayType: string;
  casinoAvailability: CasinoAvailability;
  userSettings?: any;
}): BestPlayTodayAction {
  if (input.casinoAvailability === 'closed') return 'avoid';
  switch (input.dayType) {
    case 'sea':
      return 'play';
    case 'port':
      return 'light-play';
    case 'private-island':
    case 'embarkation':
      return 'freeplay-only';
    case 'debarkation':
      return 'avoid';
    case 'unknown':
    default:
      return 'unknown';
  }
}

function recommendedSessionLength(action: BestPlayTodayAction): number {
  switch (action) {
    case 'play':
      return 120;
    case 'light-play':
      return 60;
    case 'freeplay-only':
      return 30;
    case 'avoid':
      return 0;
    case 'unknown':
    default:
      return 0;
  }
}

function buildReason(dayType: CruiseDayType, action: BestPlayTodayAction): string {
  if (action === 'unknown') return 'Best Play Today activates during an active sailing with enough itinerary context.';
  if (dayType === 'sea') return 'Sea day gives the best casino availability window.';
  if (dayType === 'port') return 'Port day likely has a smaller evening casino window.';
  if (dayType === 'private-island') return 'Private island day usually limits casino availability; preserve bankroll unless a clear window appears.';
  if (dayType === 'embarkation') return 'Embarkation day is limited; keep play light until the casino schedule is clear.';
  if (dayType === 'debarkation') return 'Debarkation day is not a good casino play day.';
  return 'Casino availability is unclear from the current itinerary data.';
}

export function buildBestPlayTodayPlan(input: {
  activeCruise?: any;
  bookedCruises?: any[];
  sessions?: any[];
  userProfile?: any;
  userSettings?: any;
  machineRecommendations?: any[];
  today?: string;
}): BestPlayTodayPlan {
  const today = normalizeDateOnly(input.today ?? getTodayLocal()) ?? getTodayLocal();
  const activeCruise = input.activeCruise ?? findActiveCruise(input.bookedCruises ?? [], today);
  const coinInPerPoint = numeric(input.userSettings?.coinInPerPoint ?? input.userProfile?.coinInPerPoint, 5) || 5;
  const bankrollCap = numeric(input.userSettings?.bankrollCap ?? input.userProfile?.bankrollCap, 200) || 200;
  const suggestedBetRange = text(input.userSettings?.suggestedBetRange) || '$2.50–$5.00';

  if (!activeCruise) {
    return {
      date: today,
      cruiseDay: null,
      dayType: 'unknown',
      casinoAvailability: 'unknown',
      recommendedAction: 'unknown',
      targetPoints: 0,
      estimatedCoinIn: 0,
      suggestedBankrollCap: bankrollCap,
      suggestedBetRange,
      suggestedSessionLengthMinutes: 0,
      reason: 'Best Play Today activates during an active sailing.',
      warnings: ['No active cruise found for today.'],
    };
  }

  const cruiseDay = getCruiseDayNumber(activeCruise, today);
  const dayType = getDayTypeForActiveCruise(activeCruise, today);
  const casinoAvailability = availabilityForDayType(dayType);
  const recommendedAction = getRecommendedActionForDay({ dayType, casinoAvailability, userSettings: input.userSettings });
  const targetPoints = getTargetPointsForDay({
    dayType,
    userProfile: input.userProfile,
    userSettings: input.userSettings,
    recentSessions: input.sessions,
  });
  const warnings = calculateCasinoOpportunityScore(activeCruise).warnings;
  const recommendedMachines = (input.machineRecommendations ?? [])
    .map((machine) => text(machine?.name || machine?.machineName || machine?.title))
    .filter(Boolean)
    .slice(0, 5);

  return {
    cruiseId: getCruiseId(activeCruise),
    cruiseName: getCruiseName(activeCruise),
    shipName: getShipName(activeCruise),
    date: today,
    cruiseDay,
    dayType,
    casinoAvailability,
    recommendedAction,
    targetPoints,
    estimatedCoinIn: estimateCoinInForPoints(targetPoints, coinInPerPoint),
    suggestedBankrollCap: bankrollCap,
    suggestedBetRange,
    suggestedSessionLengthMinutes: recommendedSessionLength(recommendedAction),
    reason: buildReason(dayType, recommendedAction),
    warnings,
    recommendedMachines: recommendedMachines.length ? recommendedMachines : undefined,
  };
}

export function estimateCasinoHoursForToday(activeCruise: any, today?: string): number | null {
  const normalizedToday = normalizeDateOnly(today ?? getTodayLocal()) ?? getTodayLocal();
  const dayType = getDayTypeForActiveCruise(activeCruise, normalizedToday);
  return estimateCasinoHoursForDay(dayType, undefined, activeCruise);
}
