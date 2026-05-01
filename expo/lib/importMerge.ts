import type { BookedCruise, CasinoOffer, Cruise, ImportReconciliationSummary } from '@/types/models';
import {
  dedupeBookedCruises,
  dedupeCasinoOffers,
  dedupeCruises,
  getBookedCruiseIdentityKey,
  getCruiseIdentityKey,
  getOfferIdentityKey,
} from '@/lib/dataIdentity';
import { applyFoundationFields, buildReconciliationSummary } from '@/lib/dataFoundation';

type SyncSource = NonNullable<Cruise['cruiseSource']>;

export interface ImportMergeOptions {
  ownerProfileId?: string | null;
  sourceEmail?: string | null;
}

export interface ImportMergeResult<T> {
  merged: T[];
  reconciliation: ImportReconciliationSummary;
}

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

export function mergeImportedCruises(existingCruises: Cruise[], importedCruises: Cruise[], options: ImportMergeOptions = {}): Cruise[] {
  return mergeImportedCruisesWithReconciliation(existingCruises, importedCruises, options).merged;
}

export function mergeImportedCruisesWithReconciliation(existingCruises: Cruise[], importedCruises: Cruise[], options: ImportMergeOptions = {}): ImportMergeResult<Cruise> {
  const preparedImported = applyFoundationFields(importedCruises, {
    fallbackOwnerProfileId: options.ownerProfileId,
    fallbackSourceEmail: options.sourceEmail,
    fallbackBrand: getImportedSource({ cruises: importedCruises }),
    markUnassigned: true,
  });
  const merged = dedupeCruises([...existingCruises, ...preparedImported], 'merged imported cruises');
  return {
    merged,
    reconciliation: buildReconciliationSummary(existingCruises, preparedImported, merged, getCruiseIdentityKey),
  };
}

export function mergeImportedOffers(existingOffers: CasinoOffer[], importedOffers: CasinoOffer[], options: ImportMergeOptions = {}): CasinoOffer[] {
  return mergeImportedOffersWithReconciliation(existingOffers, importedOffers, options).merged;
}

export function mergeImportedOffersWithReconciliation(existingOffers: CasinoOffer[], importedOffers: CasinoOffer[], options: ImportMergeOptions = {}): ImportMergeResult<CasinoOffer> {
  const preparedImported = applyFoundationFields(importedOffers, {
    fallbackOwnerProfileId: options.ownerProfileId,
    fallbackSourceEmail: options.sourceEmail,
    fallbackBrand: getImportedSource({ offers: importedOffers }),
    markUnassigned: true,
  });
  const importedKeys = new Set(preparedImported.map(getOfferIdentityKey));
  const preparedExisting = existingOffers.map((offer) => {
    const sameImportSource = getImportedSource({ offers: preparedImported }) !== null && offer.offerSource === getImportedSource({ offers: preparedImported });
    const shouldReviewMissing = sameImportSource && !importedKeys.has(getOfferIdentityKey(offer)) && offer.archiveStatus !== 'archived';
    return shouldReviewMissing
      ? { ...offer, archiveStatus: 'reviewNeeded' as const, reconciliationStatus: 'reviewNeeded' as const }
      : offer;
  });
  const merged = dedupeCasinoOffers([...preparedExisting, ...preparedImported], 'merged imported offers');
  return {
    merged,
    reconciliation: buildReconciliationSummary(preparedExisting, preparedImported, merged, getOfferIdentityKey),
  };
}

export function mergeImportedBookedCruises(existingCruises: BookedCruise[], importedCruises: BookedCruise[], options: ImportMergeOptions = {}): BookedCruise[] {
  return mergeImportedBookedCruisesWithReconciliation(existingCruises, importedCruises, options).merged;
}

export function mergeImportedBookedCruisesWithReconciliation(existingCruises: BookedCruise[], importedCruises: BookedCruise[], options: ImportMergeOptions = {}): ImportMergeResult<BookedCruise> {
  const preparedImported = applyFoundationFields(importedCruises, {
    fallbackOwnerProfileId: options.ownerProfileId,
    fallbackSourceEmail: options.sourceEmail,
    fallbackBrand: getImportedSource({ bookedCruises: importedCruises }),
    markUnassigned: true,
  });
  const importSource = getImportedSource({ bookedCruises: preparedImported });
  const importedKeys = new Set(preparedImported.map(getBookedCruiseIdentityKey));
  const preparedExisting = existingCruises.map((cruise) => {
    const sameImportSource = importSource !== null && cruise.cruiseSource === importSource;
    const shouldReviewMissing = sameImportSource && !isCompletedBookedCruise(cruise) && !importedKeys.has(getBookedCruiseIdentityKey(cruise));
    return shouldReviewMissing
      ? { ...cruise, reconciliationStatus: 'reviewNeeded' as const, importStatus: cruise.importStatus ?? 'reviewNeeded' as const }
      : cruise;
  });
  const merged = dedupeBookedCruises([...preparedExisting, ...preparedImported], 'merged imported booked cruises');
  return {
    merged,
    reconciliation: buildReconciliationSummary(preparedExisting, preparedImported, merged, getBookedCruiseIdentityKey),
  };
}

export function getImportedSourceLabel(source: SyncSource | null): string {
  if (source === 'carnival') return 'Carnival';
  if (source === 'celebrity') return 'Celebrity';
  if (source === 'royal') return 'Royal Caribbean';
  return 'Imported';
}
