import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';
import { getRecordAuthority, isAtLeastAsAuthoritative, isRecordIncomplete } from './dataAuthority';
import { toCalendarDateOnly } from './date';

function normalizeKeyPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function normalizeOfferCode(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
}

function normalizeProviderOfferInstance(value: {
  playerOfferId?: string;
  offerInstanceId?: string;
  carnivalOfferId?: string;
}): string {
  return [value.playerOfferId, value.offerInstanceId, value.carnivalOfferId]
    .map((candidate) => normalizeKeyPart(candidate))
    .find(Boolean) ?? '';
}

function normalizeMaterialList(value: unknown): string {
  if (!Array.isArray(value)) return normalizeKeyPart(value);
  return value.map((item) => normalizeKeyPart(item)).filter(Boolean).join('>');
}

function normalizeDateKey(value: unknown): string {
  const normalized = normalizeKeyPart(value);
  if (!normalized) return '';

  const calendarDate = toCalendarDateOnly(normalized);
  if (calendarDate) return calendarDate;

  const dateOnly = normalized.includes('t') ? normalized.split('t')[0] : normalized;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateOnly) || /^\d{8}$/.test(dateOnly)) {
    return '';
  }
  const compactMatch = dateOnly.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = dateOnly.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const mdyMatch = dateOnly.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (mdyMatch) {
    const [, month, day, yearPart] = mdyMatch;
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateOnly;
}

function getSourceKey(value: { cruiseSource?: Cruise['cruiseSource']; offerSource?: string; brand?: string }): string {
  return normalizeKeyPart(value.brand ?? value.cruiseSource ?? value.offerSource);
}

function getOwnerKey(value: { ownerProfileId?: string; sourceEmail?: string; dataOwnerEmail?: string; dataOwnerScopeId?: string }): string {
  return [
    normalizeKeyPart(value.ownerProfileId ?? value.dataOwnerScopeId),
    normalizeKeyPart(value.sourceEmail ?? value.dataOwnerEmail),
  ].join('|');
}

function hasOwnerOrSource(value: { ownerProfileId?: string; sourceEmail?: string; dataOwnerEmail?: string; dataOwnerScopeId?: string; cruiseSource?: Cruise['cruiseSource']; offerSource?: string; brand?: string }): boolean {
  return Boolean(
    normalizeKeyPart(value.ownerProfileId ?? value.dataOwnerScopeId) ||
    normalizeKeyPart(value.sourceEmail ?? value.dataOwnerEmail) ||
    getSourceKey(value)
  );
}

function getBookedReservationKey(cruise: BookedCruise): string {
  // Provider booking IDs are the strongest reservation identity. Older EasySeas
  // builds sometimes generated a sailing-based reservationNumber before the
  // Royal booking ID arrived; preferring that synthetic value can collapse two
  // real reservations on the same sailing (for example, two cabins booked on
  // the same Harmony departure).
  return normalizeKeyPart(cruise.bookingId ?? cruise.reservationNumber ?? cruise.bwoNumber);
}

function getBookedSailingKey(cruise: BookedCruise, includeOwnerAndSource: boolean): string {
  const ship = normalizeKeyPart(cruise.shipName);
  const sailDate = normalizeDateKey(cruise.sailDate);
  const returnDate = normalizeDateKey(cruise.returnDate);

  if (!ship || !sailDate) {
    return '';
  }

  const baseParts = includeOwnerAndSource ? [ship, sailDate, returnDate] : [ship, sailDate];
  if (!includeOwnerAndSource) {
    return `sailing:${baseParts.join('|')}`;
  }

  return `sailing:${[getOwnerKey(cruise), getSourceKey(cruise), ...baseParts].join('|')}`;
}

