import { buildBookedCruiseOfferAttribution } from '@/lib/offers/offerAttribution';

export function normalizeCruiseOfferAttributionFields<T extends Record<string, any>>(cruise: T): T {
  const attribution = buildBookedCruiseOfferAttribution(cruise);
  return {
    ...cruise,
    bookingOfferCode: cruise.bookingOfferCode || attribution.offerCode || undefined,
    bookingOfferName: cruise.bookingOfferName || attribution.offerName || undefined,
    bookingOfferType: cruise.bookingOfferType || attribution.offerType,
    bookingCertificateLevel: cruise.bookingCertificateLevel || attribution.certificateLevel,
    bookingCertificateBank: cruise.bookingCertificateBank || attribution.certificateBank,
    bookingCertificatePointsRequired: cruise.bookingCertificatePointsRequired ?? attribution.pointsRequired,
  };
}

export function normalizeCruisesOfferAttributionFields<T extends Record<string, any>>(cruises: T[] = []): T[] {
  return cruises.map(normalizeCruiseOfferAttributionFields);
}
