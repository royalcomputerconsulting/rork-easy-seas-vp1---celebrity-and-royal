import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'easyseas_large_storage_v1';
const DB_VERSION = 2;
const STORE_NAME = 'kv';
const LOCAL_STORAGE_VALUE_CHAR_LIMIT = 750_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;
let hasLoggedIndexedDbGetUnavailable = false;

function canUseIndexedDb(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function getValueLength(value: string): number {
  return value.length;
}

function describeStorageError(error: unknown, seen: WeakSet<object> = new WeakSet<object>()): string {
  if (error instanceof Error) {
    const code = 'code' in error ? String((error as Error & { code?: unknown }).code ?? '') : '';
    return code.length > 0 ? `${error.name}: ${error.message} code=${code}` : `${error.name}: ${error.message}`;
  }

  if (error && typeof error === 'object') {
    if (seen.has(error)) {
      return '[Circular storage error]';
    }
    seen.add(error);

    const record = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      error?: unknown;
      cause?: unknown;
      target?: { error?: unknown };
      nativeEvent?: { error?: unknown; message?: unknown };
    };

    const nestedError = record.target?.error ?? record.nativeEvent?.error ?? record.error ?? record.cause;
    if (nestedError) {
      const nestedDescription = describeStorageError(nestedError, seen);
      if (nestedDescription && nestedDescription !== Object.prototype.toString.call(nestedError)) {
        return nestedDescription;
      }
    }

    const parts: string[] = [];
    if (typeof record.name === 'string' && record.name.length > 0) {
      parts.push(record.name);
    }
    if (typeof record.message === 'string' && record.message.length > 0) {
      parts.push(record.message);
    }
    if (typeof record.nativeEvent?.message === 'string' && record.nativeEvent.message.length > 0) {
      parts.push(record.nativeEvent.message);
    }
    if (typeof record.code === 'number' || typeof record.code === 'string') {
      parts.push(`code=${String(record.code)}`);
    }

    if (parts.length > 0) {
      return parts.join(': ');
    }

    try {
      const json = JSON.stringify(error);
      return json && json !== '{}' ? json : Object.prototype.toString.call(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
}

function isQuotaError(error: unknown): boolean {
  const description = describeStorageError(error).toLowerCase();
  return description.includes('quota') || description.includes('quotaexceedederror') || description.includes('exceeded the quota');
}

function hasObjectStore(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(STORE_NAME);
}

function resetDbCache(): void {
  dbPromise = null;
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
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (!hasObjectStore(db)) {
          console.log('[QuotaSafeStorage] IndexedDB store missing after open; fallback disabled until browser repairs storage');
          db.close();
          resetDbCache();
          resolve(null);
          return;
        }
        db.onversionchange = () => {
          db.close();
          resetDbCache();
        };
        resolve(db);
      };

      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB open failed:', describeStorageError(request.error));
        resetDbCache();
        resolve(null);
      };

      request.onblocked = () => {
        console.log('[QuotaSafeStorage] IndexedDB open blocked');
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB open threw:', describeStorageError(error));
      resetDbCache();
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
      if (!hasObjectStore(db)) {
        resetDbCache();
        resolve(null);
        return;
      }

      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === 'string' ? value : null);
      };

      request.onerror = () => {
        if (!hasLoggedIndexedDbGetUnavailable) {
          hasLoggedIndexedDbGetUnavailable = true;
          console.log('[QuotaSafeStorage] IndexedDB get unavailable; continuing with AsyncStorage value only:', { key, error: describeStorageError(request.error) });
        }
        resolve(null);
      };

      transaction.onerror = () => {
        if (!hasLoggedIndexedDbGetUnavailable) {
          hasLoggedIndexedDbGetUnavailable = true;
          console.log('[QuotaSafeStorage] IndexedDB read transaction unavailable; continuing safely:', { key, error: describeStorageError(transaction.error) });
        }
      };
    } catch (error) {
      if (!hasLoggedIndexedDbGetUnavailable) {
        hasLoggedIndexedDbGetUnavailable = true;
        console.log('[QuotaSafeStorage] IndexedDB get unavailable; continuing with empty fallback:', { key, error: describeStorageError(error) });
      }
      resetDbCache();
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
    let settled = false;
    const finish = (stored: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(stored);
      }
    };

    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB set failed:', { key, error: describeStorageError(request.error) });
        finish(false);
      };
      transaction.oncomplete = () => finish(true);
      transaction.onerror = () => {
        console.error('[QuotaSafeStorage] IndexedDB transaction failed:', { key, error: describeStorageError(transaction.error) });
        finish(false);
      };
      transaction.onabort = () => {
        console.error('[QuotaSafeStorage] IndexedDB transaction aborted:', { key, error: describeStorageError(transaction.error) });
        finish(false);
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB set threw:', { key, error: describeStorageError(error) });
      resetDbCache();
      finish(false);
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
        console.error('[QuotaSafeStorage] IndexedDB delete failed:', { key, error: describeStorageError(request.error) });
        resolve();
      };
    } catch (error) {
      console.error('[QuotaSafeStorage] IndexedDB delete threw:', { key, error: describeStorageError(error) });
      resetDbCache();
      resolve();
    }
  });
}

async function storeInFallback(key: string, value: string, reason: string): Promise<void> {
  const stored = await idbSetItem(key, value);
  if (stored) {
    await AsyncStorage.removeItem(key).catch((error) => {
      console.error('[QuotaSafeStorage] Failed to remove AsyncStorage copy after fallback write:', { key, error: describeStorageError(error) });
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
    console.error('[QuotaSafeStorage] AsyncStorage get failed, trying fallback:', { key, error: describeStorageError(error) });
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
    const errorDescription = describeStorageError(error);
    console.error('[QuotaSafeStorage] AsyncStorage set failed:', { key, error: errorDescription, chars: getValueLength(value) });
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
      console.error('[QuotaSafeStorage] AsyncStorage remove failed:', { key, error: describeStorageError(error) });
    }),
    idbRemoveItem(key),
  ]);
}
