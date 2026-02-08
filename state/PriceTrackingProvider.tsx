import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCoreData } from './CoreDataProvider';
import type { PriceHistoryRecord, PriceDropAlert, BookedCruise, CasinoOffer } from '@/types/models';
import { generateCruiseKey } from '@/types/models';

const STORAGE_KEY = 'easyseas_price_history';
const PRICE_DROPS_KEY = 'easyseas_price_drops';

interface PriceTrackingState {
  priceHistory: PriceHistoryRecord[];
  priceDrops: PriceDropAlert[];
  isLoading: boolean;
  
  recordPriceSnapshot: (cruise: BookedCruise | CasinoOffer, source: 'offer' | 'cruise') => Promise<void>;
  getPriceHistoryForCruise: (cruiseKey: string) => PriceHistoryRecord[];
  getPriceDropsForCruise: (cruiseKey: string) => PriceDropAlert[];
  getAllPriceDrops: () => PriceDropAlert[];
  clearPriceHistory: () => Promise<void>;
  dismissPriceDrop: (cruiseKey: string) => Promise<void>;
  
  getCruisePricingStatus: (cruise: BookedCruise) => {
    hasPrice: boolean;
    hasTaxes: boolean;
    hasPerks: boolean;
    completeness: number;
    missingFields: string[];
  };
}

