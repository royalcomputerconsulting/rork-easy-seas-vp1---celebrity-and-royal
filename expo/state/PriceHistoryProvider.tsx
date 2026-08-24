import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { quotaSafeGetJsonItem, quotaSafeRemoveItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from './AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import type { 
  PriceHistoryRecord, 
  PriceDropAlert,
  CasinoOffer,
  Cruise,
  BookedCruise,
} from '@/types/models';
import { generateCruiseKey } from '@/types/models';
import { getCabinTier, getHigherCabinTypes } from '@/lib/upgradeMonitor';
import { getDaysBetween, isDateInFuture } from '@/lib/date';

const BASE_PRICE_HISTORY_STORAGE_KEY = '@easy_seas_price_history';
const BASE_PRICE_DROP_ALERTS_STORAGE_KEY = '@easy_seas_price_drop_alerts';
const BASE_UPGRADE_PRICES_STORAGE_KEY = '@easy_seas_upgrade_prices';

function getScopedPriceHistoryKeys(email: string | null) {
  return {
    PRICE_HISTORY: getUserScopedKey(BASE_PRICE_HISTORY_STORAGE_KEY, email),
    PRICE_DROP_ALERTS: getUserScopedKey(BASE_PRICE_DROP_ALERTS_STORAGE_KEY, email),
    UPGRADE_PRICES: getUserScopedKey(BASE_UPGRADE_PRICES_STORAGE_KEY, email),
  } as const;
}

interface PriceHistoryState {
  priceHistory: PriceHistoryRecord[];
  priceDropAlerts: PriceDropAlert[];
  upgradePrices: Map<string, number>;
  isLoading: boolean;
  
