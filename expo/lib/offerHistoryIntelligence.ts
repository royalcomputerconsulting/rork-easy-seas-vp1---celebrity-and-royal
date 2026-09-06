import type { BookedCruise, CasinoOffer } from '@/types/models';

export type OfferHistoryStatus = 'active' | 'booked' | 'used' | 'expired' | 'archived' | 'skipped' | 'review';

export interface OfferHistoryRecord {
  instanceKey: string;
  offerId: string;
  offerCode: string;
  offerName: string;
  brand: string;
  status: OfferHistoryStatus;
  receivedAt?: string;
  expiresAt?: string;
  linkedCruiseIds: string[];
  offeredValue: number;
  capturedValue: number;
  attribution: 'provider-instance' | 'explicit-cruise' | 'unique-code' | 'none';
}

export interface OfferHistoryDimension {
  key: string;
  label: string;
  instances: number;
  redeemed: number;
  offeredValue: number;
  capturedValue: number;
}

export interface OfferHistoryReport {
  records: OfferHistoryRecord[];
  totalInstances: number;
  uniqueMarketingCodes: number;
  active: number;
  redeemed: number;
  expired: number;
  archivedOrSkipped: number;
  reviewNeeded: number;
  offeredValue: number;
  capturedValue: number;
  captureRate: number | null;
  byBrand: OfferHistoryDimension[];
  byYear: OfferHistoryDimension[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function positiveMoney(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function instanceIdentity(record: Pick<CasinoOffer | BookedCruise, 'playerOfferId' | 'offerInstanceId'> & { carnivalOfferId?: string }): string {
  return lower(record.playerOfferId || record.offerInstanceId || record.carnivalOfferId);
}

function getOfferInstanceKey(offer: CasinoOffer): string {
  const providerId = instanceIdentity(offer);
  return providerId ? `provider:${providerId}` : `local:${lower(offer.id)}`;
}

function getOfferValue(offer: CasinoOffer): number {
  const cabin = positiveMoney(offer.retailCabinValue)
    || positiveMoney(offer.totalValue)
    || positiveMoney(offer.offerValue)
    || positiveMoney(offer.value);
  return Math.round(cabin + positiveMoney(offer.freePlay ?? offer.freeplayAmount) + positiveMoney(offer.OBC ?? offer.obcAmount));
}

function getCapturedValue(cruise: BookedCruise): number {
  return Math.round(
    positiveMoney(cruise.cruiseValueCaptured)
    || positiveMoney(cruise.totalEconomicValue)
    || positiveMoney(cruise.totalCasinoDiscount)
    || positiveMoney(cruise.compValue)
    || positiveMoney(cruise.offerValue)
    || positiveMoney(cruise.retailValue),
  );
}

function getExpiry(offer: CasinoOffer): string | undefined {
  return text(offer.expiryDate || offer.expires || offer.offerExpiryDate || offer.validUntil) || undefined;
}

function isPast(dateValue: string | undefined, now: Date): boolean {
  if (!dateValue) return false;
  const timestamp = Date.parse(dateValue);
  return Number.isFinite(timestamp) && timestamp < now.getTime();
}

function classifyStatus(offer: CasinoOffer, linkedCruises: BookedCruise[], now: Date): OfferHistoryStatus {
  const status = lower(offer.status);
  const archiveStatus = lower(offer.archiveStatus);
  if (status === 'used') return 'used';
  if (status === 'booked' || linkedCruises.length > 0) return 'booked';
  if (status === 'skipped') return 'skipped';
  if (status === 'archived' || archiveStatus === 'archived' || archiveStatus === 'replaced' || status === 'replaced') return 'archived';
  if (status === 'reviewneeded' || archiveStatus === 'reviewneeded' || offer.reconciliationStatus === 'reviewNeeded') return 'review';
  if (status === 'expired' || isPast(getExpiry(offer), now)) return 'expired';
  return 'active';
}

function dedupeCruises(cruises: BookedCruise[]): BookedCruise[] {
  return Array.from(new Map(cruises.map((cruise) => [cruise.id, cruise])).values());
}

function buildDimension(records: OfferHistoryRecord[], keyFor: (record: OfferHistoryRecord) => string, labelFor?: (key: string) => string): OfferHistoryDimension[] {
  const groups = new Map<string, OfferHistoryRecord[]>();
  records.forEach((record) => {
    const key = keyFor(record) || 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return Array.from(groups.entries())
    .map(([key, rows]) => ({
      key,
      label: labelFor?.(key) ?? key,
      instances: rows.length,
      redeemed: rows.filter((row) => row.status === 'booked' || row.status === 'used').length,
      offeredValue: rows.reduce((sum, row) => sum + row.offeredValue, 0),
      capturedValue: rows.reduce((sum, row) => sum + row.capturedValue, 0),
    }))
    .sort((a, b) => b.instances - a.instances || a.label.localeCompare(b.label));
}

/**
 * Builds factual offer-instance history. Provider offer identity always wins.
 * A marketing-code fallback is allowed only when that code belongs to exactly
 * one offer instance; shared codes are never guessed or collapsed.
 */
export function buildOfferHistoryReport(offers: CasinoOffer[], bookedCruises: BookedCruise[], now = new Date()): OfferHistoryReport {
  const cruisesByInstance = new Map<string, BookedCruise[]>();
  const cruisesByCode = new Map<string, BookedCruise[]>();
  const cruisesById = new Map(bookedCruises.map((cruise) => [lower(cruise.id), cruise]));
  const offerCountByCode = new Map<string, number>();

  offers.forEach((offer) => {
    const code = lower(offer.offerCode);
    if (code) offerCountByCode.set(code, (offerCountByCode.get(code) ?? 0) + 1);
  });
  bookedCruises.forEach((cruise) => {
    const instance = instanceIdentity(cruise);
    const code = lower(cruise.offerCode);
    if (instance) cruisesByInstance.set(instance, [...(cruisesByInstance.get(instance) ?? []), cruise]);
    if (code) cruisesByCode.set(code, [...(cruisesByCode.get(code) ?? []), cruise]);
  });

  const records = offers.map((offer): OfferHistoryRecord => {
    const providerInstance = instanceIdentity(offer);
    const explicitIds = [offer.cruiseId, ...(offer.cruiseIds ?? [])].map(lower).filter(Boolean);
    let linkedCruises: BookedCruise[] = [];
    let attribution: OfferHistoryRecord['attribution'] = 'none';
    if (providerInstance && (cruisesByInstance.get(providerInstance)?.length ?? 0) > 0) {
      linkedCruises = cruisesByInstance.get(providerInstance) ?? [];
      attribution = 'provider-instance';
    } else if (explicitIds.length > 0) {
      linkedCruises = explicitIds.map((id) => cruisesById.get(id)).filter((cruise): cruise is BookedCruise => Boolean(cruise));
      if (linkedCruises.length > 0) attribution = 'explicit-cruise';
    } else {
      const code = lower(offer.offerCode);
      if (code && offerCountByCode.get(code) === 1 && (cruisesByCode.get(code)?.length ?? 0) > 0) {
        linkedCruises = cruisesByCode.get(code) ?? [];
        attribution = 'unique-code';
      }
    }
    linkedCruises = dedupeCruises(linkedCruises);
    const expiry = getExpiry(offer);
    return {
      instanceKey: getOfferInstanceKey(offer),
      offerId: offer.id,
      offerCode: text(offer.offerCode) || 'No marketing code',
      offerName: text(offer.offerName || offer.title) || 'Casino offer',
      brand: lower(offer.brand || offer.offerSource) || 'unknown',
      status: classifyStatus(offer, linkedCruises, now),
      receivedAt: text(offer.received || offer.createdAt || offer.sourceRetrievedAt) || undefined,
      expiresAt: expiry,
      linkedCruiseIds: linkedCruises.map((cruise) => cruise.id),
      offeredValue: getOfferValue(offer),
      capturedValue: linkedCruises.reduce((sum, cruise) => sum + getCapturedValue(cruise), 0),
      attribution,
    };
  });

  const redeemed = records.filter((record) => record.status === 'booked' || record.status === 'used').length;
  const offeredValue = records.reduce((sum, record) => sum + record.offeredValue, 0);
  const capturedValue = records.reduce((sum, record) => sum + record.capturedValue, 0);
  const uniqueMarketingCodes = new Set(records.map((record) => lower(record.offerCode)).filter((code) => code && code !== 'no marketing code')).size;
  return {
    records,
    totalInstances: records.length,
    uniqueMarketingCodes,
    active: records.filter((record) => record.status === 'active').length,
    redeemed,
    expired: records.filter((record) => record.status === 'expired').length,
    archivedOrSkipped: records.filter((record) => record.status === 'archived' || record.status === 'skipped').length,
    reviewNeeded: records.filter((record) => record.status === 'review').length,
    offeredValue,
    capturedValue,
    captureRate: offeredValue > 0 ? Math.round((capturedValue / offeredValue) * 100) : null,
    byBrand: buildDimension(records, (record) => record.brand, (key) => key === 'royal' ? 'Royal Caribbean' : key === 'celebrity' ? 'Celebrity' : key === 'carnival' ? 'Carnival' : key === 'silversea' ? 'Silversea' : 'Unknown brand'),
    byYear: buildDimension(records, (record) => (record.receivedAt || record.expiresAt || '').slice(0, 4) || 'unknown', (key) => key === 'unknown' ? 'Date unknown' : key),
  };
}
