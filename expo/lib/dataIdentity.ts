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

function isPlaceholderBookedIdentifier(value: unknown): boolean {
  const normalized = normalizeKeyPart(value);
  if (!normalized) return true;
  return /^(?:unconfirmed:|booking[_:-]?\d*|rc[_:-]?\d*|cruise[_:-]?\d*|row[_:-]?\d*|temp(?:orary)?[_:-]?\d*|unknown(?:[_:-].*)?)$/i.test(normalized);
}

function getBookedReservationKey(cruise: BookedCruise): string {
  const candidates = [cruise.reservationNumber, cruise.bookingId, cruise.bwoNumber];
  for (const candidate of candidates) {
    const normalized = normalizeKeyPart(candidate);
    if (normalized && !isPlaceholderBookedIdentifier(normalized)) return normalized;
  }
  return '';
}

function getBookedCabinKey(cruise: BookedCruise): string {
  return normalizeKeyPart(
    cruise.cabinNumber ??
    cruise.stateroomNumber ??
    cruise.cabinCategory ??
    cruise.stateroomCategoryCode ??
    cruise.cabinType
  );
}

function getBookedGuestKey(cruise: BookedCruise): string {
  const guests = Array.isArray(cruise.guestNames)
    ? cruise.guestNames.map(normalizeKeyPart).filter(Boolean).sort()
    : [];
  return guests.join('|');
}

