import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { 
  PriceHistoryRecord, 
  PriceDropAlert,
  CasinoOffer,
  Cruise,
} from '@/types/models';
import { generateCruiseKey } from '@/types/models';

const PRICE_HISTORY_STORAGE_KEY = '@easy_seas_price_history';
const PRICE_DROP_ALERTS_STORAGE_KEY = '@easy_seas_price_drop_alerts';

interface PriceHistoryState {
  priceHistory: PriceHistoryRecord[];
  priceDropAlerts: PriceDropAlert[];
  isLoading: boolean;
  
  recordPrice: (record: Omit<PriceHistoryRecord, 'id' | 'recordedAt'>) => PriceDropAlert | null;
  recordPriceFromOffer: (offer: CasinoOffer, cabinType?: string) => PriceDropAlert | null;
  recordPriceFromCruise: (cruise: Cruise) => PriceDropAlert | null;
  bulkRecordFromOffers: (offers: CasinoOffer[]) => PriceDropAlert[];
  
  getPriceHistory: (cruiseKey: string) => PriceHistoryRecord[];
  getLowestPrice: (cruiseKey: string) => PriceHistoryRecord | null;
  getHighestPrice: (cruiseKey: string) => PriceHistoryRecord | null;
  getLatestPrice: (cruiseKey: string) => PriceHistoryRecord | null;
  getPriceDrops: () => PriceDropAlert[];
  getActivePriceDrops: () => PriceDropAlert[];
  
  dismissPriceDrop: (cruiseKey: string) => void;
  clearPriceHistory: () => Promise<void>;
}

