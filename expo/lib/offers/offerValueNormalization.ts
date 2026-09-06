import type { CasinoOffer, Cruise } from '@/types/models';

export type OfferValueEvidence = 'provider' | 'user' | 'derived' | 'missing';

export interface NormalizedMoneyField {
  value: number | null;
  evidence: OfferValueEvidence;
  sourceField: string | null;
  explanation: string;
}

export interface NormalizedOfferValue {
  offerId: string;
  offerCode: string;
  comparableScope: string;
  eligibleSailingCount: number;
  cabinRetailRange: { minimum: number; median: number; maximum: number } | null;
  faceValue: NormalizedMoneyField;
  expectedValue: NormalizedMoneyField;
  personallyUsableValue: NormalizedMoneyField;
  components: {
    cabinRetail: NormalizedMoneyField;
    freePlay: NormalizedMoneyField;
    onboardCredit: NormalizedMoneyField;
    taxesFees: NormalizedMoneyField;
    requiredSpend: NormalizedMoneyField;
    travelCost: NormalizedMoneyField;
    redemptionProbability: number | null;
    freePlayConversionRate: number | null;
    onboardCreditUsabilityRate: number | null;
  };
  restrictions: string[];
  missingInputs: string[];
  formula: string[];
  comparableRank?: number;
  comparableCount?: number;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const recordOf = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

function numeric(record: Record<string, unknown>, keys: string[], allowZero = true): { value: number | null; key: string | null } {
  for (const key of keys) {
    const raw = record[key];
    const value = typeof raw === 'string' ? Number(raw.replace(/[$,% ,]/g, '')) : Number(raw);
    if (Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)) return { value, key };
  }
  return { value: null, key: null };
}

function moneyField(value: number | null, evidence: OfferValueEvidence, sourceField: string | null, explanation: string): NormalizedMoneyField {
  return { value: value == null ? null : roundMoney(value), evidence: value == null ? 'missing' : evidence, sourceField, explanation };
}

function cabinPriceForSailing(sailing: Cruise, cabin: string): number | null {
  const row = recordOf(sailing);
  const normalized = cabin.toLowerCase();
  const keys = normalized.includes('suite') ? ['suitePrice', 'juniorSuitePrice', 'grandSuitePrice']
    : normalized.includes('balcony') ? ['balconyPrice']
      : normalized.includes('ocean') ? ['oceanviewPrice'] : ['interiorPrice'];
  const price = numeric(row, keys, false).value ?? numeric(row, ['price'], false).value;
  if (price == null) return null;
  // Synced certificate/offer category prices are per-person. Preserve the
  // established full-room comparison basis without summing alternative trips.
  return roundMoney(price * 2);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : roundMoney((sorted[middle - 1] + sorted[middle]) / 2);
}

