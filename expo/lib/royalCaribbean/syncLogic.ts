import { CasinoOffer, BookedCruise, Cruise } from '@/types/models';
import { formatDateMDY } from '@/lib/date';
import { OfferRow, BookedCruiseRow, LoyaltyData } from './types';
import { transformOfferRowsToCruisesAndOffers, transformBookedCruisesToAppFormat, type SyncDataSource, type SyncOwnershipOptions } from './dataTransformers';
import { isActiveBookedCruise, isCompletedBookedCruise, isCourtesyHoldCruise } from '@/lib/bookedCruiseStatus';
import { createRoyalBookedCruiseIdentity, createRoyalOfferSailingIdentity, deduplicateExactRows, isSyntheticRoyalRow } from './syncIntegrity';

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
  const normalized = String(source || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const compact = normalized.replace(/_/g, '');
  if (normalized === 'royal' || normalized === 'celebrity' || normalized === 'carnival') {
    return normalized;
  }

  if (normalized === 'royal_caribbean' || compact === 'royalcaribbean' || compact === 'royalcaribbeansync') {
    return 'royal';
  }

  if (compact === 'celebritycruises' || compact === 'celebritysync') return 'celebrity';
  if (compact === 'carnivalcruiseline' || compact === 'carnivalsync') return 'carnival';

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

  const explicitBrand = normalizeSyncSource(String(cruise.brand || ''));
  if (explicitBrand) {
    return explicitBrand;
  }

  const providerSource = normalizeSyncSource(cruise.sourceProvider)
    ?? inferSourceFromText(cruise.sourceProvider, cruise.sourceEndpoint);
  if (providerSource) {
    return providerSource;
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

/**
 * A provider's successful current-bookings response is a complete snapshot for
 * that provider and owner only. Royal, Celebrity, and Carnival each own their
 * own booking snapshot; refreshing one provider must never remove another
 * provider's records. Available sailing and offer inventories follow the same
 * provider boundary above.
 */
export function getBookedCruiseSnapshotSources(syncSource: SyncDataSource): readonly SyncDataSource[] {
  return [syncSource];
}

function isManagedBookedCruiseSnapshot(
  cruise: BookedCruise,
  syncSource: SyncDataSource,
  targetOwnerProfileId?: string,
  includeUnownedRecords: boolean = true,
): boolean {
  const sourceProvider = String(cruise.sourceProvider || '').trim().toLowerCase();
  const providerMarker = normalizeSyncSource(cruise.sourceProvider)
    ?? inferSourceFromText(cruise.sourceProvider, cruise.sourceEndpoint);
  const explicitlyManual = (
    cruise.sourceAuthority === 'user_entered'
    || /(?:^|[\s_-])(manual|user entered|local)(?:$|[\s_-])/.test(sourceProvider)
  ) && !providerMarker;
  if (explicitlyManual) return false;

  const managedSources = getBookedCruiseSnapshotSources(syncSource);
  const resolvedSource = resolveCruiseSource(cruise);
  return Boolean(resolvedSource && managedSources.includes(resolvedSource))
    && matchesSyncOwner(cruise.ownerProfileId, targetOwnerProfileId, includeUnownedRecords);
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
  /**
   * Exact transform-time cruise ID -> retained cruise ID aliases.
   *
   * Offers and cruises are transformed together, so offer.cruiseIds initially
   * contain the generated IDs from that transform pass. Cruise reconciliation
   * deliberately keeps an existing local ID when the sailing already exists.
   * Preserve that exact relationship here instead of trying to reconstruct it
   * later from an offer code (which is not unique) or provider metadata (which
   * is absent on some Royal/Celebrity rows).
   */
  cruiseIdAliases?: Record<string, string>;
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
  evidence: {
    syncRunId: string;
    rawOfferRows: number;
    retainedOfferRows: number;
    rejectedOfferRows: number;
    rawBookedRows: number;
    retainedBookedRows: number;
    rejectedBookedRows: number;
    canonicalOfferSailings: number;
    retainedOfferVariants: number;
    consolidatedDuplicates: number;
    exactOfferDuplicates: number;
    exactBookedDuplicates: number;
    quarantinedBookedRows: number;
    unaccountedRows: number;
  };
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
  rawRowsReceived: number;
  canonicalRows: number;
  retainedVariants: number;
  consolidatedDuplicates: number;
  rejectedRows: number;
  insertedRows: number;
  updatedRows: number;
  unchangedRows: number;
  completedCruises: number;
  quarantinedRows: number;
  unaccountedRows: number;
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
  return normalizeSailDate(offer.offerExpiryDate || offer.expiryDate || offer.expires || (offer as CasinoOffer & { offerExpiry?: string }).offerExpiry || '');
}

function getProviderRecordId(value: unknown): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized && !/^(?:N\/A|NA|NONE|UNKNOWN|TBD|NULL|UNDEFINED)$/.test(normalized) ? normalized : '';
}

function getOfferNameKey(offer: CasinoOffer): string {
  return normalizeComparableText(offer.offerName || offer.title || offer.description || '');
}

function createCasinoOfferMaterialIdentity(offer: CasinoOffer): string {
  return [
    normalizeComparableText(offer.playerOfferId || offer.offerInstanceId),
    normalizeComparableText(offer.offerCode),
    getOfferNameKey(offer),
    getOfferExpiry(offer),
    normalizeShipName(offer.shipName),
    normalizeSailDate(offer.sailingDate),
    normalizeCabinType(offer.roomType),
    normalizeVariantText(offer.guestsInfo ?? offer.guests),
    normalizeVariantText(offer.perks?.join('|')),
    normalizeVariantText(offer.interiorPrice),
    normalizeVariantText(offer.oceanviewPrice),
    normalizeVariantText(offer.balconyPrice),
    normalizeVariantText(offer.suitePrice),
    normalizeVariantText(offer.taxesFees),
    normalizeVariantText(offer.freePlay ?? offer.freeplayAmount),
    normalizeVariantText(offer.OBC ?? offer.obcAmount),
    normalizeVariantText(offer.tradeInValue),
    normalizeVariantText(offer.bookingLink),
  ].join('|');
}

function isOfferLevelOnly(offer: CasinoOffer): boolean {
  return !offer.shipName?.trim() && !offer.sailingDate?.trim() && !(offer.cruiseIds?.length ?? 0) && !offer.cruiseId;
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
  const offerInstanceId = normalizeComparableText(offer.playerOfferId || offer.offerInstanceId);
  
  return existingOffers.find(existing => {
    const existingSource = resolveOfferSource(existing);
    if (!areSourcesCompatible(offerSource, existingSource) || !areOwnersCompatible(offer.ownerProfileId, existing.ownerProfileId, includeUnownedRecords)) {
      return false;
    }

    const existingCode = (existing.offerCode || '').trim().toUpperCase();
    const existingExpiry = getOfferExpiry(existing);
    const existingName = getOfferNameKey(existing);
    const existingInstanceId = normalizeComparableText(existing.playerOfferId || existing.offerInstanceId);

    if (offerInstanceId || existingInstanceId) {
      if (!offerInstanceId || !existingInstanceId || offerInstanceId !== existingInstanceId) {
        return false;
      }
      return createCasinoOfferMaterialIdentity(offer) === createCasinoOfferMaterialIdentity(existing);
    }
    
    if (isOfferLevelOnly(offer) && isOfferLevelOnly(existing) && offerCode && existingCode && offerCode === existingCode) {
      if (offerExpiry || existingExpiry) {
        return offerExpiry === existingExpiry;
      }
      if (offerName && existingName) {
        return offerName === existingName;
      }
      return !isInstantRewardOrCertificate(offer.offerCode, offer.offerName) && !isInstantRewardOrCertificate(existing.offerCode, existing.offerName);
    }
    
    return createCasinoOfferMaterialIdentity(offer) === createCasinoOfferMaterialIdentity(existing);
  }) || null;
}

function normalizeCabinType(cabinType: string | undefined): string {
  if (!cabinType) return 'unknown';
  return cabinType.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVariantText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).toLowerCase().trim().replace(/\s+/g, ' ');
}

