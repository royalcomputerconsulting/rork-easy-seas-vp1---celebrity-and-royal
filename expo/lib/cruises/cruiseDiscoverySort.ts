export type CruiseDiscoverySortOption = 'date-asc' | 'date-desc' | 'value-asc' | 'value-desc' | 'nights-desc';

export interface CruiseDiscoverySortAccessors<T> {
  getDate: (row: T) => string | null | undefined;
  getValue: (row: T) => number | null | undefined;
  getNights: (row: T) => number | null | undefined;
  getIdentity: (row: T) => string;
}

function calendarDayRank(value: string | null | undefined): number | null {
  const text = String(value ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const us = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})/);
  if (!us) return null;
  const year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
  return Date.UTC(year, Number(us[1]) - 1, Number(us[2]));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compareKnownNumbers(left: number | null, right: number | null, direction: 'asc' | 'desc'): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === 'asc' ? left - right : right - left;
}

/**
 * Produces a deterministic, non-mutating order for the Cruises catalog.
 * Missing dates and values always follow known records instead of jumping to
 * the top when the user changes direction.
 */
export function sortCruiseDiscoveryRows<T>(
  rows: readonly T[],
  sortBy: CruiseDiscoverySortOption,
  accessors: CruiseDiscoverySortAccessors<T>,
): T[] {
  const prepared = rows.map((row) => ({
    row,
    date: calendarDayRank(accessors.getDate(row)),
    value: finiteNumber(accessors.getValue(row)),
    nights: finiteNumber(accessors.getNights(row)),
    identity: accessors.getIdentity(row),
  }));

  prepared.sort((left, right) => {
    let comparison = 0;
    if (sortBy === 'date-asc' || sortBy === 'date-desc') {
      comparison = compareKnownNumbers(left.date, right.date, sortBy === 'date-asc' ? 'asc' : 'desc');
    } else if (sortBy === 'value-asc' || sortBy === 'value-desc') {
      comparison = compareKnownNumbers(left.value, right.value, sortBy === 'value-asc' ? 'asc' : 'desc');
    } else {
      comparison = compareKnownNumbers(left.nights, right.nights, 'desc');
    }
    if (comparison !== 0) return comparison;

    const dateComparison = compareKnownNumbers(left.date, right.date, 'asc');
    if (dateComparison !== 0) return dateComparison;
    return left.identity.localeCompare(right.identity);
  });

  return prepared.map(({ row }) => row);
}
