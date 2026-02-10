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

function isInstantRewardOrCertificate(offerCode: string | undefined, offerName: string | undefined): boolean {
  if (!offerCode && !offerName) return false;
  
  const normalizedCode = (offerCode || '').toUpperCase().trim();
  const normalizedName = (offerName || '').toLowerCase().trim();
  
  if (normalizedName.includes('instant reward') || normalizedName.includes('instant certificate')) {
    return true;
  }
  
  const instantRewardPattern = /^\d{2,4}[AC]\d{2,3}[A-Z]?$/;
  if (instantRewardPattern.test(normalizedCode)) {
    return true;
  }
  
  return false;
}

// Offer codes that represent "IN PROGRESS" offers that should not be synced
const IN_PROGRESS_OFFER_CODES = ['2601C05', '2601A05'];

function isInProgressOffer(offerCode: string | undefined, offerName: string | undefined): boolean {
  if (!offerCode && !offerName) return false;
  
  const normalizedCode = (offerCode || '').toUpperCase().trim();
  
  // Check against known IN PROGRESS offer codes
  if (IN_PROGRESS_OFFER_CODES.some(code => normalizedCode.includes(code.toUpperCase()))) {
    console.log(`[SyncLogic] Detected IN PROGRESS offer: ${offerCode}`);
    return true;
  }
  
  return false;
}

