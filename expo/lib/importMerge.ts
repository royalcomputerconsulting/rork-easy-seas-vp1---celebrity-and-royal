import type { BookedCruise, CasinoOffer, Cruise } from '@/types/models';
import {
  dedupeBookedCruises,
  dedupeCasinoOffers,
  dedupeCruises,
} from '@/lib/dataIdentity';

type SyncSource = NonNullable<Cruise['cruiseSource']>;

function getUniqueSources(values: Array<SyncSource | undefined | null>): SyncSource[] {
  return Array.from(new Set(values.filter((value): value is SyncSource => value === 'royal' || value === 'celebrity' || value === 'carnival')));
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
    return dedupeCruises([...existingCruises, ...importedCruises], 'merged imported cruises');
  }

  const preservedCruises = existingCruises.filter((cruise) => cruise.cruiseSource !== importSource);
  return dedupeCruises([...preservedCruises, ...importedCruises], 'merged imported cruises');
}

export function mergeImportedOffers(existingOffers: CasinoOffer[], importedOffers: CasinoOffer[]): CasinoOffer[] {
  const importSource = getImportedSource({ offers: importedOffers });
  if (!importSource) {
    return dedupeCasinoOffers([...existingOffers, ...importedOffers], 'merged imported offers');
  }

  const preservedOffers = existingOffers.filter((offer) => offer.offerSource !== importSource);
  return dedupeCasinoOffers([...preservedOffers, ...importedOffers], 'merged imported offers');
}

export function mergeImportedBookedCruises(existingCruises: BookedCruise[], importedCruises: BookedCruise[]): BookedCruise[] {
  const importSource = getImportedSource({ bookedCruises: importedCruises });
  if (!importSource) {
    return dedupeBookedCruises([...existingCruises, ...importedCruises], 'merged imported booked cruises');
  }

  const preservedCruises = existingCruises.filter((cruise) => cruise.cruiseSource !== importSource || isCompletedBookedCruise(cruise));
  return dedupeBookedCruises([...preservedCruises, ...importedCruises], 'merged imported booked cruises');
}

export function getImportedSourceLabel(source: SyncSource | null): string {
  if (source === 'carnival') return 'Carnival';
  if (source === 'celebrity') return 'Celebrity';
  if (source === 'royal') return 'Royal Caribbean';
  return 'Imported';
}
