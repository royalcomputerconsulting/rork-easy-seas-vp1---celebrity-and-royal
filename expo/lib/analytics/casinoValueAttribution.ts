import { attributeOfferToCruise } from '@/lib/offers/offerAttribution';
import { calculateTrueMakeout } from '@/lib/value/trueMakeout';

export function buildCasinoValueAttribution(cruise: Record<string, unknown>) {
  const n = (v: unknown) => Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0;
  return {
    offer: attributeOfferToCruise(cruise),
    trueMakeout: calculateTrueMakeout({
      retailValue: n(cruise.retailValue) || n(cruise.totalRetailCost),
      compValue: n(cruise.compValue) || n(cruise.offerValue) || n(cruise.totalCasinoDiscount),
      cashPaid: n(cruise.amountPaid) || n(cruise.pricePaid),
      taxesFees: n(cruise.taxes) || n(cruise.taxesFeesEstimate),
      onboardSpend: n(cruise.onboardSpend),
      casinoNetResult: n(cruise.cashResult) || n(cruise.winningsBroughtHome) || n(cruise.netResult),
      fccApplied: n(cruise.fccApplied),
      obcValue: n(cruise.freeOBC) || n(cruise.obcAmount),
      freeplayValue: n(cruise.freePlay) || n(cruise.freeplayAmount),
    }),
  };
}