function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergeRecordPreferIncoming<T extends Record<string, unknown>>(existing: T, incoming: T): T {
  const merged: Record<string, unknown> = { ...existing };
  const existingAuthority = getRecordAuthority(existing);
  const incomingAuthority = getRecordAuthority(incoming);
  const incomingCanReplaceExisting =
    isAtLeastAsAuthoritative(incomingAuthority, existingAuthority) && !isRecordIncomplete(incoming);
  Object.entries(incoming).forEach(([key, value]) => {
    const preservesExisting = (CRITICAL_RECONCILIATION_FIELDS.has(key) || AUTHORITY_CONTROLLED_FIELDS.has(key))
      && isMeaningfulValue(existing[key])
      && !incomingCanReplaceExisting;
    if (isMeaningfulValue(value) && !preservesExisting) {
      merged[key] = value;
    }
  });
  return merged as T;
}

const CRITICAL_RECONCILIATION_FIELDS = new Set([
  'sailDate', 'returnDate', 'nights', 'shipName', 'departurePort', 'destination',
  'itinerary', 'ports', 'portsAndTimes', 'reservationNumber', 'bookingId',
  'offerCode', 'roomType', 'cabinType', 'guests', 'freePlay', 'freeOBC',
  'tradeInValue', 'interiorPrice', 'oceanviewPrice', 'balconyPrice', 'suitePrice',
]);

// Provenance and validation must travel with the authoritative record. A lower
// authority response cannot relabel a verified record while its core fields remain.
const AUTHORITY_CONTROLLED_FIELDS = new Set([
  'sourceAuthority', 'sourceEvidence', 'dataConfidence', 'validationStatus',
  'isFallback', 'isStale', 'sourceProvider', 'sourceEndpoint', 'sourceRecordId',
  'sourceRetrievedAt', 'parserVersion', 'syncRunId',
]);

function shouldMergeBookedByLooseSailing(existing: BookedCruise, incoming: BookedCruise): boolean {
  const existingLooseSailing = getBookedSailingKey(existing, false);
  const incomingLooseSailing = getBookedSailingKey(incoming, false);
  if (!existingLooseSailing || existingLooseSailing !== incomingLooseSailing) {
    return false;
  }

  const existingReservation = getBookedReservationKey(existing);
  const incomingReservation = getBookedReservationKey(incoming);
  if (existingReservation && incomingReservation && existingReservation !== incomingReservation) {
    return false;
  }
  const sameOwner = getOwnerKey(existing) === getOwnerKey(incoming);
  const oneRecordIsIncomplete =
    !existingReservation ||
    !incomingReservation ||
    !hasOwnerOrSource(existing) ||
    !hasOwnerOrSource(incoming);

  return (sameOwner && (!existingReservation || !incomingReservation)) || oneRecordIsIncomplete;
}

function canMergeBookedRecords(existing: BookedCruise, incoming: BookedCruise): boolean {
  const existingReservation = getBookedReservationKey(existing);
  const incomingReservation = getBookedReservationKey(incoming);

  // Never use a shared sailing, owner, or generated row ID to combine two
  // provider-confirmed reservations. Multiple cabins commonly share a ship and
  // departure date and must remain independently actionable.
  if (existingReservation && incomingReservation) {
    return existingReservation === incomingReservation;
  }

  return true;
}

export function getCruiseIdentityKey(cruise: Cruise): string {
  const naturalParts = [
    getOwnerKey(cruise),
    getSourceKey(cruise),
    normalizeProviderOfferInstance(cruise),
    normalizeKeyPart(cruise.shipName),
    normalizeDateKey(cruise.sailDate),
    normalizeDateKey(cruise.returnDate),
    normalizeOfferCode(cruise.offerCode),
    normalizeKeyPart(cruise.cabinType),
    normalizeKeyPart(cruise.guests),
    normalizeKeyPart(cruise.guestsInfo),
    normalizeKeyPart(cruise.offerCategory ?? cruise.category),
    normalizeKeyPart(cruise.itineraryName ?? cruise.destination),
    normalizeMaterialList(cruise.ports),
    normalizeMaterialList(cruise.perks),
  ];

  if (naturalParts[3] && naturalParts[4]) {
    return `sailing:${naturalParts.join('|')}`;
  }

  const id = normalizeKeyPart(cruise.id);
  return id ? `id:${getOwnerKey(cruise)}|${getSourceKey(cruise)}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(cruise))}`;
}

