export type CruiseDetailParamRecord = Record<string, string>;

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length > 0 && text !== 'undefined' && text !== 'null') return text;
  }
  return '';
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
