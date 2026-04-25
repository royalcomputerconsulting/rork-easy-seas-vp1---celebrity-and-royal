import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { transformOfferRowsToCruisesAndOffers, transformBookedCruisesToAppFormat, type SyncDataSource } from './dataTransformers';
import { isActiveBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';

const CELEBRITY_SHIP_NAMES = new Set([
  'ascent',
  'apex',
  'beyond',
  'constellation',
  'eclipse',
  'edge',
  'equinox',
  'flora',
  'infinity',
  'millennium',
  'reflection',
  'silhouette',
  'solstice',
  'summit',
  'xcel',
  'celebrity ascent',
  'celebrity apex',
  'celebrity beyond',
  'celebrity constellation',
  'celebrity eclipse',
  'celebrity edge',
  'celebrity equinox',
  'celebrity flora',
  'celebrity infinity',
  'celebrity millennium',
  'celebrity reflection',
  'celebrity silhouette',
  'celebrity solstice',
  'celebrity summit',
  'celebrity xcel',
]);

function normalizeSyncSource(source: string | undefined): SyncDataSource | undefined {
  if (source === 'royal' || source === 'celebrity' || source === 'carnival') {
    return source;
  }

  if (source === 'royal_caribbean') {
    return 'royal';
  }

  return undefined;
}

function inferSourceFromText(...values: Array<string | undefined>): SyncDataSource | undefined {
  const normalized = values
    .map((value) => value?.trim().toLowerCase() ?? '')
    .filter(Boolean)
    .join(' ');

  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes('blue chip') ||
    normalized.includes("captain's club") ||
    normalized.includes('captains club') ||
    normalized.includes('celebritycruises.com') ||
    normalized.includes('celebrity cruises')
  ) {
    return 'celebrity';
  }

  if (
    normalized.includes('club royale') ||
    normalized.includes('crown & anchor') ||
    normalized.includes('crown and anchor') ||
    normalized.includes('royalcaribbean.com') ||
    normalized.includes('royal caribbean')
  ) {
    return 'royal';
  }

  if (
    normalized.includes('vifp') ||
    normalized.includes('carnival.com') ||
    normalized.includes('carnival cruise') ||
    normalized.includes('carnival ')
  ) {
    return 'carnival';
  }

  return undefined;
}

function resolveCruiseSource(cruise: Cruise | BookedCruise): SyncDataSource | undefined {
  const explicitSource = normalizeSyncSource(cruise.cruiseSource);
  if (explicitSource) {
    return explicitSource;
  }

  const shipName = cruise.shipName?.trim().toLowerCase() ?? '';
  if (shipName.includes('of the seas')) {
    return 'royal';
  }
  if (shipName.startsWith('carnival ')) {
    return 'carnival';
  }
  if (shipName.startsWith('celebrity ') || CELEBRITY_SHIP_NAMES.has(shipName)) {
    return 'celebrity';
  }

  return inferSourceFromText(
    cruise.shipName,
    cruise.offerName,
    cruise.itineraryName,
    cruise.destination,
    cruise.departurePort,
    cruise.notes,
  );
}

function resolveOfferSource(offer: CasinoOffer): SyncDataSource | undefined {
  const explicitSource = normalizeSyncSource(offer.offerSource);
  if (explicitSource) {
    return explicitSource;
  }

  const shipName = offer.shipName?.trim().toLowerCase() ?? '';
  if (shipName.includes('of the seas')) {
    return 'royal';
  }
  if (shipName.startsWith('carnival ')) {
    return 'carnival';
  }
  if (shipName.startsWith('celebrity ') || CELEBRITY_SHIP_NAMES.has(shipName)) {
    return 'celebrity';
  }

  return inferSourceFromText(
    offer.shipName,
    offer.offerName,
    offer.title,
    offer.description,
    offer.category,
    offer.bookingLink,
    ...(offer.cruiseLines ?? []),
  );
}