export function getBookedCruiseIdentityKey(cruise: BookedCruise): string {
  const ownerKey = getOwnerKey(cruise);
  const sourceKey = getSourceKey(cruise);
  const reservation = getBookedReservationKey(cruise);
  if (reservation) {
    return `reservation:${ownerKey}|${sourceKey}|${reservation}`;
  }

  const sailingKey = getBookedSailingKey(cruise, true);
  if (sailingKey) {
    return sailingKey;
  }

  const id = normalizeKeyPart(cruise.id);
  return id ? `id:${ownerKey}|${sourceKey}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(cruise))}`;
}

export function getOfferIdentityKey(offer: CasinoOffer): string {
  const naturalParts = [
    getOwnerKey(offer),
    getSourceKey(offer),
    normalizeProviderOfferInstance(offer),
    normalizeOfferCode(offer.offerCode),
    normalizeKeyPart(offer.shipName),
    normalizeDateKey(offer.sailingDate),
    normalizeKeyPart(offer.roomType),
    normalizeKeyPart(offer.offerName ?? offer.title),
    normalizeKeyPart(offer.guests),
    normalizeKeyPart(offer.guestsInfo),
    normalizeKeyPart(offer.offerType),
    normalizeKeyPart(offer.category),
    normalizeKeyPart(offer.itineraryName),
    normalizeMaterialList(offer.ports),
    normalizeMaterialList(offer.perks),
  ];

  if (naturalParts[3] || (naturalParts[4] && naturalParts[5])) {
    return `offer:${naturalParts.join('|')}`;
  }

  const id = normalizeKeyPart(offer.id);
  return id ? `id:${getOwnerKey(offer)}|${getSourceKey(offer)}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(offer))}`;
}

export function getCalendarEventIdentityKey(event: CalendarEvent): string {
  const start = normalizeDateKey(event.start ?? event.startDate);
  const end = normalizeDateKey(event.end ?? event.endDate);
  const naturalParts = [
    getOwnerKey(event),
    normalizeKeyPart(event.cruiseId),
    normalizeKeyPart(event.title),
    start,
    end,
    normalizeKeyPart(event.type),
    normalizeKeyPart(event.location),
  ];

  if (naturalParts[2] && naturalParts[3]) {
    return `event:${naturalParts.join('|')}`;
  }

  const id = normalizeKeyPart(event.id);
  return id ? `id:${getOwnerKey(event)}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(event))}`;
}

export function dedupeByIdentity<T>(items: T[], getKey: (item: T) => string, label: string): T[] {
  const keyedItems = new Map<string, T>();
  let duplicateCount = 0;
  const duplicateSamples: string[] = [];
  items.forEach((item) => {
    const key = getKey(item);
    if (keyedItems.has(key)) {
      duplicateCount += 1;
      if (duplicateSamples.length < 3) duplicateSamples.push(key);
    }
    keyedItems.set(key, item);
  });
  if (duplicateCount > 0) {
    console.log('[DataIdentity] Deduped records:', { label, duplicateCount, samples: duplicateSamples });
  }
  return Array.from(keyedItems.values());
}

export function dedupeCruises(items: Cruise[], label = 'cruises'): Cruise[] {
  return dedupeByIdentity(items, getCruiseIdentityKey, label);
}

