/**
 * EasySeas date-only utilities.
 *
 * These helpers intentionally avoid timestamp comparisons for app concepts that
 * are date-only in the real world, such as certificate expiration dates and
 * cruise day numbers. All normalized values are YYYY-MM-DD.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isValidYmdParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function toYmd(year: number, month: number, day: number): string | null {
  if (!isValidYmdParts(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function normalizeDateOnly(input?: string | Date | null): string | null {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return toYmd(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }

  const raw = String(input).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return toYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toYmd(year, month, day);
  }

  const monthNameMatch = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (monthNameMatch) {
    const monthLookup: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      sept: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const monthText = monthNameMatch[1].toLowerCase();
    const matchedKey = Object.keys(monthLookup).find((name) => monthText.startsWith(name));
    if (matchedKey) {
      const month = monthLookup[matchedKey];
      const day = Number(monthNameMatch[2]);
      const year = monthNameMatch[3] ? Number(monthNameMatch[3]) : new Date().getFullYear();
      return toYmd(year, month, day);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return null;
}

export function getTodayLocal(): string {
  const today = new Date();
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
}

function ymdToUtcMs(value?: string | Date | null): number | null {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function daysBetweenDates(startDate: string, endDate: string): number | null {
  const startMs = ymdToUtcMs(startDate);
  const endMs = ymdToUtcMs(endDate);
  if (startMs === null || endMs === null) return null;
  return Math.round((endMs - startMs) / 86400000);
}

export function isSameDate(a?: string | Date | null, b?: string | Date | null): boolean {
  const left = normalizeDateOnly(a);
  const right = normalizeDateOnly(b);
  return Boolean(left && right && left === right);
}

export function isBeforeDate(a?: string | Date | null, b?: string | Date | null): boolean {
  const left = ymdToUtcMs(a);
  const right = ymdToUtcMs(b);
  return left !== null && right !== null && left < right;
}

export function isAfterDate(a?: string | Date | null, b?: string | Date | null): boolean {
  const left = ymdToUtcMs(a);
  const right = ymdToUtcMs(b);
  return left !== null && right !== null && left > right;
}

export function addDays(date: string, days: number): string | null {
  const normalized = normalizeDateOnly(date);
  if (!normalized || !Number.isFinite(days)) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(days));
  return toYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
