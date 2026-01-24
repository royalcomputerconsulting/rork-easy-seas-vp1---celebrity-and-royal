import { CasinoOffer, BookedCruise } from '@/types/models';
import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { transformOffersToCasinoOffers, transformBookedCruisesToAppFormat } from './dataTransformers';

export interface SyncPreview {
  offers: {
    new: CasinoOffer[];
    updates: { existing: CasinoOffer; updated: CasinoOffer }[];
    unchanged: CasinoOffer[];
  };
  cruises: {
    new: BookedCruise[];
    updates: { existing: BookedCruise; updated: BookedCruise }[];
    unchanged: BookedCruise[];
  };
  loyalty: {
    clubRoyalePoints: { current: number; synced: number; changed: boolean };
    clubRoyaleTier: { current: string; synced: string; changed: boolean };
    crownAndAnchorPoints: { current: number; synced: number; changed: boolean };
    crownAndAnchorLevel: { current: string; synced: string; changed: boolean };
  } | null;
}

export interface SyncPreviewCounts {
  offersNew: number;
  offersUpdated: number;
  offersUnchanged: number;
  cruisesNew: number;
  cruisesUpdated: number;
  cruisesUnchanged: number;
  upcomingCruises: number;
  courtesyHolds: number;
  totalOffers: number;
  totalCruises: number;
}

function findMatchingOffer(
  offer: CasinoOffer,
  existingOffers: CasinoOffer[]
): CasinoOffer | null {
  return existingOffers.find(existing => {
    if (offer.offerCode && existing.offerCode && offer.offerCode === existing.offerCode) {
      if (offer.shipName === existing.shipName && offer.sailingDate === existing.sailingDate) {
        return true;
      }
    }
    
    if (
      offer.shipName === existing.shipName &&
      offer.sailingDate === existing.sailingDate &&
      offer.roomType === existing.roomType &&
      offer.offerName === existing.offerName
    ) {
      return true;
    }
    
    return false;
  }) || null;
}

function findMatchingCruise(
  cruise: BookedCruise,
  existingCruises: BookedCruise[]
): BookedCruise | null {
  return existingCruises.find(existing => {
    if (cruise.reservationNumber && existing.reservationNumber) {
      return cruise.reservationNumber === existing.reservationNumber;
    }
    
    if (cruise.bookingId && existing.bookingId) {
      return cruise.bookingId === existing.bookingId;
    }
    
    if (
      cruise.shipName === existing.shipName &&
      cruise.sailDate === existing.sailDate &&
      cruise.cabinNumber === existing.cabinNumber &&
      cruise.cabinNumber !== undefined
    ) {
      return true;
    }
    
    if (
      cruise.shipName === existing.shipName &&
      cruise.sailDate === existing.sailDate &&
      cruise.cabinType === existing.cabinType
    ) {
      return true;
    }
    
    return false;
  }) || null;
}

function mergeOffer(existing: CasinoOffer, synced: CasinoOffer): CasinoOffer {
  return {
    ...existing,
    ...synced,
    id: existing.id,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt
  };
}

function mergeCruise(existing: BookedCruise, synced: BookedCruise): BookedCruise {
  return {
    ...existing,
    ...synced,
    id: existing.id,
    earnedPoints: existing.earnedPoints,
    casinoPoints: existing.casinoPoints,
    actualSpend: existing.actualSpend,
    winnings: existing.winnings,
    financialRecordIds: existing.financialRecordIds,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt
  };
}

