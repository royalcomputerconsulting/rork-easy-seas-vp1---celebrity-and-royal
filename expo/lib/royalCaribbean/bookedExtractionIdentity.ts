import type { BookedCruiseRow } from './types';

export type ExtractedBookedCruiseMergeLedgerEntry = {
  inputIndex: number;
  identity: string;
  action: 'added' | 'merged';
  outputIndex: number;
};

export type ExtractedBookedCruiseMergeResult<T> = {
  rows: T[];
  ledger: ExtractedBookedCruiseMergeLedgerEntry[];
  addedCount: number;
  mergedCount: number;
};

const PLACEHOLDER_BOOKING_ID = /^(?:booking|rc|cruise|row|temp|temporary|unknown|unconfirmed)[_:\-]?\d*(?:[_:\-].*)?$/i;
const NON_VALUE = /^(?:n\/?a|none|null|undefined|unknown|not\s*set|not\s*assigned|tbd|gty|guarantee|guaranteed|-)$/i;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function canonicalText(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, ' ');
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return '';
}

function dateOnly(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const direct = raw.match(/^(20\d{2})[-/]?(\d{2})[-/]?(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? canonicalText(raw) : parsed.toISOString().slice(0, 10);
}

function normalizeSource(record: any): string {
  const source = canonicalText(record?.cruiseSource || record?.brand || record?.source || record?.rawBooking?.brand);
  if (source.includes('celebrity')) return 'celebrity';
  if (source.includes('carnival')) return 'carnival';
  if (source.includes('royal')) return 'royal';
  return source || 'royal';
}

export function isPlaceholderBookingIdentifier(value: unknown): boolean {
  const candidate = text(value);
  if (!candidate || NON_VALUE.test(candidate)) return true;
  if (/^unconfirmed:/i.test(candidate)) return true;
  if (PLACEHOLDER_BOOKING_ID.test(candidate)) return true;
  return false;
}

export function getRealBookingIdentifier(record: any): string {
  const raw = record?.rawBooking && typeof record.rawBooking === 'object' ? record.rawBooking : {};
  const candidates = [
    record?.reservationNumber,
    record?.confirmationNumber,
    record?.reservationId,
    record?.bookingReference,
    record?.bookingNumber,
    record?.bookingId,
    record?.masterBookingId,
    raw?.reservationNumber,
    raw?.confirmationNumber,
    raw?.reservationId,
    raw?.bookingReference,
    raw?.bookingNumber,
    raw?.bookingId,
    raw?.masterBookingId,
  ];
  for (const value of candidates) {
    const candidate = canonicalText(value);
    if (candidate && !isPlaceholderBookingIdentifier(candidate)) return candidate;
  }
  return '';
}

function getCabinSignature(record: any): string {
  const raw = record?.rawBooking && typeof record.rawBooking === 'object' ? record.rawBooking : {};
  const candidates = [
    record?.cabinNumberOrGTY,
    record?.stateroomNumber,
    record?.cabinNumber,
    raw?.cabinNumberOrGTY,
    raw?.stateroomNumber,
    raw?.cabinNumber,
    raw?.roomNumber,
  ];
  for (const value of candidates) {
    const candidate = canonicalText(value);
    if (candidate && !NON_VALUE.test(candidate)) return candidate;
  }
  return '';
}

function passengerArray(record: any): any[] {
  const raw = record?.rawBooking && typeof record.rawBooking === 'object' ? record.rawBooking : {};
  const arrays = [
    record?.passengers,
    record?.passengersInStateroom,
    record?.guestNames,
    record?.guests,
    raw?.passengers,
    raw?.passengersInStateroom,
    raw?.guestNames,
    raw?.guests,
  ];
  return arrays.flatMap(value => Array.isArray(value) ? value : []);
}

function getGuestSignature(record: any): string {
  const signatures = passengerArray(record).map(passenger => {
    if (typeof passenger === 'string') return canonicalText(passenger);
    if (!passenger || typeof passenger !== 'object') return '';
    const name = canonicalText(firstNonEmpty(
      [passenger.firstName, passenger.middleName, passenger.lastName].filter(Boolean).join(' '),
      passenger.fullName,
      passenger.name,
    ));
    if (name) return `name:${name}`;
    const id = canonicalText(firstNonEmpty(passenger.passengerId, passenger.consumerId, passenger.guestId, passenger.id));
    return id ? `id:${id}` : '';
  }).filter(Boolean);
  return Array.from(new Set(signatures)).sort().join(',');
}

function stableValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 5) return '[depth]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return canonicalText(value);
  if (Array.isArray(value)) return value.map(item => stableValue(item, depth + 1, seen));
  if (typeof value !== 'object') return String(value);
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);
  const ignored = /^(?:createdAt|updatedAt|timestamp|requestId|runId|traceId|sessionId|lastModified)$/i;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (ignored.test(key)) continue;
    output[key] = stableValue((value as Record<string, unknown>)[key], depth + 1, seen);
  }
  return output;
}

