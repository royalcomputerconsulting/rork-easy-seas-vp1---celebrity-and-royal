import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'easyseas_large_storage_v1';
const STORE_NAME = 'kv';
const LOCAL_STORAGE_VALUE_CHAR_LIMIT = 750_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function canUseIndexedDb(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function isQuotaError(error: unknown): boolean {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name ?? '') : '';
  const message = error instanceof Error ? error.message : String(error);
  return name.includes('Quota') || message.includes('QuotaExceededError') || message.includes('exceeded the quota') || message.includes('quota');
}

function getValueLength(value: string): number {
  return value.length;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = globalThis.indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };

      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB open failed:', request.error);
        resolve(null);
      };

      request.onblocked = () => {
        console.log('[QuotaSafeStorage] IndexedDB open blocked');
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB open threw:', error);
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbGetItem(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === 'string' ? value : null);
      };

      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB get failed:', { key, error: request.error });
        resolve(null);
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB get threw:', { key, error });
      resolve(null);
    }
  });
}

async function idbSetItem(key: string, value: string): Promise<boolean> {
  const db = await openDb();
  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB set failed:', { key, error: request.error });
        resolve(false);
      };
      transaction.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB transaction failed:', { key, error: transaction.error });
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB set threw:', { key, error });
      resolve(false);
    }
  });
}

async function idbRemoveItem(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB delete failed:', { key, error: request.error });
        resolve();
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB delete threw:', { key, error });
      resolve();
    }
  });
}

async function storeInFallback(key: string, value: string, reason: string): Promise<void> {
  const stored = await idbSetItem(key, value);
  if (stored) {
    await AsyncStorage.removeItem(key).catch((error) => {
      console.error('[QuotaSafeStorage] Failed to remove AsyncStorage copy after fallback write:', { key, error });
    });
    console.log('[QuotaSafeStorage] Stored key in IndexedDB fallback:', { key, reason, chars: getValueLength(value) });
    return;
  }

  console.error('[QuotaSafeStorage] Could not persist key in AsyncStorage or IndexedDB fallback:', { key, reason, chars: getValueLength(value) });
}

export async function quotaSafeGetItem(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch (error) {
    console.error('[QuotaSafeStorage] AsyncStorage get failed, trying fallback:', { key, error });
  }

  return idbGetItem(key);
}

export async function quotaSafeSetItem(key: string, value: string): Promise<void> {
  const shouldPreferFallback = canUseIndexedDb() && getValueLength(value) >= LOCAL_STORAGE_VALUE_CHAR_LIMIT;

  if (shouldPreferFallback) {
    await storeInFallback(key, value, 'large-value');
    return;
  }

  try {
    await AsyncStorage.setItem(key, value);
    await idbRemoveItem(key);
  } catch (error) {
    console.error('[QuotaSafeStorage] AsyncStorage set failed:', { key, error });
    if (canUseIndexedDb() || isQuotaError(error)) {
      await storeInFallback(key, value, isQuotaError(error) ? 'quota-exceeded' : 'async-storage-error');
      return;
    }
    throw error;
  }
}

export async function quotaSafeSetJsonItem(key: string, value: unknown): Promise<void> {
  await quotaSafeSetItem(key, JSON.stringify(value));
}

export async function quotaSafeRemoveItem(key: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(key).catch((error) => {
      console.error('[QuotaSafeStorage] AsyncStorage remove failed:', { key, error });
    }),
    idbRemoveItem(key),
  ]);
}
