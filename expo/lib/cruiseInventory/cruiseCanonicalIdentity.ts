import type { Cruise } from '@/types/models';
import { toCalendarDateOnly } from '@/lib/date';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getCruiseInventoryOwnerScope(email: string | null | undefined): string {
  const normalized = normalizeText(email);
  return normalized ? `account:${normalized}` : 'local-default';
}

function normalizeDate(value: unknown): string {
  const text = normalizeText(value);
  return toCalendarDateOnly(text) ?? text.split('t')[0];
}

export function getCruiseInventoryProvider(cruise: Cruise): string {
  const explicit = normalizeText(cruise.cruiseSource ?? cruise.sourceProvider ?? cruise.brand ?? cruise.offerSource);
  if (explicit.includes('carnival')) return 'carnival';
  if (explicit.includes('celebrity')) return 'celebrity';
  if (explicit.includes('silversea')) return 'silversea';
  if (explicit.includes('royal')) return 'royal';

  const ship = normalizeText(cruise.shipName);
  if (ship.startsWith('carnival ')) return 'carnival';
  if (ship.includes(' of the seas')) return 'royal';
  return explicit || 'unknown';
}

/**
 * Select only the provider scopes an authoritative refresh is allowed to
 * replace. Keeping this pure makes the provider boundary independently
 * testable without opening SQLite.
 */
export function selectCruiseInventoryProviderRows(
  cruises: Cruise[],
  providersToReplace?: readonly string[],
): Cruise[] {
  if (!providersToReplace?.length) return cruises;
  const providerSet = new Set(providersToReplace.map((provider) => normalizeText(provider)));
  return cruises.filter((cruise) => providerSet.has(getCruiseInventoryProvider(cruise)));
}

function getOfferExpiryDate(cruise: Cruise): string {
  const source = cruise as Cruise & {
    offerExpiryDate?: string;
    expiryDate?: string;
    expires?: string;
  };
  return normalizeDate(source.offerExpiryDate ?? source.expiryDate ?? source.expires ?? cruise.offerExpiry);
}

function getStableProviderSailingId(cruise: Cruise): string {
  const source = cruise as Cruise & {
    sailingId?: string | number;
    carnivalSailingId?: string | number;
    voyageId?: string | number;
    providerSailingId?: string | number;
  };
  return normalizeText(
    source.providerSailingId ?? source.carnivalSailingId ?? source.sailingId ?? source.voyageId,
  );
}

/**
 * Identity for the physical sailing only. Offer code, player offer ID, cabin,
 * price, guests, and perks are intentionally excluded because those belong to
 * offer eligibility, not to the master cruise.
 */
export function getCanonicalCruiseInventoryKey(cruise: Cruise): string {
  const provider = getCruiseInventoryProvider(cruise);
  const providerSailingId = getStableProviderSailingId(cruise);
  if (providerSailingId) {
    return `${provider}|provider-sailing|${providerSailingId}`;
  }

  const ship = normalizeText(cruise.shipName);
  const sailDate = normalizeDate(cruise.sailDate);
  const returnDate = normalizeDate(cruise.returnDate);
  const nights = Number.isFinite(Number(cruise.nights)) ? String(Math.max(0, Number(cruise.nights))) : '';
  const departurePort = normalizeText(cruise.departurePort);
  const routeDiscriminator = returnDate && nights
    ? ''
    : normalizeText(cruise.destinationRegion ?? cruise.destination ?? cruise.itineraryName);

  if (!ship || !sailDate) return '';
  return [provider, ship, sailDate, returnDate, nights, departurePort, routeDiscriminator].join('|');
}

/** Offer identity stays independent so three offers with one offer code remain three instances. */
export function getCruiseOfferInstanceKey(cruise: Cruise): string | null {
  const source = cruise as Cruise & { carnivalOfferId?: string };
  const strongest = normalizeText(cruise.playerOfferId ?? cruise.offerInstanceId ?? source.carnivalOfferId);
  if (strongest) return `${getCruiseInventoryProvider(cruise)}|instance|${strongest}`;

  const offerCode = normalizeText(cruise.offerCode);
  const offerName = normalizeText(cruise.offerName);
  if (!offerCode && !offerName) return null;
  return [
    getCruiseInventoryProvider(cruise),
    'material-offer',
    offerCode,
    offerName,
    normalizeDate(cruise.offerExpiry),
    normalizeText(cruise.cabinType),
    normalizeText(cruise.guests),
    normalizeText(cruise.guestsInfo),
    normalizeText(cruise.offerCategory ?? cruise.category),
  ].join('|');
}

/**
 * Queryable inventory identity for an available cruise option.
 *
 * Easy Seas users do not treat "Harmony on September 10" as one available
 * cruise when it appears under several casino offers, cabins, guest counts, or
 * B2B positions. Each exported/scraped offer-sailing row is an actionable
 * option, so the SQLite catalog must retain that row-level identity while the
 * physical sailing key remains available above for itinerary/calendar logic.
 */
export function getCruiseInventoryOptionKey(cruise: Cruise): string {
  const physicalKey = getCanonicalCruiseInventoryKey(cruise);
  if (!physicalKey) return '';

  const offerInstanceKey = getCruiseOfferInstanceKey(cruise);
  if (!offerInstanceKey) return physicalKey;

  const source = cruise as Cruise & {
    b2bSequence?: string | number;
    b2b?: string | number;
    sourceRowIndex?: string | number;
  };
  return [
    physicalKey,
    'available-option',
    offerInstanceKey,
    normalizeText(cruise.offerCode),
    normalizeText(cruise.offerName),
    getOfferExpiryDate(cruise),
    normalizeText(cruise.cabinType),
    normalizeText(cruise.guests),
    normalizeText(cruise.guestsInfo),
    normalizeText(cruise.offerCategory ?? cruise.category),
    normalizeText(source.b2bSequence ?? source.b2b),
    getCruiseInventorySourceIdentity(cruise),
  ].join('|');
}

export function getCruiseInventorySourceIdentity(cruise: Cruise): string {
  const stableProviderId = getStableProviderSailingId(cruise);
  if (stableProviderId) return stableProviderId;
  return normalizeText(cruise.sourceRecordId ?? cruise.sourceEvidence?.sourceRecordId ?? cruise.id);
}