export function normalizeOfferValue(offer: CasinoOffer | Record<string, unknown>, sailings: Cruise[] = []): NormalizedOfferValue {
  const row = recordOf(offer);
  const offerId = String(row.id ?? row.offerInstanceId ?? row.offerCode ?? 'unknown');
  const offerCode = String(row.offerCode ?? row.code ?? offerId);
  const cabin = String(row.roomType ?? row.cabinType ?? sailings[0]?.cabinType ?? 'Unspecified');
  const guests = numeric(row, ['guests', 'guestCount']).value;
  const nights = numeric(row, ['nights']).value ?? numeric(recordOf(sailings[0]), ['nights']).value;

  const explicitCabin = numeric(row, ['retailCabinValue', 'retailValue', 'cabinRetailValue'], false);
  const explicitOfferValue = numeric(row, ['totalValue', 'offerValue', 'value'], false);
  const sailingCabinValues = sailings
    .map((sailing) => cabinPriceForSailing(sailing, String(sailing.cabinType ?? cabin)))
    .filter((value): value is number => value != null);
  const cabinRetailRange = sailingCabinValues.length ? {
    minimum: Math.min(...sailingCabinValues),
    median: median(sailingCabinValues),
    maximum: Math.max(...sailingCabinValues),
  } : null;
  const cabinValue = explicitCabin.value ?? cabinRetailRange?.median ?? null;
  const cabinRetail = moneyField(cabinValue, explicitCabin.value != null ? 'provider' : cabinValue != null ? 'derived' : 'missing', explicitCabin.key ?? (cabinValue != null ? 'eligibleSailingPrices.median' : null), cabinValue == null ? 'No verified cabin retail value is available.' : explicitCabin.value != null ? 'Explicit saved/provider offer cabin value.' : 'Median full-room retail price across eligible sailings; alternatives are never summed.');

  const fp = numeric(row, ['freePlay', 'freeplayAmount', 'freeplay']);
  const obc = numeric(row, ['OBC', 'obcAmount', 'onboardCredit', 'freeOBC']);
  const taxes = numeric(row, ['taxesFees', 'portCharges', 'taxes']);
  const required = numeric(row, ['requiredSpend', 'minimumSpend', 'upgradeCost']);
  const travel = numeric(row, ['travelCost', 'estimatedTravelCost', 'tripCost']);
  const redemption = numeric(row, ['redemptionProbability', 'useProbability']).value;
  const fpConversion = numeric(row, ['freePlayConversionRate', 'freeplayConversionRate']).value;
  const obcUsability = numeric(row, ['obcUsabilityRate', 'onboardCreditUsabilityRate']).value;
  const freePlay = moneyField(fp.value ?? 0, fp.key ? 'provider' : 'derived', fp.key, fp.key ? 'Recorded FreePlay benefit.' : 'No FreePlay benefit recorded; treated as zero, not missing cabin value.');
  const onboardCredit = moneyField(obc.value ?? 0, obc.key ? 'provider' : 'derived', obc.key, obc.key ? 'Recorded onboard-credit benefit.' : 'No onboard credit recorded; treated as zero.');
  const taxesFees = moneyField(taxes.value, taxes.key ? 'provider' : 'missing', taxes.key, taxes.key ? 'Recorded taxes and fees.' : 'Taxes and fees are not available.');
  const requiredSpend = moneyField(required.value, required.key ? 'provider' : 'missing', required.key, required.key ? 'Recorded required or upgrade spend.' : 'Required spend is not confirmed.');
  const travelCost = moneyField(travel.value, travel.key ? 'user' : 'missing', travel.key, travel.key ? 'Saved personal travel cost.' : 'Personal travel cost is not available.');

  const calculatedFaceValue = cabinValue == null ? null : cabinValue + (freePlay.value ?? 0) + (onboardCredit.value ?? 0);
  const faceValueNumber = explicitOfferValue.value ?? calculatedFaceValue;
  const faceValue = moneyField(
    faceValueNumber,
    explicitOfferValue.value != null ? 'provider' : faceValueNumber == null ? 'missing' : 'derived',
    explicitOfferValue.key ?? (faceValueNumber == null ? null : 'cabin + freePlay + onboardCredit'),
    explicitOfferValue.value != null
      ? `Explicit provider/saved offer value from ${explicitOfferValue.key}.`
      : 'Face value is one usable cabin entitlement plus recorded benefits, not the sum of eligible sailings.',
  );

  const expectedValueNumber = faceValueNumber != null && redemption != null && fpConversion != null && obcUsability != null
    ? explicitOfferValue.value != null
      ? redemption * explicitOfferValue.value
      : redemption * (cabinValue! + (freePlay.value ?? 0) * fpConversion + (onboardCredit.value ?? 0) * obcUsability)
    : null;
  const expectedValue = moneyField(expectedValueNumber, expectedValueNumber == null ? 'missing' : 'derived', 'redemptionProbability × (cabin + converted FreePlay + usable OBC)', expectedValueNumber == null ? 'Expected value requires explicit redemption, FreePlay-conversion, and OBC-usability rates.' : 'Expected value uses only saved personal probability and conversion assumptions.');

  const personallyUsableNumber = expectedValueNumber != null && taxes.value != null && required.value != null && travel.value != null
    ? expectedValueNumber - taxes.value - required.value - travel.value
    : null;
  const personallyUsableValue = moneyField(personallyUsableNumber, personallyUsableNumber == null ? 'missing' : 'derived', 'expected value − taxes − required spend − travel cost', personallyUsableNumber == null ? 'Personally usable value requires expected value plus complete taxes, required-spend, and travel-cost inputs.' : 'Net value after the recorded cost of actually using the offer.');

  const missingInputs: string[] = [];
  if (cabinValue == null) missingInputs.push('cabin retail value');
  if (redemption == null) missingInputs.push('redemption probability');
  if (fpConversion == null) missingInputs.push('FreePlay conversion rate');
  if (obcUsability == null) missingInputs.push('OBC usability rate');
  if (taxes.value == null) missingInputs.push('taxes and fees');
  if (required.value == null) missingInputs.push('required spend or confirmed zero');
  if (travel.value == null) missingInputs.push('personal travel cost or confirmed zero');

  const restrictions = Array.isArray(row.restrictions) ? row.restrictions.map(String) : String(row.restrictions ?? row.terms ?? '').split(/[;\n]/).map((value) => value.trim()).filter(Boolean);
  const comparableScope = [String(row.brand ?? row.offerSource ?? 'unknown').toLowerCase(), cabin.toLowerCase(), guests ?? 'guest-unknown', nights ?? 'nights-unknown'].join('|');

  return {
    offerId, offerCode, comparableScope, eligibleSailingCount: sailings.length, cabinRetailRange,
    faceValue, expectedValue, personallyUsableValue,
    components: { cabinRetail, freePlay, onboardCredit, taxesFees, requiredSpend, travelCost, redemptionProbability: redemption, freePlayConversionRate: fpConversion, onboardCreditUsabilityRate: obcUsability },
    restrictions, missingInputs,
    formula: [
      'Face value = one cabin retail value + FreePlay + onboard credit; it is not the sum of eligible sailings.',
      'Expected value = redemption probability × (cabin value + converted FreePlay + usable onboard credit).',
      'Personally usable value = expected value − taxes/fees − required spend − personal travel cost.',
      'A missing input stays missing; Easy Seas does not fabricate a value merely to produce a ranking.',
    ],
  };
}

export function rankComparableOfferValues(values: NormalizedOfferValue[]): NormalizedOfferValue[] {
  const groups = new Map<string, NormalizedOfferValue[]>();
  values.forEach((value) => groups.set(value.comparableScope, [...(groups.get(value.comparableScope) ?? []), value]));
  const ranked: NormalizedOfferValue[] = [];
  groups.forEach((rows) => {
    const sorted = [...rows].sort((a, b) => (b.personallyUsableValue.value ?? Number.NEGATIVE_INFINITY) - (a.personallyUsableValue.value ?? Number.NEGATIVE_INFINITY));
    sorted.forEach((row, index) => ranked.push({ ...row, comparableRank: row.personallyUsableValue.value == null ? undefined : index + 1, comparableCount: rows.length }));
  });
  return ranked;
}