function generateRecordId(): string {
  return `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractCabinPrice(offer: CasinoOffer, cabinType?: string): number {
  const type = (cabinType || offer.roomType || 'balcony').toLowerCase();
  
  if (type.includes('interior')) return offer.interiorPrice || 0;
  if (type.includes('ocean')) return offer.oceanviewPrice || 0;
  if (type.includes('junior') || type.includes('jr')) return offer.juniorSuitePrice || 0;
  if (type.includes('grand')) return offer.grandSuitePrice || 0;
  if (type.includes('suite')) return offer.suitePrice || 0;
  if (type.includes('balcony')) return offer.balconyPrice || 0;
  
  return offer.balconyPrice || offer.oceanviewPrice || offer.interiorPrice || offer.value || 0;
}

export const [PriceHistoryProvider, usePriceHistory] = createContextHook((): PriceHistoryState => {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [priceDropAlerts, setPriceDropAlerts] = useState<PriceDropAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadStoredData = async () => {
      try {
        const [storedHistory, storedAlerts] = await Promise.all([
          AsyncStorage.getItem(PRICE_HISTORY_STORAGE_KEY),
          AsyncStorage.getItem(PRICE_DROP_ALERTS_STORAGE_KEY),
        ]);

        if (cancelled) return;

        if (storedHistory) {
          const parsed = JSON.parse(storedHistory);
          setPriceHistory(parsed);
          console.log('[PriceHistoryProvider] Loaded price history:', parsed.length, 'records');
        }

        if (storedAlerts) {
          const parsed = JSON.parse(storedAlerts);
          setPriceDropAlerts(parsed);
          console.log('[PriceHistoryProvider] Loaded price drop alerts:', parsed.length);
        }
      } catch (error) {
        console.error('[PriceHistoryProvider] Error loading stored data:', error);
      } finally {
        if (!cancelled) {
          setHasLoadedFromStorage(true);
          setIsLoading(false);
        }
      }
    };

    loadStoredData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasLoadedFromStorage) return;
    if (priceHistory.length === 0) return;

    const saveHistory = async () => {
      try {
        await AsyncStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(priceHistory));
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price history:', error);
      }
    };

    saveHistory();
  }, [priceHistory, hasLoadedFromStorage]);

  useEffect(() => {
    if (!hasLoadedFromStorage) return;

    const saveAlerts = async () => {
      try {
        await AsyncStorage.setItem(PRICE_DROP_ALERTS_STORAGE_KEY, JSON.stringify(priceDropAlerts));
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price drop alerts:', error);
      }
    };

    saveAlerts();
  }, [priceDropAlerts, hasLoadedFromStorage]);

  const getPriceHistory = useCallback((cruiseKey: string): PriceHistoryRecord[] => {
    return priceHistory
      .filter(r => r.cruiseKey === cruiseKey)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [priceHistory]);

  const getLowestPrice = useCallback((cruiseKey: string): PriceHistoryRecord | null => {
    const history = priceHistory.filter(r => r.cruiseKey === cruiseKey);
    if (history.length === 0) return null;
    return history.reduce((lowest, current) => 
      current.totalPrice < lowest.totalPrice ? current : lowest
    );
  }, [priceHistory]);

  const getHighestPrice = useCallback((cruiseKey: string): PriceHistoryRecord | null => {
    const history = priceHistory.filter(r => r.cruiseKey === cruiseKey);
    if (history.length === 0) return null;
    return history.reduce((highest, current) => 
      current.totalPrice > highest.totalPrice ? current : highest
    );
  }, [priceHistory]);

  const getLatestPrice = useCallback((cruiseKey: string): PriceHistoryRecord | null => {
    const history = getPriceHistory(cruiseKey);
    return history.length > 0 ? history[0] : null;
  }, [getPriceHistory]);

  const recordPrice = useCallback((
    record: Omit<PriceHistoryRecord, 'id' | 'recordedAt'>
  ): PriceDropAlert | null => {
    const now = new Date().toISOString();
    const newRecord: PriceHistoryRecord = {
      ...record,
      id: generateRecordId(),
      recordedAt: now,
    };

    const existingHistory = priceHistory.filter(r => r.cruiseKey === record.cruiseKey);
    
    const recentDuplicate = existingHistory.find(existing => {
      const timeDiff = new Date(now).getTime() - new Date(existing.recordedAt).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff < 24 && Math.abs(existing.totalPrice - record.totalPrice) < 1;
    });

    if (recentDuplicate) {
      console.log('[PriceHistoryProvider] Skipping duplicate price record for', record.cruiseKey);
      return null;
    }

    setPriceHistory(prev => [...prev, newRecord]);
    console.log('[PriceHistoryProvider] Recorded price for', record.cruiseKey, ':', record.totalPrice);

    if (existingHistory.length > 0) {
      const previousRecord = existingHistory.reduce((latest, current) => 
        new Date(current.recordedAt) > new Date(latest.recordedAt) ? current : latest
      );

      if (record.totalPrice < previousRecord.totalPrice) {
        const priceDrop = previousRecord.totalPrice - record.totalPrice;
        const priceDropPercent = (priceDrop / previousRecord.totalPrice) * 100;

        const priceDropAlert: PriceDropAlert = {
          cruiseKey: record.cruiseKey,
          shipName: record.shipName,
          sailDate: record.sailDate,
          destination: record.destination,
          cabinType: record.cabinType,
          previousPrice: previousRecord.totalPrice,
          currentPrice: record.totalPrice,
          priceDrop,
          priceDropPercent,
          previousRecordedAt: previousRecord.recordedAt,
          currentRecordedAt: now,
          offerId: record.offerId,
          offerName: record.offerName,
        };

        setPriceDropAlerts(prev => {
          const filtered = prev.filter(a => a.cruiseKey !== record.cruiseKey);
          return [...filtered, priceDropAlert];
        });

        console.log('[PriceHistoryProvider] Price drop detected!', {
          cruise: record.cruiseKey,
          drop: priceDrop,
          percent: priceDropPercent.toFixed(1) + '%',
        });

        return priceDropAlert;
      }
    }

    return null;
  }, [priceHistory]);

  const recordPriceFromOffer = useCallback((
    offer: CasinoOffer,
    cabinType?: string
  ): PriceDropAlert | null => {
    if (!offer.shipName || !offer.sailingDate) {
      console.log('[PriceHistoryProvider] Missing ship name or sail date for offer:', offer.id);
      return null;
    }

    const effectiveCabinType = cabinType || offer.roomType || 'Balcony';
    const price = extractCabinPrice(offer, effectiveCabinType);
    const taxes = offer.taxesFees || offer.portCharges || 0;
    
    if (price <= 0 && taxes <= 0) {
      console.log('[PriceHistoryProvider] No price data for offer:', offer.id);
      return null;
    }

    const cruiseKey = generateCruiseKey(offer.shipName, offer.sailingDate, effectiveCabinType);

    return recordPrice({
      cruiseKey,
      shipName: offer.shipName,
      sailDate: offer.sailingDate,
      nights: offer.nights || 0,
      destination: offer.itineraryName || 'Unknown',
      cabinType: effectiveCabinType,
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
  }, [recordPrice]);

  const recordPriceFromCruise = useCallback((cruise: Cruise): PriceDropAlert | null => {
    if (!cruise.shipName || !cruise.sailDate) {
      console.log('[PriceHistoryProvider] Missing ship name or sail date for cruise:', cruise.id);
      return null;
    }

    const cabinType = cruise.cabinType || 'Balcony';
    const price = cruise.price || cruise.totalPrice || 0;
    const taxes = cruise.taxes || 0;
    
    if (price <= 0 && taxes <= 0) {
      console.log('[PriceHistoryProvider] No price data for cruise:', cruise.id);
      return null;
    }

    const cruiseKey = generateCruiseKey(cruise.shipName, cruise.sailDate, cabinType);

    return recordPrice({
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
  }, [recordPrice]);

  const bulkRecordFromOffers = useCallback((offers: CasinoOffer[]): PriceDropAlert[] => {
    const priceDrops: PriceDropAlert[] = [];
    
    const cabinTypes = ['Interior', 'Oceanview', 'Balcony', 'Suite'];
    
    offers.forEach(offer => {
      cabinTypes.forEach(cabinType => {
        const price = extractCabinPrice(offer, cabinType);
        if (price > 0) {
          const drop = recordPriceFromOffer(offer, cabinType);
          if (drop) {
            priceDrops.push(drop);
          }
        }
      });
    });

    console.log('[PriceHistoryProvider] Bulk recorded prices from', offers.length, 'offers, found', priceDrops.length, 'price drops');
    return priceDrops;
  }, [recordPriceFromOffer]);

  const getPriceDrops = useCallback((): PriceDropAlert[] => {
    return [...priceDropAlerts].sort((a, b) => b.priceDropPercent - a.priceDropPercent);
  }, [priceDropAlerts]);

  const getActivePriceDrops = useCallback((): PriceDropAlert[] => {
    const now = new Date();
    return priceDropAlerts.filter(alert => {
      const sailDate = new Date(alert.sailDate);
      return sailDate > now;
    }).sort((a, b) => b.priceDropPercent - a.priceDropPercent);
  }, [priceDropAlerts]);

  const dismissPriceDrop = useCallback((cruiseKey: string) => {
    setPriceDropAlerts(prev => prev.filter(a => a.cruiseKey !== cruiseKey));
    console.log('[PriceHistoryProvider] Dismissed price drop alert for:', cruiseKey);
  }, []);

  const clearPriceHistory = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(PRICE_HISTORY_STORAGE_KEY),
        AsyncStorage.removeItem(PRICE_DROP_ALERTS_STORAGE_KEY),
      ]);
      setPriceHistory([]);
      setPriceDropAlerts([]);
      console.log('[PriceHistoryProvider] Cleared all price history');
    } catch (error) {
      console.error('[PriceHistoryProvider] Error clearing price history:', error);
    }
  }, []);

  return {
    priceHistory,
    priceDropAlerts,
    isLoading,
    recordPrice,
    recordPriceFromOffer,
    recordPriceFromCruise,
    bulkRecordFromOffers,
    getPriceHistory,
    getLowestPrice,
    getHighestPrice,
    getLatestPrice,
    getPriceDrops,
    getActivePriceDrops,
    dismissPriceDrop,
    clearPriceHistory,
  };
});
