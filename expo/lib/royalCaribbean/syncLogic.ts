import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';
import { createDateFromString } from '@/lib/date';
import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { transformOfferRowsToCruisesAndOffers, transformBookedCruisesToAppFormat, type SyncDataSource, type SyncOwnershipOptions } from './dataTransformers';
import { isActiveBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';
import { dedupeBookedCruisesWithLedger } from '@/lib/dataIdentity';
import { getExtractedBookedCruiseIdentity } from './bookedExtractionIdentity';

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


function normalizeIsoDateForSync(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let match = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = raw.match(/^(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})/);
  if (match) return `${match[3]}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
  const parsed = createDateFromString(raw);
  return Number.isNaN(parsed.getTime()) ? raw.toLowerCase() : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function completedCanonicalKey(row: BookedCruiseRow): string {
  // Use the same reservation/cabin/guest/full-payload identity as the WebView extraction lane.
  // Ship/date alone is never sufficient because multiple legitimate bookings can share it.
  return getExtractedBookedCruiseIdentity(row);
}

function normalizeSyncSource(source: string | undefined): SyncDataSource | undefined {
  const normalized = String(source || '').trim();
  const lowered = normalized.toLowerCase();
  if (lowered === 'royal' || lowered === 'celebrity' || lowered === 'carnival') {
    return lowered as SyncDataSource;
  }

  if (lowered === 'bluechip' || lowered === 'captainsclub' || lowered === 'celebrity_blue_chip' || lowered === "captain's club") {
    return 'celebrity';
  }

  if (lowered === 'clubroyale' || lowered === 'crownanchor' || lowered === 'royal_caribbean' || lowered === 'crown & anchor') {
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

  const brandSource = normalizeSyncSource(String((cruise as any).brand || ''));
  if (brandSource) return brandSource;
  const casinoProgramSource = normalizeSyncSource(String((cruise as any).casinoProgram || ''));
  if (casinoProgramSource) return casinoProgramSource;

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

  const brandSource = normalizeSyncSource(String((offer as any).brand || ''));
  if (brandSource) return brandSource;
  const casinoProgramSource = normalizeSyncSource(String((offer as any).casinoProgram || ''));
  if (casinoProgramSource) return casinoProgramSource;

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

function normalizeOwnerId(ownerProfileId: string | undefined): string {
  return ownerProfileId?.trim() ?? '';
}

function areOwnersCompatible(incomingOwnerProfileId: string | undefined, existingOwnerProfileId: string | undefined, includeUnownedRecords: boolean = true): boolean {
  const incomingOwner = normalizeOwnerId(incomingOwnerProfileId);
  const existingOwner = normalizeOwnerId(existingOwnerProfileId);
  if (!incomingOwner) {
    return true;
  }

  return existingOwner === incomingOwner || (!existingOwner && includeUnownedRecords);
}

function matchesSyncOwner(recordOwnerProfileId: string | undefined, targetOwnerProfileId?: string, includeUnownedRecords: boolean = true): boolean {
  const targetOwner = normalizeOwnerId(targetOwnerProfileId);
  if (!targetOwner) {
    return true;
  }

  const recordOwner = normalizeOwnerId(recordOwnerProfileId);
  return recordOwner === targetOwner || (!recordOwner && includeUnownedRecords);
}

function isManagedOfferSource(offer: CasinoOffer, syncSource: SyncDataSource, targetOwnerProfileId?: string, includeUnownedRecords: boolean = true): boolean {
  return resolveOfferSource(offer) === syncSource && matchesSyncOwner(offer.ownerProfileId, targetOwnerProfileId, includeUnownedRecords);
}

function isManagedCruiseSource(cruise: Cruise | BookedCruise, syncSource: SyncDataSource, targetOwnerProfileId?: string, includeUnownedRecords: boolean = true): boolean {
  return resolveCruiseSource(cruise) === syncSource && matchesSyncOwner(cruise.ownerProfileId, targetOwnerProfileId, includeUnownedRecords);
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
  return normalizeSailDate(offer.offerExpiryDate || offer.expiryDate || offer.expires || (offer as any).offerExpiry || '');
}

function getOfferNameKey(offer: CasinoOffer): string {
  return normalizeComparableText(offer.offerName || offer.title || offer.description || '');
}

function findMatchingOffer(
  offer: CasinoOffer,
  existingOffers: CasinoOffer[],
  includeUnownedRecords: boolean = true
): CasinoOffer | null {
  const offerSource = resolveOfferSource(offer);
  const offerCode = (offer.offerCode || '').trim().toUpperCase();
  const offerExpiry = getOfferExpiry(offer);
  const offerName = getOfferNameKey(offer);
  
  return existingOffers.find(existing => {
    const existingSource = resolveOfferSource(existing);
    if (!areSourcesCompatible(offerSource, existingSource) || !areOwnersCompatible(offer.ownerProfileId, existing.ownerProfileId, includeUnownedRecords)) {
      return false;
    }

    const existingCode = (existing.offerCode || '').trim().toUpperCase();
    const existingExpiry = getOfferExpiry(existing);
    const existingName = getOfferNameKey(existing);
    
    if (offerCode && existingCode && offerCode === existingCode) {
      // Royal/Celebrity casino offer codes are the authoritative identity for a current Sync Now pull.
      // Earlier builds also required matching expiration/name, which caused the same 5 Royal offers
      // to be appended as 5 new records when the display metadata changed.
      return true;
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
  const raw = String(sailDate).trim();
  let match = raw.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (match) return `${match[2]}-${match[3]}-${match[1]}`;
  match = raw.match(/^(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) return `${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}-${match[1]}`;
  match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}-${year}`;
  }
  try {
    const date = new Date(raw);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${month}-${day}-${year}`;
    }
  } catch {
    // Fall through
  }
  return raw;
}

function findMatchingCruise(
  cruise: Cruise,
  existingCruises: Cruise[],
  includeUnownedRecords: boolean = true
): Cruise | null {
  const cruiseShip = normalizeShipName(cruise.shipName);
  const cruiseDate = normalizeSailDate(cruise.sailDate);
  const cruiseCabin = normalizeCabinType(cruise.cabinType);
  const cruiseOfferCode = (cruise.offerCode || '').trim().toUpperCase();
  const cruiseOfferExpiry = normalizeSailDate(cruise.offerExpiry);
  const cruiseSource = resolveCruiseSource(cruise);
  
  return existingCruises.find(existing => {
    const existingSource = resolveCruiseSource(existing);
    if (!areSourcesCompatible(cruiseSource, existingSource) || !areOwnersCompatible(cruise.ownerProfileId, existing.ownerProfileId, includeUnownedRecords)) {
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
  existingCruises: BookedCruise[],
  includeUnownedRecords: boolean = true
): BookedCruise | null {
  const cruiseSource = resolveCruiseSource(cruise);

  return existingCruises.find(existing => {
    const existingSource = resolveCruiseSource(existing);
    if (!areSourcesCompatible(cruiseSource, existingSource) || !areOwnersCompatible(cruise.ownerProfileId, existing.ownerProfileId, includeUnownedRecords)) {
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
    earnedPoints: existing.earnedPoints ?? synced.earnedPoints,
    casinoPoints: existing.casinoPoints ?? synced.casinoPoints,
    actualSpend: existing.actualSpend ?? synced.actualSpend,
    winnings: existing.winnings ?? synced.winnings,
    financialRecordIds: Array.from(new Set([...(existing.financialRecordIds || []), ...(synced.financialRecordIds || [])])),
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt || synced.createdAt
  };
}

function deduplicateExtractedCruises(cruises: BookedCruiseRow[]): BookedCruiseRow[] {
  const byCanonical = new Map<string, BookedCruiseRow>();

  for (const cruise of cruises) {
    const normalizedCruise: BookedCruiseRow = {
      ...cruise,
      sailingStartDate: normalizeIsoDateForSync(cruise.sailingStartDate || (cruise as any).sailDate),
      sailingEndDate: normalizeIsoDateForSync(cruise.sailingEndDate || (cruise as any).returnDate),
    };
    const key = completedCanonicalKey(normalizedCruise);
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, normalizedCruise);
      continue;
    }

    const existingScore = JSON.stringify(existing).length;
    const nextScore = JSON.stringify(normalizedCruise).length;
    if (nextScore > existingScore) {
      byCanonical.set(key, normalizedCruise);
      console.log(`[SyncLogic] Dedup: Replaced weaker completed/booked duplicate for ${normalizedCruise.shipName} ${normalizedCruise.sailingStartDate}`);
    } else {
      console.log(`[SyncLogic] Dedup: Skipping duplicate completed/booked row for ${normalizedCruise.shipName} ${normalizedCruise.sailingStartDate}`);
    }
  }

  const result = Array.from(byCanonical.values());
  if (result.length < cruises.length) {
    console.log(`[SyncLogic] Canonical completed/booked dedupe: ${cruises.length} -> ${result.length} extracted cruises (removed ${cruises.length - result.length} duplicates)`);
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
  syncSource: SyncDataSource = 'royal',
  ownershipOptions?: SyncOwnershipOptions
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

  const includeUnownedRecords = ownershipOptions?.includeUnownedRecords ?? true;
  const { cruises: transformedCruises, offers: transformedOffers } = transformOfferRowsToCruisesAndOffers(filteredOffers, loyaltyData, syncSource, ownershipOptions);
  const transformedBookedCruises = transformBookedCruisesToAppFormat(dedupedBookedCruises, loyaltyData, syncSource, ownershipOptions);

  console.log(`[SyncLogic] Transformed ${transformedCruises.length} cruise records from ${filteredOffers.length} offer rows`);

  const offersNew: CasinoOffer[] = [];
  const offersUpdates: { existing: CasinoOffer; updated: CasinoOffer }[] = [];
  const offersUnchanged: CasinoOffer[] = [];

  for (const offer of transformedOffers) {
    const match = findMatchingOffer(offer, normalizedExistingOffers, includeUnownedRecords);
    if (match) {
      const merged = mergeOffer(match, offer);
      offersUpdates.push({ existing: match, updated: merged });
    } else {
      offersNew.push(offer);
    }
  }

  for (const existing of normalizedExistingOffers) {
    const isMatched = transformedOffers.some(offer => findMatchingOffer(offer, [existing], includeUnownedRecords));
    if (!isMatched && resolveOfferSource(existing) === syncSource) {
      offersUnchanged.push(existing);
    } else if (!isMatched) {
      offersUnchanged.push(existing);
    }
  }

  const cruisesNew: Cruise[] = [];
  const cruisesUpdates: { existing: Cruise; updated: Cruise }[] = [];
  const cruisesUnchanged: Cruise[] = [];

  for (const cruise of transformedCruises) {
    const match = findMatchingCruise(cruise, normalizedExistingCruises, includeUnownedRecords);
    if (match) {
      const merged = mergeCruise(match, cruise);
      cruisesUpdates.push({ existing: match, updated: merged });
    } else {
      cruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingCruises) {
    const isMatched = transformedCruises.some(cruise => findMatchingCruise(cruise, [existing], includeUnownedRecords));
    if (!isMatched && resolveCruiseSource(existing) === syncSource) {
      cruisesUnchanged.push(existing);
    } else if (!isMatched) {
      cruisesUnchanged.push(existing);
    }
  }

  const bookedCruisesNew: BookedCruise[] = [];
  const bookedCruisesUpdates: { existing: BookedCruise; updated: BookedCruise }[] = [];
  const bookedCruisesUnchanged: BookedCruise[] = [];

  for (const cruise of transformedBookedCruises) {
    const match = findMatchingBookedCruise(cruise, normalizedExistingBookedCruises, includeUnownedRecords);
    if (match) {
      const merged = mergeBookedCruise(match, cruise);
      bookedCruisesUpdates.push({ existing: match, updated: merged });
    } else {
      bookedCruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingBookedCruises) {
    const isMatched = transformedBookedCruises.some(cruise => findMatchingBookedCruise(cruise, [existing], includeUnownedRecords));
    if (!isMatched && resolveCruiseSource(existing) === syncSource) {
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
  // Review counts describe the one canonical incoming sync dataset. Previously, unchanged
  // historical app rows were added to these numbers, which made a 12-upcoming/60-completed
  // extraction appear as 17/81 in review. Preserved existing rows are still reported in the
  // explicit *Unchanged fields, but are not re-counted as newly reviewed input.
  const incomingBookedCruises = [
    ...preview.bookedCruises.new,
    ...preview.bookedCruises.updates.map(u => u.updated),
  ];

  const upcomingCruises = incomingBookedCruises.filter(c => isActiveBookedCruise(c)).length;
  const courtesyHolds = incomingBookedCruises.filter(c => isCourtesyHoldCruise(c)).length;
  
  console.log('[SyncLogic] calculateSyncCounts canonical incoming dataset:', {
    newCruises: preview.bookedCruises.new.length,
    updatedCruises: preview.bookedCruises.updates.length,
    preservedExistingCruises: preview.bookedCruises.unchanged.length,
    upcomingCruises,
    courtesyHolds,
    incomingCruises: incomingBookedCruises.length,
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
    totalBookedCruises: incomingBookedCruises.length,
  };
}

export interface ApplySyncPreviewOptions {
  allowOfferRemoval?: boolean;
  allowCruiseRemoval?: boolean;
  allowBookedCruiseRemoval?: boolean;
  allowActiveBookedCruiseRemoval?: boolean;
  allowCompletedCruiseRemoval?: boolean;
  targetOwnerProfileId?: string;
  includeUnownedRecords?: boolean;
  visibleOfferCodes?: string[];
  visibleOfferCount?: number;
  zeroRowOfferCodes?: string[];
  authoritativeEmptyOfferCatalog?: boolean;
}


function isAvailableOfferCatalogCruise(cruise: Cruise): boolean {
  const status = String(cruise.status || '').trim().toLowerCase();
  return status === 'available' || Boolean(String(cruise.offerCode || '').trim());
}

function isCompletedSyncBookedCruise(cruise: BookedCruise): boolean {
  const status = `${cruise.status || ''} ${cruise.bookingStatus || ''} ${cruise.completionState || ''}`.toLowerCase();
  return status.includes('completed') || status.includes('past') || cruise.completionState === 'completed';
}

function collectedOfferCodesFromPreview(preview: SyncPreview): Set<string> {
  const codes = new Set<string>();
  const add = (code?: string) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (normalized) codes.add(normalized);
  };
  preview.offers.new.forEach(o => add(o.offerCode));
  preview.offers.updates.forEach(u => add(u.updated.offerCode || u.existing.offerCode));
  preview.cruises.new.forEach(c => add(c.offerCode));
  preview.cruises.updates.forEach(u => add(u.updated.offerCode || u.existing.offerCode));
  return codes;
}


function offerIdentityKey(offer: CasinoOffer): string {
  const source = resolveOfferSource(offer) || 'unknown';
  const code = String(offer.offerCode || '').trim().toUpperCase();
  const name = getOfferNameKey(offer);
  // v12.3.5: offers are shared travel inventory. Do not include ownerProfileId in the
  // final identity key, or the same Royal/Celebrity offer can duplicate under Main User
  // and Second User even though loyalty identities remain profile-specific.
  return `${source}|${code || name}`;
}

function cruiseIdentityKey(cruise: Cruise): string {
  const source = resolveCruiseSource(cruise) || 'unknown';
  const code = String(cruise.offerCode || '').trim().toUpperCase();
  // v12.3.5: available sailings are shared household inventory. The offer/source/ship/date
  // identity must be the same for Main User and Second User.
  return `${source}|${code}|${normalizeShipName(cruise.shipName)}|${normalizeSailDate(cruise.sailDate)}|${normalizeCabinType(cruise.cabinType)}|${normalizeComparableText(cruise.itineraryName || cruise.destination || '')}`;
}

function bookedIdentityKey(cruise: BookedCruise): string {
  const source = resolveCruiseSource(cruise) || 'unknown';
  const booking = String(cruise.bookingId || cruise.reservationNumber || cruise.bwoNumber || '').trim().toLowerCase();
  // v12.3.5: booked and completed cruises are shared travel inventory. Ignore
  // ownerProfileId when deduping the same reservation across profiles, but never collapse
  // two real reservations.
  if (booking && !/^booking_\d+/i.test(booking)) return `${source}|booking:${booking}`;

  // When Royal omits a usable reservation number, cabin and guest signatures are part of
  // the canonical identity. This preserves separate bookings on the same ship/date while
  // still allowing exact duplicate payload rows to merge deterministically.
  const cabinIdentity = normalizeComparableText(
    cruise.cabinNumber ||
    cruise.stateroomNumber ||
    cruise.cabinCategory ||
    cruise.stateroomCategoryCode ||
    cruise.cabinType ||
    ''
  );
  const guestIdentity = Array.isArray(cruise.guestNames)
    ? cruise.guestNames.map(normalizeComparableText).filter(Boolean).sort().join('|')
    : '';
  return `${source}|${normalizeShipName(cruise.shipName)}|${normalizeSailDate(cruise.sailDate)}|${normalizeSailDate(cruise.returnDate)}|${cabinIdentity}|${guestIdentity}|${normalizeComparableText(cruise.itineraryName || cruise.destination || '')}`;
}

export interface SyncDedupeLedgerEntry {
  label: string;
  key: string;
  action: 'kept' | 'merged';
  reason: string;
}

export interface SyncDedupeResult<T> {
  items: T[];
  ledger: SyncDedupeLedgerEntry[];
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergeMeaningfulFields<T extends Record<string, any>>(existing: T, incoming: T): T {
  const merged: Record<string, any> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (hasMeaningfulValue(value) || !hasMeaningfulValue(merged[key])) {
      merged[key] = value;
    }
  }
  return merged as T;
}

function mergeDuplicateOffer(existing: CasinoOffer, incoming: CasinoOffer): CasinoOffer {
  const merged = mergeMeaningfulFields(existing, incoming);
  const cruiseIds = Array.from(new Set([
    ...(existing.cruiseIds || []),
    ...(incoming.cruiseIds || []),
    ...(existing.cruiseId ? [existing.cruiseId] : []),
    ...(incoming.cruiseId ? [incoming.cruiseId] : []),
  ].filter(Boolean)));
  return {
    ...merged,
    id: existing.id,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: new Date().toISOString(),
    cruiseIds,
    cruiseId: cruiseIds[0],
    eligibleSailingCount: cruiseIds.length,
  };
}

function mergeDuplicateCruise(existing: Cruise, incoming: Cruise): Cruise {
  const merged = mergeMeaningfulFields(existing, incoming);
  return {
    ...merged,
    id: existing.id,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function mergeDuplicateBookedCruise(existing: BookedCruise, incoming: BookedCruise): BookedCruise {
  const merged = mergeMeaningfulFields(existing, incoming);
  return {
    ...merged,
    id: existing.id,
    createdAt: existing.createdAt || incoming.createdAt,
    updatedAt: new Date().toISOString(),
    earnedPoints: existing.earnedPoints ?? incoming.earnedPoints,
    casinoPoints: existing.casinoPoints ?? incoming.casinoPoints,
    actualSpend: existing.actualSpend ?? incoming.actualSpend,
    winnings: existing.winnings ?? incoming.winnings,
    financialRecordIds: Array.from(new Set([...(existing.financialRecordIds || []), ...(incoming.financialRecordIds || [])])),
  };
}

export function dedupeByKeyWithLedger<T>(
  items: T[],
  keyFn: (item: T) => string,
  label: string,
  mergeFn: (existing: T, incoming: T) => T,
): SyncDedupeResult<T> {
  const map = new Map<string, T>();
  const ledger: SyncDedupeLedgerEntry[] = [];
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      ledger.push({ label, key, action: 'kept', reason: 'first canonical identity' });
      continue;
    }
    map.set(key, mergeFn(existing, item));
    ledger.push({ label, key, action: 'merged', reason: 'exact canonical identity duplicate; supplemental fields merged' });
  }
  if (map.size < items.length) {
    console.log(`[SyncLogic] Final ${label} dedupe: ${items.length} -> ${map.size}; merged ${items.length - map.size} exact duplicate row(s)`);
    ledger.filter(entry => entry.action === 'merged').forEach(entry => {
      console.log(`[SyncLogic] Dedupe ledger ${label}: ${entry.key} — ${entry.reason}`);
    });
  }
  return { items: Array.from(map.values()), ledger };
}

export interface OfferAttachmentReconciliationAudit {
  offerCount: number;
  cruiseCount: number;
  totalRelationships: number;
  danglingIdsRemoved: number;
  offersWithoutSailings: string[];
}

export function reconcileOfferCruiseAttachments(
  offers: CasinoOffer[],
  cruises: Cruise[],
): { offers: CasinoOffer[]; audit: OfferAttachmentReconciliationAudit } {
  const cruiseById = new Map(cruises.map(cruise => [cruise.id, cruise]));
  let totalRelationships = 0;
  let danglingIdsRemoved = 0;
  const offersWithoutSailings: string[] = [];

  const reconciledOffers = offers.map(offer => {
    const source = resolveOfferSource(offer);
    const code = String(offer.offerCode || '').trim().toUpperCase();
    const expiry = getOfferExpiry(offer);
    const priorIds = Array.from(new Set([...(offer.cruiseIds || []), ...(offer.cruiseId ? [offer.cruiseId] : [])].filter(Boolean)));
    danglingIdsRemoved += priorIds.filter(id => !cruiseById.has(id)).length;

    let matchedIds: string[];
    if (code) {
      matchedIds = cruises
        .filter(cruise => {
          if (resolveCruiseSource(cruise) !== source) return false;
          if (String(cruise.offerCode || '').trim().toUpperCase() !== code) return false;
          const cruiseExpiry = normalizeSailDate(cruise.offerExpiry);
          return !(expiry && cruiseExpiry && expiry !== cruiseExpiry);
        })
        .map(cruise => cruise.id);
    } else {
      matchedIds = priorIds.filter(id => cruiseById.has(id));
    }

    matchedIds = Array.from(new Set(matchedIds));
    totalRelationships += matchedIds.length;
    if (matchedIds.length === 0) {
      offersWithoutSailings.push(code || offer.offerName || offer.title || offer.id);
    }
    return {
      ...offer,
      cruiseIds: matchedIds,
      cruiseId: matchedIds[0],
      eligibleSailingCount: matchedIds.length,
      updatedAt: new Date().toISOString(),
    };
  });

  const audit: OfferAttachmentReconciliationAudit = {
    offerCount: reconciledOffers.length,
    cruiseCount: cruises.length,
    totalRelationships,
    danglingIdsRemoved,
    offersWithoutSailings,
  };
  console.log('[SyncLogic] Offer-to-sailing attachment reconciliation:', audit);
  return { offers: reconciledOffers, audit };
}

// SAFETY GUARDRAIL: a Sync Now run can fail midway (network blip, WebView navigation error,
// site layout change, session timeout) and still report a handful of rows. Without this check,
// that partial capture would be treated as "authoritative" and wipe out a much larger, previously
// verified catalog of offers/sailings/booked cruises. Only trip this when there was a meaningful
// amount of existing data to protect, and the new capture is a suspiciously small fraction of it.
function isSuspiciouslyIncompleteCapture(existingManagedCount: number, incomingCount: number): boolean {
  if (existingManagedCount < 3) {
    return false;
  }
  const MIN_RETENTION_RATIO = 0.4;
  const minimumExpected = Math.max(2, Math.ceil(existingManagedCount * MIN_RETENTION_RATIO));
  return incomingCount < minimumExpected;
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
  const allowActiveBookedCruiseRemoval = options?.allowActiveBookedCruiseRemoval ?? allowBookedCruiseRemoval;
  const allowCompletedCruiseRemoval = options?.allowCompletedCruiseRemoval ?? allowBookedCruiseRemoval;
  const targetOwnerProfileId = options?.targetOwnerProfileId;
  const includeUnownedRecords = options?.includeUnownedRecords ?? true;
  const existingManagedOfferCount = normalizedExistingOffers.filter(o => isManagedOfferSource(o, syncSource, targetOwnerProfileId, includeUnownedRecords)).length;
  const existingManagedCruiseCount = normalizedExistingCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords)).length;
  const existingManagedBookedCount = normalizedExistingBookedCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords)).length;

  // STRATEGY: Synced data is the SOURCE OF TRUTH for the active sync source.
  // Items from that source NOT present in the sync are REMOVED only when we captured
  // authoritative data for that section in the current sync. Other sources are always preserved.
  // When a section failed to capture any rows, preserve the existing data to avoid destructive overwrites.

  const collectedOfferCodes = collectedOfferCodesFromPreview(preview);
  const optionVisibleOfferCodes = new Set((options?.visibleOfferCodes || []).map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  const optionZeroRowOfferCodes = new Set((options?.zeroRowOfferCodes || []).map(code => String(code || '').trim().toUpperCase()).filter(Boolean));
  const dynamicVisibleOfferCount = Number.isFinite(Number(options?.visibleOfferCount)) ? Number(options?.visibleOfferCount) : optionVisibleOfferCodes.size;
  const authoritativeEmptyOfferCatalog = Boolean(options?.authoritativeEmptyOfferCatalog) && dynamicVisibleOfferCount === 0;
  const dynamicZeroRowOfferCodes = new Set<string>([...optionZeroRowOfferCodes]);
  optionVisibleOfferCodes.forEach(code => {
    if (code && !collectedOfferCodes.has(code)) dynamicZeroRowOfferCodes.add(code);
  });
  const supportsDynamicVisibleCatalog = syncSource === 'royal' || syncSource === 'carnival';
  const dynamicFullVisibleCatalog = supportsDynamicVisibleCatalog
    && allowOfferRemoval
    && dynamicVisibleOfferCount > 0
    && optionVisibleOfferCodes.size > 0
    && dynamicZeroRowOfferCodes.size === 0;
  const dynamicPartialVisibleCatalog = supportsDynamicVisibleCatalog
    && allowOfferRemoval
    && dynamicVisibleOfferCount > 0
    && dynamicZeroRowOfferCodes.size > 0;
  const incomingCruiseCount = preview.cruises.new.length + preview.cruises.updates.length;
  const incomingOfferCount = preview.offers.new.length + preview.offers.updates.length;
  const offerCaptureLooksIncomplete = authoritativeEmptyOfferCatalog
    ? false
    : dynamicFullVisibleCatalog
    ? false
    : isSuspiciouslyIncompleteCapture(existingManagedOfferCount, incomingOfferCount)
      || isSuspiciouslyIncompleteCapture(existingManagedCruiseCount, incomingCruiseCount);
  if (allowOfferRemoval && offerCaptureLooksIncomplete) {
    console.log(`[SyncLogic] Guardrail tripped: incoming ${syncSource} capture (${incomingOfferCount} offers / ${incomingCruiseCount} sailings) is suspiciously smaller than existing (${existingManagedOfferCount} offers / ${existingManagedCruiseCount} sailings) - preserving existing offers/sailings instead of removing any`);
  }
  const hasAuthoritativeOfferCatalog = allowOfferRemoval && !offerCaptureLooksIncomplete && (
    authoritativeEmptyOfferCatalog ||
    (supportsDynamicVisibleCatalog && dynamicFullVisibleCatalog && incomingCruiseCount > 0) ||
    (syncSource === 'royal' && optionVisibleOfferCodes.size === 0 && collectedOfferCodes.size >= 1 && incomingCruiseCount > 0) ||
    (syncSource === 'celebrity' && collectedOfferCodes.size >= 1 && incomingCruiseCount > 0) ||
    (syncSource === 'carnival' && optionVisibleOfferCodes.size === 0 && collectedOfferCodes.size >= 1 && incomingCruiseCount > 0)
  );

  // v12.3.2: Royal's rotating Club Royale offer pages can occasionally return 0 rows for
  // one visible offer card (for example a monthly mix offer) while the other visible offers
  // scrape cleanly. A 3-of-4 capture is useful, but it is not a fully authoritative catalog
  // replacement. Preserve unmatched existing Royal offer/catalog rows instead of deleting the
  // zero-row visible offer from the app. Fully authoritative large captures still replace the
  // managed catalog above.
  const preserveUnmatchedManagedOfferCatalog = supportsDynamicVisibleCatalog
    && allowOfferRemoval
    && incomingCruiseCount > 0
    && collectedOfferCodes.size > 0
    && (dynamicPartialVisibleCatalog || !hasAuthoritativeOfferCatalog);
  if (authoritativeEmptyOfferCatalog) {
    console.log('[SyncLogic] v12.3.3 authoritative empty Royal offer catalog: removing managed Royal offers/available sailings because the live account showed 0 offers');
  }
  if (preserveUnmatchedManagedOfferCatalog) {
    console.log(`[SyncLogic] Preserving unmatched ${syncSource} offer/catalog rows because ${dynamicZeroRowOfferCodes.size} visible offer code(s) returned 0 rows or the capture was not a full replacement (${collectedOfferCodes.size} row-bearing offer code(s), ${incomingCruiseCount} sailing rows)`);
  }
  const updatedOfferIds = new Set(preview.offers.updates.map(u => u.existing.id));
  const incomingOfferRecords = [
    ...preview.offers.updates.map(u => u.updated),
    ...preview.offers.new,
  ];
  const finalOffers = offerCaptureLooksIncomplete
    ? [
        ...normalizedExistingOffers.filter(o => !updatedOfferIds.has(o.id)),
        ...incomingOfferRecords,
      ]
    : hasAuthoritativeOfferCatalog
    ? [
        ...normalizedExistingOffers.filter(o => {
          const code = String(o.offerCode || '').trim().toUpperCase();
          const isRoyalManaged = resolveOfferSource(o) === syncSource || (code && collectedOfferCodes.has(code));
          if (isRoyalManaged) {
            console.log(`[SyncLogic] Replacing ${syncSource} offer catalog record: ${o.offerCode || 'no-code'} - ${o.offerName || o.title || ''}`);
            return false;
          }
          return true;
        }),
        ...incomingOfferRecords,
      ]
    : [
        // Keep offers from other sources; drop active-source offers not present in this sync
        ...normalizedExistingOffers
          .filter(o => {
            if (allowOfferRemoval && isManagedOfferSource(o, syncSource, targetOwnerProfileId, includeUnownedRecords) && !updatedOfferIds.has(o.id)) {
              const isBeingReplaced = preview.offers.new.some(newOffer => 
                findMatchingOffer(newOffer, [o], includeUnownedRecords)
              );
              if (!isBeingReplaced) {
                if (preserveUnmatchedManagedOfferCatalog) {
                  console.log(`[SyncLogic] Preserving unmatched ${syncSource}-source offer because this run was not a full authoritative catalog replacement: ${o.offerCode} - ${o.offerName}`);
                  return true;
                }
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
        ...incomingOfferRecords,
      ];

  const updatedCruiseIds = new Set(preview.cruises.updates.map(u => u.existing.id));
  const incomingCruiseRecords = [
    ...preview.cruises.updates.map(u => u.updated),
    ...preview.cruises.new,
  ];
  const finalCruises = offerCaptureLooksIncomplete
    ? [
        ...normalizedExistingCruises.filter(c => !updatedCruiseIds.has(c.id)),
        ...incomingCruiseRecords,
      ]
    : hasAuthoritativeOfferCatalog
    ? [
        ...normalizedExistingCruises.filter(c => {
          const code = String(c.offerCode || '').trim().toUpperCase();
          const isManagedOfferCatalogRow = isAvailableOfferCatalogCruise(c) && (
            resolveCruiseSource(c) === syncSource ||
            Boolean(code && collectedOfferCodes.has(code)) ||
            (syncSource === 'royal' && resolveCruiseSource(c) === 'royal') ||
            (syncSource === 'celebrity' && resolveCruiseSource(c) === 'celebrity') ||
            (syncSource === 'carnival' && resolveCruiseSource(c) === 'carnival')
          );
          if (isManagedOfferCatalogRow) {
            console.log(`[SyncLogic] Replacing ${syncSource} available-catalog cruise: ${c.offerCode || 'no-code'} | ${c.shipName} | ${c.sailDate}`);
            return false;
          }
          return true;
        }),
        ...incomingCruiseRecords,
      ]
    : [
        // Keep cruises from other sources; drop active-source cruises not in sync
        ...normalizedExistingCruises
          .filter(c => {
            if (allowCruiseRemoval && isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords) && !updatedCruiseIds.has(c.id)) {
              const isBeingReplaced = preview.cruises.new.some(newCruise => 
                findMatchingCruise(newCruise, [c], includeUnownedRecords)
              );
              if (!isBeingReplaced) {
                if (preserveUnmatchedManagedOfferCatalog && isAvailableOfferCatalogCruise(c)) {
                  console.log(`[SyncLogic] Preserving unmatched ${syncSource}-source available-catalog cruise because this run was not a full authoritative catalog replacement: ${c.offerCode || 'no-code'} | ${c.shipName} on ${c.sailDate}`);
                  return true;
                }
                console.log(`[SyncLogic] Removing stale ${syncSource}-source cruise: ${c.shipName} on ${c.sailDate}`);
                return false;
              }
            }
            return true;
          })
          .filter(c => !updatedCruiseIds.has(c.id))
          .filter(c => {
            const isBeingReplaced = preview.cruises.new.some(newCruise => 
              findMatchingCruise(newCruise, [c], includeUnownedRecords)
            );
            return !isBeingReplaced;
          }),
        ...incomingCruiseRecords,
      ];

  const updatedBookedCruiseIds = new Set(preview.bookedCruises.updates.map(u => u.existing.id));
  const incomingBookedRecords = [
    ...preview.bookedCruises.updates.map(u => u.updated),
    ...preview.bookedCruises.new,
  ];
  const incomingCompletedCount = incomingBookedRecords.filter(isCompletedSyncBookedCruise).length;
  const incomingActiveCount = incomingBookedRecords.filter(c => !isCompletedSyncBookedCruise(c)).length;
  const existingManagedActiveCount = normalizedExistingBookedCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords) && !isCompletedSyncBookedCruise(c)).length;
  const existingManagedCompletedCount = normalizedExistingBookedCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords) && isCompletedSyncBookedCruise(c)).length;
  const activeBookedCaptureLooksIncomplete = allowActiveBookedCruiseRemoval && isSuspiciouslyIncompleteCapture(existingManagedActiveCount, incomingActiveCount);
  const completedCaptureLooksIncomplete = allowCompletedCruiseRemoval && isSuspiciouslyIncompleteCapture(existingManagedCompletedCount, incomingCompletedCount);
  const bookedCaptureLooksIncomplete = (incomingActiveCount > 0 && activeBookedCaptureLooksIncomplete) || (incomingCompletedCount > 0 && completedCaptureLooksIncomplete);
  if (allowBookedCruiseRemoval && incomingBookedRecords.length > 0 && bookedCaptureLooksIncomplete) {
    console.log(`[SyncLogic] Guardrail tripped: incoming ${syncSource} booked/history capture (active=${incomingActiveCount}, completed=${incomingCompletedCount}) is suspiciously smaller than existing (active=${existingManagedActiveCount}, completed=${existingManagedCompletedCount}) - preserving existing booked/completed records instead of removing any`);
  }
  // v12.3.5: active bookings and completed/past cruises are independent lanes.
  // A good active-booking capture must not wipe completed history, and a completed-history
  // capture must not wipe active bookings. Each lane is authoritative only when that lane
  // produced rows and its section was selected.
  const hasAuthoritativeActiveBooked = allowActiveBookedCruiseRemoval && incomingActiveCount > 0 && !activeBookedCaptureLooksIncomplete;
  const hasAuthoritativeCompletedHistory = allowCompletedCruiseRemoval && incomingCompletedCount > 0 && !completedCaptureLooksIncomplete;
  const hasAuthoritativeBookedOrHistory = hasAuthoritativeActiveBooked || hasAuthoritativeCompletedHistory;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const finalBookedCruises = bookedCaptureLooksIncomplete
    ? [
        ...normalizedExistingBookedCruises.filter(c => !updatedBookedCruiseIds.has(c.id)),
        ...incomingBookedRecords,
      ]
    : hasAuthoritativeBookedOrHistory
    ? [
        ...normalizedExistingBookedCruises.filter(c => {
          const isManagedSourceRecord = resolveCruiseSource(c) === syncSource;
          const existingIsCompleted = isCompletedSyncBookedCruise(c);
          const laneIsAuthoritative = existingIsCompleted ? hasAuthoritativeCompletedHistory : hasAuthoritativeActiveBooked;
          if (isManagedSourceRecord && laneIsAuthoritative) {
            console.log(`[SyncLogic] Replacing ${syncSource} ${existingIsCompleted ? 'completed/history' : 'active booked'} record from authoritative lane sync: ${c.shipName} on ${c.sailDate} (${c.status || c.completionState || 'unknown'})`);
            return false;
          }
          return true;
        }),
        ...incomingBookedRecords,
      ]
    : [
        // Keep booked cruises from other sources; drop active-source UPCOMING cruises not in sync
        // ALWAYS preserve completed cruises — sync only captures currently visible website bookings
        ...normalizedExistingBookedCruises
          .filter(c => {
            if (allowBookedCruiseRemoval && isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords) && !updatedBookedCruiseIds.has(c.id)) {
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
                findMatchingBookedCruise(newCruise, [c], includeUnownedRecords)
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
        ...incomingBookedRecords,
      ];

  if (hasAuthoritativeBookedOrHistory) {
    console.log(`[SyncLogic] Authoritative booked/history replacement applied: incoming active=${incomingActiveCount}, incoming completed=${incomingCompletedCount}, total incoming=${incomingBookedRecords.length}`);
  }

  console.log('[SyncLogic] applySyncPreview final counts:', {
    syncSource,
    allowOfferRemoval,
    allowCruiseRemoval,
    allowBookedCruiseRemoval,
    allowActiveBookedCruiseRemoval,
    allowCompletedCruiseRemoval,
    incomingActiveCount,
    incomingCompletedCount,
    hasAuthoritativeActiveBooked,
    hasAuthoritativeCompletedHistory,
    existingOffers: normalizedExistingOffers.length,
    finalOffers: finalOffers.length,
    existingCruises: normalizedExistingCruises.length,
    finalCruises: finalCruises.length,
    existingBooked: normalizedExistingBookedCruises.length,
    finalBooked: finalBookedCruises.length,
    targetOwnerProfileId,
    includeUnownedRecords,
    managedOffersDelta: finalOffers.filter(o => isManagedOfferSource(o, syncSource, targetOwnerProfileId, includeUnownedRecords)).length - normalizedExistingOffers.filter(o => isManagedOfferSource(o, syncSource, targetOwnerProfileId, includeUnownedRecords)).length,
    managedCruisesDelta: finalCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords)).length - normalizedExistingCruises.filter(c => isManagedCruiseSource(c, syncSource, targetOwnerProfileId, includeUnownedRecords)).length,
  });

  const offerDedupe = dedupeByKeyWithLedger(finalOffers, offerIdentityKey, 'offers', mergeDuplicateOffer);
  const cruiseDedupe = dedupeByKeyWithLedger(finalCruises, cruiseIdentityKey, 'available cruises', mergeDuplicateCruise);
  const bookedDedupeResult = dedupeBookedCruisesWithLedger(
    finalBookedCruises,
    'booked/completed cruises',
    mergeDuplicateBookedCruise,
  );
  const bookedDedupe = {
    items: bookedDedupeResult.cruises,
    ledger: bookedDedupeResult.ledger.map((entry) => ({
      label: 'booked/completed cruises',
      key: entry.outputIdentity,
      action: entry.action,
      reason: entry.reason === 'new'
        ? 'first canonical identity'
        : `${entry.reason} duplicate; supplemental fields merged`,
    })),
  } satisfies SyncDedupeResult<BookedCruise>;
  const attachmentReconciliation = reconcileOfferCruiseAttachments(offerDedupe.items, cruiseDedupe.items);

  console.log('[SyncLogic] Available sailing reconciliation ledger:', {
    incomingOfferSailingRows: incomingCruiseRecords.length,
    preDedupeStoredRows: finalCruises.length,
    uniqueCanonicalSailings: cruiseDedupe.items.length,
    mergedExactDuplicates: cruiseDedupe.ledger.filter(entry => entry.action === 'merged').length,
    offerToSailingRelationships: attachmentReconciliation.audit.totalRelationships,
    danglingOfferCruiseIdsRemoved: attachmentReconciliation.audit.danglingIdsRemoved,
  });
  console.log('[SyncLogic] Booked/completed reconciliation ledger:', {
    incomingActive: incomingActiveCount,
    incomingCompleted: incomingCompletedCount,
    preDedupeRows: finalBookedCruises.length,
    canonicalRows: bookedDedupe.items.length,
    mergedExactDuplicates: bookedDedupe.ledger.filter(entry => entry.action === 'merged').length,
  });

  return {
    offers: attachmentReconciliation.offers,
    cruises: cruiseDedupe.items,
    bookedCruises: bookedDedupe.items,
  };
}
