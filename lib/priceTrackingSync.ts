import { trpcClient, isBackendAvailable } from '@/lib/trpc';
import type { PriceHistoryRecord, CasinoOffer, Cruise } from '@/types/models';
import { generateCruiseKey } from '@/types/models';

export interface PriceRecordInput {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  nights: number;
  destination: string;
  cabinType: string;
  price: number;
  taxesFees: number;
  totalPrice: number;
  freePlay?: number;
  obc?: number;
  offerCode?: string;
  offerName?: string;
  offerId?: string;
  source: 'offer' | 'cruise' | 'manual';
}

function extractCabinPrice(offer: CasinoOffer, cabinType: string): number {
  const type = cabinType.toLowerCase();
  if (type.includes('interior')) return offer.interiorPrice || 0;
  if (type.includes('ocean')) return offer.oceanviewPrice || 0;
  if (type.includes('junior') || type.includes('jr')) return offer.juniorSuitePrice || 0;
  if (type.includes('grand')) return offer.grandSuitePrice || 0;
  if (type.includes('suite')) return offer.suitePrice || 0;
  if (type.includes('balcony')) return offer.balconyPrice || 0;
  return offer.balconyPrice || offer.oceanviewPrice || offer.interiorPrice || offer.value || 0;
}

export function buildPriceRecordsFromOffers(offers: CasinoOffer[]): PriceRecordInput[] {
  const records: PriceRecordInput[] = [];
  const cabinTypes = ['Interior', 'Oceanview', 'Balcony', 'Suite'];

  for (const offer of offers) {
    if (!offer.shipName || !offer.sailingDate) continue;

    for (const cabinType of cabinTypes) {
      const price = extractCabinPrice(offer, cabinType);
      if (price <= 0) continue;

      const taxes = offer.taxesFees || offer.portCharges || 0;
      const cruiseKey = generateCruiseKey(offer.shipName, offer.sailingDate, cabinType);

      records.push({
        cruiseKey,
        shipName: offer.shipName,
        sailDate: offer.sailingDate,
        nights: offer.nights || 0,
        destination: offer.itineraryName || 'Unknown',
        cabinType,
        price,
        taxesFees: taxes,
        totalPrice: price + taxes,
        freePlay: offer.freePlay || offer.freeplayAmount,
        obc: offer.OBC || offer.obcAmount,
        offerCode: offer.offerCode,
        offerName: offer.offerName || offer.title,
        offerId: offer.id,
        source: 'offer',
      });
    }
  }

  console.log('[PriceTrackingSync] Built', records.length, 'price records from', offers.length, 'offers');
  return records;
}

export function buildPriceRecordsFromCruises(cruises: Cruise[]): PriceRecordInput[] {
  const records: PriceRecordInput[] = [];

  for (const cruise of cruises) {
    if (!cruise.shipName || !cruise.sailDate) continue;

    const cabinType = cruise.cabinType || 'Balcony';
    const price = cruise.price || cruise.totalPrice || 0;
    const taxes = cruise.taxes || 0;

    if (price <= 0 && taxes <= 0) continue;

    const cruiseKey = generateCruiseKey(cruise.shipName, cruise.sailDate, cabinType);

    records.push({
      cruiseKey,
      shipName: cruise.shipName,
      sailDate: cruise.sailDate,
      nights: cruise.nights || 0,
      destination: cruise.destination || cruise.itineraryName || 'Unknown',
      cabinType,
      price,
      taxesFees: taxes,
      totalPrice: price + taxes,
      freePlay: cruise.freePlay,
      obc: cruise.freeOBC,
      offerCode: cruise.offerCode,
      offerName: cruise.offerName,
      source: 'cruise',
    });
  }

  console.log('[PriceTrackingSync] Built', records.length, 'price records from', cruises.length, 'cruises');
  return records;
}

export async function syncPriceRecordsToBackend(
  email: string,
  records: PriceRecordInput[]
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  if (!isBackendAvailable()) {
    console.log('[PriceTrackingSync] Backend not available, skipping cloud sync');
    return { success: false, savedCount: 0, error: 'Backend not available' };
  }

  if (records.length === 0) {
    console.log('[PriceTrackingSync] No records to sync');
    return { success: true, savedCount: 0 };
  }

  try {
    const BATCH_SIZE = 50;
    let totalSaved = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const result = await trpcClient.priceTracking.savePriceRecords.mutate({
        email,
        records: batch,
      });
      totalSaved += result.savedCount;
      console.log('[PriceTrackingSync] Synced batch', Math.floor(i / BATCH_SIZE) + 1, '- saved:', result.savedCount);
    }

    console.log('[PriceTrackingSync] Cloud sync complete - total saved:', totalSaved);
    return { success: true, savedCount: totalSaved };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PriceTrackingSync] Cloud sync failed:', errorMsg);
    return { success: false, savedCount: 0, error: errorMsg };
  }
}

export async function loadPriceHistoryFromBackend(
  email: string,
  cruiseKey?: string
): Promise<PriceHistoryRecord[]> {
  if (!isBackendAvailable()) {
    console.log('[PriceTrackingSync] Backend not available, returning empty');
    return [];
  }

  try {
    const result = await trpcClient.priceTracking.getPriceHistory.query({
      email,
      cruiseKey,
    });
    console.log('[PriceTrackingSync] Loaded', result.records.length, 'records from backend');
    return result.records as PriceHistoryRecord[];
  } catch (error) {
    console.error('[PriceTrackingSync] Failed to load from backend:', error);
    return [];
  }
}
