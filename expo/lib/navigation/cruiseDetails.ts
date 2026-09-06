export type CruiseDetailParamKey =
  | 'id' | 'source' | 'shipName' | 'sailDate' | 'returnDate' | 'offerCode'
  | 'bookingId' | 'brand' | 'sourceRecordId' | 'sourceIdentity' | 'offerOptionId'
  | 'offerInstanceKey' | 'nights' | 'destination' | 'departurePort' | 'cabinType'
  | 'guests' | 'itineraryName';

export type CruiseDetailParamRecord = Record<CruiseDetailParamKey, string>;

export type CruiseDetailSearchParams = Partial<Record<CruiseDetailParamKey, string | string[]>>;

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstString(...value);
      if (nested) return nested;
      continue;
    }
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length > 0 && text !== 'undefined' && text !== 'null') return text;
  }
  return '';
};

const normalizeIdentity = (value: unknown): string => firstString(value).toLowerCase();

const isMissingEvidence = (value: unknown): boolean => (
  value === undefined
  || value === null
  || (typeof value === 'string' && value.trim().length === 0)
  || (Array.isArray(value) && value.length === 0)
);

const cruiseBookingIdentity = (cruise: any): string => firstString(
  cruise?.bookingId,
  cruise?.reservationNumber,
  cruise?.reservationId,
  cruise?.bookingNumber,
  cruise?.bwoNumber,
);

const recordIdentities = (record: any): string[] => [
  record?.id,
  record?.canonicalKey,
  record?.inventoryCanonicalKey,
  record?.sourceCruiseId,
].map(normalizeIdentity).filter(Boolean);

const recordSourceIdentities = (record: any): string[] => [
  record?.sourceRecordId,
  record?.sourceIdentity,
  record?.sourceEvidence?.sourceRecordId,
  record?.providerSailingId,
  record?.sailingId,
  record?.voyageId,
].map(normalizeIdentity).filter(Boolean);

const recordOptionIdentities = (record: any): string[] => [
  record?.offerOptionId,
  record?.offerSailingKey,
  record?.eligibilityKey,
  record?.inventoryCanonicalKey,
].map(normalizeIdentity).filter(Boolean);

/**
 * CoreData and the compatibility AppState provider can expose the same logical
 * record during hydration. Treating those two copies as two different cruises
 * made a valid Booked card fall through to route-only evidence. Preserve the
 * first (current store) record as authoritative and only backfill values it is
 * genuinely missing from its duplicate.
 */
const coalesceLogicalRecordCopies = <T extends Record<string, any>>(matches: readonly T[]): T | undefined => {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  return matches.slice(1).reduce<T>((resolved, candidate) => {
    const merged: Record<string, any> = { ...resolved };
    Object.entries(candidate).forEach(([key, value]) => {
      if (isMissingEvidence(merged[key]) && !isMissingEvidence(value)) {
        merged[key] = value;
      }
    });
    return merged as T;
  }, { ...matches[0] } as T);
};

function uniqueIdentityMatch<T extends Record<string, any>>(
  records: readonly T[],
  requested: string,
  identities: (record: T) => string[],
): T | undefined {
  if (!requested) return undefined;
  const matches = records.filter((record) => identities(record).includes(requested));
  return coalesceLogicalRecordCopies(matches);
}

/**
 * Resolve a detail route without relying only on a possibly unsafe or recycled ID.
 * Exact IDs remain authoritative. Booking identity and then a unique ship/date
 * match are fail-safe fallbacks for imported cruises whose IDs changed during a
 * local merge.
 */
