import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';

function normalizeKeyPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function normalizeOfferCode(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
}

function normalizeDateKey(value: unknown): string {
  const normalized = normalizeKeyPart(value);
  return normalized.includes('t') ? normalized.split('t')[0] : normalized;
}

function getSourceKey(value: { cruiseSource?: Cruise['cruiseSource']; offerSource?: CasinoOffer['offerSource']; brand?: string }): string {
  return normalizeKeyPart(value.brand ?? value.cruiseSource ?? value.offerSource);
}

function getOwnerKey(value: { ownerProfileId?: string; sourceEmail?: string; dataOwnerEmail?: string }): string {
  return [
    normalizeKeyPart(value.ownerProfileId),
    normalizeKeyPart(value.sourceEmail ?? value.dataOwnerEmail),
  ].join('|');
}

export function getCruiseIdentityKey(cruise: Cruise): string {
  const naturalParts = [
    getOwnerKey(cruise),
    getSourceKey(cruise),
    normalizeKeyPart(cruise.shipName),
    normalizeDateKey(cruise.sailDate),
    normalizeDateKey(cruise.returnDate),
    normalizeOfferCode(cruise.offerCode),
    normalizeKeyPart(cruise.cabinType),
  ];

  if (naturalParts[2] && naturalParts[3]) {
    return `sailing:${naturalParts.join('|')}`;
  }

  const id = normalizeKeyPart(cruise.id);
  return id ? `id:${getOwnerKey(cruise)}|${getSourceKey(cruise)}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(cruise))}`;
}

export function getBookedCruiseIdentityKey(cruise: BookedCruise): string {
  const ownerKey = getOwnerKey(cruise);
  const sourceKey = getSourceKey(cruise);
  const reservation = normalizeKeyPart(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber);
  if (reservation) {
    return `reservation:${ownerKey}|${sourceKey}|${reservation}`;
  }

  const naturalParts = [
    ownerKey,
    sourceKey,
    normalizeKeyPart(cruise.shipName),
    normalizeDateKey(cruise.sailDate),
    normalizeDateKey(cruise.returnDate),
  ];

  if (naturalParts[2] && naturalParts[3]) {
    return `sailing:${naturalParts.join('|')}`;
  }

  const id = normalizeKeyPart(cruise.id);
  return id ? `id:${ownerKey}|${sourceKey}|${id}` : `payload:${normalizeKeyPart(JSON.stringify(cruise))}`;
}

export function getOfferIdentityKey(offer: CasinoOffer): string {
  const naturalParts = [
    getOwnerKey(offer),
    getSourceKey(offer),
    normalizeOfferCode(offer.offerCode),
    normalizeKeyPart(offer.shipName),
    normalizeDateKey(offer.sailingDate),
    normalizeKeyPart(offer.roomType),
    normalizeKeyPart(offer.offerName ?? offer.title),
  ];

  if (naturalParts[2] || (naturalParts[3] && naturalParts[4])) {
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
  items.forEach((item) => {
    const key = getKey(item);
    if (keyedItems.has(key)) {
      console.log('[DataIdentity] Deduped duplicate record:', { label, key });
    }
    keyedItems.set(key, item);
  });
  return Array.from(keyedItems.values());
}

export function dedupeCruises(items: Cruise[], label = 'cruises'): Cruise[] {
  return dedupeByIdentity(items, getCruiseIdentityKey, label);
}

export function dedupeBookedCruises(items: BookedCruise[], label = 'booked cruises'): BookedCruise[] {
  return dedupeByIdentity(items, getBookedCruiseIdentityKey, label);
}

export function dedupeCasinoOffers(items: CasinoOffer[], label = 'casino offers'): CasinoOffer[] {
  return dedupeByIdentity(items, getOfferIdentityKey, label);
}

export function dedupeCalendarEvents(items: CalendarEvent[], label = 'calendar events'): CalendarEvent[] {
  return dedupeByIdentity(items, getCalendarEventIdentityKey, label);
}