export function createSyncPreview(
  extractedOffers: OfferRow[],
  extractedCruises: BookedCruiseRow[],
  loyaltyData: LoyaltyData | null,
  existingOffers: CasinoOffer[],
  existingCruises: BookedCruise[],
  currentLoyalty: { clubRoyalePoints: number; clubRoyaleTier: string; crownAndAnchorPoints: number; crownAndAnchorLevel: string }
): SyncPreview {
  const transformedOffers = transformOffersToCasinoOffers(extractedOffers, loyaltyData);
  const transformedCruises = transformBookedCruisesToAppFormat(extractedCruises, loyaltyData);

  const offersNew: CasinoOffer[] = [];
  const offersUpdates: { existing: CasinoOffer; updated: CasinoOffer }[] = [];
  const offersUnchanged: CasinoOffer[] = [];

  for (const offer of transformedOffers) {
    const match = findMatchingOffer(offer, existingOffers);
    if (match) {
      const merged = mergeOffer(match, offer);
      offersUpdates.push({ existing: match, updated: merged });
    } else {
      offersNew.push(offer);
    }
  }

  for (const existing of existingOffers) {
    const isMatched = transformedOffers.some(offer => findMatchingOffer(offer, [existing]));
    if (!isMatched && existing.offerSource === 'royal') {
      offersUnchanged.push(existing);
    } else if (!isMatched) {
      offersUnchanged.push(existing);
    }
  }

  const cruisesNew: BookedCruise[] = [];
  const cruisesUpdates: { existing: BookedCruise; updated: BookedCruise }[] = [];
  const cruisesUnchanged: BookedCruise[] = [];

  for (const cruise of transformedCruises) {
    const match = findMatchingCruise(cruise, existingCruises);
    if (match) {
      const merged = mergeCruise(match, cruise);
      cruisesUpdates.push({ existing: match, updated: merged });
    } else {
      cruisesNew.push(cruise);
    }
  }

  for (const existing of existingCruises) {
    const isMatched = transformedCruises.some(cruise => findMatchingCruise(cruise, [existing]));
    if (!isMatched && existing.cruiseSource === 'royal') {
      cruisesUnchanged.push(existing);
    } else if (!isMatched) {
      cruisesUnchanged.push(existing);
    }
  }

  let loyaltyPreview = null;
  if (loyaltyData) {
    const syncedClubRoyalePoints = currentLoyalty.clubRoyalePoints;
    const syncedClubRoyaleTier = loyaltyData.clubRoyaleTier || currentLoyalty.clubRoyaleTier;
    const syncedCrownAndAnchorPoints = currentLoyalty.crownAndAnchorPoints;
    const syncedCrownAndAnchorLevel = loyaltyData.crownAndAnchorLevel || currentLoyalty.crownAndAnchorLevel;

    loyaltyPreview = {
      clubRoyalePoints: {
        current: currentLoyalty.clubRoyalePoints,
        synced: syncedClubRoyalePoints,
        changed: syncedClubRoyalePoints !== currentLoyalty.clubRoyalePoints
      },
      clubRoyaleTier: {
        current: currentLoyalty.clubRoyaleTier,
        synced: syncedClubRoyaleTier,
        changed: syncedClubRoyaleTier !== currentLoyalty.clubRoyaleTier
      },
      crownAndAnchorPoints: {
        current: currentLoyalty.crownAndAnchorPoints,
        synced: syncedCrownAndAnchorPoints,
        changed: syncedCrownAndAnchorPoints !== currentLoyalty.crownAndAnchorPoints
      },
      crownAndAnchorLevel: {
        current: currentLoyalty.crownAndAnchorLevel,
        synced: syncedCrownAndAnchorLevel,
        changed: syncedCrownAndAnchorLevel !== currentLoyalty.crownAndAnchorLevel
      }
    };
  }

  return {
    offers: {
      new: offersNew,
      updates: offersUpdates,
      unchanged: offersUnchanged
    },
    cruises: {
      new: cruisesNew,
      updates: cruisesUpdates,
      unchanged: cruisesUnchanged
    },
    loyalty: loyaltyPreview
  };
}

export function calculateSyncCounts(preview: SyncPreview): SyncPreviewCounts {
  const upcomingCruises = preview.cruises.new.filter(c => c.status === 'booked').length + 
                          preview.cruises.updates.filter(u => u.updated.status === 'booked').length;
  const courtesyHolds = preview.cruises.new.filter(c => c.status === 'available').length + 
                        preview.cruises.updates.filter(u => u.updated.status === 'available').length;

  return {
    offersNew: preview.offers.new.length,
    offersUpdated: preview.offers.updates.length,
    offersUnchanged: preview.offers.unchanged.length,
    cruisesNew: preview.cruises.new.length,
    cruisesUpdated: preview.cruises.updates.length,
    cruisesUnchanged: preview.cruises.unchanged.length,
    upcomingCruises,
    courtesyHolds,
    totalOffers: preview.offers.new.length + preview.offers.updates.length,
    totalCruises: preview.cruises.new.length + preview.cruises.updates.length
  };
}

export function applySyncPreview(
  preview: SyncPreview,
  existingOffers: CasinoOffer[],
  existingCruises: BookedCruise[]
): { offers: CasinoOffer[]; cruises: BookedCruise[] } {
  const updatedOfferIds = new Set(preview.offers.updates.map(u => u.existing.id));
  const finalOffers = [
    ...existingOffers
      .filter(o => !updatedOfferIds.has(o.id))
      .filter(o => {
        const isBeingReplaced = preview.offers.new.some(newOffer => 
          findMatchingOffer(newOffer, [o])
        );
        return !isBeingReplaced;
      }),
    ...preview.offers.updates.map(u => u.updated),
    ...preview.offers.new
  ];

  const updatedCruiseIds = new Set(preview.cruises.updates.map(u => u.existing.id));
  const finalCruises = [
    ...existingCruises
      .filter(c => !updatedCruiseIds.has(c.id))
      .filter(c => {
        const isBeingReplaced = preview.cruises.new.some(newCruise => 
          findMatchingCruise(newCruise, [c])
        );
        return !isBeingReplaced;
      }),
    ...preview.cruises.updates.map(u => u.updated),
    ...preview.cruises.new
  ];

  return { offers: finalOffers, cruises: finalCruises };
}