function knownValuesConflict(valueA: unknown, valueB: unknown): boolean {
  const normalizedA = normalizeVariantText(valueA);
  const normalizedB = normalizeVariantText(valueB);
  return Boolean(normalizedA && normalizedB && normalizedA !== normalizedB);
}

function normalizeShipName(shipName: string | undefined): string {
  if (!shipName) return '';
  return shipName.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeSailDate(sailDate: string | undefined): string {
  if (!sailDate) return '';
  const normalized = formatDateMDY(sailDate, '-');
  return normalized.includes('NaN') ? sailDate.trim() : normalized;
}

function createCruiseMaterialIdentity(cruise: Cruise): string {
  return [
    normalizeVariantText(cruise.playerOfferId || cruise.offerInstanceId),
    normalizeShipName(cruise.shipName),
    normalizeSailDate(cruise.sailDate),
    normalizeSailDate(cruise.returnDate),
    normalizeVariantText(cruise.departurePort),
    normalizeVariantText(cruise.destination),
    normalizeVariantText(cruise.nights),
    normalizeCabinType(cruise.cabinType),
    normalizeVariantText(cruise.guestsInfo ?? cruise.guests),
    normalizeVariantText(cruise.offerCode),
    normalizeSailDate(cruise.offerExpiry),
    normalizeVariantText(cruise.freePlay),
    normalizeVariantText(cruise.freeOBC),
    normalizeVariantText(cruise.tradeInValue),
    normalizeVariantText(cruise.perks?.join('|')),
    normalizeVariantText(cruise.interiorPrice),
    normalizeVariantText(cruise.oceanviewPrice),
    normalizeVariantText(cruise.balconyPrice),
    normalizeVariantText(cruise.suitePrice),
    normalizeVariantText(cruise.taxes),
    normalizeVariantText(cruise.ports?.join('|')),
  ].join('|');
}

function findMatchingCruise(
  cruise: Cruise,
  existingCruises: Cruise[],
  includeUnownedRecords: boolean = true
): Cruise | null {
  const cruiseSource = resolveCruiseSource(cruise);
  
  return existingCruises.find(existing => {
    const existingSource = resolveCruiseSource(existing);
    if (!areSourcesCompatible(cruiseSource, existingSource) || !areOwnersCompatible(cruise.ownerProfileId, existing.ownerProfileId, includeUnownedRecords)) {
      return false;
    }

    return createCruiseMaterialIdentity(cruise) === createCruiseMaterialIdentity(existing);
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
    const cruiseReservation = getProviderRecordId(cruise.reservationNumber);
    const existingReservation = getProviderRecordId(existing.reservationNumber);
    if (cruiseReservation && existingReservation) {
      const cruiseRes = cruiseReservation;
      const existingRes = existingReservation;
      if (cruiseRes && existingRes && cruiseRes === existingRes) {
        console.log(`[Dedup BookedCruise] Matched by reservation number: ${cruise.reservationNumber}`);
        return true;
      }
    }
    
    // PRIORITY 2: Match by booking ID
    const cruiseBooking = getProviderRecordId(cruise.bookingId);
    const existingBooking = getProviderRecordId(existing.bookingId);
    if (cruiseBooking && existingBooking) {
      const cruiseBook = cruiseBooking;
      const existingBook = existingBooking;
      if (cruiseBook && existingBook && cruiseBook === existingBook) {
        console.log(`[Dedup BookedCruise] Matched by booking ID: ${cruise.bookingId}`);
        return true;
      }
    }
    
    return createCruiseMaterialIdentity(cruise) === createCruiseMaterialIdentity(existing);
  }) || null;
}

function hasKnownValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    return value.trim().length > 0 && !/unknown|tbd|n\/a|not available/i.test(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function preferKnownValue<T>(existingValue: T, syncedValue: T): T {
  return hasKnownValue(syncedValue) ? syncedValue : existingValue;
}

function preserveKnownCruiseFields<T extends Cruise | BookedCruise>(existing: T, synced: T): T {
  const syncedIsVerifiedProviderRecord = synced.validationStatus === 'valid'
    && synced.dataConfidence === 'verified'
    && synced.isFallback !== true;
  return {
    ...synced,
    shipName: preferKnownValue(existing.shipName, synced.shipName),
    sailDate: preferKnownValue(existing.sailDate, synced.sailDate),
    returnDate: preferKnownValue(existing.returnDate, synced.returnDate),
    departurePort: preferKnownValue(existing.departurePort, synced.departurePort),
    destination: preferKnownValue(existing.destination, synced.destination),
    nights: hasKnownValue(synced.nights) ? synced.nights : existing.nights,
    itineraryName: preferKnownValue(existing.itineraryName, synced.itineraryName),
    itineraryRaw: preferKnownValue(existing.itineraryRaw, synced.itineraryRaw),
    ports: preferKnownValue(existing.ports, synced.ports),
    dataConfidence: syncedIsVerifiedProviderRecord ? synced.dataConfidence : existing.dataConfidence,
    validationStatus: syncedIsVerifiedProviderRecord ? synced.validationStatus : existing.validationStatus,
  };
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
  const protectedSynced = preserveKnownCruiseFields(existing, synced);
  return {
    ...existing,
    ...protectedSynced,
    id: existing.id,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt
  };
}

function mergeBookedCruise(existing: BookedCruise, synced: BookedCruise): BookedCruise {
  const protectedSynced = preserveKnownCruiseFields(existing, synced);
  const merged: BookedCruise = {
    ...existing,
    ...protectedSynced,
    id: existing.id,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt
  };

  // Provider booking sync owns itinerary/reservation facts. User-entered or
  // imported casino closeout/economics facts remain authoritative and must not
  // disappear when a completed booking is seen again by Club Royale.
  const locallyAuthoritativeFields: Array<keyof BookedCruise> = [
    'pointsEarned', 'earnedPoints', 'casinoPoints', 'coinIn',
    'actualSpend', 'totalSpend', 'winnings', 'totalWinnings', 'winningsBroughtHome',
    'netResult', 'cashResult', 'actualLoss', 'theoreticalLoss',
    'hoursPlayed', 'sessionsPlayed', 'avgBet',
    'pricePaid', 'amountPaid', 'netEffectivePaid', 'retailValue', 'totalRetailCost',
    'originalPrice', 'totalCasinoDiscount', 'taxesFeesEstimate',
    'casinoStartingCash', 'casinoEndingCash', 'casinoChargesRoomBilled', 'casinoHandpays',
    'cruiseValueCaptured', 'totalEconomicValue', 'financialRecordIds',
    'casinoHistoryImportId', 'casinoProgram', 'calculationConfidence',
  ];
  for (const field of locallyAuthoritativeFields) {
    if (hasKnownValue(existing[field])) {
      (merged as unknown as Record<string, unknown>)[field] = existing[field] as unknown;
    }
  }
  return merged;
}

function deduplicateExtractedCruises(cruises: BookedCruiseRow[]) {
  return deduplicateExactRows(cruises, createRoyalBookedCruiseIdentity);
}

function isCompletedBookedRow(row: BookedCruiseRow): boolean {
  const status = (row.status || '').trim().toLowerCase();
  return status === 'completed' || status === 'past' || row.sourcePage?.toLowerCase().includes('past') === true;
}

function rowHasUnknownDate(value: string | undefined): boolean {
  return !value?.trim() || /unknown|tbd|n\/a|not available/i.test(value);
}

function hasAuthoritativeNightCount(row: BookedCruiseRow): boolean {
  if (typeof row.numberOfNights === 'number' && Number.isFinite(row.numberOfNights) && row.numberOfNights > 0) {
    return true;
  }
  return /(\d+)\s*[-]?\s*night/i.test([row.cruiseTitle, row.itinerary, row.sailingDates].filter(Boolean).join(' '));
}

function isInvalidCompletedCruiseRow(row: BookedCruiseRow): boolean {
  if (!isCompletedBookedRow(row)) {
    return false;
  }
  return rowHasUnknownDate(row.sailingStartDate) || (!row.sailingEndDate && !hasAuthoritativeNightCount(row));
}

function createOfferVariantKey(row: OfferRow): string {
  return createRoyalOfferSailingIdentity(row);
}

function filterRedundantOfferLevelRows(rows: OfferRow[]): OfferRow[] {
  type ExpiryEvidence = { hasBlankExpiry: boolean; expiries: Set<string> };
  const detailedIndex = new Map<string, ExpiryEvidence>();
  const materialKeys = (row: OfferRow): string[] => {
    const instanceId = normalizeComparableText(row.playerOfferId || row.carnivalOfferId || row.offerInstanceId);
    const code = normalizeComparableText(row.offerCode);
    const name = normalizeComparableText(row.offerName);
    const prefix = instanceId ? `id:${instanceId}` : 'material';
    return [
      code ? `${prefix}|code:${code}` : '',
      name ? `${prefix}|name:${name}` : '',
    ].filter(Boolean);
  };
  const addDetailedEvidence = (key: string, expiry: string) => {
    const evidence = detailedIndex.get(key) ?? { hasBlankExpiry: false, expiries: new Set<string>() };
    if (expiry) evidence.expiries.add(expiry);
    else evidence.hasBlankExpiry = true;
    detailedIndex.set(key, evidence);
  };

  for (const row of rows) {
    if (isEmptyOfferRow(row)) continue;
    const expiry = normalizeSailDate(row.offerExpirationDate);
    materialKeys(row).forEach((key) => addDetailedEvidence(key, expiry));
  }

  return rows.filter((row) => {
    if (!isEmptyOfferRow(row)) return true;
    const expiry = normalizeSailDate(row.offerExpirationDate);
    return !materialKeys(row).some((key) => {
      const evidence = detailedIndex.get(key);
      if (!evidence) return false;
      return !expiry || evidence.hasBlankExpiry || evidence.expiries.has(expiry);
    });
  });
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
  const syncRunId = `royal_sync_${Date.now()}`;
  const sourceRetrievedAt = new Date().toISOString();

  // Preserving distinct variant rows: only exact material identities consolidate;
  // same offer code, ship, or date is never enough to erase a variant.
  const eligibleOffers = extractedOffers.filter(offer => {
    if (isInProgressOffer(offer.offerCode, offer.offerName, offer.offerStatus, offer.isInProgress)) {
      console.log(`[SyncLogic] Skipping IN PROGRESS offer: ${offer.offerCode} - ${offer.offerName}`);
      return false;
    }
    if (isSyntheticRoyalRow(offer)) {
      console.warn(`[SyncLogic] Rejecting synthetic/mock offer row: ${offer.offerCode || offer.offerName || 'unknown'}`);
      return false;
    }
    return true;
  });
  const dedupedOffers = deduplicateExactRows(eligibleOffers, createOfferVariantKey);
  const filteredOffers = filterRedundantOfferLevelRows(dedupedOffers.retained);
  const rejectedOfferRows = (extractedOffers.length - eligibleOffers.length) + (dedupedOffers.retained.length - filteredOffers.length);
  if (rejectedOfferRows > 0) {
    console.log(`[SyncLogic] Rejected ${rejectedOfferRows} non-duplicate offer row(s); ${dedupedOffers.exactDuplicates} exact material duplicate(s) remain separately accounted for.`);
  }

  const dedupedBookedCruises = deduplicateExtractedCruises(extractedBookedCruises);
  const transformableBookedRows = dedupedBookedCruises.retained.filter((row) => !isSyntheticRoyalRow(row) && Boolean(row.shipName?.trim()));
  const rejectedBookedRows = dedupedBookedCruises.retained.length - transformableBookedRows.length;
  const quarantinedBookedRows = transformableBookedRows.filter(isInvalidCompletedCruiseRow).length;
  if (rejectedBookedRows > 0) {
    console.warn(`[SyncLogic] Rejected ${rejectedBookedRows} malformed or synthetic booked cruise row(s); ${dedupedBookedCruises.exactDuplicates} exact duplicate(s) remain separately accounted for.`);
  }
  if (quarantinedBookedRows > 0) {
    console.warn(`[SyncLogic] Quarantining ${quarantinedBookedRows} incomplete completed cruise row(s); unknown dates or nights will not be normalized into valid history.`);
  }

  const enrichedOwnershipOptions: SyncOwnershipOptions = {
    ...ownershipOptions,
    syncRunId,
    sourceRetrievedAt,
    sourceEndpoint: syncSource === 'royal' ? 'club-royale/offers+my-trips' : `${syncSource}/offers+trips`,
  };

  const includeUnownedRecords = ownershipOptions?.includeUnownedRecords ?? true;
  const { cruises: transformedCruises, offers: transformedOffers } = transformOfferRowsToCruisesAndOffers(filteredOffers, loyaltyData, syncSource, enrichedOwnershipOptions);
  const transformedBookedCruises = transformBookedCruisesToAppFormat(transformableBookedRows, loyaltyData, syncSource, enrichedOwnershipOptions);

  console.log(`[SyncLogic] Transformed ${transformedCruises.length} cruise records from ${filteredOffers.length} offer rows`);

  const offersNew: CasinoOffer[] = [];
  const offersUpdates: { existing: CasinoOffer; updated: CasinoOffer }[] = [];
  const offersUnchanged: CasinoOffer[] = [];

  const appendIndex = <T,>(index: Map<string, T[]>, key: string, value: T) => {
    const bucket = index.get(key);
    if (bucket) bucket.push(value);
    else index.set(key, [value]);
  };
  const existingOfferMaterialIndex = new Map<string, CasinoOffer[]>();
  const existingOfferLevelCodeIndex = new Map<string, CasinoOffer[]>();
  normalizedExistingOffers.forEach((offer) => {
    appendIndex(existingOfferMaterialIndex, createCasinoOfferMaterialIdentity(offer), offer);
    if (isOfferLevelOnly(offer) && offer.offerCode?.trim()) {
      appendIndex(existingOfferLevelCodeIndex, offer.offerCode.trim().toUpperCase(), offer);
    }
  });
  const matchedExistingOffers = new Set<CasinoOffer>();

  for (const offer of transformedOffers) {
    const candidates = new Set(existingOfferMaterialIndex.get(createCasinoOfferMaterialIdentity(offer)) ?? []);
    if (isOfferLevelOnly(offer) && offer.offerCode?.trim()) {
      (existingOfferLevelCodeIndex.get(offer.offerCode.trim().toUpperCase()) ?? []).forEach((candidate) => candidates.add(candidate));
    }
    const match = findMatchingOffer(offer, Array.from(candidates), includeUnownedRecords);
    if (match) {
      matchedExistingOffers.add(match);
      const merged = mergeOffer(match, offer);
      offersUpdates.push({ existing: match, updated: merged });
    } else {
      offersNew.push(offer);
    }
  }

  for (const existing of normalizedExistingOffers) {
    const isMatched = matchedExistingOffers.has(existing);
    if (!isMatched && existing.offerSource === 'royal') {
      offersUnchanged.push(existing);
    } else if (!isMatched) {
      offersUnchanged.push(existing);
    }
  }

  const cruisesNew: Cruise[] = [];
  const cruisesUpdates: { existing: Cruise; updated: Cruise }[] = [];
  const cruisesUnchanged: Cruise[] = [];
  const cruiseIdAliases: Record<string, string> = {};

  const existingCruiseMaterialIndex = new Map<string, Cruise[]>();
  normalizedExistingCruises.forEach((cruise) => appendIndex(existingCruiseMaterialIndex, createCruiseMaterialIdentity(cruise), cruise));
  const matchedExistingCruises = new Set<Cruise>();

  for (const cruise of transformedCruises) {
    const match = findMatchingCruise(
      cruise,
      existingCruiseMaterialIndex.get(createCruiseMaterialIdentity(cruise)) ?? [],
      includeUnownedRecords,
    );
    if (match) {
      matchedExistingCruises.add(match);
      const merged = mergeCruise(match, cruise);
      cruiseIdAliases[cruise.id] = merged.id;
      cruisesUpdates.push({ existing: match, updated: merged });
    } else {
      cruiseIdAliases[cruise.id] = cruise.id;
      cruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingCruises) {
    const isMatched = matchedExistingCruises.has(existing);
    if (!isMatched && existing.cruiseSource === 'royal') {
      cruisesUnchanged.push(existing);
    } else if (!isMatched) {
      cruisesUnchanged.push(existing);
    }
  }

  const bookedCruisesNew: BookedCruise[] = [];
  const bookedCruisesUpdates: { existing: BookedCruise; updated: BookedCruise }[] = [];
  const bookedCruisesUnchanged: BookedCruise[] = [];
  const matchedExistingBookedCruises = new Set<BookedCruise>();

  for (const cruise of transformedBookedCruises) {
    const match = findMatchingBookedCruise(cruise, normalizedExistingBookedCruises, includeUnownedRecords);
    if (match) {
      matchedExistingBookedCruises.add(match);
      const merged = mergeBookedCruise(match, cruise);
      bookedCruisesUpdates.push({ existing: match, updated: merged });
    } else {
      bookedCruisesNew.push(cruise);
    }
  }

  for (const existing of normalizedExistingBookedCruises) {
    const isMatched = matchedExistingBookedCruises.has(existing);
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
    cruiseIdAliases,
    bookedCruises: {
      new: bookedCruisesNew,
      updates: bookedCruisesUpdates,
      unchanged: bookedCruisesUnchanged
    },
    loyalty: loyaltyPreview,
    evidence: {
      syncRunId,
      rawOfferRows: extractedOffers.length,
      retainedOfferRows: filteredOffers.length,
      rejectedOfferRows,
      rawBookedRows: extractedBookedCruises.length,
      retainedBookedRows: transformableBookedRows.length,
      rejectedBookedRows,
      canonicalOfferSailings: transformedCruises.length,
      retainedOfferVariants: filteredOffers.length,
      consolidatedDuplicates: dedupedOffers.exactDuplicates + dedupedBookedCruises.exactDuplicates,
      exactOfferDuplicates: dedupedOffers.exactDuplicates,
      exactBookedDuplicates: dedupedBookedCruises.exactDuplicates,
      quarantinedBookedRows,
      unaccountedRows: (extractedOffers.length + extractedBookedCruises.length)
        - (filteredOffers.length + transformableBookedRows.length + rejectedOfferRows + rejectedBookedRows + dedupedOffers.exactDuplicates + dedupedBookedCruises.exactDuplicates),
    }
  };
}

export function calculateSyncCounts(preview: SyncPreview): SyncPreviewCounts {
  // Status counts describe the provider rows staged by this sync, not stale
  // unmatched records that are only carried in preview. This keeps the review
  // count aligned with Royal's visible Upcoming/Past totals before commit.
  const incomingBookedCruises = [
    ...preview.bookedCruises.new,
    ...preview.bookedCruises.updates.map(u => u.updated),
  ];

  const upcomingCruises = incomingBookedCruises.filter(c => isActiveBookedCruise(c)).length;
  const courtesyHolds = incomingBookedCruises.filter(c => isCourtesyHoldCruise(c)).length;
  const completedCruises = incomingBookedCruises.filter(c => isCompletedBookedCruise(c)).length;
  const insertedRows = preview.offers.new.length + preview.cruises.new.length + preview.bookedCruises.new.length;
  const updatedRows = preview.offers.updates.length + preview.cruises.updates.length + preview.bookedCruises.updates.length;
  const unchangedRows = preview.offers.unchanged.length + preview.cruises.unchanged.length + preview.bookedCruises.unchanged.length;
  
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
    totalBookedCruises: incomingBookedCruises.length,
    rawRowsReceived: preview.evidence.rawOfferRows + preview.evidence.rawBookedRows,
    canonicalRows: preview.evidence.canonicalOfferSailings + preview.evidence.retainedBookedRows,
    retainedVariants: preview.evidence.retainedOfferVariants,
    consolidatedDuplicates: preview.evidence.consolidatedDuplicates,
    rejectedRows: preview.evidence.rejectedOfferRows + preview.evidence.rejectedBookedRows,
    insertedRows,
    updatedRows,
    unchangedRows,
    completedCruises,
    quarantinedRows: preview.evidence.quarantinedBookedRows,
    unaccountedRows: preview.evidence.unaccountedRows,
  };
}

export interface ApplySyncPreviewOptions {
  allowOfferRemoval?: boolean;
  allowCruiseRemoval?: boolean;
  allowBookedCruiseRemoval?: boolean;
  /** Remove unmatched genuinely historical rows only when Past Trips was also
   * captured successfully. A current-bookings response alone owns future and
   * in-progress bookings, not the user's completed-cruise history. */
  allowCompletedBookedCruiseRemoval?: boolean;
  targetOwnerProfileId?: string;
  includeUnownedRecords?: boolean;
  replaceProviderCatalogAcrossOwners?: boolean;
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
  const allowCompletedBookedCruiseRemoval = options?.allowCompletedBookedCruiseRemoval ?? false;
  const targetOwnerProfileId = options?.targetOwnerProfileId;
  const includeUnownedRecords = options?.includeUnownedRecords ?? true;
  const catalogOwnerProfileId = options?.replaceProviderCatalogAcrossOwners
    ? undefined
    : targetOwnerProfileId;

  // STRATEGY: Synced data is the SOURCE OF TRUTH for the active sync source.
  // Items from that source NOT present in the sync are REMOVED only when we captured
  // authoritative data for that section in the current sync. Other sources are always preserved.
  // When a section failed to capture any rows, preserve the existing data to avoid destructive overwrites.

  const updatedOfferIds = new Set(preview.offers.updates.map(u => u.existing.id));
  const finalOffers = [
    // Keep offers from other sources; drop active-source offers not present in this sync
    ...normalizedExistingOffers
      .filter(o => {
        if (allowOfferRemoval && isManagedOfferSource(o, syncSource, catalogOwnerProfileId, includeUnownedRecords) && !updatedOfferIds.has(o.id)) {
          return false;
        }
        return true;
      })
      .filter(o => !updatedOfferIds.has(o.id)),
    ...preview.offers.updates.map(u => u.updated),
    ...preview.offers.new
  ];

  const updatedCruiseIds = new Set(preview.cruises.updates.map(u => u.existing.id));
  const finalCruises = [
    // Keep cruises from other sources; drop active-source cruises not in sync
    ...normalizedExistingCruises
      .filter(c => {
        if (allowCruiseRemoval && isManagedCruiseSource(c, syncSource, catalogOwnerProfileId, includeUnownedRecords) && !updatedCruiseIds.has(c.id)) {
          return false;
        }
        return true;
      })
      .filter(c => !updatedCruiseIds.has(c.id)),
    ...preview.cruises.updates.map(u => u.updated),
    ...preview.cruises.new
  ];

  // Offers are transformed before cruise reconciliation, so their cruiseIds
  // initially point at the transform-time IDs. When an incoming sailing
  // updates an existing sailing, mergeCruise intentionally retains the stable
  // existing ID. Rewrite every offer edge to that retained ID before the
  // atomic integrity check and persistence step.
  const finalCruiseIds = new Set(finalCruises.map((cruise) => cruise.id));
  const directCruiseIdAliases = new Map<string, string>(Object.entries(preview.cruiseIdAliases ?? {}));
  // Keep compatibility with previews created before aliases were added and
  // with hand-built previews used by diagnostics/tests.
  preview.cruises.new.forEach((cruise) => directCruiseIdAliases.set(cruise.id, cruise.id));
  preview.cruises.updates.forEach(({ existing, updated }) => {
    directCruiseIdAliases.set(existing.id, updated.id);
    directCruiseIdAliases.set(updated.id, updated.id);
  });
  const providerInstance = (record: { playerOfferId?: string; offerInstanceId?: string; carnivalOfferId?: string }) =>
    String(record.playerOfferId || record.offerInstanceId || record.carnivalOfferId || '').trim().toLowerCase();
  const cruiseIdsByOfferInstance = new Map<string, string[]>();
  finalCruises.forEach((cruise) => {
    const key = providerInstance(cruise);
    if (key) cruiseIdsByOfferInstance.set(key, [...(cruiseIdsByOfferInstance.get(key) ?? []), cruise.id]);
  });
  const offerCountByCode = finalOffers.reduce<Map<string, number>>((counts, offer) => {
    const code = String(offer.offerCode || '').trim().toUpperCase();
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    return counts;
  }, new Map());
  const remappedFinalOffers = finalOffers.map((offer) => {
    const instanceId = providerInstance(offer);
    const code = String(offer.offerCode || '').trim().toUpperCase();
    const originalLinks = Array.from(new Set([offer.cruiseId, ...(offer.cruiseIds ?? [])].filter(Boolean))) as string[];
    const directlyRemappedLinks = originalLinks
      .map((id) => directCruiseIdAliases.get(id) ?? id)
      .filter((id) => finalCruiseIds.has(id));
    const instanceLinks = instanceId ? cruiseIdsByOfferInstance.get(instanceId) ?? [] : [];
    const unambiguousCodeLinks = !instanceId && code && offerCountByCode.get(code) === 1
      ? finalCruises.filter((cruise) => String(cruise.offerCode || '').trim().toUpperCase() === code).map((cruise) => cruise.id)
      : [];
    const cruiseIds = Array.from(new Set([...directlyRemappedLinks, ...instanceLinks, ...unambiguousCodeLinks]));
    return {
      ...offer,
      cruiseId: cruiseIds[0],
      cruiseIds,
    };
  });

  const updatedBookedCruiseIds = new Set(preview.bookedCruises.updates.map(u => u.existing.id));
  const finalBookedCruises = [
    // A successful current-bookings response is an authoritative snapshot.
    // Remove unmatched future/in-progress records in the provider scope. True
    // historical rows are removed only when the separate Past Trips response
    // was captured too. This clears cancelled/changed bookings without erasing
    // legitimate history after a partial provider response. Other providers,
    // other owners, and explicit manual bookings always survive.
    ...normalizedExistingBookedCruises
      .filter(c => {
        if (allowBookedCruiseRemoval && isManagedBookedCruiseSnapshot(c, syncSource, targetOwnerProfileId, includeUnownedRecords) && !updatedBookedCruiseIds.has(c.id)) {
          const sailingTimestamp = Date.parse(c.returnDate || c.sailDate || '');
          const isGenuinelyHistorical = Number.isFinite(sailingTimestamp)
            ? sailingTimestamp < Date.now()
            : isCompletedBookedCruise(c);
          if (isGenuinelyHistorical && !allowCompletedBookedCruiseRemoval) return true;
          return false;
        }
        return true;
      })
      .filter(c => !updatedBookedCruiseIds.has(c.id)),
    ...preview.bookedCruises.updates.map(u => u.updated),
    ...preview.bookedCruises.new
  ];

  console.log('[SyncLogic] applySyncPreview final counts:', {
    syncSource,
    allowOfferRemoval,
    allowCruiseRemoval,
    allowBookedCruiseRemoval,
    allowCompletedBookedCruiseRemoval,
    existingOffers: normalizedExistingOffers.length,
    finalOffers: remappedFinalOffers.length,
    existingCruises: normalizedExistingCruises.length,
    finalCruises: finalCruises.length,
    existingBooked: normalizedExistingBookedCruises.length,
    finalBooked: finalBookedCruises.length,
    targetOwnerProfileId,
    replaceProviderCatalogAcrossOwners: options?.replaceProviderCatalogAcrossOwners ?? false,
    includeUnownedRecords,
    cruiseIdAliases: directCruiseIdAliases.size,
    managedOffersDelta: remappedFinalOffers.filter(o => isManagedOfferSource(o, syncSource, catalogOwnerProfileId, includeUnownedRecords)).length - normalizedExistingOffers.filter(o => isManagedOfferSource(o, syncSource, catalogOwnerProfileId, includeUnownedRecords)).length,
    managedCruisesDelta: finalCruises.filter(c => isManagedCruiseSource(c, syncSource, catalogOwnerProfileId, includeUnownedRecords)).length - normalizedExistingCruises.filter(c => isManagedCruiseSource(c, syncSource, catalogOwnerProfileId, includeUnownedRecords)).length,
  });

  return { offers: remappedFinalOffers, cruises: finalCruises, bookedCruises: finalBookedCruises };
}