function withResolvedCruiseSource<T extends Cruise | BookedCruise>(cruise: T): T {
  const resolvedSource = resolveCruiseSource(cruise);
  if (!resolvedSource || cruise.cruiseSource === resolvedSource) {
    return cruise;
  }

  return {
    ...cruise,
    cruiseSource: resolvedSource,
  };
}

function withResolvedOfferSource(offer: CasinoOffer): CasinoOffer {
  const resolvedSource = resolveOfferSource(offer);
  if (!resolvedSource || offer.offerSource === resolvedSource) {
    return offer;
  }

  return {
    ...offer,
    offerSource: resolvedSource,
  };
}

function areSourcesCompatible(sourceA: SyncDataSource | undefined, sourceB: SyncDataSource | undefined): boolean {
  if (sourceA === undefined && sourceB === undefined) {
    return true;
  }

  if (sourceA === undefined || sourceB === undefined) {
    return false;
  }

  return sourceA === sourceB;
}

function isManagedOfferSource(offer: CasinoOffer, syncSource: SyncDataSource): boolean {
  return resolveOfferSource(offer) === syncSource;
}

function isManagedCruiseSource(cruise: Cruise | BookedCruise, syncSource: SyncDataSource): boolean {
  return resolveCruiseSource(cruise) === syncSource;
}

export function normalizeOfferSources(offers: CasinoOffer[]): CasinoOffer[] {
  return offers.map((offer) => withResolvedOfferSource(offer));
}

export function normalizeCruiseSources(cruises: Cruise[]): Cruise[] {
  return cruises.map((cruise) => withResolvedCruiseSource(cruise));
}

export function normalizeBookedCruiseSources(cruises: BookedCruise[]): BookedCruise[] {
  return cruises.map((cruise) => withResolvedCruiseSource(cruise));
}

function isInProgressBookedCruise(cruise: BookedCruise, today: Date): boolean {
  if (cruise.completionState === 'in-progress') {
    return true;
  }

  if (!cruise.sailDate || !cruise.returnDate) {
    return false;
  }

  try {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    sailDate.setHours(0, 0, 0, 0);
    returnDate.setHours(0, 0, 0, 0);
    return today >= sailDate && today <= returnDate;
  } catch {
    return false;
  }
}

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

