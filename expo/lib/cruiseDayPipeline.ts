import type { ItineraryDay } from '@/types/models';
import { toCalendarDateOnly, toTimeZoneCalendarDateOnly } from './date';

export type CruiseDayIntegrity = 'verified' | 'partial' | 'conflict' | 'unknown';
export type CruiseDaySource = 'provider' | 'public_document' | 'verified_local' | 'enriched' | 'user_entered' | 'derived' | 'unknown';

export interface CruiseDayPipelineInput {
  shipName?: string | null;
  sailDate?: string | null;
  returnDate?: string | null;
  nights?: number | null;
  departurePort?: string | null;
  destination?: string | null;
  itineraryName?: string | null;
  ports?: string[] | null;
  itinerary?: ItineraryDay[] | null;
  timeZone?: string | null;
}

export interface CanonicalCruiseDay extends ItineraryDay {
  date: string;
  source: CruiseDaySource;
}

export interface CruiseDayPlan {
  sailDate: string;
  returnDate: string;
  days: CanonicalCruiseDay[];
  integrity: CruiseDayIntegrity;
  issues: string[];
  returnDateSource: CruiseDaySource;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toCruiseDateOnly(value?: string | null): string | undefined {
  return toCalendarDateOnly(value);
}

export function addCruiseDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function differenceInDays(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function isSupportedNightCount(value?: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 60;
}

function isExplicitSeaDay(day: ItineraryDay | undefined): boolean {
  return day?.isSeaDay === true || /^at sea$/i.test(day?.port?.trim() ?? '');
}

function cleanRouteText(value?: string | null): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeRouteText(value?: string | null): string {
  return cleanRouteText(value).toLowerCase();
}

function itineraryDayHasUsableLocation(day: ItineraryDay): boolean {
  const port = cleanRouteText(day.port);
  return Boolean(port || day.latitude || day.longitude || isExplicitSeaDay(day));
}

function derivedItineraryDay(day: number, port: string, isSeaDay = false, notes?: string): ItineraryDay {
  return {
    day,
    port,
    isSeaDay,
    notes,
    source: 'derived',
    dataConfidence: 'partial',
  };
}

function buildPortListFallback(input: CruiseDayPipelineInput, duration: number): ItineraryDay[] {
  const rawPorts = (input.ports ?? [])
    .map(cleanRouteText)
    .filter(Boolean)
    .filter((port) => !/^(caribbean|eastern caribbean|western caribbean|bahamas|perfect day|transatlantic|pacific|atlantic)$/i.test(port));

  if (rawPorts.length < 2) return [];

  const days: ItineraryDay[] = [];
  const finalDay = duration + 1;
  const departurePort = cleanRouteText(input.departurePort) || rawPorts[0];
  for (let day = 1; day <= finalDay; day += 1) {
    const suppliedPort = rawPorts[day - 1];
    if (day === 1) {
      days.push(derivedItineraryDay(day, departurePort, false, 'Derived from imported route summary.'));
    } else if (day === finalDay) {
      days.push(derivedItineraryDay(day, rawPorts[rawPorts.length - 1] || departurePort, false, 'Derived from imported route summary.'));
    } else if (suppliedPort) {
      days.push(derivedItineraryDay(day, suppliedPort, /^at sea/i.test(suppliedPort), 'Derived from imported route summary.'));
    } else {
      days.push(derivedItineraryDay(day, 'At Sea — route position estimated between scheduled ports', true, 'Derived sea-day waypoint used for weather routing.'));
    }
  }

  return days;
}

function buildPortCanaveralBahamasFallback(input: CruiseDayPipelineInput, duration: number): ItineraryDay[] {
  const context = normalizeRouteText([
    input.shipName,
    input.departurePort,
    input.destination,
    input.itineraryName,
    ...(input.ports ?? []),
  ].filter(Boolean).join(' '));

  const departsPortCanaveral = /port canaveral|orlando/.test(context);
  const mentionsBahamas = /bahamas|nassau|cococay|coco cay|perfect day/.test(context);
  if (!departsPortCanaveral || !mentionsBahamas) return [];

  const departurePort = cleanRouteText(input.departurePort) || 'Port Canaveral, Florida';
  const perfectDay = 'Perfect Day at CocoCay, Bahamas';
  const nassau = 'Nassau, Bahamas';

  if (duration === 3) {
    return [
      derivedItineraryDay(1, departurePort, false, 'Derived Port Canaveral Bahamas route.'),
      derivedItineraryDay(2, perfectDay, false, 'Derived Port Canaveral Bahamas route.'),
      derivedItineraryDay(3, 'At Sea — Bahamas to Port Canaveral', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(4, departurePort, false, 'Derived Port Canaveral Bahamas route.'),
    ];
  }

  if (duration === 4) {
    return [
      derivedItineraryDay(1, departurePort, false, 'Derived Port Canaveral Bahamas/Perfect Day route.'),
      derivedItineraryDay(2, nassau, false, 'Derived Port Canaveral Bahamas/Perfect Day route.'),
      derivedItineraryDay(3, perfectDay, false, 'Derived Port Canaveral Bahamas/Perfect Day route.'),
      derivedItineraryDay(4, 'At Sea — Bahamas to Port Canaveral', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(5, departurePort, false, 'Derived Port Canaveral Bahamas/Perfect Day route.'),
    ];
  }

  if (duration === 5) {
    return [
      derivedItineraryDay(1, departurePort, false, 'Derived Harmony/Port Canaveral Bahamas route.'),
      derivedItineraryDay(2, nassau, false, 'Derived Harmony/Port Canaveral Bahamas route.'),
      derivedItineraryDay(3, 'At Sea — off Nassau and Perfect Day at CocoCay', true, 'Derived sea-day waypoint used for weather routing between Nassau and CocoCay.'),
      derivedItineraryDay(4, perfectDay, false, 'Derived Harmony/Port Canaveral Bahamas route.'),
      derivedItineraryDay(5, 'At Sea — Bahamas to Port Canaveral', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(6, departurePort, false, 'Derived Harmony/Port Canaveral Bahamas route.'),
    ];
  }

  if (duration === 7 && /eastern caribbean/.test(context)) {
    return [
      derivedItineraryDay(1, departurePort, false, 'Derived Port Canaveral Eastern Caribbean route.'),
      derivedItineraryDay(2, perfectDay, false, 'Derived Port Canaveral Eastern Caribbean route.'),
      derivedItineraryDay(3, 'At Sea — Bahamas and western Atlantic', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(4, 'Charlotte Amalie, St. Thomas, USVI', false, 'Derived Port Canaveral Eastern Caribbean route.'),
      derivedItineraryDay(5, 'Philipsburg, St. Maarten', false, 'Derived Port Canaveral Eastern Caribbean route.'),
      derivedItineraryDay(6, 'At Sea — northbound western Atlantic', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(7, 'At Sea — offshore Florida/Bahamas approach', true, 'Derived sea-day waypoint used for weather routing.'),
      derivedItineraryDay(8, departurePort, false, 'Derived Port Canaveral Eastern Caribbean route.'),
    ];
  }

  return [];
}

function buildFallbackItinerary(input: CruiseDayPipelineInput, duration: number): ItineraryDay[] {
  if (duration <= 0 || duration > 60) return [];
  const portCanaveralBahamas = buildPortCanaveralBahamasFallback(input, duration);
  if (portCanaveralBahamas.length > 0) return portCanaveralBahamas;
  return buildPortListFallback(input, duration);
}

function normalizeCruiseDaySource(value: unknown): CruiseDaySource {
  switch (value) {
    case 'provider':
    case 'public_document':
    case 'verified_local':
    case 'enriched':
    case 'user_entered':
    case 'derived':
    case 'unknown':
      return value;
    default:
      return 'unknown';
  }
}

export function buildCruiseDayPlan(input: CruiseDayPipelineInput): CruiseDayPlan | null {
  const sailDate = toCruiseDateOnly(input.sailDate);
  if (!sailDate) return null;

  const issues: string[] = [];
  const explicitReturnDate = toCruiseDateOnly(input.returnDate);
  const derivedReturnDate = isSupportedNightCount(input.nights) ? addCruiseDays(sailDate, input.nights) : undefined;
  let returnDate = explicitReturnDate ?? derivedReturnDate ?? sailDate;
  let returnDateSource: CruiseDaySource = explicitReturnDate ? 'provider' : derivedReturnDate ? 'derived' : 'unknown';
  let integrity: CruiseDayIntegrity = explicitReturnDate ? 'verified' : derivedReturnDate ? 'partial' : 'unknown';

  if (explicitReturnDate && explicitReturnDate < sailDate) {
    returnDate = sailDate;
    returnDateSource = 'unknown';
    integrity = 'conflict';
    issues.push('Return date precedes the sailing date.');
  }

  if (explicitReturnDate && derivedReturnDate && explicitReturnDate !== derivedReturnDate) {
    integrity = 'conflict';
    issues.push('Provider return date and stated night count disagree.');
  }

  if (!explicitReturnDate && !derivedReturnDate) {
    issues.push('No verified return date or supported night count is available.');
  }

  const duration = differenceInDays(sailDate, returnDate);
  const itineraryByDay = new Map<number, ItineraryDay>();
  const suppliedItinerary = (input.itinerary ?? []).filter(itineraryDayHasUsableLocation);
  const itinerary = [
    ...suppliedItinerary,
    ...buildFallbackItinerary(input, duration),
  ];
  itinerary.forEach((day) => {
    const datedKey = toCruiseDateOnly(day.date);
    const datedDayNumber = datedKey && datedKey >= sailDate && datedKey <= returnDate
      ? differenceInDays(sailDate, datedKey) + 1
      : undefined;
    const suppliedDayNumber = Number.isInteger(day.day) && day.day >= 1 && day.day <= duration + 1
      ? day.day
      : datedDayNumber;
    if (suppliedDayNumber && !itineraryByDay.has(suppliedDayNumber)) {
      itineraryByDay.set(suppliedDayNumber, day);
    }
  });

  const days: CanonicalCruiseDay[] = [];
  for (let dayNumber = 1; dayNumber <= duration + 1; dayNumber += 1) {
    const suppliedDay = itineraryByDay.get(dayNumber);
    const suppliedPort = suppliedDay?.port?.trim();
    const seaDay = isExplicitSeaDay(suppliedDay);
    days.push({
      day: dayNumber,
      date: addCruiseDays(sailDate, dayNumber - 1),
      port: suppliedPort && !/^at sea$/i.test(suppliedPort) ? suppliedPort : '',
      arrival: suppliedDay?.arrival,
      departure: suppliedDay?.departure,
      isSeaDay: seaDay,
      casinoOpen: suppliedDay?.casinoOpen,
      notes: suppliedDay?.notes,
      source: suppliedDay ? normalizeCruiseDaySource(suppliedDay.source) : returnDateSource === 'derived' ? 'derived' : 'unknown',
      dataConfidence: suppliedDay?.dataConfidence ?? (suppliedDay ? 'partial' : returnDateSource === 'derived' ? 'partial' : 'unknown'),
      latitude: suppliedDay?.latitude,
      longitude: suppliedDay?.longitude,
    });
  }

  return { sailDate, returnDate, days, integrity, issues, returnDateSource };
}

export function getCruiseDayForDate(
  input: CruiseDayPipelineInput,
  targetDate: Date | string,
  timeZone: string | null | undefined = input.timeZone,
): CanonicalCruiseDay | undefined {
  const plan = buildCruiseDayPlan(input);
  if (!plan) return undefined;
  const targetKey = typeof targetDate === 'string'
    ? toCruiseDateOnly(targetDate)
    : timeZone
      ? toTimeZoneCalendarDateOnly(targetDate, timeZone)
      : toCruiseDateOnly(targetDate.toISOString());
  if (!targetKey) return undefined;
  return plan.days.find((day) => day.date === targetKey);
}

export function isWithinForecastWindow(targetDate: Date, horizonDays = 15): boolean {
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${pad2(today.getUTCMonth() + 1)}-${pad2(today.getUTCDate())}`;
  const targetKey = `${targetDate.getUTCFullYear()}-${pad2(targetDate.getUTCMonth() + 1)}-${pad2(targetDate.getUTCDate())}`;
  const maxKey = addCruiseDays(todayKey, horizonDays);
  return targetKey >= todayKey && targetKey <= maxKey;
}
