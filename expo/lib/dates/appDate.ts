export function normalizeDateOnly(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return makeDateOnly(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const year = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    return makeDateOnly(year, Number(us[1]), Number(us[2]));
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function makeDateOnly(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function todayDateOnly(now: Date = new Date()): string {
  return normalizeDateOnly(now) ?? now.toISOString().slice(0, 10);
}

export function addDays(date: string | Date, days: number): string | null {
  const normalized = normalizeDateOnly(date);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function diffDays(start: string | Date, end: string | Date): number | null {
  const s = normalizeDateOnly(start);
  const e = normalizeDateOnly(end);
  if (!s || !e) return null;
  const startMs = Date.parse(`${s}T00:00:00.000Z`);
  const endMs = Date.parse(`${e}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / 86400000);
}
