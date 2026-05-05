import { BookedCruiseRow } from './types';

export interface ParsedTripPayloadResult {
  rawRows: Record<string, unknown>[];
  rows: BookedCruiseRow[];
  skippedPlaceholderRows: number;
  isPastTripsPayload: boolean;
  expectedTotal?: number;
}

interface ParseTripPayloadOptions {
  endpoint: string;
  url?: string;
  forceCompleted?: boolean;
  isCarnival?: boolean;
  now?: Date;
}

const ROYAL_SHIP_CODE_MAP: Record<string, string> = {
  AL: 'Allure of the Seas',
  AN: 'Anthem of the Seas',
  AD: 'Adventure of the Seas',
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
  SP: 'Spectrum of the Seas',
  ST: 'Star of the Seas',
  SG: 'Star of the Seas',
  SN: 'Star of the Seas',
  SY: 'Symphony of the Seas',
  UT: 'Utopia of the Seas',
  VI: 'Vision of the Seas',
  VY: 'Voyager of the Seas',
  WN: 'Wonder of the Seas',
};

const CARNIVAL_SHIP_CODE_MAP: Record<string, string> = {
  BR: 'Carnival Breeze',
  CL: 'Carnival Celebration',
  CQ: 'Carnival Conquest',
  DR: 'Carnival Dream',
  EL: 'Carnival Elation',
  FI: 'Carnival Firenze',
  CF: 'Carnival Freedom',
  GL: 'Carnival Glory',
  HZ: 'Carnival Horizon',
  JB: 'Carnival Jubilee',
  LE: 'Carnival Legend',
  LI: 'Carnival Liberty',
  LU: 'Carnival Luminosa',
  MG: 'Carnival Magic',
  MG2: 'Mardi Gras',
  MI: 'Carnival Miracle',
  PO: 'Carnival Panorama',
  PA: 'Carnival Paradise',
  PR: 'Carnival Pride',
  RA: 'Carnival Radiance',
  SP: 'Carnival Spirit',
  SL: 'Carnival Splendor',
  SS: 'Carnival Sunshine',
  VL: 'Carnival Valor',
  VE: 'Carnival Venice',
  VI: 'Carnival Vista',
};

const STATEROOM_TYPE_MAP: Record<string, string> = {
  I: 'Interior',
  O: 'Ocean View',
  B: 'Balcony',
  S: 'Suite',
};

const TRIP_ARRAY_KEYS = [
  'pastCruises',
  'pastTrips',
  'completedCruises',
  'completedTrips',
  'previousTrips',
  'cruiseHistory',
  'history',
  'past',
  'trips',
  'reservations',
  'bookings',
  'profileBookings',
  'sailingInfo',
  'upcomingTrips',
  'upcomingCruises',
  'items',
  'results',
  'cards',
  'tripCards',
  'bookingCards',
  'cruises',
];

const CONTAINER_KEYS = ['payload', 'data', 'result', 'response', 'myTrips', 'trips', 'content', 'props', 'pageProps'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function getPathValue(record: Record<string, unknown>, paths: string[][]): unknown {
  for (const path of paths) {
    let current: unknown = record;
    for (const segment of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[segment];
    }
    if (current !== undefined && current !== null && stringifyValue(current) !== '') {
      return current;
    }
  }
  return undefined;
}

function getString(record: Record<string, unknown>, paths: string[][]): string {
  return stringifyValue(getPathValue(record, paths));
}

function extractVoyageCode(value: string): string {
  const match = value.trim().toUpperCase().match(/[A-Z]{2}\d{8}/);
  return match?.[0] ?? '';
}

function extractShipCodeFromVoyage(value: string): string {
  const voyageCode = extractVoyageCode(value);
  return voyageCode ? voyageCode.slice(0, 2) : '';
}

function extractDateFromVoyage(value: string): string {
  const voyageCode = extractVoyageCode(value);
  return voyageCode ? voyageCode.slice(2) : '';
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const parsedCompact = new Date(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]), 12);
    return Number.isNaN(parsedCompact.getTime()) ? null : parsedCompact;
  }
  const parsed = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateNights(startValue: string, endValue: string): number | undefined {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end) return undefined;
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 && diff <= 365 ? diff : undefined;
}

