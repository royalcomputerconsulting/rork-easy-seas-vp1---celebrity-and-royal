import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';
import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { transformOfferRowsToCruisesAndOffers, transformBookedCruisesToAppFormat } from './dataTransformers';

export interface SyncPreview {
  offers: {
    new: CasinoOffer[];
    updates: { existing: CasinoOffer; updated: CasinoOffer }[];
    unchanged: CasinoOffer[];
  };
  cruises: {
    new: Cruise[];
    updates: { existing: Cruise; updated: Cruise }[];
    unchanged: Cruise[];
  };
  bookedCruises: {
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
  bookedCruisesNew: number;
  bookedCruisesUpdated: number;
  bookedCruisesUnchanged: number;
  upcomingCruises: number;
  courtesyHolds: number;
  totalOffers: number;
  totalCruises: number;
  totalBookedCruises: number;
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
  cruise: Cruise,
  existingCruises: Cruise[]
): Cruise | null {
  return existingCruises.find(existing => {
    if (cruise.offerCode && existing.offerCode && cruise.offerCode === existing.offerCode) {
      if (cruise.shipName === existing.shipName && cruise.sailDate === existing.sailDate) {
        return true;
      }
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

function findMatchingBookedCruise(
  cruise: BookedCruise,
  existingCruises: BookedCruise[]
): BookedCruise | null {
  return existingCruises.find(existing => {
    // PRIORITY 1: Match by reservation number (most reliable)
    if (cruise.reservationNumber && existing.reservationNumber) {
      const cruiseRes = cruise.reservationNumber.toString().trim();
      const existingRes = existing.reservationNumber.toString().trim();
      if (cruiseRes && existingRes && cruiseRes === existingRes) {
        console.log(`[Dedup] Matched by reservation number: ${cruise.reservationNumber}`);
        return true;
      }
    }
    
    // PRIORITY 2: Match by booking ID
    if (cruise.bookingId && existing.bookingId) {
      const cruiseBook = cruise.bookingId.toString().trim();
      const existingBook = existing.bookingId.toString().trim();
      if (cruiseBook && existingBook && cruiseBook === existingBook) {
        console.log(`[Dedup] Matched by booking ID: ${cruise.bookingId}`);
        return true;
      }
    }
    
    // PRIORITY 3: Match by ship name + sail date (exact match)
    if (
      cruise.shipName && existing.shipName &&
      cruise.sailDate && existing.sailDate &&
      cruise.shipName.trim() === existing.shipName.trim() &&
      cruise.sailDate.trim() === existing.sailDate.trim()
    ) {
      console.log(`[Dedup] Matched by ship + date: ${cruise.shipName} on ${cruise.sailDate}`);
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

function mergeCruise(existing: Cruise, synced: Cruise): Cruise {
  return {
    ...existing,
    ...synced,
    id: existing.id,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt
  };
}

function mergeBookedCruise(existing: BookedCruise, synced: BookedCruise): BookedCruise {
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
  extractedBookedCruises: BookedCruiseRow[],
  loyaltyData: LoyaltyData | null,
  existingOffers: CasinoOffer[],
  existingCruises: Cruise[],
  existingBookedCruises: BookedCruise[],
  currentLoyalty: { clubRoyalePoints: number; clubRoyaleTier: string; crownAndAnchorPoints: number; crownAndAnchorLevel: string }
): SyncPreview {
  const { cruises: transformedCruises, offers: transformedOffers } = transformOfferRowsToCruisesAndOffers(extractedOffers, loyaltyData);
  const transformedBookedCruises = transformBookedCruisesToAppFormat(extractedBookedCruises, loyaltyData);

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

  const cruisesNew: Cruise[] = [];
  const cruisesUpdates: { existing: Cruise; updated: Cruise }[] = [];
  const cruisesUnchanged: Cruise[] = [];

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

  const bookedCruisesNew: BookedCruise[] = [];
  const bookedCruisesUpdates: { existing: BookedCruise; updated: BookedCruise }[] = [];
  const bookedCruisesUnchanged: BookedCruise[] = [];

  for (const cruise of transformedBookedCruises) {
    const match = findMatchingBookedCruise(cruise, existingBookedCruises);
    if (match) {
      const merged = mergeBookedCruise(match, cruise);
      bookedCruisesUpdates.push({ existing: match, updated: merged });
    } else {
      bookedCruisesNew.push(cruise);
    }
  }

  for (const existing of existingBookedCruises) {
    const isMatched = transformedBookedCruises.some(cruise => findMatchingBookedCruise(cruise, [existing]));
    if (!isMatched && existing.cruiseSource === 'royal') {
      bookedCruisesUnchanged.push(existing);
    } else if (!isMatched) {
      bookedCruisesUnchanged.push(existing);
    }
  }

  let loyaltyPreview = null;
  if (loyaltyData) {
    const syncedClubRoyalePoints: number = loyaltyData.clubRoyalePoints != null
      ? (typeof loyaltyData.clubRoyalePoints === 'number' 
          ? loyaltyData.clubRoyalePoints 
          : (parseInt(String(loyaltyData.clubRoyalePoints).replace(/,/g, ''), 10) || 0))
      : currentLoyalty.clubRoyalePoints;
    const syncedClubRoyaleTier = loyaltyData.clubRoyaleTier || currentLoyalty.clubRoyaleTier;
    const syncedCrownAndAnchorLevel = loyaltyData.crownAndAnchorLevel || currentLoyalty.crownAndAnchorLevel;
    const syncedCrownAndAnchorPoints = loyaltyData.crownAndAnchorPoints != null
      ? (typeof loyaltyData.crownAndAnchorPoints === 'number'
          ? loyaltyData.crownAndAnchorPoints
          : parseInt(String(loyaltyData.crownAndAnchorPoints).replace(/,/g, ''), 10) || 0)
      : currentLoyalty.crownAndAnchorPoints;

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
    bookedCruises: {
      new: bookedCruisesNew,
      updates: bookedCruisesUpdates,
      unchanged: bookedCruisesUnchanged
    },
    loyalty: loyaltyPreview
  };
}

export function calculateSyncCounts(preview: SyncPreview): SyncPreviewCounts {
  const upcomingCruises = preview.bookedCruises.new.filter(c => c.status === 'booked').length + 
                          preview.bookedCruises.updates.filter(u => u.updated.status === 'booked').length;
  const courtesyHolds = preview.bookedCruises.new.filter(c => c.status === 'available').length + 
                        preview.bookedCruises.updates.filter(u => u.updated.status === 'available').length;

  return {
    offersNew: preview.offers.new.length,
    offersUpdated: preview.offers.updates.length,
    offersUnchanged: preview.offers.unchanged.length,
    cruisesNew: preview.cruises.new.length,
    cruisesUpdated: preview.cruises.updates.length,
    cruisesUnchanged: preview.cruises.unchanged.length,
    bookedCruisesNew: preview.bookedCruises.new.length,
    bookedCruisesUpdated: preview.bookedCruises.updates.length,
    bookedCruisesUnchanged: preview.bookedCruises.unchanged.length,
    upcomingCruises,
    courtesyHolds,
    totalOffers: preview.offers.new.length + preview.offers.updates.length,
    totalCruises: preview.cruises.new.length + preview.cruises.updates.length,
    totalBookedCruises: preview.bookedCruises.new.length + preview.bookedCruises.updates.length
  };
}

export function applySyncPreview(
  preview: SyncPreview,
  existingOffers: CasinoOffer[],
  existingCruises: Cruise[],
  existingBookedCruises: BookedCruise[]
): { offers: CasinoOffer[]; cruises: Cruise[]; bookedCruises: BookedCruise[] } {
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

  const updatedBookedCruiseIds = new Set(preview.bookedCruises.updates.map(u => u.existing.id));
  const finalBookedCruises = [
    ...existingBookedCruises
      .filter(c => !updatedBookedCruiseIds.has(c.id))
      .filter(c => {
        const isBeingReplaced = preview.bookedCruises.new.some(newCruise => 
          findMatchingBookedCruise(newCruise, [c])
        );
        return !isBeingReplaced;
      }),
    ...preview.bookedCruises.updates.map(u => u.updated),
    ...preview.bookedCruises.new
  ];

  return { offers: finalOffers, cruises: finalCruises, bookedCruises: finalBookedCruises };
}
