import { useState, useCallback, useEffect, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import type { CompItem, W2GRecord, TaxSummary } from '@/types/models';
import { useAuth } from '@/state/AuthProvider';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';

const COMP_ITEMS_KEY = ALL_STORAGE_KEYS.COMP_ITEMS;
const W2G_RECORDS_KEY = ALL_STORAGE_KEYS.W2G_RECORDS;

interface TaxState {
  compItems: CompItem[];
  w2gRecords: W2GRecord[];
  isLoading: boolean;
  
  addCompItem: (item: Omit<CompItem, 'id' | 'createdAt'>) => Promise<void>;
  removeCompItem: (id: string) => Promise<void>;
  getTotalCompValue: () => number;
  getCompItemsByCruise: (cruiseId?: string) => CompItem[];
  
  addW2GRecord: (record: Omit<W2GRecord, 'id' | 'createdAt'>) => Promise<void>;
  removeW2GRecord: (id: string) => Promise<void>;
  getTaxSummary: (year?: number) => TaxSummary;
  getW2GRecordsByYear: (year: number) => W2GRecord[];
}

export const [TaxProvider, useTax] = createContextHook((): TaxState => {
  const { authenticatedEmail } = useAuth();
  const compItemsKeyRef = useRef<string>(getUserScopedKey(COMP_ITEMS_KEY, authenticatedEmail));
  const w2gRecordsKeyRef = useRef<string>(getUserScopedKey(W2G_RECORDS_KEY, authenticatedEmail));
  const [compItems, setCompItems] = useState<CompItem[]>([]);
  const [w2gRecords, setW2GRecords] = useState<W2GRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [items, records] = await Promise.all([
        quotaSafeGetJsonItem<CompItem[]>(compItemsKeyRef.current, [], Array.isArray),
        quotaSafeGetJsonItem<W2GRecord[]>(w2gRecordsKeyRef.current, [], Array.isArray),
      ]);

      setCompItems(items);
      setW2GRecords(records);
      console.log('[TaxProvider] Loaded scoped comp items:', { email: authenticatedEmail, count: items.length });
      console.log('[TaxProvider] Loaded scoped W-2G records:', { email: authenticatedEmail, count: records.length });
    } catch (error) {
      console.error('[TaxProvider] Failed to load scoped tax data:', error);
      setCompItems([]);
      setW2GRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedEmail]);

  useEffect(() => {
    compItemsKeyRef.current = getUserScopedKey(COMP_ITEMS_KEY, authenticatedEmail);
    w2gRecordsKeyRef.current = getUserScopedKey(W2G_RECORDS_KEY, authenticatedEmail);
    void loadData();
  }, [authenticatedEmail, loadData]);

  const saveCompItems = useCallback(async (items: CompItem[]) => {
    try {
      await quotaSafeSetJsonItem(compItemsKeyRef.current, items);
      console.log('[TaxProvider] Saved scoped comp items:', { email: authenticatedEmail, count: items.length });
    } catch (error) {
      console.error('[TaxProvider] Failed to save scoped comp items:', error);
    }
  }, [authenticatedEmail]);

  const saveW2GRecords = useCallback(async (records: W2GRecord[]) => {
    try {
      await quotaSafeSetJsonItem(w2gRecordsKeyRef.current, records);
      console.log('[TaxProvider] Saved scoped W-2G records:', { email: authenticatedEmail, count: records.length });
    } catch (error) {
      console.error('[TaxProvider] Failed to save scoped W-2G records:', error);
    }
  }, [authenticatedEmail]);

  const addCompItem = useCallback(async (item: Omit<CompItem, 'id' | 'createdAt'>) => {
    const newItem: CompItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    const updatedItems = [...compItems, newItem];
    setCompItems(updatedItems);
    await saveCompItems(updatedItems);
    console.log('[TaxProvider] Added scoped comp item:', { email: authenticatedEmail, name: newItem.name });
  }, [authenticatedEmail, compItems, saveCompItems]);

  const removeCompItem = useCallback(async (id: string) => {
    const updatedItems = compItems.filter(item => item.id !== id);
    setCompItems(updatedItems);
    await saveCompItems(updatedItems);
    console.log('[TaxProvider] Removed scoped comp item:', { email: authenticatedEmail, id });
  }, [authenticatedEmail, compItems, saveCompItems]);

  const getTotalCompValue = useCallback(() => {
    return compItems.reduce((sum, item) => sum + item.value, 0);
  }, [compItems]);

  const getCompItemsByCruise = useCallback((cruiseId?: string) => {
    if (!cruiseId) return compItems;
    return compItems.filter(item => item.cruiseId === cruiseId);
  }, [compItems]);

  const addW2GRecord = useCallback(async (record: Omit<W2GRecord, 'id' | 'createdAt'>) => {
    const newRecord: W2GRecord = {
      ...record,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    const updatedRecords = [...w2gRecords, newRecord];
    setW2GRecords(updatedRecords);
    await saveW2GRecords(updatedRecords);
    console.log('[TaxProvider] Added scoped W-2G record:', { email: authenticatedEmail, amount: newRecord.amount });
  }, [authenticatedEmail, w2gRecords, saveW2GRecords]);

  const removeW2GRecord = useCallback(async (id: string) => {
    const updatedRecords = w2gRecords.filter(record => record.id !== id);
    setW2GRecords(updatedRecords);
    await saveW2GRecords(updatedRecords);
    console.log('[TaxProvider] Removed scoped W-2G record:', { email: authenticatedEmail, id });
  }, [authenticatedEmail, w2gRecords, saveW2GRecords]);

  const getTaxSummary = useCallback((year?: number): TaxSummary => {
    const currentYear = year || new Date().getFullYear();
    const yearRecords = w2gRecords.filter(record => {
      const recordYear = new Date(record.date).getFullYear();
      return recordYear === currentYear;
    });

    return {
      totalW2GWinnings: yearRecords.reduce((sum, record) => sum + record.amount, 0),
      totalW2GWithheld: yearRecords.reduce((sum, record) => sum + record.withheld, 0),
      w2gCount: yearRecords.length,
      taxYear: currentYear,
    };
  }, [w2gRecords]);

  const getW2GRecordsByYear = useCallback((year: number): W2GRecord[] => {
    return w2gRecords.filter(record => {
      const recordYear = new Date(record.date).getFullYear();
      return recordYear === year;
    });
  }, [w2gRecords]);

  return {
    compItems,
    w2gRecords,
    isLoading,
    addCompItem,
    removeCompItem,
    getTotalCompValue,
    getCompItemsByCruise,
    addW2GRecord,
    removeW2GRecord,
    getTaxSummary,
    getW2GRecordsByYear,
  };
});
