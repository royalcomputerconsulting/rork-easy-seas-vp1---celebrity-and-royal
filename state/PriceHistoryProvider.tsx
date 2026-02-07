import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { trpcClient, isBackendAvailable } from '@/lib/trpc';
import type { 
  PriceHistoryRecord, 
  PriceDropAlert,
  CasinoOffer,
  Cruise,
  BookedCruise,
} from '@/types/models';
import { generateCruiseKey } from '@/types/models';

const PRICE_HISTORY_STORAGE_KEY = '@easy_seas_price_history';
const PRICE_DROP_ALERTS_STORAGE_KEY = '@easy_seas_price_drop_alerts';
const LAST_BACKEND_SYNC_KEY = '@easy_seas_price_last_backend_sync';

export interface PriceSnapshot {
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

interface BackendPriceDrop {
  cruiseKey: string;
  shipName: string;
  sailDate: string;
  cabinType: string;
  firstPrice: number;
  latestPrice: number;
  dropAmount: number;
  dropPercent: number;
  firstDate: string;
  latestDate: string;
  snapshotCount: number;
}

interface PriceHistoryState {
  priceHistory: PriceHistoryRecord[];
  priceDropAlerts: PriceDropAlert[];
  isLoading: boolean;
  isSyncingToBackend: boolean;
  
  recordPrice: (record: Omit<PriceHistoryRecord, 'id' | 'recordedAt'>) => PriceDropAlert | null;
  recordPriceFromOffer: (offer: CasinoOffer, cabinType?: string) => PriceDropAlert | null;
  recordPriceFromCruise: (cruise: Cruise) => PriceDropAlert | null;
  bulkRecordFromOffers: (offers: CasinoOffer[]) => PriceDropAlert[];
  
  captureSnapshotForBookedCruise: (cruise: BookedCruise, userId: string) => Promise<void>;
  bulkCaptureSnapshots: (cruises: BookedCruise[], offers: CasinoOffer[], userId: string) => Promise<{ created: number; updated: number; skipped: number }>;
  fetchBackendHistory: (userId: string, cruiseKey?: string) => Promise<any[]>;
  fetchBackendPriceDrops: (userId: string) => Promise<BackendPriceDrop[]>;
  syncLocalToBackend: (userId: string) => Promise<void>;
  
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
    source: 'cruise',
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
    source: 'offer',
  };
}

