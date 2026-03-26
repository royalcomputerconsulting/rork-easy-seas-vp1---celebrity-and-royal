import { useState, useCallback, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompItem, W2GRecord, TaxSummary } from '@/types/models';

const COMP_ITEMS_KEY = '@easyseas/compItems';
const W2G_RECORDS_KEY = '@easyseas/w2gRecords';

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
  const [compItems, setCompItems] = useState<CompItem[]>([]);
  const [w2gRecords, setW2GRecords] = useState<W2GRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [compItemsJson, w2gRecordsJson] = await Promise.all([
        AsyncStorage.getItem(COMP_ITEMS_KEY),
        AsyncStorage.getItem(W2G_RECORDS_KEY),
      ]);

      if (compItemsJson) {
        const items = JSON.parse(compItemsJson) as CompItem[];
        setCompItems(items);
        console.log('[TaxProvider] Loaded', items.length, 'comp items');
      }

      if (w2gRecordsJson) {
        const records = JSON.parse(w2gRecordsJson) as W2GRecord[];
        setW2GRecords(records);
        console.log('[TaxProvider] Loaded', records.length, 'W-2G records');
      }
    } catch (error) {
      console.error('[TaxProvider] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCompItems = useCallback(async (items: CompItem[]) => {
    try {
      await AsyncStorage.setItem(COMP_ITEMS_KEY, JSON.stringify(items));
      console.log('[TaxProvider] Saved', items.length, 'comp items');
    } catch (error) {
      console.error('[TaxProvider] Failed to save comp items:', error);
    }
  }, []);

  const saveW2GRecords = useCallback(async (records: W2GRecord[]) => {
    try {
      await AsyncStorage.setItem(W2G_RECORDS_KEY, JSON.stringify(records));
      console.log('[TaxProvider] Saved', records.length, 'W-2G records');
    } catch (error) {
      console.error('[TaxProvider] Failed to save W-2G records:', error);
    }
  }, []);

  const addCompItem = useCallback(async (item: Omit<CompItem, 'id' | 'createdAt'>) => {
    const newItem: CompItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    const updatedItems = [...compItems, newItem];
    setCompItems(updatedItems);
    await saveCompItems(updatedItems);
    console.log('[TaxProvider] Added comp item:', newItem.name);
  }, [compItems, saveCompItems]);

  const removeCompItem = useCallback(async (id: string) => {
    const updatedItems = compItems.filter(item => item.id !== id);
    setCompItems(updatedItems);
    await saveCompItems(updatedItems);
    console.log('[TaxProvider] Removed comp item:', id);
  }, [compItems, saveCompItems]);

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
    console.log('[TaxProvider] Added W-2G record:', newRecord.amount);
  }, [w2gRecords, saveW2GRecords]);

  const removeW2GRecord = useCallback(async (id: string) => {
    const updatedRecords = w2gRecords.filter(record => record.id !== id);
    setW2GRecords(updatedRecords);
    await saveW2GRecords(updatedRecords);
    console.log('[TaxProvider] Removed W-2G record:', id);
  }, [w2gRecords, saveW2GRecords]);

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
