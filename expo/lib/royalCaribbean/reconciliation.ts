import type { BookedCruiseRow, OfferRow } from './types';

export interface OfferExtractionReconciliation {
  rawOfferRows: number;
  retainedOfferRows: number;
  canonicalOfferSailings: number;
  retainedVariantRows: number;
  duplicateRowsConsolidated: number;
  rejectedOfferRows: number;
  offerLevelRows: number;
}

export interface QuarantinedCompletedCruiseRow {
  row: BookedCruiseRow;
  reason: 'missing_ship' | 'missing_sailing_date' | 'missing_ship_and_sailing_date';
  sourcePage: string;
  bookingId?: string;
}

function text(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function money(value: unknown): string {
  const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!cleaned) return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : text(value);
}

function date(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const ymd = raw.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const mdy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  return text(raw);
}

export function canonicalOfferCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function getCanonicalOfferSailingKey(row: Partial<OfferRow>): string {
  return [
    text(row.shipName),
    date(row.sailingDate),
    text(row.itinerary) || String(row.totalNights ?? ''),
    text(row.departurePort),
  ].join('|');
}

export function getMaterialOfferRowKey(row: Partial<OfferRow>): string {
  return [
    text(row.playerOfferId || row.carnivalOfferId || row.offerInstanceId),
    canonicalOfferCode(row.offerCode) || text(row.offerName),
    getCanonicalOfferSailingKey(row),
    text(row.cabinType),
    text(row.numberOfGuests),
    money(row.interiorPrice),
    money(row.oceanviewPrice),
    money(row.balconyPrice),
    money(row.suitePrice),
    money(row.taxesAndFees),
    text(row.perks),
    text(row.bookingLink),
  ].join('|');
}

export function summarizeOfferExtraction(
  rawRows: ReadonlyArray<Partial<OfferRow>>,
  retainedRows: ReadonlyArray<Partial<OfferRow>> = rawRows,
  explicitRawCount?: number,
): OfferExtractionReconciliation {
  const rawOfferRows = Number.isFinite(explicitRawCount) && Number(explicitRawCount) >= rawRows.length
    ? Number(explicitRawCount)
    : rawRows.length;

  const validRows = retainedRows.filter((row) => Boolean(row && typeof row === 'object'));
  const offerLevelRows = validRows.filter((row) => !text(row.shipName) && !date(row.sailingDate)).length;
  const sailingRows = validRows.filter((row) => text(row.shipName) && date(row.sailingDate));
  const materialKeys = new Set(sailingRows.map(getMaterialOfferRowKey));
  const canonicalKeys = new Set(sailingRows.map(getCanonicalOfferSailingKey));
  const retainedOfferRows = materialKeys.size + offerLevelRows;
  const canonicalOfferSailings = canonicalKeys.size;
  const retainedVariantRows = Math.max(0, materialKeys.size - canonicalOfferSailings);
  const duplicateRowsConsolidated = Math.max(0, rawOfferRows - retainedOfferRows);
  const rejectedOfferRows = Math.max(0, rawRows.length - validRows.length);

  return {
    rawOfferRows,
    retainedOfferRows,
    canonicalOfferSailings,
    retainedVariantRows,
    duplicateRowsConsolidated,
    rejectedOfferRows,
    offerLevelRows,
  };
}

export function isCompletedBookedCruiseRow(row: Partial<BookedCruiseRow>): boolean {
  const status = `${row.status ?? ''} ${row.bookingStatus ?? ''} ${row.sourcePage ?? ''}`.toLowerCase();
  return status.includes('completed') || status.includes('past') || status.includes('history');
}

export function partitionAuthoritativeCompletedRows(rows: BookedCruiseRow[]): {
  accepted: BookedCruiseRow[];
  quarantined: QuarantinedCompletedCruiseRow[];
} {
  const accepted: BookedCruiseRow[] = [];
  const quarantined: QuarantinedCompletedCruiseRow[] = [];

  for (const row of rows) {
    if (!isCompletedBookedCruiseRow(row)) {
      accepted.push(row);
      continue;
    }

    const hasShip = Boolean(text(row.shipName)) && !/^unknown ship$/i.test(String(row.shipName || '').trim());
    const hasSailingDate = Boolean(date(row.sailingStartDate));
    if (hasShip && hasSailingDate) {
      accepted.push(row);
      continue;
    }

    quarantined.push({
      row,
      reason: !hasShip && !hasSailingDate
        ? 'missing_ship_and_sailing_date'
        : (!hasShip ? 'missing_ship' : 'missing_sailing_date'),
      sourcePage: String(row.sourcePage || 'Completed History'),
      bookingId: String(row.bookingId || '').trim() || undefined,
    });
  }

  return { accepted, quarantined };
}
