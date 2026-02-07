import { trpcClient, isBackendAvailable } from '@/lib/trpc';
import { generateCruiseKey } from '@/types/models';
import type { BookedCruise, CasinoOffer } from '@/types/models';

interface PriceSnapshot {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  nights: number;
  destination: string;
  cabinType: string;
  prices: {
    interior?: number;
    oceanview?: number;
    balcony?: number;
    suite?: number;
    juniorSuite?: number;
    grandSuite?: number;
  };
  taxesFees?: number;
  freePlay?: number;
  obc?: number;
  offerCode?: string;
  offerName?: string;
  offerId?: string;
  source: 'offer' | 'cruise' | 'manual' | 'sync';
}

function buildSnapshotFromCruise(cruise: BookedCruise): PriceSnapshot | null {
  if (!cruise.shipName || !cruise.sailDate) return null;

  const cabinType = cruise.cabinType || 'Balcony';
  const cruiseKey = generateCruiseKey(cruise.shipName, cruise.sailDate, cabinType);

  const prices: PriceSnapshot['prices'] = {};
  if (cruise.interiorPrice) prices.interior = cruise.interiorPrice;
  if (cruise.oceanviewPrice) prices.oceanview = cruise.oceanviewPrice;
  if (cruise.balconyPrice) prices.balcony = cruise.balconyPrice;
  if (cruise.suitePrice) prices.suite = cruise.suitePrice;
  if (cruise.juniorSuitePrice) prices.juniorSuite = cruise.juniorSuitePrice;
  if (cruise.grandSuitePrice) prices.grandSuite = cruise.grandSuitePrice;

  const mainPrice = cruise.price || cruise.totalPrice || 0;
  if (mainPrice > 0 && Object.keys(prices).length === 0) {
    const key = cabinType.toLowerCase();
    if (key.includes('interior')) prices.interior = mainPrice;
    else if (key.includes('ocean')) prices.oceanview = mainPrice;
    else if (key.includes('suite')) prices.suite = mainPrice;
    else prices.balcony = mainPrice;
  }

  if (Object.values(prices).every(v => !v || v === 0)) return null;

  return {
    cruiseKey,
    shipName: cruise.shipName,
    sailDate: cruise.sailDate,
    nights: cruise.nights || 0,
    destination: cruise.destination || cruise.itineraryName || 'Unknown',
    cabinType,
    prices,
    taxesFees: cruise.taxes || 0,
    freePlay: cruise.freePlay,
    obc: cruise.freeOBC,
    offerCode: cruise.offerCode,
    offerName: cruise.offerName,
    source: 'sync',
  };
}

function buildSnapshotFromOffer(offer: CasinoOffer): PriceSnapshot | null {
  if (!offer.shipName || !offer.sailingDate) return null;

  const cabinType = offer.roomType || 'Balcony';
  const cruiseKey = generateCruiseKey(offer.shipName, offer.sailingDate, cabinType);

  const prices: PriceSnapshot['prices'] = {};
  if (offer.interiorPrice) prices.interior = offer.interiorPrice;
  if (offer.oceanviewPrice) prices.oceanview = offer.oceanviewPrice;
  if (offer.balconyPrice) prices.balcony = offer.balconyPrice;
  if (offer.suitePrice) prices.suite = offer.suitePrice;
  if (offer.juniorSuitePrice) prices.juniorSuite = offer.juniorSuitePrice;
  if (offer.grandSuitePrice) prices.grandSuite = offer.grandSuitePrice;

  if (Object.values(prices).every(v => !v || v === 0)) return null;

  return {
    cruiseKey,
    shipName: offer.shipName,
    sailDate: offer.sailingDate,
    nights: offer.nights || 0,
    destination: offer.itineraryName || 'Unknown',
    cabinType,
    prices,
    taxesFees: offer.taxesFees || offer.portCharges || 0,
    freePlay: offer.freePlay || offer.freeplayAmount,
    obc: offer.OBC || offer.obcAmount,
    offerCode: offer.offerCode,
    offerName: offer.offerName || offer.title,
    offerId: offer.id,
    source: 'sync',
  };
}

export async function capturePriceSnapshotsOnSync(
  bookedCruises: BookedCruise[],
  offers: CasinoOffer[],
  userId: string
): Promise<{ created: number; updated: number; skipped: number }> {
  if (!isBackendAvailable()) {
    console.log('[PriceTrackingSync] Backend not available, skipping snapshot capture');
    return { created: 0, updated: 0, skipped: 0 };
  }

  const snapshots: PriceSnapshot[] = [];
  const seenKeys = new Set<string>();

  for (const cruise of bookedCruises) {
    const snapshot = buildSnapshotFromCruise(cruise);
    if (snapshot && !seenKeys.has(snapshot.cruiseKey)) {
      snapshots.push(snapshot);
      seenKeys.add(snapshot.cruiseKey);
    }
  }

  for (const offer of offers) {
    const snapshot = buildSnapshotFromOffer(offer);
    if (snapshot && !seenKeys.has(snapshot.cruiseKey)) {
      snapshots.push(snapshot);
      seenKeys.add(snapshot.cruiseKey);
    }
  }

  if (snapshots.length === 0) {
    console.log('[PriceTrackingSync] No snapshots to capture');
    return { created: 0, updated: 0, skipped: 0 };
  }

  console.log('[PriceTrackingSync] Sending', snapshots.length, 'snapshots to backend');

  try {
    const result = await trpcClient.priceTracking.bulkRecordSnapshots.mutate({
      userId,
      snapshots,
    });
    console.log('[PriceTrackingSync] Result:', result);
    return result;
  } catch (error) {
    console.error('[PriceTrackingSync] Failed:', error);
    return { created: 0, updated: 0, skipped: 0 };
  }
}