function extractNights(record: Record<string, unknown>, startValue: string, endValue: string): number | undefined {
  const explicit = getString(record, [
    ['numberOfNights'],
    ['duration'],
    ['numNights'],
    ['nights'],
    ['cruiseNights'],
    ['totalNights'],
    ['sailingNights'],
    ['voyage', 'duration'],
    ['sailing', 'duration'],
    ['itinerary', 'totalNights'],
  ]);
  const parsedExplicit = Number.parseInt(explicit, 10);
  if (Number.isFinite(parsedExplicit) && parsedExplicit > 0 && parsedExplicit <= 365) {
    return parsedExplicit;
  }

  const calculated = calculateNights(startValue, endValue);
  if (calculated !== undefined) return calculated;

  const text = [
    getString(record, [['cruiseTitle'], ['title'], ['name'], ['itinerary'], ['destination'], ['cruiseName'], ['itineraryName']]),
  ].join(' ');
  const match = text.match(/(\d{1,3})\s*(night|nights|nt)/i);
  if (match) {
    const parsedText = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsedText) && parsedText > 0 && parsedText <= 365) {
      return parsedText;
    }
  }

  return undefined;
}

function scoreTripRecord(record: Record<string, unknown>): number {
  let score = 0;
  const bookingId = getString(record, [['bookingId'], ['confirmationNumber'], ['reservationId'], ['reservationNumber'], ['id'], ['booking', 'id']]);
  const shipName = getString(record, [['shipName'], ['ship', 'name'], ['vesselName'], ['vessel', 'name']]);
  const shipCode = getString(record, [['shipCode'], ['ship', 'code'], ['vesselCode'], ['voyageCode'], ['voyageId'], ['sailingId'], ['code']]);
  const startDate = getString(record, [['sailDate'], ['departureDate'], ['startDate'], ['sailingStartDate'], ['start'], ['embarkDate'], ['embarkationDate'], ['departure', 'date'], ['voyage', 'sailDate'], ['sailing', 'sailDate']]);
  const endDate = getString(record, [['endDate'], ['returnDate'], ['sailingEndDate'], ['debarkDate'], ['debarkationDate'], ['arrivalDate'], ['arrival', 'date'], ['voyage', 'endDate'], ['sailing', 'endDate']]);
  const nights = getString(record, [['numberOfNights'], ['duration'], ['numNights'], ['nights'], ['cruiseNights'], ['totalNights']]);

  if (bookingId) score += 3;
  if (shipName) score += 2;
  if (shipCode || extractShipCodeFromVoyage(shipCode)) score += 2;
  if (startDate || extractDateFromVoyage(shipCode)) score += 3;
  if (endDate) score += 1;
  if (nights) score += 1;

  return score;
}

function looksLikeTripRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return scoreTripRecord(value) >= 4;
}

function uniqueRawRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];
  for (const row of rows) {
    const identity = [
      getString(row, [['bookingId'], ['confirmationNumber'], ['reservationId'], ['reservationNumber'], ['id']]),
      getString(row, [['shipName'], ['ship', 'name']]),
      getString(row, [['shipCode'], ['ship', 'code'], ['voyageCode'], ['sailingId'], ['code']]),
      getString(row, [['sailDate'], ['departureDate'], ['startDate'], ['sailingStartDate'], ['embarkationDate']]),
      getString(row, [['stateroomNumber'], ['cabinNumber'], ['stateroom', 'number']]),
    ].join('|');
    const key = identity.replace(/\|/g, '').trim() || JSON.stringify(row).slice(0, 240);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function collectTripRows(value: unknown, depth: number = 0, seenObjects: WeakSet<object> = new WeakSet<object>()): Record<string, unknown>[] {
  if (depth > 8 || value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    const directRows = value.filter(looksLikeTripRecord);
    const nestedRows = value.flatMap((item) => collectTripRows(item, depth + 1, seenObjects));
    return uniqueRawRows(nestedRows.length > directRows.length ? nestedRows : directRows);
  }

  if (!isRecord(value)) return [];
  if (seenObjects.has(value)) return [];
  seenObjects.add(value);

  const preferredRows: Record<string, unknown>[] = [];
  for (const key of TRIP_ARRAY_KEYS) {
    if (value[key] !== undefined) {
      preferredRows.push(...collectTripRows(value[key], depth + 1, seenObjects));
    }
  }
  if (preferredRows.length > 0) {
    return uniqueRawRows(preferredRows);
  }

  const containerRows: Record<string, unknown>[] = [];
  for (const key of CONTAINER_KEYS) {
    if (value[key] !== undefined) {
      containerRows.push(...collectTripRows(value[key], depth + 1, seenObjects));
    }
  }
  if (containerRows.length > 0) {
    return uniqueRawRows(containerRows);
  }

  const nestedRows: Record<string, unknown>[] = [];
  for (const child of Object.values(value)) {
    if (Array.isArray(child) || isRecord(child)) {
      nestedRows.push(...collectTripRows(child, depth + 1, seenObjects));
    }
  }
  return uniqueRawRows(nestedRows);
}

function extractExpectedTotal(value: unknown, depth: number = 0): number | undefined {
  if (depth > 5 || !isRecord(value)) return undefined;
  const keys = ['pastCount', 'pastTripCount', 'pastTripsCount', 'completedTripCount', 'completedTripsCount', 'totalTrips', 'totalCount', 'count'];
  for (const key of keys) {
    const raw = value[key];
    const numeric = typeof raw === 'number' ? raw : Number.parseInt(stringifyValue(raw).replace(/,/g, ''), 10);
    if (Number.isFinite(numeric) && numeric > 0 && numeric < 10000) {
      return numeric;
    }
  }
  for (const child of Object.values(value)) {
    if (isRecord(child)) {
      const nested = extractExpectedTotal(child, depth + 1);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function determineIsPastPayload(endpoint: string, url: string | undefined, forceCompleted: boolean | undefined): boolean {
  const lowerUrl = (url ?? '').toLowerCase();
  return Boolean(
    forceCompleted ||
      endpoint === 'pastTrips' ||
      lowerUrl.includes('/myaccount/my-trips') ||
      lowerUrl.includes('past') ||
      lowerUrl.includes('previous') ||
      lowerUrl.includes('completed')
  );
}

function determineStatus(startDate: string, bookingStatus: string, isPastTripsPayload: boolean, now: Date): string {
  if (isPastTripsPayload) return 'Completed';
  if (bookingStatus === 'OF') return 'Courtesy Hold';
  if (bookingStatus === 'CX' || bookingStatus === 'XX' || bookingStatus === 'CN') return 'Cancelled';
  const parsedStart = parseDate(startDate);
  if (parsedStart) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    parsedStart.setHours(0, 0, 0, 0);
    if (parsedStart < today) return 'Completed';
  }
  return 'Upcoming';
}

function normalizeShipCode(record: Record<string, unknown>): string {
  const explicit = getString(record, [
    ['shipCode'],
    ['ship', 'code'],
    ['vesselCode'],
    ['vessel', 'code'],
    ['voyage', 'shipCode'],
    ['sailing', 'shipCode'],
  ]).toUpperCase();
  if (explicit) return explicit;
  return extractShipCodeFromVoyage(getString(record, [['voyageCode'], ['voyageId'], ['sailingId'], ['code'], ['id']])).toUpperCase();
}

function normalizeStartDate(record: Record<string, unknown>): string {
  const explicit = getString(record, [
    ['sailDate'],
    ['departureDate'],
    ['startDate'],
    ['sailingStartDate'],
    ['start'],
    ['embarkDate'],
    ['embarkationDate'],
    ['departure', 'date'],
    ['voyage', 'sailDate'],
    ['sailing', 'sailDate'],
  ]);
  if (explicit) return explicit;
  return extractDateFromVoyage(getString(record, [['voyageCode'], ['voyageId'], ['sailingId'], ['code'], ['id']]));
}

function normalizeEndDate(record: Record<string, unknown>): string {
  return getString(record, [
    ['endDate'],
    ['returnDate'],
    ['sailingEndDate'],
    ['end'],
    ['debarkDate'],
    ['debarkationDate'],
    ['arrivalDate'],
    ['arrival', 'date'],
    ['voyage', 'endDate'],
    ['sailing', 'endDate'],
  ]);
}

function buildBookedCruiseRow(record: Record<string, unknown>, options: ParseTripPayloadOptions, isPastTripsPayload: boolean): BookedCruiseRow | null {
  const shipCode = normalizeShipCode(record);
  const nestedShipName = getString(record, [['ship', 'name'], ['vessel', 'name'], ['voyage', 'shipName'], ['sailing', 'shipName']]);
  const shipName = getString(record, [['shipName'], ['vesselName']]) || nestedShipName || (options.isCarnival ? CARNIVAL_SHIP_CODE_MAP[shipCode] : ROYAL_SHIP_CODE_MAP[shipCode]) || (shipCode ? `${shipCode} of the Seas` : 'Unknown Ship');
  const startDate = normalizeStartDate(record);
  const endDate = normalizeEndDate(record);
  const nights = extractNights(record, startDate, endDate);
  const stateroomType = getString(record, [['stateroomType'], ['cabinType'], ['categoryType'], ['stateroom', 'type'], ['cabin', 'type']]);
  const cabinType = STATEROOM_TYPE_MAP[stateroomType] || stateroomType || getString(record, [['cabinCategory'], ['categoryName']]);
  const stateroomNumber = getString(record, [['stateroomNumber'], ['cabinNumber'], ['stateroom', 'number'], ['cabin', 'number']]);
  const bookingStatus = getString(record, [['bookingStatus'], ['statusCode'], ['status']]) || 'BK';
  const status = determineStatus(startDate, bookingStatus, isPastTripsPayload || getString(record, [['tripStatus']]).toLowerCase() === 'past', options.now ?? new Date());
  const bookingId = getString(record, [['bookingId'], ['confirmationNumber'], ['reservationId'], ['reservationNumber'], ['id'], ['booking', 'id']]);
  const hasMeaningfulIdentity = Boolean(
    (shipName !== 'Unknown Ship' && startDate) ||
      (shipCode && startDate) ||
      (bookingId && startDate && shipName !== 'Unknown Ship')
  );

  if (!hasMeaningfulIdentity) {
    return null;
  }

  const itinerary = getString(record, [['itinerary'], ['destination'], ['cruiseName'], ['name'], ['itineraryName'], ['title'], ['voyage', 'name'], ['sailing', 'name']]);
  const isGTY = stateroomNumber === 'GTY' || !stateroomNumber;

  return {
    rawBooking: record,
    sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
    shipName,
    shipCode,
    cruiseTitle: getString(record, [['cruiseTitle'], ['title'], ['name']]) || (nights ? `${nights} Night Cruise` : 'Cruise'),
    sailingStartDate: startDate,
    sailingEndDate: endDate,
    sailingDates: getString(record, [['sailingDates']]) || startDate,
    itinerary,
    departurePort: getString(record, [['departurePort'], ['homePort'], ['embarkPort'], ['embarkationPort'], ['departurePortName'], ['departure', 'portName'], ['departure', 'port']]),
    arrivalPort: getString(record, [['arrivalPort'], ['arrivalPortName'], ['arrival', 'portName'], ['arrival', 'port']]) || undefined,
    cabinType,
    cabinCategory: getString(record, [['stateroomCategoryCode'], ['categoryCode'], ['cabinCategory'], ['stateroom', 'categoryCode']]) || undefined,
    cabinNumberOrGTY: isGTY ? 'GTY' : stateroomNumber,
    deckNumber: getString(record, [['deckNumber'], ['deck'], ['stateroom', 'deck']]) || undefined,
    bookingId,
    numberOfGuests: getString(record, [['numberOfGuests'], ['guestCount']]) || (Array.isArray(record.passengers) ? String(record.passengers.length) : '1'),
    numberOfNights: nights,
    daysToGo: '',
    status,
    holdExpiration: getString(record, [['offerExpirationDate'], ['holdExpiration']]) || undefined,
    loyaltyLevel: '',
    loyaltyPoints: '',
    paidInFull: getString(record, [['paidInFull']]) === 'true' ? 'Yes' : getString(record, [['paidInFull']]) === 'false' ? 'No' : undefined,
    balanceDue: getString(record, [['balanceDueAmount'], ['balanceDue'], ['amountDue']]) || undefined,
    musterStation: getString(record, [['musterStation']]) || undefined,
    bookingStatus,
    packageCode: getString(record, [['packageCode']]) || undefined,
    passengerStatus: Array.isArray(record.passengers) && isRecord(record.passengers[0]) ? getString(record.passengers[0], [['passengerStatus']]) : undefined,
    stateroomNumber,
    stateroomCategoryCode: getString(record, [['stateroomCategoryCode'], ['categoryCode']]) || undefined,
    stateroomType,
  };
}

export function getBookedCruiseRowIdentityKey(row: BookedCruiseRow): string {
  const bookingId = row.bookingId?.trim();
  if (bookingId) return `booking:${bookingId}`;
  return [
    'ship-date-cabin',
    row.shipName?.trim().toLowerCase() ?? '',
    row.sailingStartDate?.trim() ?? '',
    row.cabinNumberOrGTY?.trim().toLowerCase() ?? '',
    row.cabinType?.trim().toLowerCase() ?? '',
  ].join('|');
}

export function isMeaningfulBookedCruiseRow(row: BookedCruiseRow): boolean {
  return Boolean(
    ((row.shipName?.trim() ?? '') !== '' && row.shipName !== 'Unknown Ship' && (row.sailingStartDate?.trim() ?? '') !== '') ||
      ((row.shipCode?.trim() ?? '') !== '' && (row.sailingStartDate?.trim() ?? '') !== '')
  );
}

export function parseTripPayload(data: unknown, options: ParseTripPayloadOptions): ParsedTripPayloadResult {
  const isPastTripsPayload = determineIsPastPayload(options.endpoint, options.url, options.forceCompleted);
  const rawRows = collectTripRows(data);
  const rows: BookedCruiseRow[] = [];
  let skippedPlaceholderRows = 0;

  for (const rawRow of rawRows) {
    const row = buildBookedCruiseRow(rawRow, options, isPastTripsPayload);
    if (!row || !isMeaningfulBookedCruiseRow(row)) {
      skippedPlaceholderRows += 1;
      continue;
    }
    rows.push(row);
  }

  const seen = new Set<string>();
  const dedupedRows = rows.filter((row) => {
    const key = getBookedCruiseRowIdentityKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    rawRows,
    rows: dedupedRows,
    skippedPlaceholderRows,
    isPastTripsPayload,
    expectedTotal: extractExpectedTotal(data),
  };
}
