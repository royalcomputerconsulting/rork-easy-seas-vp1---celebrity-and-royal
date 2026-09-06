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

/** Parses the row-level eligibility language used by offer exports and certificate PDFs. */
export function parseGuestEligibility(value: unknown): number | undefined {
  const direct = knownGuestCount(value);
  if (direct) return direct;
  const text = String(value ?? '').trim();
  if (!text) return undefined;
  if (/\bsingle\s+occupancy\b/i.test(text)) return 1;
  if (/\bdouble\s+occupancy\b/i.test(text)) return 2;
  const match = text.match(/\b(\d{1,2})\s*(?:guests?|people|persons?|passengers?|pax)\b/i);
  return knownGuestCount(match?.[1]);
}

export function getCruiseGuestEligibility(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return parseGuestEligibility(value);
  const cruise = value as Record<string, unknown>;
  for (const candidate of [cruise.guestsInfo, cruise.guestCount, cruise.numberOfGuests, cruise.guests, cruise.occupancy, cruise.passengerCount]) {
    const count = parseGuestEligibility(candidate);
    if (count) return count;
  }
  const payload = cruise.sourcePayload;
  if (payload && typeof payload === 'object') return getCruiseGuestEligibility(payload);
  return undefined;
}

export function formatGuestEligibility(value: unknown, unknownLabel = 'Guest eligibility not stated'): string {
  const count = typeof value === 'object' && value !== null ? getCruiseGuestEligibility(value) : parseGuestEligibility(value);
  return count ? `${count} Guest${count === 1 ? '' : 's'}` : unknownLabel;
}

/** One authoritative cabin label shared by offer, catalog, booked, and casino cards. */
export function getCanonicalCruiseCabinLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rawType = [row.cabinType, row.stateroomType]
    .map((candidate) => String(candidate ?? '').trim())
    .find(Boolean);
  const aliases: Record<string, string> = {
    I: 'Interior', INTERIOR: 'Interior', INSIDE: 'Interior', INT: 'Interior',
    O: 'Oceanview', OCEANVIEW: 'Oceanview', 'OCEAN VIEW': 'Oceanview', OV: 'Oceanview',
    B: 'Balcony', BALCONY: 'Balcony', BAL: 'Balcony', BLC: 'Balcony',
    S: 'Suite', SUITE: 'Suite', STE: 'Suite', JS: 'Junior Suite', GS: 'Grand Suite', OS: "Owner's Suite",
  };
  let label = '';
  if (rawType) label = aliases[rawType.toUpperCase()] ?? rawType.replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (!label) {
    const category = String(row.cabinCategory ?? row.stateroomCategoryCode ?? '').trim();
    if (category) label = `Category ${category.toUpperCase()}`;
  }
  const isGty = row.gty === true
    || /^(?:y|yes|true|gty|guarantee)$/i.test(String(row.gty ?? ''))
    || /^(?:gty|guarantee)$/i.test(String(row.stateroomNumber ?? row.cabinNumber ?? ''))
    || /\bgty\b|guarantee/i.test(label);
  if (!label) return isGty ? 'GTY · Stateroom category not supplied' : null;
  return isGty && !/\bgty\b|guarantee/i.test(label) ? `${label} · GTY` : label;
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
