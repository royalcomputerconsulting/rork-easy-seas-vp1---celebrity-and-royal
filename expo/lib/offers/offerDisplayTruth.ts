import type { CasinoOffer, Cruise } from '@/types/models';
import { getCanonicalCruiseCabinLabel, getCruiseGuestEligibility } from '@/lib/cruiseRecordIntegrity';
import { classifyOfferCode } from '@/lib/offers/offerCodeClassifier';

export type OfferDisplayEvidence = 'provider' | 'saved' | 'decoded_code' | 'sailing_rows' | 'missing';

export interface OfferDisplayFact<T> {
  value: T | null;
  label: string;
  evidence: OfferDisplayEvidence;
  source: string;
  varies: boolean;
}

function text(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function positiveNumber(record: Record<string, unknown> | undefined, fields: string[]): { value: number; field: string } | null {
  if (!record) return null;
  for (const field of fields) {
    const raw = record[field];
    const value = typeof raw === 'string' ? Number(raw.replace(/[, ]/g, '')) : Number(raw);
    if (Number.isFinite(value) && value > 0) return { value, field };
  }
  return null;
}

export function resolveOfferPointRequirement(offer: Partial<CasinoOffer> | undefined, sailings: readonly Cruise[]): OfferDisplayFact<number> {
  const explicitOffer = positiveNumber(offer as Record<string, unknown> | undefined, ['pointsRequired', 'pointRequirement', 'pointsLevel', 'pointLevel', 'thresholdPoints']);
  if (explicitOffer) return { value: explicitOffer.value, label: explicitOffer.value.toLocaleString(), evidence: 'provider', source: `Offer ${explicitOffer.field}`, varies: false };

  const rowValues = sailings
    .map((sailing) => positiveNumber(sailing as unknown as Record<string, unknown>, ['pointsRequired', 'pointRequirement', 'pointsLevel', 'pointLevel', 'certificatePoints', 'thresholdPoints'])?.value)
    .filter((value): value is number => Boolean(value));
  const uniqueRows = Array.from(new Set(rowValues));
  if (uniqueRows.length === 1) return { value: uniqueRows[0], label: uniqueRows[0].toLocaleString(), evidence: 'sailing_rows', source: 'Eligible sailing row', varies: false };
  if (uniqueRows.length > 1) return { value: null, label: 'Varies by sailing', evidence: 'sailing_rows', source: 'Eligible sailing rows', varies: true };

  const decoded = classifyOfferCode(offer?.offerCode ?? sailings[0]?.offerCode);
  if (decoded.pointsRequired) return { value: decoded.pointsRequired, label: decoded.pointsRequired.toLocaleString(), evidence: 'decoded_code', source: `Decoded ${decoded.code} suffix`, varies: false };
  return { value: null, label: 'Not stated', evidence: 'missing', source: 'No provider or certificate point field', varies: false };
}

export function resolveOfferCabinEntitlement(offer: Partial<CasinoOffer> | undefined, sailings: readonly Cruise[]): OfferDisplayFact<string> {
  const rowCabins = Array.from(new Set(sailings.map((sailing) => getCanonicalCruiseCabinLabel(sailing)).filter((value): value is string => Boolean(value))));
  if (rowCabins.length > 1) return { value: null, label: rowCabins.join(' · '), evidence: 'sailing_rows', source: `${rowCabins.length} Royal sailing categories`, varies: true };
  if (rowCabins.length === 1) return { value: rowCabins[0], label: rowCabins[0], evidence: 'sailing_rows', source: 'Eligible sailing row', varies: false };
  const providerRecord = offer as unknown as Record<string, unknown> | undefined;
  const providerCabin = getCanonicalCruiseCabinLabel(offer) ?? text(providerRecord?.stateroomType ?? offer?.roomType ?? offer?.cabinType);
  if (providerCabin) return { value: providerCabin, label: providerCabin, evidence: 'provider', source: 'Offer cabin entitlement', varies: false };
  return { value: null, label: sailings.length > 0 ? 'See sailing categories' : 'Category pending sync', evidence: 'missing', source: 'No loaded category field', varies: false };
}

export function resolveOfferGuestEntitlement(offer: Partial<CasinoOffer> | undefined, sailings: readonly Cruise[]): OfferDisplayFact<number> {
  const rowGuests = Array.from(new Set(sailings.map(getCruiseGuestEligibility).filter((count): count is number => Boolean(count))));
  if (rowGuests.length > 1) return { value: null, label: 'Varies by sailing', evidence: 'sailing_rows', source: 'Eligible sailing rows', varies: true };
  if (rowGuests.length === 1) return { value: rowGuests[0], label: `${rowGuests[0]} guest${rowGuests[0] === 1 ? '' : 's'}`, evidence: 'sailing_rows', source: 'Eligible sailing row', varies: false };
  const offerGuests = getCruiseGuestEligibility(offer);
  if (offerGuests) return { value: offerGuests, label: `${offerGuests} guest${offerGuests === 1 ? '' : 's'}`, evidence: 'provider', source: 'Offer guest entitlement', varies: false };
  return { value: null, label: 'Not stated', evidence: 'missing', source: 'No guest entitlement field', varies: false };
}
