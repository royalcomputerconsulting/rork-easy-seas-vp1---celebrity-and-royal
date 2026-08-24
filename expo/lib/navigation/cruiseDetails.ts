export type CruiseDetailParamRecord = Record<string, string>;

export type CruiseDetailSearchParams = Partial<Record<keyof CruiseDetailParamRecord | 'id' | 'source' | 'shipName' | 'sailDate' | 'returnDate' | 'offerCode' | 'bookingId' | 'brand', string | string[]>>;

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

const cruiseBookingIdentity = (cruise: any): string => firstString(
  cruise?.bookingId,
  cruise?.reservationNumber,
  cruise?.reservationId,
  cruise?.bookingNumber,
  cruise?.bwoNumber,
);

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
    const exactId = records.find((record) => firstString(record?.id) === requestedId);
    if (exactId) return exactId;
  }

  const requestedBooking = normalizeIdentity(firstString(params.bookingId, requestedId));
  if (requestedBooking) {
    const bookingMatches = records.filter((record) => normalizeIdentity(cruiseBookingIdentity(record)) === requestedBooking);
    if (bookingMatches.length === 1) return bookingMatches[0];
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

  return materialMatches.length === 1 ? materialMatches[0] : undefined;
};

const inferSource = (cruise: any, fallbackSource?: string): string => {
  const status = firstString(cruise?.status, cruise?.bookingStatus, cruise?.sourceType, cruise?.source);
  const sourceType = firstString(cruise?.sourceType, cruise?.syncSourceType);
  if (sourceType === 'offer_catalog' || status === 'available' || status === 'offer') return 'available';
  if (status === 'completed' || status === 'past' || status === 'history') return 'completed';
  if (status === 'booked' || status === 'upcoming' || status === 'hold') return 'booked';
  return firstString(fallbackSource, status, 'unknown');
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

  return {
    id,
    source,
    shipName,
    sailDate,
    returnDate,
    offerCode,
    bookingId,
    brand,
  };
};