  recordPrice: (record: Omit<PriceHistoryRecord, 'id' | 'recordedAt'>) => PriceDropAlert | null;
  recordPriceFromOffer: (offer: CasinoOffer, cabinType?: string) => PriceDropAlert | null;
  recordPriceFromCruise: (cruise: Cruise) => PriceDropAlert | null;
  bulkRecordFromOffers: (offers: CasinoOffer[]) => PriceDropAlert[];
  trackUpgradePricesForBooked: (bookedCruises: BookedCruise[], offers: CasinoOffer[]) => void;
  
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

function extractUpgradeCabinPrice(offer: CasinoOffer, tierLabel: string): number {
  const label = tierLabel.toLowerCase();
  if (label.includes('interior')) return offer.interiorPrice || 0;
  if (label.includes('oceanview') || label.includes('ocean view')) return offer.oceanviewPrice || 0;
  if (label.includes('balcony')) return offer.balconyPrice || 0;
  if (label.includes('junior suite') || label.includes('jr suite')) return offer.juniorSuitePrice || 0;
  if (label.includes('grand suite')) return offer.grandSuitePrice || 0;
  if (label.includes('suite')) return offer.suitePrice || 0;
  return 0;
}

export const [PriceHistoryProvider, usePriceHistory] = createContextHook((): PriceHistoryState => {
  const { authenticatedEmail } = useAuth();
  const storageKeysRef = useRef(getScopedPriceHistoryKeys(authenticatedEmail));
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRecord[]>([]);
  const [priceDropAlerts, setPriceDropAlerts] = useState<PriceDropAlert[]>([]);
  const [upgradePrices, setUpgradePrices] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const storageReadyRef = useRef(false);
  const loadedHistorySnapshotRef = useRef<PriceHistoryRecord[] | null>(null);
  const loadedAlertsSnapshotRef = useRef<PriceDropAlert[] | null>(null);

  useEffect(() => {
    storageKeysRef.current = getScopedPriceHistoryKeys(authenticatedEmail);
    console.log('[PriceHistoryProvider] Scoped storage keys updated for:', authenticatedEmail);
  }, [authenticatedEmail]);

  const loadStoredData = useCallback(async () => {
    try {
      setIsLoading(true);
      const scopedKeys = getScopedPriceHistoryKeys(authenticatedEmail);
      storageKeysRef.current = scopedKeys;
      const [parsedHistory, parsedAlerts, parsedUpgradePrices] = await Promise.all([
        quotaSafeGetJsonItem<PriceHistoryRecord[]>(scopedKeys.PRICE_HISTORY, [], Array.isArray),
        quotaSafeGetJsonItem<PriceDropAlert[]>(scopedKeys.PRICE_DROP_ALERTS, [], Array.isArray),
        quotaSafeGetJsonItem<Record<string, number>>(scopedKeys.UPGRADE_PRICES, {}, (value): value is Record<string, number> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)),
      ]);

      loadedHistorySnapshotRef.current = parsedHistory;
      setPriceHistory(parsedHistory);
      console.log('[PriceHistoryProvider] Loaded scoped price history:', { email: authenticatedEmail, count: parsedHistory.length });

      loadedAlertsSnapshotRef.current = parsedAlerts;
      setPriceDropAlerts(parsedAlerts);
      console.log('[PriceHistoryProvider] Loaded scoped price drop alerts:', { email: authenticatedEmail, count: parsedAlerts.length });

      const map = new Map<string, number>(Object.entries(parsedUpgradePrices));
      setUpgradePrices(map);
      console.log('[PriceHistoryProvider] Loaded scoped upgrade prices:', { email: authenticatedEmail, count: map.size });
    } catch (error) {
      console.error('[PriceHistoryProvider] Error loading scoped stored data:', error);
      const emptyHistory: PriceHistoryRecord[] = [];
      const emptyAlerts: PriceDropAlert[] = [];
      loadedHistorySnapshotRef.current = emptyHistory;
      loadedAlertsSnapshotRef.current = emptyAlerts;
      setPriceHistory(emptyHistory);
      setPriceDropAlerts(emptyAlerts);
      setUpgradePrices(new Map());
    } finally {
      storageReadyRef.current = true;
      setIsLoading(false);
    }
  }, [authenticatedEmail]);

  useEffect(() => {
    storageReadyRef.current = false;
    setPriceHistory([]);
    setPriceDropAlerts([]);
    setUpgradePrices(new Map());
    void loadStoredData();
  }, [authenticatedEmail, loadStoredData]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[PriceHistoryProvider] Data cleared event detected, resetting scoped price history');
      setPriceHistory([]);
      setPriceDropAlerts([]);
      setUpgradePrices(new Map());
      setIsLoading(false);
    };

    const handleCloudRestore = () => {
      console.log('[PriceHistoryProvider] Cloud data restored, reloading scoped price history');
      void loadStoredData();
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('appDataCleared', handleDataCleared);
        window.addEventListener('cloudDataRestored', handleCloudRestore);
        return () => {
          window.removeEventListener('appDataCleared', handleDataCleared);
          window.removeEventListener('cloudDataRestored', handleCloudRestore);
        };
      }
    } catch (error) {
      console.log('[PriceHistoryProvider] Could not set up scoped storage event listeners:', error);
    }
  }, [loadStoredData]);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    if (loadedHistorySnapshotRef.current === priceHistory) {
      loadedHistorySnapshotRef.current = null;
      return;
    }
    const saveHistory = async () => {
      try {
        await quotaSafeSetJsonItem(storageKeysRef.current.PRICE_HISTORY, priceHistory);
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price history:', error);
      }
    };

    if (priceHistory.length > 0) {
      void saveHistory();
    }
  }, [priceHistory]);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    if (loadedAlertsSnapshotRef.current === priceDropAlerts) {
      loadedAlertsSnapshotRef.current = null;
      return;
    }
    const saveAlerts = async () => {
      try {
        await quotaSafeSetJsonItem(storageKeysRef.current.PRICE_DROP_ALERTS, priceDropAlerts);
      } catch (error) {
        console.error('[PriceHistoryProvider] Error saving price drop alerts:', error);
      }
    };

    void saveAlerts();
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
    const now = new Date();
    const nowIso = now.toISOString();
    const latestByCruiseKey = new Map<string, PriceHistoryRecord>();
    const recentPriceKeys = new Set<string>();
    for (const record of priceHistory) {
      const existingLatest = latestByCruiseKey.get(record.cruiseKey);
      if (!existingLatest || record.recordedAt > existingLatest.recordedAt) {
        latestByCruiseKey.set(record.cruiseKey, record);
      }
      const ageMs = now.getTime() - new Date(record.recordedAt).getTime();
      if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) {
        recentPriceKeys.add(`${record.cruiseKey}:${Math.round(record.totalPrice)}`);
      }
    }

    const recordsToAdd: PriceHistoryRecord[] = [];
    const priceDrops: PriceDropAlert[] = [];
    const cabinTypes = ['Interior', 'Oceanview', 'Balcony', 'Suite'];

    for (const offer of offers) {
      if (!offer.shipName || !offer.sailingDate) continue;
      for (const cabinType of cabinTypes) {
        const price = extractCabinPrice(offer, cabinType);
        const taxes = offer.taxesFees || offer.portCharges || 0;
        if (price <= 0 && taxes <= 0) continue;

        const cruiseKey = generateCruiseKey(offer.shipName, offer.sailingDate, cabinType);
        const totalPrice = price + taxes;
        const recentKey = `${cruiseKey}:${Math.round(totalPrice)}`;
        if (recentPriceKeys.has(recentKey)) continue;
        recentPriceKeys.add(recentKey);

        const record: PriceHistoryRecord = {
          id: generateRecordId(),
          cruiseKey,
          shipName: offer.shipName,
          sailDate: offer.sailingDate,
          nights: offer.nights || 0,
          destination: offer.itineraryName || 'Unknown',
          cabinType,
          price,
          taxesFees: taxes,
          totalPrice,
          freePlay: offer.freePlay || offer.freeplayAmount,
          obc: offer.OBC || offer.obcAmount,
          offerCode: offer.offerCode,
          offerName: offer.offerName || offer.title,
          offerId: offer.id,
          recordedAt: nowIso,
          source: 'offer',
        };
        recordsToAdd.push(record);

        const previousRecord = latestByCruiseKey.get(cruiseKey);
        if (previousRecord && totalPrice < previousRecord.totalPrice) {
          const priceDrop = previousRecord.totalPrice - totalPrice;
          priceDrops.push({
            cruiseKey,
            shipName: record.shipName,
            sailDate: record.sailDate,
            destination: record.destination,
            cabinType,
            previousPrice: previousRecord.totalPrice,
            currentPrice: totalPrice,
            priceDrop,
            priceDropPercent: (priceDrop / previousRecord.totalPrice) * 100,
            previousRecordedAt: previousRecord.recordedAt,
            currentRecordedAt: nowIso,
            offerId: offer.id,
            offerName: record.offerName,
          });
        }
        latestByCruiseKey.set(cruiseKey, record);
      }
    }

    // One provider publication and one persistence effect replace hundreds of
    // per-price state updates that previously blocked tab presses after launch.
    if (recordsToAdd.length > 0) {
      setPriceHistory((previous) => [...previous, ...recordsToAdd]);
    }
    if (priceDrops.length > 0) {
      setPriceDropAlerts((previous) => {
        const droppedKeys = new Set(priceDrops.map((drop) => drop.cruiseKey));
        return [...previous.filter((alert) => !droppedKeys.has(alert.cruiseKey)), ...priceDrops];
      });
    }

    if (__DEV__) console.log('[PriceHistoryProvider] Bulk recorded prices from', offers.length, 'offers:', recordsToAdd.length, 'records and', priceDrops.length, 'price drops');
    return priceDrops;
  }, [priceHistory]);

  const getPriceDrops = useCallback((): PriceDropAlert[] => {
    return [...priceDropAlerts].sort((a, b) => b.priceDropPercent - a.priceDropPercent);
  }, [priceDropAlerts]);

  const getActivePriceDrops = useCallback((): PriceDropAlert[] => {
    return priceDropAlerts.filter(alert => {
      return isDateInFuture(alert.sailDate);
    }).sort((a, b) => b.priceDropPercent - a.priceDropPercent);
  }, [priceDropAlerts]);

  const dismissPriceDrop = useCallback((cruiseKey: string) => {
    setPriceDropAlerts(prev => prev.filter(a => a.cruiseKey !== cruiseKey));
    console.log('[PriceHistoryProvider] Dismissed price drop alert for:', cruiseKey);
  }, []);

  const trackUpgradePricesForBooked = useCallback((bookedCruises: BookedCruise[], offers: CasinoOffer[]) => {
    const upcomingBooked = bookedCruises.filter(c => {
      return isDateInFuture(c.sailDate) && (c.status === 'booked' || c.completionState === 'upcoming' || c.status === 'Courtesy Hold');
    });

    if (upcomingBooked.length === 0 || offers.length === 0) return;

    let updatedCount = 0;
    const newPrices = new Map(upgradePrices);

    for (const booked of upcomingBooked) {
      const bookedTier = getCabinTier(booked.cabinType);
      const higherTiers = getHigherCabinTypes(bookedTier.tier);

      const matchingOffers = offers.filter(offer => {
        if (!offer.shipName || !offer.sailingDate) return false;
        const shipMatch = offer.shipName.toLowerCase().trim() === booked.shipName.toLowerCase().trim();
        const dateMatch = offer.sailingDate === booked.sailDate;
        if (shipMatch && dateMatch) return true;
        if (!shipMatch) return false;
        const daysDiff = getDaysBetween(offer.sailingDate, booked.sailDate);
        return !Number.isNaN(daysDiff) && daysDiff <= 3;
      });

      for (const offer of matchingOffers) {
        for (const higherTier of higherTiers) {
          const price = extractUpgradeCabinPrice(offer, higherTier.label);
          if (price <= 0) continue;

          const upgradeKey = `${booked.id}_${higherTier.label}`;
          const existingPrice = newPrices.get(upgradeKey);

          if (!existingPrice || price !== existingPrice) {
            newPrices.set(upgradeKey, price);
            updatedCount++;

            if (existingPrice && price < existingPrice) {
              const drop = existingPrice - price;
              const dropPercent = (drop / existingPrice) * 100;
              console.log(`[PriceHistoryProvider] Upgrade price drop: ${booked.shipName} ${higherTier.label} dropped ${drop.toFixed(0)} (${dropPercent.toFixed(1)}%)`);
            }
          }
        }
      }
    }

    if (updatedCount > 0) {
      setUpgradePrices(newPrices);
      const obj = Object.fromEntries(newPrices);
      quotaSafeSetJsonItem(storageKeysRef.current.UPGRADE_PRICES, obj).catch(err => {
        console.error('[PriceHistoryProvider] Error saving upgrade prices:', err);
      });
      console.log('[PriceHistoryProvider] Updated', updatedCount, 'upgrade price entries, total tracked:', newPrices.size);
    }
  }, [upgradePrices]);

  const clearPriceHistory = useCallback(async () => {
    try {
      await Promise.all([
        quotaSafeRemoveItem(storageKeysRef.current.PRICE_HISTORY),
        quotaSafeRemoveItem(storageKeysRef.current.PRICE_DROP_ALERTS),
        quotaSafeRemoveItem(storageKeysRef.current.UPGRADE_PRICES),
      ]);
      setPriceHistory([]);
      setPriceDropAlerts([]);
      setUpgradePrices(new Map());
      console.log('[PriceHistoryProvider] Cleared all price history');
    } catch (error) {
      console.error('[PriceHistoryProvider] Error clearing price history:', error);
    }
  }, []);

  const uniqueCruiseKeys = useMemo(() => {
    return [...new Set(priceHistory.map(r => r.cruiseKey))];
  }, [priceHistory]);

  if (__DEV__) console.log('[PriceHistoryProvider] Tracking', uniqueCruiseKeys.length, 'unique cruises with', priceHistory.length, 'price records');

  return useMemo(() => ({
    priceHistory,
    priceDropAlerts,
    upgradePrices,
    isLoading,
    recordPrice,
    recordPriceFromOffer,
    recordPriceFromCruise,
    bulkRecordFromOffers,
    trackUpgradePricesForBooked,
    getPriceHistory,
    getLowestPrice,
    getHighestPrice,
    getLatestPrice,
    getPriceDrops,
    getActivePriceDrops,
    dismissPriceDrop,
    clearPriceHistory,
  }), [priceHistory, priceDropAlerts, upgradePrices, isLoading, recordPrice, recordPriceFromOffer, recordPriceFromCruise, bulkRecordFromOffers, trackUpgradePricesForBooked, getPriceHistory, getLowestPrice, getHighestPrice, getLatestPrice, getPriceDrops, getActivePriceDrops, dismissPriceDrop, clearPriceHistory]);
});