export const resolveCruiseDetailsRecord = <T extends Record<string, any>>(
  records: readonly T[],
  params: CruiseDetailSearchParams,
): T | undefined => {
  const requestedId = firstString(params.id);
  if (requestedId) {
    const exactId = uniqueIdentityMatch(records, normalizeIdentity(requestedId), recordIdentities);
    if (exactId) return exactId;
  }

  const sourceIdentity = normalizeIdentity(firstString(params.sourceRecordId, params.sourceIdentity));
  const sourceMatch = uniqueIdentityMatch(records, sourceIdentity, recordSourceIdentities);
  if (sourceMatch) return sourceMatch;

  const optionIdentity = normalizeIdentity(params.offerOptionId);
  const optionMatch = uniqueIdentityMatch(records, optionIdentity, recordOptionIdentities);
  if (optionMatch) return optionMatch;

  const requestedBooking = normalizeIdentity(firstString(params.bookingId, requestedId));
  if (requestedBooking) {
    const bookingMatches = records.filter((record) => normalizeIdentity(cruiseBookingIdentity(record)) === requestedBooking);
    const bookingMatch = coalesceLogicalRecordCopies(bookingMatches);
    if (bookingMatch) return bookingMatch;
  }

  const requestedShip = normalizeIdentity(params.shipName);
  const requestedSailDate = firstString(params.sailDate);
  if (!requestedShip || !requestedSailDate) return undefined;

  let materialMatches = records.filter((record) => (
    normalizeIdentity(record?.shipName ?? record?.ship) === requestedShip
    && firstString(record?.sailDate ?? record?.sailingDate ?? record?.date) === requestedSailDate
  ));

  const requestedReturnDate = firstString(params.returnDate);
  if (requestedReturnDate) {
    const returnDateMatches = materialMatches.filter((record) => firstString(record?.returnDate ?? record?.endDate) === requestedReturnDate);
    if (returnDateMatches.length > 0) materialMatches = returnDateMatches;
  }

  const requestedBrand = normalizeIdentity(params.brand);
  if (requestedBrand) {
    const brandMatches = materialMatches.filter((record) => normalizeIdentity(record?.brand ?? record?.cruiseLine ?? record?.provider ?? record?.cruiseSource) === requestedBrand);
    if (brandMatches.length > 0) materialMatches = brandMatches;
  }

  const requestedOfferCode = normalizeIdentity(params.offerCode);
  if (requestedOfferCode) {
    const offerMatches = materialMatches.filter((record) => normalizeIdentity(record?.offerCode ?? record?.certificateCode) === requestedOfferCode);
    if (offerMatches.length > 0) materialMatches = offerMatches;
  }

  const requestedCabin = normalizeIdentity(params.cabinType);
  if (requestedCabin) {
    const cabinMatches = materialMatches.filter((record) => normalizeIdentity(record?.cabinType ?? record?.stateroomType ?? record?.cabinCategory) === requestedCabin);
    if (cabinMatches.length > 0) materialMatches = cabinMatches;
  }

  const requestedGuests = firstString(params.guests);
  if (requestedGuests) {
    const guestMatches = materialMatches.filter((record) => firstString(record?.guests ?? record?.guestCount) === requestedGuests);
    if (guestMatches.length > 0) materialMatches = guestMatches;
  }

  return materialMatches.length === 1 ? materialMatches[0] : undefined;
};

const inferSource = (cruise: any, fallbackSource?: string): string => {
  // Callers use `source` as navigation context (Booked, Cruises, Calendar,
  // Casino, or Offers). An explicit context must win over the record's data
  // status; otherwise every shared detail route drifts back to its host stack.
  const explicitSource = firstString(fallbackSource);
  if (explicitSource) return explicitSource;
  const status = firstString(cruise?.status, cruise?.bookingStatus, cruise?.sourceType, cruise?.source);
  const sourceType = firstString(cruise?.sourceType, cruise?.syncSourceType);
  if (sourceType === 'offer_catalog' || status === 'available' || status === 'offer') return 'available';
  if (status === 'completed' || status === 'past' || status === 'history') return 'completed';
  if (status === 'booked' || status === 'upcoming' || status === 'hold') return 'booked';
  return firstString(status, 'unknown');
};