function stableHash(value: unknown): string {
  const input = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function opaqueFingerprint(record: any): Record<string, unknown> {
  return {
    source: normalizeSource(record),
    ship: canonicalText(record?.shipName || record?.rawBooking?.shipName),
    start: dateOnly(record?.sailingStartDate || record?.sailDate || record?.startDate || record?.rawBooking?.sailingStartDate),
    end: dateOnly(record?.sailingEndDate || record?.returnDate || record?.endDate || record?.rawBooking?.sailingEndDate),
    cabin: getCabinSignature(record),
    category: canonicalText(record?.cabinCategory || record?.stateroomCategoryCode || record?.rawBooking?.stateroomCategoryCode),
    guests: getGuestSignature(record),
    itinerary: canonicalText(record?.itinerary || record?.itineraryName || record?.destination || record?.rawBooking?.itinerary),
    departurePort: canonicalText(record?.departurePort || record?.homePort || record?.rawBooking?.departurePort),
    sourcePage: canonicalText(record?.sourcePage),
    raw: record?.rawBooking || record,
  };
}

export function buildUnconfirmedBookingIdentifier(record: any): string {
  return `unconfirmed:${stableHash(opaqueFingerprint(record))}`;
}

/**
 * Extraction identity is intentionally reservation-first. A ship/date pair alone is
 * never used as a canonical booking identity because two reservations can share it.
 */
export function getExtractedBookedCruiseIdentity(record: any): string {
  const source = normalizeSource(record);
  const reservation = getRealBookingIdentifier(record);
  if (reservation) return `${source}|reservation:${reservation}`;

  const ship = canonicalText(record?.shipName || record?.rawBooking?.shipName) || 'unknown-ship';
  const start = dateOnly(record?.sailingStartDate || record?.sailDate || record?.startDate || record?.rawBooking?.sailingStartDate);
  const end = dateOnly(record?.sailingEndDate || record?.returnDate || record?.endDate || record?.rawBooking?.sailingEndDate);
  const cabin = getCabinSignature(record);
  const guests = getGuestSignature(record);
  if (cabin || guests) {
    return `${source}|bookingless:${ship}|${start}|${end}|cabin:${cabin || '-'}|guests:${guests || '-'}`;
  }

  // Ambiguous rows are keyed by the complete stable payload, never by ship/date alone.
  // This merges a byte-equivalent repeat but preserves rows with any distinct detail.
  return `${source}|opaque:${stableHash(opaqueFingerprint(record))}`;
}

function isMeaningful(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') {
    const candidate = value.trim();
    return Boolean(candidate) && !NON_VALUE.test(candidate) && candidate !== '0';
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergeRows<T extends Record<string, unknown>>(existing: T, incoming: T): T {
  const merged: any = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (isMeaningful(value) || !isMeaningful(merged[key])) merged[key] = value;
  }
  const existingReservation = getRealBookingIdentifier(existing);
  const incomingReservation = getRealBookingIdentifier(incoming);
  if (incomingReservation) merged.bookingId = text((incoming as any).bookingId) || incomingReservation;
  else if (existingReservation) merged.bookingId = text((existing as any).bookingId) || existingReservation;
  else merged.bookingId = buildUnconfirmedBookingIdentifier(merged);
  return merged as T;
}

export function mergeExtractedBookedCruiseRows<T extends any>(rows: T[]): ExtractedBookedCruiseMergeResult<T> {
  const output: T[] = [];
  const indexByIdentity = new Map<string, number>();
  const ledger: ExtractedBookedCruiseMergeLedgerEntry[] = [];
  let mergedCount = 0;

  rows.forEach((row, inputIndex) => {
    const identity = getExtractedBookedCruiseIdentity(row);
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex == null) {
      const normalizedRow: any = { ...(row as any) };
      if (!getRealBookingIdentifier(normalizedRow)) normalizedRow.bookingId = buildUnconfirmedBookingIdentifier(normalizedRow);
      output.push(normalizedRow as T);
      const outputIndex = output.length - 1;
      indexByIdentity.set(identity, outputIndex);
      ledger.push({ inputIndex, identity, action: 'added', outputIndex });
      return;
    }
    output[existingIndex] = mergeRows(output[existingIndex] as Record<string, unknown>, row as Record<string, unknown>) as T;
    mergedCount += 1;
    ledger.push({ inputIndex, identity, action: 'merged', outputIndex: existingIndex });
  });

  return {
    rows: output,
    ledger,
    addedCount: output.length,
    mergedCount,
  };
}

export function normalizeExtractedBookingId(record: Partial<BookedCruiseRow> & Record<string, unknown>): string {
  const real = getRealBookingIdentifier(record);
  return real ? text(record.bookingId) || real : buildUnconfirmedBookingIdentifier(record);
}
