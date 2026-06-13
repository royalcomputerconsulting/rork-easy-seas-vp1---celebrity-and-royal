import { useEffect, useRef, useCallback } from 'react';
import { useCoreData } from '@/state/CoreDataProvider';
import { usePriceHistory } from '@/state/PriceHistoryProvider';
import type { CasinoOffer } from '@/types/models';

export function usePriceTrackingSync() {
  const { casinoOffers, bookedCruises } = useCoreData();
  const { bulkRecordFromOffers, priceDropAlerts } = usePriceHistory();
  const lastProcessedRef = useRef<string>('');
  const isInitialMount = useRef(true);

  const processOffers = useCallback((offers: CasinoOffer[]) => {
    if (offers.length === 0) return;

    const watchedKeys = new Set((bookedCruises || []).map((c: any) => `${String(c.shipName || '').toLowerCase()}|${String(c.sailDate || c.sailingDate || '').slice(0, 10)}`));
    const trackableOffers = offers.length > 250
      ? offers.filter((o: any) => watchedKeys.has(`${String(o.shipName || '').toLowerCase()}|${String(o.sailingDate || o.sailDate || '').slice(0, 10)}`) || o.watched === true || o.booked === true)
      : offers;

    if (offers.length > 250 && trackableOffers.length === 0) {
      console.log('[usePriceTrackingSync] Large available-offer catalog detected; skipping startup price tracking until a row is booked/watched/opened');
      lastProcessedRef.current = `large-skip:${offers.length}`;
      return;
    }

    const offersHash = trackableOffers.map(o => `${o.id}:${o.balconyPrice || 0}`).join(',');
    
    if (offersHash === lastProcessedRef.current) {
      console.log('[usePriceTrackingSync] Offers unchanged, skipping');
      return;
    }

    console.log('[usePriceTrackingSync] Processing', trackableOffers.length, 'trackable offer(s) for price tracking from catalog size', offers.length);
    const drops = bulkRecordFromOffers(trackableOffers);
    
    if (drops.length > 0) {
      console.log('[usePriceTrackingSync] Detected', drops.length, 'price drops!');
      drops.forEach(drop => {
        console.log(`[usePriceTrackingSync] Price drop: ${drop.shipName} ${drop.cabinType} - $${drop.previousPrice} → $${drop.currentPrice} (${drop.priceDropPercent.toFixed(1)}% off)`);
      });
    }

    lastProcessedRef.current = offersHash;
  }, [bulkRecordFromOffers, bookedCruises]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      if (casinoOffers.length > 0) {
        const timer = setTimeout(() => {
          processOffers(casinoOffers);
        }, 2000);
        return () => clearTimeout(timer);
      }
    } else {
      if (casinoOffers.length > 0) {
        processOffers(casinoOffers);
      }
    }
  }, [casinoOffers, processOffers]);

  return {
    priceDropCount: priceDropAlerts.length,
    hasNewPriceDrops: priceDropAlerts.length > 0,
  };
}
