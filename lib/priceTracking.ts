import type { CasinoOffer, Cruise, PriceHistoryRecord, PriceDropAlert } from '@/types/models';
import { generateCruiseKey } from '@/types/models';

export interface PriceTrackingResult {
  recordsAdded: number;
  priceDrops: PriceDropAlert[];
  skipped: number;
}

function generateRecordId(): string {
  return `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

export function createPriceRecordFromOffer(
  offer: CasinoOffer,
  cabinType: string
): PriceHistoryRecord | null {
  if (!offer.shipName || !offer.sailingDate) {
    return null;
  }

  const price = extractCabinPrice(offer, cabinType);
  const taxes = offer.taxesFees || offer.portCharges || 0;
  
  if (price <= 0 && taxes <= 0) {
    return null;
  }

  const cruiseKey = generateCruiseKey(offer.shipName, offer.sailingDate, cabinType);

  return {
    id: generateRecordId(),
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
    recordedAt: new Date().toISOString(),
    source: 'offer',
  };
}

export function createPriceRecordFromCruise(cruise: Cruise): PriceHistoryRecord | null {
  if (!cruise.shipName || !cruise.sailDate) {
    return null;
  }

  const cabinType = cruise.cabinType || 'Balcony';
  const price = cruise.price || cruise.totalPrice || 0;
  const taxes = cruise.taxes || 0;
  
  if (price <= 0 && taxes <= 0) {
    return null;
  }

  const cruiseKey = generateCruiseKey(cruise.shipName, cruise.sailDate, cabinType);

  return {
    id: generateRecordId(),
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
    recordedAt: new Date().toISOString(),
    source: 'cruise',
  };
}

export function detectPriceDrop(
  newRecord: PriceHistoryRecord,
  existingHistory: PriceHistoryRecord[]
): PriceDropAlert | null {
  const relevantHistory = existingHistory
    .filter(r => r.cruiseKey === newRecord.cruiseKey)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  if (relevantHistory.length === 0) {
    return null;
  }

  const previousRecord = relevantHistory[0];

  if (newRecord.totalPrice < previousRecord.totalPrice) {
    const priceDrop = previousRecord.totalPrice - newRecord.totalPrice;
    const priceDropPercent = (priceDrop / previousRecord.totalPrice) * 100;

    return {
      cruiseKey: newRecord.cruiseKey,
      shipName: newRecord.shipName,
      sailDate: newRecord.sailDate,
      destination: newRecord.destination,
      cabinType: newRecord.cabinType,
      previousPrice: previousRecord.totalPrice,
      currentPrice: newRecord.totalPrice,
      priceDrop,
      priceDropPercent,
      previousRecordedAt: previousRecord.recordedAt,
      currentRecordedAt: newRecord.recordedAt,
      offerId: newRecord.offerId,
      offerName: newRecord.offerName,
    };
  }

  return null;
}

export function processOffersForPriceTracking(
  offers: CasinoOffer[],
  existingHistory: PriceHistoryRecord[]
): { newRecords: PriceHistoryRecord[]; priceDrops: PriceDropAlert[] } {
  const newRecords: PriceHistoryRecord[] = [];
  const priceDrops: PriceDropAlert[] = [];
  const now = new Date();
  const cabinTypes = ['Interior', 'Oceanview', 'Balcony', 'Suite'];

  offers.forEach(offer => {
    cabinTypes.forEach(cabinType => {
      const record = createPriceRecordFromOffer(offer, cabinType);
      if (!record) return;

      const cruiseKey = record.cruiseKey;
      const history = existingHistory.filter(r => r.cruiseKey === cruiseKey);

      const recentDuplicate = history.find(existing => {
        const timeDiff = now.getTime() - new Date(existing.recordedAt).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        return hoursDiff < 24 && Math.abs(existing.totalPrice - record.totalPrice) < 1;
      });

      if (recentDuplicate) {
        return;
      }

      newRecords.push(record);

      const drop = detectPriceDrop(record, existingHistory);
      if (drop) {
        priceDrops.push(drop);
      }
    });
  });

  console.log('[PriceTracking] Processed offers:', {
    offersCount: offers.length,
    newRecords: newRecords.length,
    priceDrops: priceDrops.length,
  });

  return { newRecords, priceDrops };
}

export function formatPriceDrop(drop: PriceDropAlert): string {
  const sailDate = new Date(drop.sailDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  return `${drop.cabinType} on ${drop.shipName} (${sailDate}): $${drop.previousPrice.toFixed(0)} → $${drop.currentPrice.toFixed(0)} (Save $${drop.priceDrop.toFixed(0)}, ${drop.priceDropPercent.toFixed(1)}% off)`;
}

export function getPriceDropSeverity(priceDropPercent: number): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  if (priceDropPercent >= 25) return 'critical';
  if (priceDropPercent >= 15) return 'high';
  if (priceDropPercent >= 10) return 'medium';
  if (priceDropPercent >= 5) return 'low';
  return 'info';
}

export function sortPriceDropsByValue(drops: PriceDropAlert[]): PriceDropAlert[] {
  return [...drops].sort((a, b) => b.priceDrop - a.priceDrop);
}

export function sortPriceDropsByPercent(drops: PriceDropAlert[]): PriceDropAlert[] {
  return [...drops].sort((a, b) => b.priceDropPercent - a.priceDropPercent);
}

export function filterActivePriceDrops(drops: PriceDropAlert[]): PriceDropAlert[] {
  const now = new Date();
  return drops.filter(drop => {
    const sailDate = new Date(drop.sailDate);
    return sailDate > now;
  });
}