export const [PriceHistoryProvider, usePriceHistory] = createContextHook((): PriceHistoryState => {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [priceDropAlerts, setPriceDropAlerts] = useState<PriceDropAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingToBackend, setIsSyncingToBackend] = useState(false);
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [storedHistory, storedAlerts] = await Promise.all([
          AsyncStorage.getItem(PRICE_HISTORY_STORAGE_KEY),
          AsyncStorage.getItem(PRICE_DROP_ALERTS_STORAGE_KEY),
        ]);

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
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  useEffect(() => {
    const saveHistory = async () => {
      try {
        await AsyncStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(priceHistory));
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price history:', error);
      }
    };

    if (priceHistory.length > 0) {
      saveHistory();
    }
  }, [priceHistory]);

  useEffect(() => {
    const saveAlerts = async () => {
      try {
        await AsyncStorage.setItem(PRICE_DROP_ALERTS_STORAGE_KEY, JSON.stringify(priceDropAlerts));
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price drop alerts:', error);
      }
    };

    saveAlerts();
  }, [priceDropAlerts]);

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

  const captureSnapshotForBookedCruise = useCallback(async (cruise: BookedCruise, userId: string) => {
    if (!isBackendAvailable()) {
      console.log('[PriceHistoryProvider] Backend not available, skipping snapshot capture');
      return;
    }

    const snapshot = buildSnapshotFromCruise(cruise);
    if (!snapshot) {
      console.log('[PriceHistoryProvider] No price data to snapshot for cruise:', cruise.id);
      return;
    }

    try {
      const result = await trpcClient.priceTracking.recordSnapshot.mutate({
        userId,
        snapshot,
      });
      console.log('[PriceHistoryProvider] Backend snapshot', result.action, 'for', snapshot.cruiseKey);
    } catch (error) {
      console.error('[PriceHistoryProvider] Failed to capture backend snapshot:', error);
    }
  }, []);

  const bulkCaptureSnapshots = useCallback(async (
    cruises: BookedCruise[],
    offers: CasinoOffer[],
    userId: string
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    if (!isBackendAvailable()) {
      console.log('[PriceHistoryProvider] Backend not available for bulk capture');
      return { created: 0, updated: 0, skipped: 0 };
    }

    if (syncInProgressRef.current) {
      console.log('[PriceHistoryProvider] Sync already in progress, skipping');
      return { created: 0, updated: 0, skipped: 0 };
    }

    syncInProgressRef.current = true;
    setIsSyncingToBackend(true);

    try {
      const snapshots: PriceSnapshot[] = [];

      for (const cruise of cruises) {
        const snapshot = buildSnapshotFromCruise(cruise);
        if (snapshot) snapshots.push(snapshot);
      }

      for (const offer of offers) {
        const snapshot = buildSnapshotFromOffer(offer);
        if (snapshot) {
          const exists = snapshots.find(s => s.cruiseKey === snapshot.cruiseKey);
          if (!exists) {
            snapshots.push(snapshot);
          }
        }
      }

      if (snapshots.length === 0) {
        console.log('[PriceHistoryProvider] No snapshots to capture');
        return { created: 0, updated: 0, skipped: 0 };
      }

      console.log('[PriceHistoryProvider] Sending', snapshots.length, 'snapshots to backend');

      const result = await trpcClient.priceTracking.bulkRecordSnapshots.mutate({
        userId,
        snapshots,
      });

      console.log('[PriceHistoryProvider] Bulk capture result:', result);
      await AsyncStorage.setItem(LAST_BACKEND_SYNC_KEY, new Date().toISOString());

      return result;
    } catch (error) {
      console.error('[PriceHistoryProvider] Bulk capture failed:', error);
      return { created: 0, updated: 0, skipped: 0 };
    } finally {
      syncInProgressRef.current = false;
      setIsSyncingToBackend(false);
    }
  }, []);

  const fetchBackendHistory = useCallback(async (userId: string, cruiseKey?: string): Promise<any[]> => {
    if (!isBackendAvailable()) return [];

    try {
      if (cruiseKey) {
        return await trpcClient.priceTracking.getHistory.query({ userId, cruiseKey });
      } else {
        return await trpcClient.priceTracking.getHistoryForAllCruises.query({ userId });
      }
    } catch (error) {
      console.error('[PriceHistoryProvider] Failed to fetch backend history:', error);
      return [];
    }
  }, []);

  const fetchBackendPriceDrops = useCallback(async (userId: string): Promise<BackendPriceDrop[]> => {
    if (!isBackendAvailable()) return [];

    try {
      return await trpcClient.priceTracking.getPriceDrops.query({ userId, minDropPercent: 1 });
    } catch (error) {
      console.error('[PriceHistoryProvider] Failed to fetch backend price drops:', error);
      return [];
    }
  }, []);

  const syncLocalToBackend = useCallback(async (userId: string) => {
    if (!isBackendAvailable() || priceHistory.length === 0) return;

    const lastSync = await AsyncStorage.getItem(LAST_BACKEND_SYNC_KEY);
    if (lastSync) {
      const lastSyncDate = new Date(lastSync);
      const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync < 1) {
        console.log('[PriceHistoryProvider] Skipping sync, last synced', hoursSinceSync.toFixed(1), 'hours ago');
        return;
      }
    }

    console.log('[PriceHistoryProvider] Syncing', priceHistory.length, 'local records to backend');

    const snapshotMap = new Map<string, PriceSnapshot>();
    for (const record of priceHistory) {
      const key = record.cruiseKey;
      if (!snapshotMap.has(key) || new Date(record.recordedAt) > new Date(snapshotMap.get(key)!.sailDate)) {
        snapshotMap.set(key, {
          cruiseKey: record.cruiseKey,
          shipName: record.shipName,
          sailDate: record.sailDate,
          nights: record.nights,
          destination: record.destination,
          cabinType: record.cabinType,
          prices: {
            [record.cabinType.toLowerCase().includes('interior') ? 'interior' :
             record.cabinType.toLowerCase().includes('ocean') ? 'oceanview' :
             record.cabinType.toLowerCase().includes('suite') ? 'suite' : 'balcony']: record.price,
          },
          taxesFees: record.taxesFees,
          freePlay: record.freePlay,
          obc: record.obc,
          offerCode: record.offerCode,
          offerName: record.offerName,
          offerId: record.offerId,
          source: record.source,
        });
      }
    }

    try {
      const snapshots = Array.from(snapshotMap.values());
      await trpcClient.priceTracking.bulkRecordSnapshots.mutate({ userId, snapshots });
      await AsyncStorage.setItem(LAST_BACKEND_SYNC_KEY, new Date().toISOString());
      console.log('[PriceHistoryProvider] Synced', snapshots.length, 'snapshots to backend');
    } catch (error) {
      console.error('[PriceHistoryProvider] Sync to backend failed:', error);
    }
  }, [priceHistory]);

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
        AsyncStorage.removeItem(LAST_BACKEND_SYNC_KEY),
      ]);
      setPriceHistory([]);
      setPriceDropAlerts([]);
      console.log('[PriceHistoryProvider] Cleared all price history');
    } catch (error) {
      console.error('[PriceHistoryProvider] Error clearing price history:', error);
    }
  }, []);

  const uniqueCruiseKeys = useMemo(() => {
    return [...new Set(priceHistory.map(r => r.cruiseKey))];
  }, [priceHistory]);

  console.log('[PriceHistoryProvider] Tracking', uniqueCruiseKeys.length, 'unique cruises with', priceHistory.length, 'price records');

  return {
    priceHistory,
    priceDropAlerts,
    isLoading,
    isSyncingToBackend,
    recordPrice,
    recordPriceFromOffer,
    recordPriceFromCruise,
    bulkRecordFromOffers,
    captureSnapshotForBookedCruise,
    bulkCaptureSnapshots,
    fetchBackendHistory,
    fetchBackendPriceDrops,
    syncLocalToBackend,
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