export function dedupeBookedCruises(items: BookedCruise[], label = 'booked cruises'): BookedCruise[] {
  const result: BookedCruise[] = [];
  const identityToIndex = new Map<string, number>();
  const idToIndex = new Map<string, number>();
  const reservationToIndex = new Map<string, number>();
  const strictSailingToIndexes = new Map<string, number[]>();
  const looseSailingToIndexes = new Map<string, number[]>();
  let duplicateCount = 0;
  const duplicateSamples: string[] = [];

  const rememberIndexes = (cruise: BookedCruise, index: number) => {
    identityToIndex.set(getBookedCruiseIdentityKey(cruise), index);

    const id = normalizeKeyPart(cruise.id);
    if (id) {
      idToIndex.set(id, index);
    }

    const reservation = getBookedReservationKey(cruise);
    if (reservation) {
      reservationToIndex.set(reservation, index);
    }

    const strictSailing = getBookedSailingKey(cruise, true);
    if (strictSailing) {
      const indexes = strictSailingToIndexes.get(strictSailing) ?? [];
      if (!indexes.includes(index)) {
        strictSailingToIndexes.set(strictSailing, [...indexes, index]);
      }
    }

    const looseSailing = getBookedSailingKey(cruise, false);
    if (looseSailing) {
      const indexes = looseSailingToIndexes.get(looseSailing) ?? [];
      if (!indexes.includes(index)) {
        looseSailingToIndexes.set(looseSailing, [...indexes, index]);
      }
    }
  };

  items.forEach((item) => {
    const identityKey = getBookedCruiseIdentityKey(item);
    const idKey = normalizeKeyPart(item.id);
    const reservationKey = getBookedReservationKey(item);
    const strictSailingKey = getBookedSailingKey(item, true);
    const looseSailingKey = getBookedSailingKey(item, false);

    let matchedIndex = identityToIndex.get(identityKey);

    if (matchedIndex !== undefined && !canMergeBookedRecords(result[matchedIndex], item)) {
      matchedIndex = undefined;
    }

    if (matchedIndex === undefined && idKey) {
      const idMatch = idToIndex.get(idKey);
      if (idMatch !== undefined && canMergeBookedRecords(result[idMatch], item)) {
        matchedIndex = idMatch;
      }
    }

    if (matchedIndex === undefined && reservationKey) {
      matchedIndex = reservationToIndex.get(reservationKey);
    }

    if (matchedIndex === undefined && strictSailingKey) {
      const candidates = strictSailingToIndexes.get(strictSailingKey) ?? [];
      matchedIndex = candidates.find((candidateIndex) => canMergeBookedRecords(result[candidateIndex], item));
    }

    if (matchedIndex === undefined && looseSailingKey) {
      const candidates = looseSailingToIndexes.get(looseSailingKey) ?? [];
      matchedIndex = candidates.find((candidateIndex) => shouldMergeBookedByLooseSailing(result[candidateIndex], item));
    }

    if (matchedIndex !== undefined) {
      duplicateCount += 1;
      if (duplicateSamples.length < 3) duplicateSamples.push(identityKey || idKey || reservationKey || looseSailingKey);
      result[matchedIndex] = mergeRecordPreferIncoming(result[matchedIndex] as unknown as Record<string, unknown>, item as unknown as Record<string, unknown>) as unknown as BookedCruise;
      rememberIndexes(result[matchedIndex], matchedIndex);
      return;
    }

    const nextIndex = result.length;
    result.push(item);
    rememberIndexes(item, nextIndex);
  });

  if (duplicateCount > 0) {
    console.log('[DataIdentity] Deduped booked cruises:', { label, duplicateCount, samples: duplicateSamples });
  }

  return result;
}

export function dedupeCasinoOffers(items: CasinoOffer[], label = 'casino offers'): CasinoOffer[] {
  return dedupeByIdentity(items, getOfferIdentityKey, label);
}

export function dedupeCalendarEvents(items: CalendarEvent[], label = 'calendar events'): CalendarEvent[] {
  return dedupeByIdentity(items, getCalendarEventIdentityKey, label);
}
