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
  if (!normalized) return '';

  const dateOnly = normalized.includes('t') ? normalized.split('t')[0] : normalized;
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

function getSourceKey(value: { cruiseSource?: Cruise['cruiseSource']; offerSource?: CasinoOffer['offerSource']; brand?: string }): string {
  return normalizeKeyPart(value.brand ?? value.cruiseSource ?? value.offerSource);
}

function getOwnerKey(value: { ownerProfileId?: string; sourceEmail?: string; dataOwnerEmail?: string; dataOwnerScopeId?: string }): string {
  return [
    normalizeKeyPart(value.ownerProfileId ?? value.dataOwnerScopeId),
    normalizeKeyPart(value.sourceEmail ?? value.dataOwnerEmail),
  ].join('|');
}

function hasOwnerOrSource(value: { ownerProfileId?: string; sourceEmail?: string; dataOwnerEmail?: string; dataOwnerScopeId?: string; cruiseSource?: Cruise['cruiseSource']; brand?: string }): boolean {
  return Boolean(
    normalizeKeyPart(value.ownerProfileId ?? value.dataOwnerScopeId) ||
    normalizeKeyPart(value.sourceEmail ?? value.dataOwnerEmail) ||
    getSourceKey(value)
  );
}

function getBookedReservationKey(cruise: BookedCruise): string {
  return normalizeKeyPart(cruise.reservationNumber ?? cruise.bookingId ?? cruise.bwoNumber);
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
  Object.entries(incoming).forEach(([key, value]) => {
    if (isMeaningfulValue(value)) {
      merged[key] = value;
    }
  });
  return merged as T;
}

function shouldMergeBookedByLooseSailing(existing: BookedCruise, incoming: BookedCruise): boolean {
  const existingLooseSailing = getBookedSailingKey(existing, false);
  const incomingLooseSailing = getBookedSailingKey(incoming, false);
  if (!existingLooseSailing || existingLooseSailing !== incomingLooseSailing) {
    return false;
  }

  const existingReservation = getBookedReservationKey(existing);
  const incomingReservation = getBookedReservationKey(incoming);
  const sameOwner = getOwnerKey(existing) === getOwnerKey(incoming);
  const oneRecordIsIncomplete =
    !existingReservation ||
    !incomingReservation ||
    !hasOwnerOrSource(existing) ||
    !hasOwnerOrSource(incoming);

  return sameOwner || oneRecordIsIncomplete;
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
  const result: BookedCruise[] = [];
  const identityToIndex = new Map<string, number>();
  const reservationToIndex = new Map<string, number>();
  const strictSailingToIndex = new Map<string, number>();
  const looseSailingToIndexes = new Map<string, number[]>();

  const rememberIndexes = (cruise: BookedCruise, index: number) => {
    identityToIndex.set(getBookedCruiseIdentityKey(cruise), index);

    const reservation = getBookedReservationKey(cruise);
    if (reservation) {
      reservationToIndex.set(reservation, index);
    }

    const strictSailing = getBookedSailingKey(cruise, true);
    if (strictSailing) {
      strictSailingToIndex.set(strictSailing, index);
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
    const reservationKey = getBookedReservationKey(item);
    const strictSailingKey = getBookedSailingKey(item, true);
    const looseSailingKey = getBookedSailingKey(item, false);

    let matchedIndex = identityToIndex.get(identityKey);

    if (matchedIndex === undefined && reservationKey) {
      matchedIndex = reservationToIndex.get(reservationKey);
    }

    if (matchedIndex === undefined && strictSailingKey) {
      matchedIndex = strictSailingToIndex.get(strictSailingKey);
    }

    if (matchedIndex === undefined && looseSailingKey) {
      const candidates = looseSailingToIndexes.get(looseSailingKey) ?? [];
      matchedIndex = candidates.find((candidateIndex) => shouldMergeBookedByLooseSailing(result[candidateIndex], item));
    }

    if (matchedIndex !== undefined) {
      console.log('[DataIdentity] Deduped duplicate booked cruise:', {
        label,
        identityKey,
        reservationKey,
        sailingKey: looseSailingKey,
        shipName: item.shipName,
        sailDate: item.sailDate,
      });
      result[matchedIndex] = mergeRecordPreferIncoming(result[matchedIndex] as unknown as Record<string, unknown>, item as unknown as Record<string, unknown>) as unknown as BookedCruise;
      rememberIndexes(result[matchedIndex], matchedIndex);
      return;
    }

    const nextIndex = result.length;
    result.push(item);
    rememberIndexes(item, nextIndex);
  });

  return result;
}

export function dedupeCasinoOffers(items: CasinoOffer[], label = 'casino offers'): CasinoOffer[] {
  return dedupeByIdentity(items, getOfferIdentityKey, label);
}

export function dedupeCalendarEvents(items: CalendarEvent[], label = 'calendar events'): CalendarEvent[] {
  return dedupeByIdentity(items, getCalendarEventIdentityKey, label);
}
