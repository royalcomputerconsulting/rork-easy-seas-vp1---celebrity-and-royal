import { attributeOfferToCruise } from '@/lib/offers/offerAttribution';

export function backfillOfferAttribution<T extends Record<string, unknown>>(cruises: T[]) {
  return cruises.map(cruise => ({ ...cruise, offerAttribution: attributeOfferToCruise(cruise) }));
}
