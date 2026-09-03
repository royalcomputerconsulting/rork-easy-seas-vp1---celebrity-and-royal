import type { BookedCruiseRow, OfferRow } from './types';
import type { CasinoOffer, Cruise } from '@/types/models';

const UNKNOWN_VALUE_PATTERN = /^(?:unknown|tbd|n\/?a|not available|null|undefined)$/i;
const GENERATED_ID_PATTERN = /^(?:rc_|booking[_-]|reservation[_-]|res[_-]|generated_|completed-xlsx|imported_|local-booked[_-]|ccl(?:-dom)?[_-])/i;
const SYNTHETIC_VALUE_PATTERN = /\b(?:mock|sample|demo|test fixture)\b/i;

export interface ExactDeduplicationResult<T> {
  retained: T[];
  exactDuplicates: number;
}

export interface OfferCruiseReferenceValidation {
  valid: boolean;
  offerCount: number;
  cruiseCount: number;
  linkedCruiseCount: number;
  danglingCruiseIds: string[];
  duplicateCruiseIds: string[];
  duplicateOfferIds: string[];
}

function collectDuplicateIds(items: Array<{ id?: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  items.forEach((item) => {
    const id = String(item.id ?? '').trim();
    if (!id) return;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  return Array.from(duplicates);
}

/**
 * Proves that an offer dataset can be published without broken sailing links.
 * This runs before any local dataset write so a failed Royal/Carnival handoff
 * cannot replace working data with a partially normalized graph.
 */
export function validateOfferCruiseReferences(
  offers: CasinoOffer[],
  cruises: Cruise[],
): OfferCruiseReferenceValidation {
  const cruiseIds = new Set(cruises.map((cruise) => String(cruise.id ?? '').trim()).filter(Boolean));
  const linkedCruiseIds = new Set<string>();
  const danglingCruiseIds = new Set<string>();

  offers.forEach((offer) => {
    const references = [offer.cruiseId, ...(offer.cruiseIds ?? [])]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
    references.forEach((id) => {
      linkedCruiseIds.add(id);
      if (!cruiseIds.has(id)) danglingCruiseIds.add(id);
    });
  });

  const duplicateCruiseIds = collectDuplicateIds(cruises);
  const duplicateOfferIds = collectDuplicateIds(offers);
  const dangling = Array.from(danglingCruiseIds);
  return {
    valid: dangling.length === 0 && duplicateCruiseIds.length === 0 && duplicateOfferIds.length === 0,
    offerCount: offers.length,
    cruiseCount: cruises.length,
    linkedCruiseCount: linkedCruiseIds.size,
    danglingCruiseIds: dangling,
    duplicateCruiseIds,
    duplicateOfferIds,
  };
}

export function normalizeRoyalText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function hasAuthoritativeValue(value: unknown): boolean {
  const normalized = normalizeRoyalText(value);
  return Boolean(normalized && !UNKNOWN_VALUE_PATTERN.test(normalized));
}

export function normalizeRoyalDateOnly(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || UNKNOWN_VALUE_PATTERN.test(raw)) return '';

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const mdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  return normalizeRoyalText(raw);
}

export function getProviderRecordId(value: unknown): string | undefined {
  const identifier = String(value ?? '').trim();
  if (!identifier || UNKNOWN_VALUE_PATTERN.test(identifier) || GENERATED_ID_PATTERN.test(identifier)) return undefined;
  return identifier;
}

export function isSyntheticRoyalRow(row: Partial<OfferRow> & Partial<BookedCruiseRow>): boolean {
  return [
    row.sourcePage,
    row.shipName,
    row.cruiseTitle,
    row.itinerary,
    row.offerName,
    row.offerCode,
  ].some((value) => SYNTHETIC_VALUE_PATTERN.test(String(value ?? '')));
}

function normalizeMoney(value: unknown): string {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  if (!raw) return '';
  const amount = Number(raw);
  return Number.isFinite(amount) ? String(amount) : '';
}

function normalizePerks(value: unknown): string {
  return normalizeRoyalText(value).replace(/[;,|]+/g, '|');
}

function normalizePortEvidence(value: unknown): string {
  return normalizeRoyalText(value).replace(/[;,|]+/g, '|');
}

export function createRoyalOfferSailingIdentity(row: Pick<OfferRow,
  'playerOfferId' | 'offerInstanceId' | 'carnivalOfferId' | 'offerCode' | 'offerName' | 'offerExpirationDate' | 'offerType' | 'shipName' | 'shipCode' |
  'sailingDate' | 'departurePort' | 'itinerary' | 'cabinType' | 'numberOfGuests' | 'perks' |
  'interiorPrice' | 'oceanviewPrice' | 'balconyPrice' | 'suitePrice' | 'taxesAndFees' |
  'portList' | 'totalNights' | 'bookingLink'
>): string {
  return [
    normalizeRoyalText(row.playerOfferId || row.carnivalOfferId || row.offerInstanceId),
    normalizeRoyalText(row.offerCode),
    normalizeRoyalText(row.offerName),
    normalizeRoyalDateOnly(row.offerExpirationDate),
    normalizeRoyalText(row.offerType),
    normalizeRoyalText(row.shipCode),
    normalizeRoyalText(row.shipName),
    normalizeRoyalDateOnly(row.sailingDate),
    normalizeRoyalText(row.departurePort),
    normalizeRoyalText(row.itinerary),
    normalizeRoyalText(row.cabinType),
    normalizeRoyalText(row.numberOfGuests),
    normalizePerks(row.perks),
    normalizeMoney(row.interiorPrice),
    normalizeMoney(row.oceanviewPrice),
    normalizeMoney(row.balconyPrice),
    normalizeMoney(row.suitePrice),
    normalizeMoney(row.taxesAndFees),
    normalizePortEvidence(row.portList),
    normalizeRoyalText(row.totalNights),
    normalizeRoyalText(row.bookingLink),
  ].join('|');
}

export function createRoyalBookedCruiseIdentity(row: Pick<BookedCruiseRow,
  'bookingId' | 'shipName' | 'shipCode' | 'sailingStartDate' | 'sailingEndDate' | 'departurePort' |
  'arrivalPort' | 'cruiseTitle' | 'itinerary' | 'cabinType' | 'cabinCategory' | 'cabinNumberOrGTY' |
  'numberOfGuests' | 'numberOfNights' | 'interiorPrice' | 'oceanviewPrice' | 'balconyPrice' |
  'suitePrice' | 'taxesAndFees' | 'portList'
>): string {
  const providerId = getProviderRecordId(row.bookingId);
  if (providerId) return `provider:${providerId.toLowerCase()}`;

  return [
    'material',
    normalizeRoyalText(row.shipCode),
    normalizeRoyalText(row.shipName),
    normalizeRoyalDateOnly(row.sailingStartDate),
    normalizeRoyalDateOnly(row.sailingEndDate),
    normalizeRoyalText(row.departurePort),
    normalizeRoyalText(row.arrivalPort),
    normalizeRoyalText(row.cruiseTitle),
    normalizeRoyalText(row.itinerary),
    normalizeRoyalText(row.cabinType),
    normalizeRoyalText(row.cabinCategory),
    normalizeRoyalText(row.cabinNumberOrGTY),
    normalizeRoyalText(row.numberOfGuests),
    normalizeRoyalText(row.numberOfNights),
    normalizeMoney(row.interiorPrice),
    normalizeMoney(row.oceanviewPrice),
    normalizeMoney(row.balconyPrice),
    normalizeMoney(row.suitePrice),
    normalizeMoney(row.taxesAndFees),
    normalizePortEvidence(row.portList),
  ].join('|');
}

export function deduplicateExactRows<T>(rows: T[], keyForRow: (row: T) => string): ExactDeduplicationResult<T> {
  const retained: T[] = [];
  const seen = new Set<string>();
  let exactDuplicates = 0;

  rows.forEach((row) => {
    const key = keyForRow(row);
    if (seen.has(key)) {
      exactDuplicates += 1;
      return;
    }
    seen.add(key);
    retained.push(row);
  });

  return { retained, exactDuplicates };
}
