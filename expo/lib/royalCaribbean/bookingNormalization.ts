import type { BookedCruiseRow, ExtendedLoyaltyData } from './types';

export const ROYAL_SHIP_CODE_MAP: Readonly<Record<string, string>> = Object.freeze({
  AD: 'Adventure of the Seas',
  AL: 'Allure of the Seas',
  AN: 'Anthem of the Seas',
  BR: 'Brilliance of the Seas',
  EN: 'Enchantment of the Seas',
  EX: 'Explorer of the Seas',
  FR: 'Freedom of the Seas',
  GR: 'Grandeur of the Seas',
  HM: 'Harmony of the Seas',
  IC: 'Icon of the Seas',
  ID: 'Independence of the Seas',
  JW: 'Jewel of the Seas',
  LB: 'Liberty of the Seas',
  LE: 'Legend of the Seas',
  MA: 'Mariner of the Seas',
  MJ: 'Majesty of the Seas',
  MR: 'Mariner of the Seas',
  NV: 'Navigator of the Seas',
  OA: 'Oasis of the Seas',
  OV: 'Ovation of the Seas',
  OY: 'Odyssey of the Seas',
  QN: 'Quantum of the Seas',
  RD: 'Radiance of the Seas',
  RH: 'Rhapsody of the Seas',
  SE: 'Serenade of the Seas',
  SG: 'Star of the Seas',
  SP: 'Spectrum of the Seas',
  ST: 'Star of the Seas',
  SY: 'Symphony of the Seas',
  UT: 'Utopia of the Seas',
  VI: 'Vision of the Seas',
  VY: 'Voyager of the Seas',
  WN: 'Wonder of the Seas',
});

