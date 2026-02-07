import { useEffect, useRef, useCallback } from 'react';
import { useCruiseStore } from '@/state/CruiseStore';
import { usePriceHistory } from '@/state/PriceHistoryProvider';
import type { CasinoOffer } from '@/types/models';

export function usePriceTrackingSync() {
  const { casinoOffers } = useCruiseStore();
  const { bulkRecordFromOffers, priceDropAlerts, isLoading } = usePriceHistory();
  const lastProcessedRef = useRef<string>('');
  const isProcessingRef = useRef(false);

  const processOffers = useCallback((offers: CasinoOffer[]) => {
    if (offers.length === 0) return;
    if (isProcessingRef.current) return;

    const offersHash = offers.length + ':' + offers.slice(0, 5).map(o => o.id).join(',');
    
    if (offersHash === lastProcessedRef.current) {
      return;
    }

    isProcessingRef.current = true;
    console.log('[usePriceTrackingSync] Processing', offers.length, 'offers for price tracking');
    
    try {
      const drops = bulkRecordFromOffers(offers);
      
      if (drops.length > 0) {
        console.log('[usePriceTrackingSync] Detected', drops.length, 'price drops');
      }

      lastProcessedRef.current = offersHash;
    } catch (error) {
      console.error('[usePriceTrackingSync] Error processing offers:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [bulkRecordFromOffers]);

  useEffect(() => {
    if (isLoading) return;
    if (casinoOffers.length === 0) return;

    const timer = setTimeout(() => {
      processOffers(casinoOffers);
    }, 5000);

    return () => clearTimeout(timer);
  }, [casinoOffers, processOffers, isLoading]);

  return {
    priceDropCount: priceDropAlerts.length,
    hasNewPriceDrops: priceDropAlerts.length > 0,
  };
}
