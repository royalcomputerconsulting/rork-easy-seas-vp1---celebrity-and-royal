import { addDays, daysBetweenDates, normalizeDateOnly } from '../dates/appDate';

export type CasinoOpportunityLabel = 'excellent' | 'strong' | 'good' | 'limited' | 'poor' | 'unknown';

export type CruiseDayType =
  | 'embarkation'
  | 'sea'
  | 'port'
  | 'private-island'
  | 'debarkation'
  | 'unknown';

export type CasinoOpportunityDayBreakdown = {
  date?: string;
  dayNumber: number;
  type: CruiseDayType;
  label?: string;
  estimatedCasinoHours: number | null;
  reasons: string[];
  warnings: string[];
};

export type CasinoOpportunityScore = {
  cruiseId?: string;
  score: number | null;
  label: CasinoOpportunityLabel;
  casinoOpenDayCount: number;
  estimatedCasinoHours: number | null;
  seaDayCount: number;
  portDayCount: number;
  privateIslandDayCount: number;
  restrictedDayCount: number;
  unknownDayCount: number;
  reasons: string[];
  warnings: string[];
  dayBreakdown: CasinoOpportunityDayBreakdown[];
};

type NormalizedItineraryDay = {
  date?: string;
  dayNumber: number;
  label?: string;
  portName?: string;
  arriveTime?: string;
  departTime?: string;
};

const INCOMPLETE_ITINERARY_WARNING =
  'Casino score estimated from sailing length and itinerary label. Exact port-day data is incomplete.';

const PRIVATE_ISLAND_KEYWORDS = ['perfect day at cococay', 'cococay', 'labadee', 'hideaway beach', 'private island'];
const SEA_DAY_KEYWORDS = ['sea day', 'cruising', 'at sea', 'marine zone', 'western atlantic', 'northwest bahamas marine zone'];
const US_RESTRICTION_KEYWORDS = [
  'los angeles',
  'cape liberty',
  'bayonne',
  'port canaveral',
  'miami',
  'fort lauderdale',
  'tampa',
  'galveston',
  'seattle',
  'san juan',
  'honolulu',
];

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function lowerText(value: unknown): string {
  return text(value).toLowerCase();
}

