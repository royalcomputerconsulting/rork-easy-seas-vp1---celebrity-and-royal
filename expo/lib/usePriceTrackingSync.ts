import { useEffect, useRef, useCallback } from 'react';
import { runAfterUiSettles } from '@/lib/runAfterUiSettles';
import { useCoreData } from '@/state/CoreDataProvider';
import { usePriceHistory } from '@/state/PriceHistoryProvider';
import type { CasinoOffer } from '@/types/models';

export function usePriceTrackingSync() {
  const { casinoOffers } = useCoreData();
  const { bulkRecordFromOffers, priceDropAlerts } = usePriceHistory();
  const lastProcessedRef = useRef<string>('');

  const processOffers = useCallback((offers: CasinoOffer[]) => {
    if (offers.length === 0) return;

    const offersHash = offers.map(o => `${o.id}:${o.balconyPrice || 0}`).join(',');
    
    if (offersHash === lastProcessedRef.current) {
      console.log('[usePriceTrackingSync] Offers unchanged, skipping');
      return;
    }

    console.log('[usePriceTrackingSync] Processing', offers.length, 'offers for price tracking');
    const drops = bulkRecordFromOffers(offers);
    
    if (drops.length > 0) {
      console.log('[usePriceTrackingSync] Detected', drops.length, 'price drops!');
      drops.forEach(drop => {
        console.log(`[usePriceTrackingSync] Price drop: ${drop.shipName} ${drop.cabinType} - $${drop.previousPrice} → $${drop.currentPrice} (${drop.priceDropPercent.toFixed(1)}% off)`);
      });
    }

    lastProcessedRef.current = offersHash;
  }, [bulkRecordFromOffers]);

  useEffect(() => {
    if (casinoOffers.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interaction = runAfterUiSettles(() => {
      timer = setTimeout(() => processOffers(casinoOffers), 3000);
    });
    return () => {
      interaction.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [casinoOffers, processOffers]);

  return {
    priceDropCount: priceDropAlerts.length,
    hasNewPriceDrops: priceDropAlerts.length > 0,
  };
}
