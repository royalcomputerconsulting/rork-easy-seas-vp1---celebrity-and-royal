export type OfferSailingToggleFilter = 'all' | 'yes' | 'no';

export interface OfferSailingFilterState {
  ships: string[];
  shipClasses: string[];
  cabins: string[];
  guestCounts: number[];
  departurePorts: string[];
  dateFrom: string;
  dateTo: string;
  minNights: string;
  maxNights: string;
  gty: OfferSailingToggleFilter;
  nextCruiseBonus: OfferSailingToggleFilter;
}

export interface OfferSailingFilterAccessors<T> {
  ship: (row: T) => string;
  shipClass: (row: T) => string;
  cabin: (row: T) => string;
  guestCount: (row: T) => number | undefined;
  departurePort: (row: T) => string;
  sailDate: (row: T) => string;
  nights: (row: T) => number;
  hasNextCruiseBonus: (row: T) => boolean;
  searchParts: (row: T) => unknown[];
  dateToTime: (date: string) => number;
}

function selected(values: string[], value: string): boolean {
  return values.length === 0 || values.includes(value);
}

function numericBoundary(value: string, fallback: number): number {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Applies every offer-sailing filter without collapsing or de-duplicating rows.
 * One provider relationship in means either one matching relationship out or none.
 */
export function filterOfferSailingRows<T>(
  rows: readonly T[],
  searchText: string,
  filters: OfferSailingFilterState,
  accessors: OfferSailingFilterAccessors<T>,
): T[] {
  const terms = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const fromTime = filters.dateFrom.trim() ? accessors.dateToTime(filters.dateFrom) : Number.NEGATIVE_INFINITY;
  const toTime = filters.dateTo.trim() ? accessors.dateToTime(filters.dateTo) : Number.POSITIVE_INFINITY;
  const minNights = numericBoundary(filters.minNights, Number.NEGATIVE_INFINITY);
  const maxNights = numericBoundary(filters.maxNights, Number.POSITIVE_INFINITY);

  return rows.filter((row) => {
    const ship = accessors.ship(row).trim();
    const shipClass = accessors.shipClass(row).trim();
    const cabin = accessors.cabin(row).trim();
    const guestCount = accessors.guestCount(row);
    const departurePort = accessors.departurePort(row).trim();
    const sailTime = accessors.dateToTime(accessors.sailDate(row));
    const nights = accessors.nights(row) || 0;
    const isGty = /\bgty\b|guarantee/i.test(cabin);
    const hasBonus = accessors.hasNextCruiseBonus(row);

    if (!selected(filters.ships, ship)) return false;
    if (!selected(filters.shipClasses, shipClass)) return false;
    if (!selected(filters.cabins, cabin)) return false;
    if (filters.guestCounts.length && (!guestCount || !filters.guestCounts.includes(guestCount))) return false;
    if (!selected(filters.departurePorts, departurePort)) return false;
    if (Number.isFinite(fromTime) && sailTime < fromTime) return false;
    if (Number.isFinite(toTime) && sailTime > toTime) return false;
    if (nights < minNights || nights > maxNights) return false;
    if (filters.gty === 'yes' && !isGty) return false;
    if (filters.gty === 'no' && isGty) return false;
    if (filters.nextCruiseBonus === 'yes' && !hasBonus) return false;
    if (filters.nextCruiseBonus === 'no' && hasBonus) return false;

    const haystack = accessors.searchParts(row)
      .flatMap((part) => Array.isArray(part) ? part : [part])
      .filter((part) => part !== undefined && part !== null && String(part).trim())
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