function includesAny(value: string, keywords: string[]): boolean {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function getCruiseId(cruise: any): string | undefined {
  return text(cruise?.id || cruise?.cruiseId || cruise?.reservationNumber || cruise?.reservationId) || undefined;
}

function getShipName(cruise: any): string {
  return text(cruise?.shipName || cruise?.ship || cruise?.ship_name || cruise?.vesselName);
}

function getItineraryLabel(cruise: any): string {
  return text(cruise?.itinerary || cruise?.itineraryName || cruise?.title || cruise?.destination || cruise?.description);
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
  const nights = Number(cruise?.nights ?? cruise?.durationNights ?? cruise?.length ?? cruise?.nightCount);
  if (start && Number.isFinite(nights) && nights > 0) return addDays(start, nights);
  return null;
}

function normalizeDay(rawDay: any, index: number): NormalizedItineraryDay {
  const dayNumber = Number(rawDay?.dayNumber ?? rawDay?.day ?? rawDay?.sequence ?? index + 1) || index + 1;
  const label = text(
    rawDay?.label || rawDay?.title || rawDay?.portName || rawDay?.port || rawDay?.location || rawDay?.name || rawDay?.description
  );
  return {
    date: normalizeDateOnly(rawDay?.date || rawDay?.arrivalDate || rawDay?.startDate) || undefined,
    dayNumber,
    label,
    portName: text(rawDay?.portName || rawDay?.port || rawDay?.location || rawDay?.name) || undefined,
    arriveTime: text(rawDay?.arriveTime || rawDay?.arrivalTime || rawDay?.arrives) || undefined,
    departTime: text(rawDay?.departTime || rawDay?.departureTime || rawDay?.departs) || undefined,
  };
}

function getKnownStarItinerary(cruise: any): NormalizedItineraryDay[] | null {
  const ship = lowerText(getShipName(cruise));
  const start = getStartDate(cruise);
  if (!ship.includes('star of the seas') || start !== '2026-07-05') return null;
  return [
    { dayNumber: 1, date: '2026-07-05', label: 'Port Canaveral' },
    { dayNumber: 2, date: '2026-07-06', label: 'Perfect Day at CocoCay' },
    { dayNumber: 3, date: '2026-07-07', label: 'Northwest Bahamas marine zone' },
    { dayNumber: 4, date: '2026-07-08', label: 'Charlotte Amalie, St. Thomas' },
    { dayNumber: 5, date: '2026-07-09', label: 'Basseterre, St. Kitts & Nevis' },
    { dayNumber: 6, date: '2026-07-10', label: 'Western Atlantic marine zone' },
    { dayNumber: 7, date: '2026-07-11', label: 'Western Atlantic marine zone' },
    { dayNumber: 8, date: '2026-07-12', label: 'Port Canaveral' },
  ];
}

function getRawItineraryDays(cruise: any): any[] {
  const candidates = [
    cruise?.itineraryDays,
    cruise?.dayByDayItinerary,
    cruise?.itineraryDetails,
    cruise?.ports,
    cruise?.portSchedule,
    cruise?.portEntries,
    cruise?.stops,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

function getTrustedItineraryDays(cruise: any): NormalizedItineraryDay[] {
  const known = getKnownStarItinerary(cruise);
  if (known) return known;
  return getRawItineraryDays(cruise).map(normalizeDay).filter((day) => Boolean(day.label || day.portName || day.date));
}

export function hasTrustedItineraryData(cruise: any): boolean {
  return getTrustedItineraryDays(cruise).length > 0;
}

export function classifyCruiseDay(day: any, context?: any): CruiseDayType {
  const dayNumber = Number(day?.dayNumber ?? day?.day ?? context?.dayNumber) || null;
  const totalDays = Number(context?.totalDays ?? context?.dayCount) || null;
  const label = lowerText(
    day?.label || day?.title || day?.portName || day?.port || day?.location || day?.name || day?.description
  );

  if (dayNumber === 1) return 'embarkation';
  if (totalDays && dayNumber === totalDays) return 'debarkation';
  if (includesAny(label, PRIVATE_ISLAND_KEYWORDS)) return 'private-island';
  if (includesAny(label, SEA_DAY_KEYWORDS)) return 'sea';
  if (!label) return 'unknown';
  return 'port';
}

export function estimateCasinoHoursForDay(dayType: CruiseDayType, day?: any, cruise?: any): number | null {
  switch (dayType) {
    case 'sea':
      return 14;
    case 'port': {
      const depart = lowerText(day?.departTime || day?.departureTime || day?.departs);
      if (/([8-9]|1[0-1])(?::\d{2})?\s*pm/.test(depart) || /2[0-3]:\d{2}/.test(depart)) return 5;
      return 3;
    }
    case 'private-island':
      return 2;
    case 'embarkation':
      return 4;
    case 'debarkation':
      return 0;
    case 'unknown':
    default:
      return null;
  }
}

export function getCasinoOpportunityLabel(score: number | null): CasinoOpportunityLabel {
  if (score === null || !Number.isFinite(score)) return 'unknown';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'limited';
  return 'poor';
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getCruiseNightCount(cruise: any, trustedDays: NormalizedItineraryDay[]): number | null {
  const explicit = Number(cruise?.nights ?? cruise?.durationNights ?? cruise?.length ?? cruise?.nightCount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const start = getStartDate(cruise);
  const end = getEndDate(cruise);
  if (start && end) return daysBetweenDates(start, end);
  if (trustedDays.length > 1) return trustedDays.length - 1;
  return null;
}

export function calculateCasinoOpportunityScore(cruise: any, userSettings?: any): CasinoOpportunityScore {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const trustedDays = getTrustedItineraryDays(cruise);
  const trusted = trustedDays.length > 0;
  const nights = getCruiseNightCount(cruise, trustedDays);
  const totalDays = trustedDays.length || (nights ? nights + 1 : 0);

  if (!cruise) {
    return {
      score: null,
      label: 'unknown',
      casinoOpenDayCount: 0,
      estimatedCasinoHours: null,
      seaDayCount: 0,
      portDayCount: 0,
      privateIslandDayCount: 0,
      restrictedDayCount: 0,
      unknownDayCount: 0,
      reasons: [],
      warnings: ['No cruise data provided.'],
      dayBreakdown: [],
    };
  }

  if (!trusted) warnings.push(INCOMPLETE_ITINERARY_WARNING);

  const daysToScore: NormalizedItineraryDay[] = trusted
    ? trustedDays
    : Array.from({ length: totalDays || 0 }, (_, index) => ({ dayNumber: index + 1, label: getItineraryLabel(cruise) }));

  const dayBreakdown = daysToScore.map((day, index) => {
    const dayNumber = day.dayNumber || index + 1;
    const type = trusted
      ? classifyCruiseDay(day, { totalDays: daysToScore.length, dayNumber })
      : dayNumber === 1
        ? 'embarkation'
        : daysToScore.length && dayNumber === daysToScore.length
          ? 'debarkation'
          : 'unknown';
    const estimatedCasinoHours = estimateCasinoHoursForDay(type, day, cruise);
    const dayWarnings: string[] = [];
    const dayReasons: string[] = [];
    const label = day.label || day.portName;

    if (!trusted) dayWarnings.push('Exact day-level itinerary data is incomplete.');
    if (type === 'sea') dayReasons.push('Sea or marine-zone day gives the strongest casino window.');
    if (type === 'private-island') dayReasons.push('Private island day usually restricts casino availability.');
    if (type === 'embarkation' || type === 'debarkation') dayReasons.push('Embarkation/debarkation has limited casino time.');
    if (type === 'port' && includesAny(label || '', US_RESTRICTION_KEYWORDS)) {
      dayReasons.push('Likely U.S. port restriction day.');
    }
    if (trusted && type === 'port' && !day.arriveTime && !day.departTime) {
      dayWarnings.push('Port times are missing, so the casino window is estimated.');
    }

    return {
      date: day.date,
      dayNumber,
      type,
      label,
      estimatedCasinoHours,
      reasons: dayReasons,
      warnings: dayWarnings,
    } as CasinoOpportunityDayBreakdown;
  });

  const seaDayCount = dayBreakdown.filter((day) => day.type === 'sea').length;
  const portDayCount = dayBreakdown.filter((day) => day.type === 'port').length;
  const privateIslandDayCount = dayBreakdown.filter((day) => day.type === 'private-island').length;
  const usRestrictionDayCount = dayBreakdown.filter((day) => day.reasons.some((reason) => reason.includes('U.S. port restriction'))).length;
  const missingPortTimeDayCount = dayBreakdown.filter((day) => day.warnings.some((warning) => warning.includes('Port times are missing'))).length;
  const restrictedDayCount = dayBreakdown.filter(
    (day) => day.type === 'embarkation' || day.type === 'debarkation' || day.reasons.some((reason) => reason.includes('restriction'))
  ).length;
  const unknownDayCount = dayBreakdown.filter((day) => day.type === 'unknown').length;
  const casinoOpenDayCount = dayBreakdown.filter((day) => (day.estimatedCasinoHours ?? 0) > 0).length;
  const estimatedHoursValues = dayBreakdown.map((day) => day.estimatedCasinoHours).filter((value): value is number => typeof value === 'number');
  const estimatedCasinoHours = estimatedHoursValues.length ? estimatedHoursValues.reduce((sum, value) => sum + value, 0) : null;

  if (!trusted && !nights) {
    return {
      cruiseId: getCruiseId(cruise),
      score: null,
      label: 'unknown',
      casinoOpenDayCount,
      estimatedCasinoHours,
      seaDayCount,
      portDayCount,
      privateIslandDayCount,
      restrictedDayCount,
      unknownDayCount,
      reasons,
      warnings,
      dayBreakdown,
    };
  }

  let score = 50;
  score += seaDayCount * 10;
  if (nights && nights >= 7) {
    score += 5;
    reasons.push('Sailing is 7 nights or longer.');
  }
  const itineraryText = lowerText(`${getItineraryLabel(cruise)} ${getShipName(cruise)}`);
  if (itineraryText.includes('transatlantic') || itineraryText.includes('reposition') || itineraryText.includes('pacific coastal')) {
    score += 5;
    reasons.push('Repositioning/transatlantic-style itinerary can create strong casino windows.');
  }
  if (seaDayCount + casinoOpenDayCount >= 4) {
    score += 5;
    reasons.push('Multiple casino-friendly days are available.');
  }
  const latePortDays = dayBreakdown.filter((day) => day.type === 'port' && (day.estimatedCasinoHours ?? 0) >= 5).length;
  score += latePortDays * 5;

  score -= privateIslandDayCount * 10;
  score -= unknownDayCount * 10;
  score -= usRestrictionDayCount * 5;
  if (missingPortTimeDayCount > 0) {
    score -= 5;
    warnings.push('One or more port days are missing arrival/departure times; casino windows are estimated.');
  }
  if (!trusted) score -= 10;
  if (nights && nights <= 3) {
    score -= 20;
    reasons.push('Short cruise has limited casino time.');
  }

  const finalScore = clampScore(score);
  if (seaDayCount > 0) reasons.push(`${seaDayCount} sea/marine-zone day${seaDayCount === 1 ? '' : 's'} improve the casino opportunity.`);
  if (privateIslandDayCount > 0) reasons.push(`${privateIslandDayCount} private-island day${privateIslandDayCount === 1 ? '' : 's'} reduce the casino window.`);
  if (usRestrictionDayCount > 0) reasons.push(`${usRestrictionDayCount} likely U.S.-restriction day${usRestrictionDayCount === 1 ? '' : 's'} reduce casino availability.`);
  if (missingPortTimeDayCount > 0) reasons.push('Missing port times reduce score confidence.');
  if (unknownDayCount > 0) reasons.push(`${unknownDayCount} day${unknownDayCount === 1 ? '' : 's'} could not be classified from trusted data.`);

  return {
    cruiseId: getCruiseId(cruise),
    score: finalScore,
    label: getCasinoOpportunityLabel(finalScore),
    casinoOpenDayCount,
    estimatedCasinoHours,
    seaDayCount,
    portDayCount,
    privateIslandDayCount,
    restrictedDayCount,
    unknownDayCount,
    reasons,
    warnings,
    dayBreakdown,
  };
}

export const CASINO_OPPORTUNITY_INCOMPLETE_ITINERARY_WARNING = INCOMPLETE_ITINERARY_WARNING;