export const buildCruiseDetailsParams = (cruise: any, fallback?: Partial<CruiseDetailParamRecord>): CruiseDetailParamRecord => {
  const id = firstString(cruise?.id, fallback?.id, cruise?.cruiseId, cruise?.bookingId, cruise?.reservationNumber);
  const shipName = firstString(cruise?.shipName, cruise?.ship, cruise?.title, fallback?.shipName);
  const sailDate = firstString(cruise?.sailDate, cruise?.sailingDate, cruise?.date, fallback?.sailDate);
  const returnDate = firstString(cruise?.returnDate, cruise?.endDate, fallback?.returnDate);
  const offerCode = firstString(cruise?.offerCode, cruise?.certificateCode, cruise?.offer_code, fallback?.offerCode);
  const bookingId = firstString(cruise?.bookingId, cruise?.reservationNumber, cruise?.reservationId, cruise?.bookingNumber, fallback?.bookingId);
  const brand = firstString(cruise?.brand, cruise?.cruiseLine, cruise?.provider, fallback?.brand);
  const source = inferSource(cruise, fallback?.source);
  const sourceRecordId = firstString(cruise?.sourceRecordId, cruise?.sourceIdentity, cruise?.sourceEvidence?.sourceRecordId, fallback?.sourceRecordId);
  const sourceIdentity = firstString(cruise?.sourceIdentity, cruise?.sourceRecordId, fallback?.sourceIdentity);
  const offerOptionId = firstString(cruise?.offerOptionId, cruise?.offerSailingKey, cruise?.eligibilityKey, cruise?.inventoryCanonicalKey, fallback?.offerOptionId);
  const offerInstanceKey = firstString(cruise?.offerInstanceKey, cruise?.playerOfferId, cruise?.offerInstanceId, fallback?.offerInstanceKey);
  const nights = firstString(cruise?.nights, fallback?.nights);
  const destination = firstString(cruise?.destination, fallback?.destination);
  const departurePort = firstString(cruise?.departurePort, fallback?.departurePort);
  const cabinType = firstString(cruise?.cabinType, cruise?.stateroomType, cruise?.cabinCategory, fallback?.cabinType);
  const guests = firstString(cruise?.guests, cruise?.guestCount, fallback?.guests);
  const itineraryName = firstString(
    cruise?.itineraryName,
    typeof cruise?.itinerary === 'string' ? cruise.itinerary : undefined,
    fallback?.itineraryName,
  );

  return {
    id,
    source,
    shipName,
    sailDate,
    returnDate,
    offerCode,
    bookingId,
    brand,
    sourceRecordId,
    sourceIdentity,
    offerOptionId,
    offerInstanceKey,
    nights,
    destination,
    departurePort,
    cabinType,
    guests,
    itineraryName,
  };
};

/**
 * If a certificate or stale provider route no longer has a hydrated catalog
 * object, retain the exact evidence carried by the tap instead of rendering a
 * false "Cruise Not Found". This record is visibly partial and never saved
 * unless the user explicitly books/edits it.
 */
export const createCruiseDetailsRouteFallback = (params: CruiseDetailSearchParams): Record<string, any> | undefined => {
  const shipName = firstString(params.shipName);
  const sailDate = firstString(params.sailDate);
  if (!shipName || !sailDate) return undefined;
  const routeId = firstString(params.offerOptionId, params.sourceRecordId, params.id, `${shipName}|${sailDate}`);
  const parsedNights = Number(firstString(params.nights));
  return {
    id: routeId,
    shipName,
    sailDate,
    returnDate: firstString(params.returnDate) || undefined,
    nights: Number.isFinite(parsedNights) && parsedNights > 0 ? parsedNights : undefined,
    destination: firstString(params.destination) || undefined,
    itineraryName: firstString(params.itineraryName, params.destination) || undefined,
    departurePort: firstString(params.departurePort) || undefined,
    cabinType: firstString(params.cabinType) || undefined,
    stateroomType: firstString(params.cabinType) || undefined,
    guests: Number(firstString(params.guests)) || undefined,
    offerCode: firstString(params.offerCode) || undefined,
    bookingId: firstString(params.bookingId) || undefined,
    brand: firstString(params.brand) || undefined,
    sourceRecordId: firstString(params.sourceRecordId, params.sourceIdentity) || undefined,
    offerSailingKey: firstString(params.offerOptionId) || undefined,
    status: inferSource({}, firstString(params.source)) === 'booked' ? 'booked' : 'available',
    dataConfidence: 'partial',
    validationStatus: 'needsReview',
    sourceProvider: 'navigation-route-evidence',
    isRouteEvidenceFallback: true,
  };
};

export const buildCruiseDetailsPath = (cruise: any, fallback?: Partial<CruiseDetailParamRecord>): string => {
  const params = buildCruiseDetailsParams(cruise, fallback);
  const search = Object.entries(params)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `/cruise-details${search ? `?${search}` : ''}`;
};