function findMatchingOffer(
  offer: CasinoOffer,
  existingOffers: CasinoOffer[]
): CasinoOffer | null {
  if (isInstantRewardOrCertificate(offer.offerCode, offer.offerName)) {
    return null;
  }
  
  return existingOffers.find(existing => {
    if (isInstantRewardOrCertificate(existing.offerCode, existing.offerName)) {
      return false;
    }
    
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

function normalizeCabinType(cabinType: string | undefined): string {
  if (!cabinType) return 'unknown';
  return cabinType.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeShipName(shipName: string | undefined): string {
  if (!shipName) return '';
  return shipName.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeSailDate(sailDate: string | undefined): string {
  if (!sailDate) return '';
  // Normalize to MM-DD-YYYY format
  try {
    const date = new Date(sailDate);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${month}-${day}-${year}`;
    }
  } catch {
    // Fall through
  }
  return sailDate.trim();
}

function findMatchingCruise(
  cruise: Cruise,
  existingCruises: Cruise[]
): Cruise | null {
  const cruiseShip = normalizeShipName(cruise.shipName);
  const cruiseDate = normalizeSailDate(cruise.sailDate);
  const cruiseCabin = normalizeCabinType(cruise.cabinType);
  const cruiseOfferCode = (cruise.offerCode || '').trim().toUpperCase();
  
  return existingCruises.find(existing => {
    const existingShip = normalizeShipName(existing.shipName);
    const existingDate = normalizeSailDate(existing.sailDate);
    const existingCabin = normalizeCabinType(existing.cabinType);
    const existingOfferCode = (existing.offerCode || '').trim().toUpperCase();
    
    // IMPORTANT: Two sailings on the same ship/date but with DIFFERENT offer codes are NOT duplicates
    // Each offer should create its own cruise entry
    
    // PRIORITY 1: Match by ship + sail date + cabin type + offer code (most specific)
    if (
      cruiseShip && existingShip &&
      cruiseDate && existingDate &&
      cruiseShip === existingShip &&
      cruiseDate === existingDate &&
      cruiseCabin === existingCabin &&
      cruiseOfferCode && existingOfferCode &&
      cruiseOfferCode === existingOfferCode
    ) {
      console.log(`[Dedup Cruise] Matched by ship+date+cabin+offer: ${cruise.shipName} on ${cruise.sailDate} (${cruise.cabinType}) [${cruise.offerCode}]`);
      return true;
    }
    
    // PRIORITY 2: Match by ship + sail date + offer code (when one has unknown cabin)
    if (
      cruiseShip && existingShip &&
      cruiseDate && existingDate &&
      cruiseShip === existingShip &&
      cruiseDate === existingDate &&
      cruiseOfferCode && existingOfferCode &&
      cruiseOfferCode === existingOfferCode
    ) {
      // Only match if cabin types are similar or one is unknown
      const cabinsSimilar = cruiseCabin === existingCabin ||
        cruiseCabin === 'unknown' || existingCabin === 'unknown' ||
        cruiseCabin.includes(existingCabin) || existingCabin.includes(cruiseCabin);
      
      if (cabinsSimilar) {
        console.log(`[Dedup Cruise] Matched by ship+date+offer (similar cabin): ${cruise.shipName} on ${cruise.sailDate} [${cruise.offerCode}]`);
        return true;
      }
    }
    
    // PRIORITY 3: Match by ship + sail date + cabin when NEITHER has an offer code
    // This preserves the old behavior for cruises without offer codes (manually added, imported from CSV, etc.)
    if (
      cruiseShip && existingShip &&
      cruiseDate && existingDate &&
      cruiseShip === existingShip &&
      cruiseDate === existingDate &&
      !cruiseOfferCode && !existingOfferCode
    ) {
      const cabinsSimilar = cruiseCabin === existingCabin ||
        cruiseCabin === 'unknown' || existingCabin === 'unknown' ||
        cruiseCabin.includes(existingCabin) || existingCabin.includes(cruiseCabin);
      
      if (cabinsSimilar) {
        console.log(`[Dedup Cruise] Matched by ship+date+cabin (no offer codes): ${cruise.shipName} on ${cruise.sailDate}`);
        return true;
      }
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
        console.log(`[Dedup BookedCruise] Matched by reservation number: ${cruise.reservationNumber}`);
        return true;
      }
    }
    
    // PRIORITY 2: Match by booking ID
    if (cruise.bookingId && existing.bookingId) {
      const cruiseBook = cruise.bookingId.toString().trim();
      const existingBook = existing.bookingId.toString().trim();
      if (cruiseBook && existingBook && cruiseBook === existingBook) {
        console.log(`[Dedup BookedCruise] Matched by booking ID: ${cruise.bookingId}`);
        return true;
      }
    }
    
    // PRIORITY 3: Match by ship + normalized sail date + cabin type for same-source cruises
    // This catches duplicates from re-syncs or imports where IDs might differ slightly
    if (cruise.cruiseSource === existing.cruiseSource && cruise.cruiseSource === 'royal') {
      const cruiseShip = normalizeShipName(cruise.shipName);
      const existingShip = normalizeShipName(existing.shipName);
      const cruiseDate = normalizeSailDate(cruise.sailDate);
      const existingDate = normalizeSailDate(existing.sailDate);
      const cruiseCabin = normalizeCabinType(cruise.cabinType);
      const existingCabin = normalizeCabinType(existing.cabinType);
      
      if (
        cruiseShip && existingShip && cruiseShip === existingShip &&
        cruiseDate && existingDate && cruiseDate === existingDate &&
        (cruiseCabin === existingCabin || cruiseCabin === 'unknown' || existingCabin === 'unknown' ||
         cruiseCabin.includes(existingCabin) || existingCabin.includes(cruiseCabin))
      ) {
        // Only match if neither has a different booking ID
        const cruiseBook = (cruise.bookingId || '').toString().trim();
        const existingBook = (existing.bookingId || '').toString().trim();
        if (!cruiseBook || !existingBook || cruiseBook === existingBook) {
          console.log(`[Dedup BookedCruise] Matched by ship+date+cabin (same source): ${cruise.shipName} on ${cruise.sailDate}`);
          return true;
        }
      }
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

function deduplicateExtractedCruises(cruises: BookedCruiseRow[]): BookedCruiseRow[] {
  const byBookingId = new Map<string, BookedCruiseRow>();
  const byShipDate = new Map<string, BookedCruiseRow>();
  const result: BookedCruiseRow[] = [];
  
  for (const cruise of cruises) {
    const bookingId = (cruise.bookingId || '').toString().trim();
    const shipName = (cruise.shipName || '').toLowerCase().trim();
    const sailDate = (cruise.sailingStartDate || '').trim();
    const shipDateKey = `${shipName}|${sailDate}`;
    
    if (bookingId && byBookingId.has(bookingId)) {
      console.log(`[SyncLogic] Dedup: Skipping duplicate bookingId: ${bookingId} (${cruise.shipName})`);
      continue;
    }
    
    if (!bookingId && shipName && sailDate && byShipDate.has(shipDateKey)) {
      console.log(`[SyncLogic] Dedup: Skipping duplicate ship+date: ${cruise.shipName} on ${sailDate}`);
      continue;
    }
    
    if (bookingId) byBookingId.set(bookingId, cruise);
    if (shipName && sailDate) byShipDate.set(shipDateKey, cruise);
    result.push(cruise);
  }
  
  if (result.length < cruises.length) {
    console.log(`[SyncLogic] Deduplication: ${cruises.length} -> ${result.length} extracted cruises (removed ${cruises.length - result.length} duplicates)`);
  }
  return result;
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
  // STEP 0: Deduplicate raw extracted cruises (prevents duplicates from multiple API captures)
  const dedupedBookedCruises = deduplicateExtractedCruises(extractedBookedCruises);
  console.log(`[SyncLogic] After dedup: ${dedupedBookedCruises.length} unique cruises from ${extractedBookedCruises.length} raw`);

  // Filter out IN PROGRESS offers before transformation
  const filteredOffers = extractedOffers.filter(offer => {
    if (isInProgressOffer(offer.offerCode, offer.offerName)) {
      console.log(`[SyncLogic] Skipping IN PROGRESS offer: ${offer.offerCode} - ${offer.offerName}`);
      return false;
    }
    return true;
  });
  
  const inProgressCount = extractedOffers.length - filteredOffers.length;
  if (inProgressCount > 0) {
    console.log(`[SyncLogic] Filtered out ${inProgressCount} IN PROGRESS offer(s) from sync`);
  }

  const { cruises: transformedCruises, offers: transformedOffers } = transformOfferRowsToCruisesAndOffers(filteredOffers, loyaltyData);
  const transformedBookedCruises = transformBookedCruisesToAppFormat(dedupedBookedCruises, loyaltyData);

  console.log(`[SyncLogic] Transformed ${transformedCruises.length} cruise records from ${filteredOffers.length} offer rows`);

  const offersNew: CasinoOffer[] = [];
  const offersUpdates: { existing: CasinoOffer; updated: CasinoOffer }[] = [];
  const offersUnchanged: CasinoOffer[] = [];

  for (const offer of transformedOffers) {
    // Skip IN PROGRESS offers during sync
    if (isInProgressOffer(offer.offerCode, offer.offerName)) {
      console.log(`[SyncLogic] Skipping IN PROGRESS offer in sync: ${offer.offerCode}`);
      continue;
    }
    
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

  let loyaltyPreview: SyncPreview['loyalty'] = null;
  if (loyaltyData) {
    const syncedClubRoyalePoints: number = loyaltyData.clubRoyalePoints != null
      ? (typeof loyaltyData.clubRoyalePoints === 'number' 
          ? loyaltyData.clubRoyalePoints 
          : parseInt(String(loyaltyData.clubRoyalePoints).replace(/,/g, ''), 10) || 0)
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
  // Count upcoming cruises - all booked cruises that are NOT courtesy holds
  const upcomingCruises = preview.bookedCruises.new.filter(c => !c.isCourtesyHold).length + 
                          preview.bookedCruises.updates.filter(u => !u.updated.isCourtesyHold).length;
  
  // Count courtesy holds
  const courtesyHolds = preview.bookedCruises.new.filter(c => c.isCourtesyHold === true).length + 
                        preview.bookedCruises.updates.filter(u => u.updated.isCourtesyHold === true).length;
  
  console.log('[SyncLogic] calculateSyncCounts:', {
    newCruises: preview.bookedCruises.new.length,
    updatedCruises: preview.bookedCruises.updates.length,
    upcomingCruises,
    courtesyHolds,
    newCruisesDetails: preview.bookedCruises.new.map(c => ({ ship: c.shipName, date: c.sailDate, isHold: c.isCourtesyHold })),
  });

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