function normalizeComparableText(value: string | undefined): string {
  return (value || '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}

function isInProgressOffer(
  offerCode: string | undefined,
  offerName: string | undefined,
  offerStatus?: string,
  isInProgress?: boolean
): boolean {
  if (isInProgress === true) {
    console.log(`[SyncLogic] Detected IN PROGRESS offer flag: ${offerCode || offerName || 'unknown'}`);
    return true;
  }

  const normalizedStatus = normalizeComparableText(offerStatus);
  const normalizedName = normalizeComparableText(offerName);

  const statusIndicatesInProgress =
    normalizedStatus.includes('in progress') ||
    normalizedStatus.includes('pending') ||
    normalizedStatus.includes('processing') ||
    normalizedStatus.includes('earning') ||
    normalizedStatus.includes('not yet available');

  if (statusIndicatesInProgress) {
    console.log(`[SyncLogic] Detected IN PROGRESS offer status: ${offerCode || offerName || 'unknown'} (${offerStatus})`);
    return true;
  }

  if (normalizedName.includes('in progress') && !normalizedName.includes('cruise reward')) {
    console.log(`[SyncLogic] Detected IN PROGRESS offer name: ${offerCode || offerName || 'unknown'}`);
    return true;
  }
  
  return false;
}

function isEmptyOfferRow(row: OfferRow): boolean {
  return !row.shipName?.trim() && !row.sailingDate?.trim();
}

function getOfferExpiry(offer: CasinoOffer): string {
  return normalizeSailDate(offer.offerExpiryDate || offer.expiryDate || offer.expires || offer.offerExpiry || '');
}

function getOfferNameKey(offer: CasinoOffer): string {
  return normalizeComparableText(offer.offerName || offer.title || offer.description || '');
}

function findMatchingOffer(
  offer: CasinoOffer,
  existingOffers: CasinoOffer[]
): CasinoOffer | null {
  const offerSource = resolveOfferSource(offer);
  const offerCode = (offer.offerCode || '').trim().toUpperCase();
  const offerExpiry = getOfferExpiry(offer);
  const offerName = getOfferNameKey(offer);
  
  return existingOffers.find(existing => {
    const existingSource = resolveOfferSource(existing);
    if (!areSourcesCompatible(offerSource, existingSource)) {
      return false;
    }

    const existingCode = (existing.offerCode || '').trim().toUpperCase();
    const existingExpiry = getOfferExpiry(existing);
    const existingName = getOfferNameKey(existing);
    
    if (offerCode && existingCode && offerCode === existingCode) {
      if (offerExpiry || existingExpiry) {
        return offerExpiry === existingExpiry;
      }
      if (offerName && existingName) {
        return offerName === existingName;
      }
      return !isInstantRewardOrCertificate(offer.offerCode, offer.offerName) && !isInstantRewardOrCertificate(existing.offerCode, existing.offerName);
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
  const cruiseOfferExpiry = normalizeSailDate(cruise.offerExpiry);
  const cruiseSource = resolveCruiseSource(cruise);
  
  return existingCruises.find(existing => {
    const existingSource = resolveCruiseSource(existing);
    if (!areSourcesCompatible(cruiseSource, existingSource)) {
      return false;
    }

    const existingShip = normalizeShipName(existing.shipName);
    const existingDate = normalizeSailDate(existing.sailDate);
    const existingCabin = normalizeCabinType(existing.cabinType);
    const existingOfferCode = (existing.offerCode || '').trim().toUpperCase();
    const existingOfferExpiry = normalizeSailDate(existing.offerExpiry);
    if (
      cruiseOfferCode &&
      existingOfferCode &&
      cruiseOfferCode === existingOfferCode &&
      (cruiseOfferExpiry || existingOfferExpiry) &&
      cruiseOfferExpiry !== existingOfferExpiry
    ) {
      return false;
    }
    
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
  const cruiseSource = resolveCruiseSource(cruise);

  return existingCruises.find(existing => {
    const existingSource = resolveCruiseSource(existing);
    if (!areSourcesCompatible(cruiseSource, existingSource)) {
      return false;
    }

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
  currentLoyalty: { clubRoyalePoints: number; clubRoyaleTier: string; crownAndAnchorPoints: number; crownAndAnchorLevel: string },
  syncSource: SyncDataSource = 'royal'
): SyncPreview {
  const normalizedExistingOffers = normalizeOfferSources(existingOffers);
  const normalizedExistingCruises = normalizeCruiseSources(existingCruises);
  const normalizedExistingBookedCruises = normalizeBookedCruiseSources(existingBookedCruises);

  // STEP 0: Deduplicate raw extracted cruises (prevents duplicates from multiple API captures)
  const dedupedBookedCruises = deduplicateExtractedCruises(extractedBookedCruises);
  console.log(`[SyncLogic] After dedup: ${dedupedBookedCruises.length} unique cruises from ${extractedBookedCruises.length} raw`);

  const filteredOffers = extractedOffers.filter(offer => {
    if (isInProgressOffer(offer.offerCode, offer.offerName, offer.offerStatus, offer.isInProgress)) {
      console.log(`[SyncLogic] Skipping IN PROGRESS offer: ${offer.offerCode} - ${offer.offerName}`);
      return false;
    }
    return true;
  });
  
  const inProgressCount = extractedOffers.length - filteredOffers.length;
  if (inProgressCount > 0) {
    console.log(`[SyncLogic] Filtered out ${inProgressCount} IN PROGRESS offer(s) from sync`);
  }

  const { cruises: transformedCruises, offers: transformedOffers } = transformOfferRowsToCruisesAndOffers(filteredOffers, loyaltyData, syncSource);
  const transformedBookedCruises = transformBookedCruisesToAppFormat(dedupedBookedCruises, loyaltyData, syncSource);

  console.log(`[SyncLogic] Transformed ${transformedCruises.length} cruise records from ${filteredOffers.length} offer rows`);

  const offersNew: CasinoOffer[] = [];
  const offersUpdates: { existing: CasinoOffer; updated: CasinoOffer }[] = [];
  const offersUnchanged: CasinoOffer[] = [];

  for (const offer of transformedOffers) {
    const match = findMatchingOffer(offer, normalizedExistingOffers);
    if (match) {
      const merged = mergeOffer(match, offer);
      offersUpdates.push({ existing: match, updated: merged });
    } else {
      offersNew.push(offer);
    }
  }

  for (const existing of normalizedExistingOffers) {
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
    const match = findMatchingCruise(cruise, normalizedExistingCruises);
    if (match) {
      const merged = mergeCruise(match, cruise);
      cruisesUpdates.push({ existing: match, updated: merged });
    } else {
      cruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingCruises) {
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
    const match = findMatchingBookedCruise(cruise, normalizedExistingBookedCruises);
    if (match) {
      const merged = mergeBookedCruise(match, cruise);
      bookedCruisesUpdates.push({ existing: match, updated: merged });
    } else {
      bookedCruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingBookedCruises) {
    const isMatched = transformedBookedCruises.some(cruise => findMatchingBookedCruise(cruise, [existing]));
    if (!isMatched && existing.cruiseSource === 'royal') {
      bookedCruisesUnchanged.push(existing);
    } else if (!isMatched) {
      bookedCruisesUnchanged.push(existing);
    }
  }

  let loyaltyPreview: SyncPreview['loyalty'] = null;
  if (loyaltyData && syncSource !== 'carnival') {
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
  const allBookedCruises = [
    ...preview.bookedCruises.new,
    ...preview.bookedCruises.updates.map(u => u.updated),
    ...preview.bookedCruises.unchanged,
  ];

  const upcomingCruises = allBookedCruises.filter(c => isActiveBookedCruise(c)).length;
  const courtesyHolds = allBookedCruises.filter(c => isCourtesyHoldCruise(c)).length;
  
  console.log('[SyncLogic] calculateSyncCounts:', {
    newCruises: preview.bookedCruises.new.length,
    updatedCruises: preview.bookedCruises.updates.length,
    unchangedCruises: preview.bookedCruises.unchanged.length,
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
    totalOffers: preview.offers.new.length + preview.offers.updates.length + preview.offers.unchanged.length,
    totalCruises: preview.cruises.new.length + preview.cruises.updates.length + preview.cruises.unchanged.length,
    totalBookedCruises: preview.bookedCruises.new.length + preview.bookedCruises.updates.length + preview.bookedCruises.unchanged.length
  };
}

export interface ApplySyncPreviewOptions {
  allowOfferRemoval?: boolean;
  allowCruiseRemoval?: boolean;
  allowBookedCruiseRemoval?: boolean;
}

export function applySyncPreview(
  preview: SyncPreview,
  existingOffers: CasinoOffer[],
  existingCruises: Cruise[],
  existingBookedCruises: BookedCruise[],
  syncSource: SyncDataSource = 'royal',
  options?: ApplySyncPreviewOptions
): { offers: CasinoOffer[]; cruises: Cruise[]; bookedCruises: BookedCruise[] } {
  const normalizedExistingOffers = normalizeOfferSources(existingOffers);
  const normalizedExistingCruises = normalizeCruiseSources(existingCruises);
  const normalizedExistingBookedCruises = normalizeBookedCruiseSources(existingBookedCruises);
  const allowOfferRemoval = options?.allowOfferRemoval ?? true;
  const allowCruiseRemoval = options?.allowCruiseRemoval ?? true;
  const allowBookedCruiseRemoval = options?.allowBookedCruiseRemoval ?? true;

  // STRATEGY: Synced data is the SOURCE OF TRUTH for the active sync source.
  // Items from that source NOT present in the sync are REMOVED only when we captured
  // authoritative data for that section in the current sync. Other sources are always preserved.
  // When a section failed to capture any rows, preserve the existing data to avoid destructive overwrites.

  const updatedOfferIds = new Set(preview.offers.updates.map(u => u.existing.id));
  const finalOffers = [
    // Keep offers from other sources; drop active-source offers not present in this sync
    ...normalizedExistingOffers
      .filter(o => {
        if (allowOfferRemoval && isManagedOfferSource(o, syncSource) && !updatedOfferIds.has(o.id)) {
          const isBeingReplaced = preview.offers.new.some(newOffer => 
            findMatchingOffer(newOffer, [o])
          );
          if (!isBeingReplaced) {
            console.log(`[SyncLogic] Removing stale ${syncSource}-source offer: ${o.offerCode} - ${o.offerName}`);
            return false;
          }
        }
        return true;
      })
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
    // Keep cruises from other sources; drop active-source cruises not in sync
    ...normalizedExistingCruises
      .filter(c => {
        if (allowCruiseRemoval && isManagedCruiseSource(c, syncSource) && !updatedCruiseIds.has(c.id)) {
          const isBeingReplaced = preview.cruises.new.some(newCruise => 
            findMatchingCruise(newCruise, [c])
          );
          if (!isBeingReplaced) {
            console.log(`[SyncLogic] Removing stale ${syncSource}-source cruise: ${c.shipName} on ${c.sailDate}`);
            return false;
          }
        }
        return true;
      })
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const finalBookedCruises = [
    // Keep booked cruises from other sources; drop active-source UPCOMING cruises not in sync
    // ALWAYS preserve completed cruises — sync only captures currently visible website bookings
    ...normalizedExistingBookedCruises
      .filter(c => {
        if (allowBookedCruiseRemoval && isManagedCruiseSource(c, syncSource) && !updatedBookedCruiseIds.has(c.id)) {
          const isCompleted = c.completionState === 'completed' || c.status === 'completed';
          const isInProgress = isInProgressBookedCruise(c, today);
          let isPastReturnDate = false;
          if (c.returnDate) {
            try {
              const returnDate = createDateFromString(c.returnDate);
              returnDate.setHours(0, 0, 0, 0);
              isPastReturnDate = returnDate < today;
            } catch {
              isPastReturnDate = false;
            }
          }
          if (isCompleted || isPastReturnDate || isInProgress) {
            console.log(`[SyncLogic] Preserving ${isInProgress ? 'in-progress' : 'completed'} ${syncSource}-source booked cruise: ${c.shipName} on ${c.sailDate}`);
            return true;
          }

          const isBeingReplaced = preview.bookedCruises.new.some(newCruise => 
            findMatchingBookedCruise(newCruise, [c])
          );
          if (!isBeingReplaced) {
            console.log(`[SyncLogic] Removing stale ${syncSource}-source booked cruise: ${c.shipName} on ${c.sailDate}`);
            return false;
          }
        }
        return true;
      })
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

  console.log('[SyncLogic] applySyncPreview final counts:', {
    syncSource,
    allowOfferRemoval,
    allowCruiseRemoval,
    allowBookedCruiseRemoval,
    existingOffers: normalizedExistingOffers.length,
    finalOffers: finalOffers.length,
    existingCruises: normalizedExistingCruises.length,
    finalCruises: finalCruises.length,
    existingBooked: normalizedExistingBookedCruises.length,
    finalBooked: finalBookedCruises.length,
    managedOffersDelta: finalOffers.filter(o => isManagedOfferSource(o, syncSource)).length - normalizedExistingOffers.filter(o => isManagedOfferSource(o, syncSource)).length,
    managedCruisesDelta: finalCruises.filter(c => isManagedCruiseSource(c, syncSource)).length - normalizedExistingCruises.filter(c => isManagedCruiseSource(c, syncSource)).length,
  });

  return { offers: finalOffers, cruises: finalCruises, bookedCruises: finalBookedCruises };
}