function getBookedSailingKey(cruise: BookedCruise, includeStrongDiscriminators: boolean): string {
  const ship = normalizeKeyPart(cruise.shipName);
  const sailDate = normalizeDateKey(cruise.sailDate);
  const returnDate = normalizeDateKey(cruise.returnDate);

  if (!ship || !sailDate) {
    return '';
  }

  if (!includeStrongDiscriminators) {
    return `sailing:${[getSourceKey(cruise), ship, sailDate].join('|')}`;
  }

  // Booked/completed cruises are shared travel inventory, so owner/profile is never part
  // of their identity. Cabin and guest signatures prevent one couple/room from collapsing
  // into another when a reservation number is omitted; otherwise the stable record ID is used.
  const cabin = getBookedCabinKey(cruise);
  const guests = getBookedGuestKey(cruise);
  if (!cabin && !guests) {
    return '';
  }

  return `sailing:${[
    getSourceKey(cruise),
    ship,
    sailDate,
    returnDate,
    cabin,
    guests,
  ].join('|')}`;
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
  if (existingReservation && incomingReservation && existingReservation !== incomingReservation) {
    return false;
  }

  const existingCabin = getBookedCabinKey(existing);
  const incomingCabin = getBookedCabinKey(incoming);
  if (existingCabin && incomingCabin && existingCabin !== incomingCabin) {
    return false;
  }

  const existingGuests = getBookedGuestKey(existing);
  const incomingGuests = getBookedGuestKey(incoming);
  if (existingGuests && incomingGuests && existingGuests !== incomingGuests) {
    return false;
  }

  if (existingReservation || incomingReservation) {
    // One payload may omit a reservation number that another payload supplies. Only merge
    // that partial row when a strong cabin or guest signature agrees; ship/date alone is
    // never sufficient proof.
    return Boolean(
      (existingCabin && incomingCabin && existingCabin === incomingCabin) ||
      (existingGuests && incomingGuests && existingGuests === incomingGuests)
    );
  }

  // With no reservation numbers, require a strong matching discriminator. Exact IDs and
  // strict identities are handled before this loose-sailing fallback.
  return Boolean(
    (existingCabin && incomingCabin && existingCabin === incomingCabin) ||
    (existingGuests && incomingGuests && existingGuests === incomingGuests)
  );
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
  const sourceKey = getSourceKey(cruise);
  const reservation = getBookedReservationKey(cruise);
  if (reservation) {
    return `reservation:${sourceKey}|${reservation}`;
  }

  const sailingKey = getBookedSailingKey(cruise, true);
  if (sailingKey) {
    return sailingKey;
  }

  // Without a reservation, cabin, or guest signature, ship/date is not unique enough to
  // merge safely. Prefer the stable record ID so two real same-date trips cannot disappear.
  const id = normalizeKeyPart(cruise.id);
  return id ? `id:${sourceKey}|${id}` : `payload:${sourceKey}|${normalizeKeyPart(JSON.stringify(cruise))}`;
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

export interface BookedCruiseDedupeLedgerEntry {
  inputIndex: number;
  inputIdentity: string;
  outputIndex: number;
  outputIdentity: string;
  action: 'kept' | 'merged';
  reason: 'new' | 'exact_identity' | 'stable_id' | 'reservation' | 'strict_sailing' | 'loose_sailing';
  reservationNumber?: string;
  shipName?: string;
  sailDate?: string;
}

export interface BookedCruiseDedupeResult {
  cruises: BookedCruise[];
  ledger: BookedCruiseDedupeLedgerEntry[];
}

/**
 * Deduplicates booked/history rows while retaining a complete input-to-output ledger.
 *
 * A row that gains a reservation number from a more complete duplicate legitimately changes
 * identity during the merge. The ledger records its final output index/identity so persistence
 * validation can prove that the row was represented without falsely treating that identity
 * upgrade as data loss.
 */
export function dedupeBookedCruisesWithLedger(
  items: BookedCruise[],
  label = 'booked cruises',
  mergeFn: (existing: BookedCruise, incoming: BookedCruise) => BookedCruise = (existing, incoming) =>
    mergeRecordPreferIncoming(
      existing as unknown as Record<string, unknown>,
      incoming as unknown as Record<string, unknown>,
    ) as unknown as BookedCruise,
): BookedCruiseDedupeResult {
  const result: BookedCruise[] = [];
  const ledger: BookedCruiseDedupeLedgerEntry[] = [];
  const identityToIndex = new Map<string, number>();
  const idToIndex = new Map<string, number>();
  const reservationToIndex = new Map<string, number>();
  const strictSailingToIndex = new Map<string, number>();
  const looseSailingToIndexes = new Map<string, number[]>();

  const rememberIndexes = (cruise: BookedCruise, index: number) => {
    identityToIndex.set(getBookedCruiseIdentityKey(cruise), index);

    const id = normalizeKeyPart(cruise.id);
    if (id) idToIndex.set(id, index);

    const reservation = getBookedReservationKey(cruise);
    if (reservation) reservationToIndex.set(reservation, index);

    const strictSailing = getBookedSailingKey(cruise, true);
    if (strictSailing) strictSailingToIndex.set(strictSailing, index);

    const looseSailing = getBookedSailingKey(cruise, false);
    if (looseSailing) {
      const indexes = looseSailingToIndexes.get(looseSailing) ?? [];
      if (!indexes.includes(index)) looseSailingToIndexes.set(looseSailing, [...indexes, index]);
    }
  };

  items.forEach((item, inputIndex) => {
    const identityKey = getBookedCruiseIdentityKey(item);
    const idKey = normalizeKeyPart(item.id);
    const reservationKey = getBookedReservationKey(item);
    const strictSailingKey = getBookedSailingKey(item, true);
    const looseSailingKey = getBookedSailingKey(item, false);

    let matchedIndex = identityToIndex.get(identityKey);
    let matchReason: BookedCruiseDedupeLedgerEntry['reason'] = matchedIndex !== undefined ? 'exact_identity' : 'new';

    if (matchedIndex === undefined && idKey) {
      const idCandidate = idToIndex.get(idKey);
      if (idCandidate !== undefined) {
        const candidateReservation = getBookedReservationKey(result[idCandidate]);
        // A recycled/stale record ID can never override two different real reservation numbers.
        if (!(candidateReservation && reservationKey && candidateReservation !== reservationKey)) {
          matchedIndex = idCandidate;
          matchReason = 'stable_id';
        }
      }
    }

    if (matchedIndex === undefined && reservationKey) {
      matchedIndex = reservationToIndex.get(reservationKey);
      if (matchedIndex !== undefined) matchReason = 'reservation';
    }

    if (matchedIndex === undefined && strictSailingKey) {
      const strictCandidate = strictSailingToIndex.get(strictSailingKey);
      if (strictCandidate !== undefined && shouldMergeBookedByLooseSailing(result[strictCandidate], item)) {
        matchedIndex = strictCandidate;
        matchReason = 'strict_sailing';
      }
    }

    if (matchedIndex === undefined && looseSailingKey) {
      const candidates = looseSailingToIndexes.get(looseSailingKey) ?? [];
      const looseCandidate = candidates.find((candidateIndex) => shouldMergeBookedByLooseSailing(result[candidateIndex], item));
      if (looseCandidate !== undefined) {
        matchedIndex = looseCandidate;
        matchReason = 'loose_sailing';
      }
    }

    if (matchedIndex !== undefined) {
      console.log('[DataIdentity] Deduped duplicate booked cruise:', {
        label,
        reason: matchReason,
        identityKey,
        idKey,
        reservationKey,
        sailingKey: looseSailingKey,
        shipName: item.shipName,
        sailDate: item.sailDate,
      });
      result[matchedIndex] = mergeFn(result[matchedIndex], item);
      rememberIndexes(result[matchedIndex], matchedIndex);
      ledger.push({
        inputIndex,
        inputIdentity: identityKey,
        outputIndex: matchedIndex,
        outputIdentity: '',
        action: 'merged',
        reason: matchReason,
        reservationNumber: reservationKey || undefined,
        shipName: item.shipName,
        sailDate: item.sailDate,
      });
      return;
    }

    const nextIndex = result.length;
    result.push(item);
    rememberIndexes(item, nextIndex);
    ledger.push({
      inputIndex,
      inputIdentity: identityKey,
      outputIndex: nextIndex,
      outputIdentity: '',
      action: 'kept',
      reason: 'new',
      reservationNumber: reservationKey || undefined,
      shipName: item.shipName,
      sailDate: item.sailDate,
    });
  });

  const finalizedLedger = ledger.map((entry) => ({
    ...entry,
    outputIdentity: getBookedCruiseIdentityKey(result[entry.outputIndex]),
  }));

  return { cruises: result, ledger: finalizedLedger };
}

export function dedupeBookedCruises(items: BookedCruise[], label = 'booked cruises'): BookedCruise[] {
  return dedupeBookedCruisesWithLedger(items, label).cruises;
}

export function dedupeCasinoOffers(items: CasinoOffer[], label = 'casino offers'): CasinoOffer[] {
  return dedupeByIdentity(items, getOfferIdentityKey, label);
}

export function dedupeCalendarEvents(items: CalendarEvent[], label = 'calendar events'): CalendarEvent[] {
  return dedupeByIdentity(items, getCalendarEventIdentityKey, label);
}
