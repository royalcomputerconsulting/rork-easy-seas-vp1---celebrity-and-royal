/**
 * Shared rules for fields that must never be fabricated from a missing
 * provider value. `0` is used only where the legacy model requires a number;
 * callers must pair it with `validationStatus: 'partial'`.
 */
export function knownPositiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 365) return undefined;
  return parsed;
}

export function knownNightCount(value: unknown): number | undefined {
  return knownPositiveInteger(value);
}

export function knownGuestCount(value: unknown): number | undefined {
  const parsed = knownPositiveInteger(value);
  return parsed && parsed <= 20 ? parsed : undefined;
}

/**
 * A calculation can only use a count when the provider, a verified document,
 * or the user actually supplied one. Returning zero keeps legacy numeric
 * models representable without inventing a duration or party size.
 */
export function knownCountOrZero(value: unknown, kind: 'nights' | 'guests'): number {
  return (kind === 'nights' ? knownNightCount(value) : knownGuestCount(value)) ?? 0;
}

export function isGeneratedBookingIdentifier(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  return /^(?:booking|reservation|res|ccl(?:-dom)?)[-_]\d/i.test(normalized);
}

export function hasAuthoritativeSchedule(value: { sailDate?: unknown; returnDate?: unknown; nights?: unknown }): boolean {
  const sailDate = String(value.sailDate ?? '').trim();
  const returnDate = String(value.returnDate ?? '').trim();
  return Boolean(sailDate && returnDate && knownNightCount(value.nights));
}

export function deriveReturnDateUtc(sailDate: string, nights: number | undefined): string | undefined {
  const iso = sailDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const us = sailDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if ((!iso && !us) || !nights) return undefined;
  const year = Number(iso?.[1] ?? (us![3].length === 2 ? `20${us![3]}` : us![3]));
  const month = Number(iso?.[2] ?? us![1]);
  const day = Number(iso?.[3] ?? us![2]);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return undefined;
  start.setUTCDate(start.getUTCDate() + nights);
  return start.toISOString().slice(0, 10);
}

export function displayKnownCount(value: unknown, singular: string, plural = `${singular}s`): string {
  const count = knownPositiveInteger(value);
  if (!count) return 'Unknown';
  return `${count} ${count === 1 ? singular : plural}`;
}
