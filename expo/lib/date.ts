export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

const SHORT_MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const FULL_MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isValidCalendarDate(parts: CalendarDateParts): boolean {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day;
}

function toLocalCalendarDate(parts: CalendarDateParts): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

function formatCalendarDate(parts: CalendarDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Parses a date as a calendar day. ISO timestamps intentionally keep their
 * written YYYY-MM-DD portion so a sailing cannot shift when the device is in
 * another time zone.
 */
export function parseCalendarDate(value?: string | null): CalendarDateParts | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const parts = { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
    return isValidCalendarDate(parts) ? parts : undefined;
  }

  const usMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? 2000 + Number(usMatch[3]) : Number(usMatch[3]);
    const parts = { year, month: Number(usMatch[1]), day: Number(usMatch[2]) };
    return isValidCalendarDate(parts) ? parts : undefined;
  }

  const compactMatch = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const parts = { year: Number(compactMatch[1]), month: Number(compactMatch[2]), day: Number(compactMatch[3]) };
    return isValidCalendarDate(parts) ? parts : undefined;
  }

  const namedMonthMatch = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})/);
  if (namedMonthMatch) {
    const monthName = namedMonthMatch[1].toLowerCase();
    const month = FULL_MONTH_NAMES[monthName] ?? SHORT_MONTH_NAMES[monthName.slice(0, 3)];
    const parts = { year: Number(namedMonthMatch[3]), month: month ?? 0, day: Number(namedMonthMatch[2]) };
    return isValidCalendarDate(parts) ? parts : undefined;
  }

  // Cruise records are calendar days, not instants. Refuse formats that the
  // platform would parse in a device time zone rather than shifting the day.
  return undefined;
}

export function toCalendarDateOnly(value?: string | null): string | undefined {
  const parts = parseCalendarDate(value);
  return parts ? formatCalendarDate(parts) : undefined;
}

/** Formats an in-memory UI Date using its local calendar fields, never UTC. */
export function toLocalCalendarDateOnly(date: Date): string | undefined {
  if (Number.isNaN(date.getTime())) return undefined;
  return formatCalendarDate({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

/**
 * Uses an explicit itinerary time zone when an instant must be compared with a
 * cruise calendar day. This avoids converting an international sailing day in
 * the device's time zone or UTC by accident.
 */
export function toTimeZoneCalendarDateOnly(date: Date, timeZone: string): string | undefined {
  if (Number.isNaN(date.getTime()) || !timeZone?.trim()) return undefined;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]));
    const calendar = { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
    return isValidCalendarDate(calendar) ? formatCalendarDate(calendar) : undefined;
  } catch {
    return undefined;
  }
}

/** Adds whole days to a written calendar day without involving the device time zone. */
export function addCalendarDateDays(value: string, days: number): string | undefined {
  const parts = parseCalendarDate(value);
  if (!parts || !Number.isFinite(days)) return undefined;
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Math.trunc(days)));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

/** Compares written calendar days. Invalid values cannot participate in ordering. */
export function compareCalendarDates(left?: string | null, right?: string | null): number | undefined {
  const leftDate = toCalendarDateOnly(left);
  const rightDate = toCalendarDateOnly(right);
  if (!leftDate || !rightDate) return undefined;
  return leftDate === rightDate ? 0 : leftDate < rightDate ? -1 : 1;
}

export function createDateFromString(dateString: string): Date {
  const parts = parseCalendarDate(dateString);
  if (!parts) {
    console.warn('[date] Invalid calendar date string:', dateString);
    return new Date(Number.NaN);
  }
  return toLocalCalendarDate(parts);
}

/** Converts a written cruise calendar date into the UTC day used by weather APIs. */
export function createUtcDateFromCalendarDate(dateString: string): Date {
  const parts = parseCalendarDate(dateString);
  if (!parts) return new Date(Number.NaN);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** Preserves a UI Date's local calendar day before the weather layer reads UTC fields. */
export function createUtcDateFromLocalCalendarDay(date: Date): Date {
  if (Number.isNaN(date.getTime())) return new Date(Number.NaN);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function calendarDayTimestamp(value: Date | string): number {
  const parts = typeof value === 'string'
    ? parseCalendarDate(value)
    : { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  if (!parts) return Number.NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function calendarDayDate(value: Date | string): Date {
  if (typeof value === 'string') return createDateFromString(value);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function formatDateMDY(date: Date | string, separator: '-' | '/' = '/'): string {
  const d = calendarDayDate(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}${separator}${day}${separator}${d.getFullYear()}`;
}

export function formatDateMMDDYYYY(date: Date | string): string {
  return formatDateMDY(date, '/');
}

export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
  const d = calendarDayDate(date);
  if (Number.isNaN(d.getTime())) return 'Unknown date';

  switch (format) {
    case 'short':
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case 'medium':
      return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`;
    case 'long':
      return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long' })} ${d.getDate()}, ${d.getFullYear()}`;
    case 'full':
      return formatDateMMDDYYYY(d);
    default:
      return formatDateMMDDYYYY(d);
  }
}

export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = calendarDayDate(startDate);
  const end = calendarDayDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Unknown dates';

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${formatDate(start, 'medium')} - ${formatDate(end, 'medium')}`;
}

export function getDaysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = calendarDayTimestamp(startDate);
  const end = calendarDayTimestamp(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.abs(Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

export function getDaysUntil(date: Date | string, today: Date = new Date()): number {
  const target = calendarDayTimestamp(date);
  const current = calendarDayTimestamp(today);
  if (Number.isNaN(target) || Number.isNaN(current)) return Number.NaN;
  return Math.round((target - current) / (24 * 60 * 60 * 1000));
}

export function isDateInPast(date: Date | string, today: Date = new Date()): boolean {
  const target = calendarDayTimestamp(date);
  const current = calendarDayTimestamp(today);
  return !Number.isNaN(target) && !Number.isNaN(current) && target < current;
}

export function isDateInFuture(date: Date | string, today: Date = new Date()): boolean {
  const target = calendarDayTimestamp(date);
  const current = calendarDayTimestamp(today);
  return !Number.isNaN(target) && !Number.isNaN(current) && target > current;
}

export function addDays(date: Date | string, days: number): Date {
  const timestamp = calendarDayTimestamp(date);
  if (Number.isNaN(timestamp) || !Number.isFinite(days)) return new Date(Number.NaN);
  const next = new Date(timestamp + Math.trunc(days) * 24 * 60 * 60 * 1000);
  return new Date(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
}

export function getRelativeTimeString(date: Date | string, now: Date = new Date()): string {
  const diffDays = getDaysUntil(date, now);
  if (Number.isNaN(diffDays)) return 'Unknown date';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > 7 && diffDays <= 30) return `In ${Math.round(diffDays / 7)} weeks`;
  if (diffDays < -7 && diffDays >= -30) return `${Math.round(Math.abs(diffDays) / 7)} weeks ago`;
  return formatDate(date, 'medium');
}