const STATEROOM_CLASS_MAP: Readonly<Record<string, string>> = Object.freeze({
  I: 'Interior',
  O: 'Ocean View',
  B: 'Balcony',
  S: 'Suite',
});

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function firstValue(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function firstString(record: UnknownRecord, keys: string[]): string {
  const value = firstValue(record, keys);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstPositiveInteger(record: UnknownRecord, keys: string[]): number | undefined {
  const raw = firstValue(record, keys);
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : undefined;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeRoyalCalendarDate(value: unknown): string {
  const input = String(value ?? '').trim();
  if (!input) return '';

  let match = input.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return isValidCalendarDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : '';
  }

  match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return isValidCalendarDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : '';
  }

  match = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    return isValidCalendarDate(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : '';
  }

  return '';
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addRoyalCalendarDays(dateValue: unknown, days: number | undefined): string {
  const normalized = normalizeRoyalCalendarDate(dateValue);
  if (!normalized || !Number.isFinite(days) || !days || days < 1 || days > 365) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function todayToCalendarDate(today?: Date | string): string {
  if (typeof today === 'string') return normalizeRoyalCalendarDate(today);
  const date = today instanceof Date ? today : new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export interface ResolveRoyalCruiseStatusInput {
  sailDate: unknown;
  endDate?: unknown;
  nights?: number;
  bookingStatus?: unknown;
  forceCompleted?: boolean;
  completePastStartWhenEndUnknown?: boolean;
  today?: Date | string;
}

export function resolveRoyalCruiseStatus(input: ResolveRoyalCruiseStatusInput): string {
  const statusRaw = String(input.bookingStatus ?? '').trim();
  const statusCode = statusRaw.toUpperCase();
  const statusText = statusRaw.toLowerCase().replace(/[\s_-]+/g, ' ');

  if (input.forceCompleted || statusText === 'past' || statusText === 'completed') return 'Completed';
  if (statusCode === 'OF' || statusText === 'hold' || statusText === 'courtesy hold') return 'Courtesy Hold';
  if (statusCode === 'CX' || statusCode === 'XX' || statusText === 'cancelled' || statusText === 'canceled') return 'Cancelled';

  const startDate = normalizeRoyalCalendarDate(input.sailDate);
  const explicitEndDate = normalizeRoyalCalendarDate(input.endDate);
  const endDate = explicitEndDate || addRoyalCalendarDays(startDate, input.nights);
  const today = todayToCalendarDate(input.today);

  // A trip is not completed merely because embarkation has passed. It remains
  // active through its inclusive return date.
  if (endDate && today && endDate < today) return 'Completed';
  if (!endDate && startDate && today && input.completePastStartWhenEndUnknown && startDate < today) return 'Completed';
  if (startDate && endDate && today >= startDate && today <= endDate) return 'In Progress';
  return 'Upcoming';
}

function resolveShipName(record: UnknownRecord): { shipCode: string; shipName: string } {
  const nestedShip = asRecord(record.ship);
  const shipCode = (firstString(record, ['shipCode', 'vesselCode']) || firstString(nestedShip, ['code'])).toUpperCase();
  const explicitName = firstString(record, ['shipName', 'shipDescription', 'vesselName']) || firstString(nestedShip, ['name']);
  return {
    shipCode,
    shipName: explicitName || ROYAL_SHIP_CODE_MAP[shipCode] || (shipCode ? `${shipCode} of the Seas` : ''),
  };
}

function extractHistorySailings(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (Array.isArray(record.sailings)) return record.sailings;
  const payload = asRecord(record.payload);
  if (Array.isArray(payload.sailings)) return payload.sailings;
  const data = asRecord(record.data);
  if (Array.isArray(data.sailings)) return data.sailings;
  return [];
}

export interface RoyalHistoryParseResult {
  rows: BookedCruiseRow[];
  discovered: number;
  rejected: number;
  duplicates: number;
}

export function parseRoyalLoyaltyHistorySailings(value: unknown): RoyalHistoryParseResult {
  const sailings = extractHistorySailings(value);
  const rows: BookedCruiseRow[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;

  sailings.forEach((item) => {
    const record = asRecord(item);
    const { shipCode, shipName } = resolveShipName(record);
    const startDate = normalizeRoyalCalendarDate(firstValue(record, ['sailingDate', 'sailDate', 'departureDate', 'startDate']));
    const nights = firstPositiveInteger(record, ['itineraryNightsQuantity', 'numberOfNights', 'duration', 'nights']);
    const endDate = normalizeRoyalCalendarDate(firstValue(record, ['returnDate', 'endDate', 'sailingEndDate'])) || addRoyalCalendarDays(startDate, nights);
    const bookingId = firstString(record, ['bookingId', 'confirmationNumber', 'reservationNumber', 'reservationId']);
    const cabinNumber = firstString(record, ['cabinNumber', 'stateroomNumber']);

    if (!shipName || !startDate || !endDate || !nights) {
      rejected += 1;
      return;
    }

    const identity = bookingId
      ? `booking:${bookingId.toLowerCase()}|${startDate}`
      : `voyage:${shipName.toLowerCase()}|${startDate}|${cabinNumber.toLowerCase()}`;
    if (seen.has(identity)) {
      duplicates += 1;
      return;
    }
    seen.add(identity);

    const cabinClassCode = firstString(record, ['cabinClassCode', 'stateroomClassCode']).toUpperCase();
    const cabinClassDescription = firstString(record, ['cabinClassDescription', 'stateroomDescription']);
    const cabinType = STATEROOM_CLASS_MAP[cabinClassCode] || cabinClassDescription || firstString(record, ['cabinType', 'stateroomType']);
    const itinerary = firstString(record, ['itineraryDescription', 'itineraryName', 'itinerary', 'destinationDescription']);
    const departurePort = firstString(record, ['originPortDescription', 'departurePortDescription', 'departurePort', 'homePort']);
    const arrivalPort = firstString(record, ['destinationPortDescription', 'arrivalPortDescription', 'arrivalPort']);
    const loyaltyPoints = firstString(record, ['points', 'loyaltyPoints']);

    rows.push({
      rawBooking: item,
      sourcePage: 'Completed',
      shipName,
      shipCode: shipCode || undefined,
      cruiseTitle: itinerary || `${nights} Night Cruise`,
      sailingStartDate: startDate,
      sailingEndDate: endDate,
      sailingDates: startDate,
      itinerary,
      departurePort,
      arrivalPort: arrivalPort || undefined,
      cabinType,
      cabinCategory: firstString(record, ['cabinCategory', 'stateroomCategoryCode', 'cabinTypeCode']) || undefined,
      cabinNumberOrGTY: cabinNumber || (firstString(record, ['cabinTypeCode']).toUpperCase() === 'GTY' ? 'GTY' : ''),
      bookingId,
      numberOfGuests: firstString(record, ['numberOfGuests', 'guestCount']) || undefined,
      numberOfNights: nights,
      status: 'Completed',
      loyaltyLevel: '',
      loyaltyPoints,
      bookingStatus: firstString(record, ['bookingStatus', 'statusCode', 'status']) || 'Completed',
      stateroomNumber: cabinNumber || undefined,
      stateroomCategoryCode: firstString(record, ['cabinCategory', 'stateroomCategoryCode', 'cabinTypeCode']) || undefined,
      stateroomType: cabinType || undefined,
      passengerId: firstString(record, ['passengerId']) || undefined,
    });
  });

  return { rows, discovered: sailings.length, rejected, duplicates };
}

export function hasMeaningfulExtendedLoyaltyData(value: ExtendedLoyaltyData | null | undefined): boolean {
  if (!value) return false;
  return Boolean(
    value.crownAndAnchorId?.trim() ||
    value.crownAndAnchorTier?.trim() ||
    value.crownAndAnchorLevel?.trim() ||
    value.crownAndAnchorPointsFromApi !== undefined ||
    value.clubRoyaleTierFromApi?.trim() ||
    value.clubRoyalePointsFromApi !== undefined ||
    value.captainsClubId?.trim() ||
    value.captainsClubTier?.trim() ||
    value.captainsClubPoints !== undefined ||
    value.celebrityBlueChipTier?.trim() ||
    value.celebrityBlueChipPoints !== undefined ||
    value.venetianSocietyMemberNumber?.trim() ||
    value.venetianSocietyTier?.trim()
  );
}

export function isRoyalLoyaltyHistoryPayload(value: unknown): boolean {
  return extractHistorySailings(value).length > 0;
}
