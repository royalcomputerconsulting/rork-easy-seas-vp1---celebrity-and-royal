import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';

type SyncSource = NonNullable<Cruise['cruiseSource']>;

function getUniqueSources(values: Array<SyncSource | undefined | null>): SyncSource[] {
  return Array.from(new Set(values.filter((value): value is SyncSource => value === 'royal' || value === 'celebrity' || value === 'carnival')));
}

function getCruiseKey(cruise: Cruise): string {
  return [
    cruise.cruiseSource ?? '',
    cruise.shipName.trim().toLowerCase(),
    cruise.sailDate.trim(),
    (cruise.offerCode ?? '').trim().toUpperCase(),
    String(cruise.cabinType ?? '').trim().toLowerCase(),
  ].join('|');
}

function getOfferKey(offer: CasinoOffer): string {
  return [
    offer.offerSource ?? '',
    (offer.offerCode ?? '').trim().toUpperCase(),
    (offer.shipName ?? '').trim().toLowerCase(),
    (offer.sailingDate ?? '').trim(),
    String(offer.roomType ?? '').trim().toLowerCase(),
    (offer.offerName ?? offer.title ?? '').trim().toLowerCase(),
  ].join('|');
}

function getBookedCruiseKey(cruise: BookedCruise): string {
  const identity = (cruise.reservationNumber ?? cruise.bookingId ?? '').trim();
  if (identity) {
    return [cruise.cruiseSource ?? '', identity].join('|');
  }

  return [
    cruise.cruiseSource ?? '',
    cruise.shipName.trim().toLowerCase(),
    cruise.sailDate.trim(),
    String(cruise.cabinNumber ?? '').trim().toLowerCase(),
    String(cruise.cabinType ?? '').trim().toLowerCase(),
  ].join('|');
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => {
    map.set(getKey(item), item);
  });
  return Array.from(map.values());
}

function isCompletedBookedCruise(cruise: BookedCruise): boolean {
  if (cruise.completionState === 'completed' || cruise.status === 'completed') {
    return true;
  }

  if (!cruise.returnDate) {
    return false;
  }

  const returnDate = new Date(cruise.returnDate);
  if (Number.isNaN(returnDate.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return returnDate < today;
}

export function getImportedSource(input: {
  cruises?: Cruise[];
  bookedCruises?: BookedCruise[];
  offers?: CasinoOffer[];
}): SyncSource | null {
  const sources = getUniqueSources([
    ...(input.cruises ?? []).map((cruise) => cruise.cruiseSource),
    ...(input.bookedCruises ?? []).map((cruise) => cruise.cruiseSource),
    ...(input.offers ?? []).map((offer) => offer.offerSource),
  ]);

  return sources.length === 1 ? sources[0] : null;
}

export function mergeImportedCruises(existingCruises: Cruise[], importedCruises: Cruise[]): Cruise[] {
  const importSource = getImportedSource({ cruises: importedCruises });
  if (!importSource) {
    return dedupeByKey([...existingCruises, ...importedCruises], getCruiseKey);
  }

  const preservedCruises = existingCruises.filter((cruise) => cruise.cruiseSource !== importSource);
  return dedupeByKey([...preservedCruises, ...importedCruises], getCruiseKey);
}

export function mergeImportedOffers(existingOffers: CasinoOffer[], importedOffers: CasinoOffer[]): CasinoOffer[] {
  const importSource = getImportedSource({ offers: importedOffers });
  if (!importSource) {
    return dedupeByKey([...existingOffers, ...importedOffers], getOfferKey);
  }

  const preservedOffers = existingOffers.filter((offer) => offer.offerSource !== importSource);
  return dedupeByKey([...preservedOffers, ...importedOffers], getOfferKey);
}

export function mergeImportedBookedCruises(existingCruises: BookedCruise[], importedCruises: BookedCruise[]): BookedCruise[] {
  const importSource = getImportedSource({ bookedCruises: importedCruises });
  if (!importSource) {
    return dedupeByKey([...existingCruises, ...importedCruises], getBookedCruiseKey);
  }

  const preservedCruises = existingCruises.filter((cruise) => cruise.cruiseSource !== importSource || isCompletedBookedCruise(cruise));
  return dedupeByKey([...preservedCruises, ...importedCruises], getBookedCruiseKey);
}

export function getImportedSourceLabel(source: SyncSource | null): string {
  if (source === 'carnival') return 'Carnival';
  if (source === 'celebrity') return 'Celebrity';
  if (source === 'royal') return 'Royal Caribbean';
  return 'Imported';
}