export const [PriceTrackingProvider, usePriceTracking] = createContextHook((): PriceTrackingState => {
  const { bookedCruises, casinoOffers } = useCoreData();
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [priceDrops, setPriceDrops] = useState<PriceDropAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPriceData = useCallback(async () => {
    try {
      console.log('[PriceTracking] Loading price history...');
      const [historyData, dropsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(PRICE_DROPS_KEY),
      ]);

      if (historyData) {
        const parsed = JSON.parse(historyData);
        setPriceHistory(parsed);
        console.log('[PriceTracking] Loaded', parsed.length, 'price records');
      }

      if (dropsData) {
        const parsed = JSON.parse(dropsData);
        setPriceDrops(parsed);
        console.log('[PriceTracking] Loaded', parsed.length, 'price drops');
      }
    } catch (error) {
      console.error('[PriceTracking] Failed to load price data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriceData();
  }, [loadPriceData]);

  const savePriceHistory = useCallback(async (history: PriceHistoryRecord[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      console.log('[PriceTracking] Saved', history.length, 'price records');
    } catch (error) {
      console.error('[PriceTracking] Failed to save price history:', error);
    }
  }, []);

  const savePriceDrops = useCallback(async (drops: PriceDropAlert[]) => {
    try {
      await AsyncStorage.setItem(PRICE_DROPS_KEY, JSON.stringify(drops));
      console.log('[PriceTracking] Saved', drops.length, 'price drops');
    } catch (error) {
      console.error('[PriceTracking] Failed to save price drops:', error);
    }
  }, []);

  const detectPriceDrop = useCallback((
    cruiseKey: string,
    newRecord: PriceHistoryRecord,
    existingRecords: PriceHistoryRecord[]
  ): PriceDropAlert | null => {
    const relevantRecords = existingRecords
      .filter(r => r.cruiseKey === cruiseKey && r.cabinType === newRecord.cabinType)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    if (relevantRecords.length === 0) return null;

    const previousRecord = relevantRecords[0];
    const priceDrop = previousRecord.totalPrice - newRecord.totalPrice;

    if (priceDrop > 0) {
      const priceDropPercent = (priceDrop / previousRecord.totalPrice) * 100;

      return {
        cruiseKey,
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
  }, []);

  const recordPriceSnapshot = useCallback(async (
    item: BookedCruise | CasinoOffer,
    source: 'offer' | 'cruise'
  ) => {
    try {
      const isCruise = 'reservationNumber' in item;
      const isOffer = 'offerType' in item;
      const shipName = item.shipName || 'Unknown Ship';
      const sailDate = isCruise ? item.sailDate : (isOffer && 'sailingDate' in item ? item.sailingDate : '') || '';
      const nights = item.nights || 0;
      const destination = (isCruise && 'destination' in item ? item.destination : undefined) || item.itineraryName || 'Unknown';
      
      const cabinType = (isOffer && 'roomType' in item ? item.roomType : undefined) || (isCruise && 'cabinType' in item ? item.cabinType : undefined) || 'Unknown';
      
      const price = item.balconyPrice || item.oceanviewPrice || item.interiorPrice || 
                   item.suitePrice || (isCruise && 'price' in item ? item.price : 0) || 0;
      const taxesFees = (isCruise && 'taxes' in item ? item.taxes : undefined) || (isOffer && 'taxesFees' in item ? item.taxesFees : undefined) || 0;
      const totalPrice = (isCruise && 'totalPrice' in item ? item.totalPrice : undefined) || (price + taxesFees);

      if (!sailDate || totalPrice === 0) {
        console.log('[PriceTracking] Skipping snapshot - missing sail date or price:', shipName);
        return;
      }

      const cruiseKey = generateCruiseKey(shipName, sailDate, cabinType);

      const newRecord: PriceHistoryRecord = {
        id: `${cruiseKey}_${Date.now()}`,
        cruiseKey,
        shipName,
        sailDate,
        nights,
        destination,
        cabinType,
        price,
        taxesFees,
        totalPrice,
        freePlay: item.freePlay || (isOffer && 'freeplayAmount' in item ? item.freeplayAmount : undefined),
        obc: (isCruise && 'freeOBC' in item ? item.freeOBC : undefined) || (isOffer && 'OBC' in item ? item.OBC : undefined) || (isOffer && 'obcAmount' in item ? item.obcAmount : undefined),
        offerCode: item.offerCode,
        offerName: item.offerName,
        offerId: 'id' in item ? item.id : undefined,
        recordedAt: new Date().toISOString(),
        source,
      };

      setPriceHistory(prev => {
        const updated = [...prev, newRecord];
        savePriceHistory(updated);
        
        const drop = detectPriceDrop(cruiseKey, newRecord, prev);
        if (drop) {
          console.log('[PriceTracking] 🎉 Price drop detected:', drop.priceDrop, 'savings on', drop.shipName);
          setPriceDrops(prevDrops => {
            const updatedDrops = [...prevDrops, drop];
            savePriceDrops(updatedDrops);
            return updatedDrops;
          });
        }
        
        return updated;
      });

      console.log('[PriceTracking] Recorded price snapshot for:', shipName, sailDate, totalPrice);
    } catch (error) {
      console.error('[PriceTracking] Failed to record price snapshot:', error);
    }
  }, [savePriceHistory, savePriceDrops, detectPriceDrop]);

  const getPriceHistoryForCruise = useCallback((cruiseKey: string): PriceHistoryRecord[] => {
    return priceHistory
      .filter(record => record.cruiseKey === cruiseKey)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }, [priceHistory]);

  const getPriceDropsForCruise = useCallback((cruiseKey: string): PriceDropAlert[] => {
    return priceDrops.filter(drop => drop.cruiseKey === cruiseKey);
  }, [priceDrops]);

  const getAllPriceDrops = useCallback((): PriceDropAlert[] => {
    return priceDrops.sort((a, b) => 
      new Date(b.currentRecordedAt).getTime() - new Date(a.currentRecordedAt).getTime()
    );
  }, [priceDrops]);

  const clearPriceHistory = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY),
        AsyncStorage.removeItem(PRICE_DROPS_KEY),
      ]);
      setPriceHistory([]);
      setPriceDrops([]);
      console.log('[PriceTracking] Cleared all price history');
    } catch (error) {
      console.error('[PriceTracking] Failed to clear price history:', error);
    }
  }, []);

  const dismissPriceDrop = useCallback(async (cruiseKey: string) => {
    setPriceDrops(prev => {
      const updated = prev.filter(drop => drop.cruiseKey !== cruiseKey);
      savePriceDrops(updated);
      return updated;
    });
  }, [savePriceDrops]);

  const getCruisePricingStatus = useCallback((cruise: BookedCruise) => {
    const missingFields: string[] = [];
    let score = 0;
    const totalFields = 6;

    if (cruise.price || cruise.balconyPrice || cruise.oceanviewPrice || cruise.interiorPrice || cruise.suitePrice) {
      score++;
    } else {
      missingFields.push('Base Price');
    }

    if (cruise.taxes !== undefined && cruise.taxes > 0) {
      score++;
    } else {
      missingFields.push('Taxes & Fees');
    }

    if (cruise.freePlay !== undefined && cruise.freePlay >= 0) {
      score++;
    } else {
      missingFields.push('Free Play');
    }

    if (cruise.freeOBC !== undefined && cruise.freeOBC >= 0) {
      score++;
    } else {
      missingFields.push('Onboard Credit');
    }

    if (cruise.tradeInValue !== undefined && cruise.tradeInValue >= 0) {
      score++;
    } else {
      missingFields.push('Trade-In Value');
    }

    if (cruise.cabinType) {
      score++;
    } else {
      missingFields.push('Cabin Type');
    }

    const completeness = Math.round((score / totalFields) * 100);

    return {
      hasPrice: score >= 1,
      hasTaxes: cruise.taxes !== undefined && cruise.taxes > 0,
      hasPerks: (cruise.freePlay || 0) > 0 || (cruise.freeOBC || 0) > 0 || (cruise.tradeInValue || 0) > 0,
      completeness,
      missingFields,
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const autoTrack = async () => {
      console.log('[PriceTracking] Auto-tracking prices for', bookedCruises.length, 'cruises and', casinoOffers.length, 'offers');
      
      for (const cruise of bookedCruises) {
        const cruiseKey = generateCruiseKey(
          cruise.shipName,
          cruise.sailDate,
          cruise.cabinType || 'unknown'
        );
        
        const existing = priceHistory.filter(r => r.cruiseKey === cruiseKey);
        
        if (existing.length === 0 || 
            (existing.length > 0 && 
             Date.now() - new Date(existing[existing.length - 1].recordedAt).getTime() > 24 * 60 * 60 * 1000)) {
          console.log('[PriceTracking] Taking initial snapshot for:', cruise.shipName);
          await recordPriceSnapshot(cruise, 'cruise');
        }
      }
    };

    autoTrack();
  }, [bookedCruises.length, casinoOffers.length, isLoading, priceHistory, recordPriceSnapshot]);

  return {
    priceHistory,
    priceDrops,
    isLoading,
    recordPriceSnapshot,
    getPriceHistoryForCruise,
    getPriceDropsForCruise,
    getAllPriceDrops,
    clearPriceHistory,
    dismissPriceDrop,
    getCruisePricingStatus,
  };
});
