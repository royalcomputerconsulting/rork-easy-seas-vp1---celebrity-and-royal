import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'easyseas_large_storage_v1';
const DB_VERSION = 2;
const STORE_NAME = 'kv';
const LOCAL_STORAGE_VALUE_CHAR_LIMIT = 100_000;
const LOCAL_STORAGE_CLEANUP_MIN_VALUE_CHARS = 25_000;
const MAX_LOCAL_STORAGE_CLEANUP_KEYS = 24;

const BULKY_STORAGE_KEY_MARKERS = [
  'MACHINE_INDEX',
  'MACHINE_DETAIL',
  'SHARED_MACHINE_LIBRARY_CACHE',
  'PERMANENT_GLOBAL_MACHINE_DATABASE',
  'machine_encyclopedia',
  'sailing_weather_cache',
  'casino_open_hours',
  'easyseas_cruises',
  'easyseas_booked_cruises',
  'easyseas_casino_offers',
  'easyseas_calendar_events',
  'crew_recognition_entries',
  'crew_recognition_sailings',
];

const PURGEABLE_CACHE_KEY_MARKERS = [
  'MACHINE_INDEX',
  'MACHINE_DETAIL',
  'SHARED_MACHINE_LIBRARY_CACHE',
  'PERMANENT_GLOBAL_MACHINE_DATABASE',
  'sailing_weather_cache',
];

let dbPromise: Promise<IDBDatabase | null> | null = null;
let hasLoggedIndexedDbGetUnavailable = false;
let cleanupPromise: Promise<number> | null = null;
let hasLoggedStoragePressure = false;

function canUseIndexedDb(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

function getValueLength(value: string): number {
  return value.length;
}

function formatStorageLog(message: string, details: Record<string, string | number | boolean | null | undefined>): string {
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  return detailText.length > 0 ? `${message} ${detailText}` : message;
}

function redactStorageKey(key: string): string {
  return key.replace(/::[^:]+$/u, '::<user>');
}

function isBulkyStorageKey(key: string): boolean {
  return BULKY_STORAGE_KEY_MARKERS.some((marker) => key.includes(marker));
}

function isPurgeableCacheKey(key: string): boolean {
  return PURGEABLE_CACHE_KEY_MARKERS.some((marker) => key.includes(marker));
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
        console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB open failed;', { error: describeStorageError(request.error) }));
        resetDbCache();
        resolve(null);
      };

      request.onblocked = () => {
        console.log('[QuotaSafeStorage] IndexedDB open blocked');
      };
    } catch (error) {
      console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB open threw;', { error: describeStorageError(error) }));
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
          console.log(formatStorageLog('[QuotaSafeStorage] IndexedDB get unavailable; continuing with AsyncStorage value only;', { key: redactStorageKey(key), error: describeStorageError(request.error) }));
        }
        resolve(null);
      };

      transaction.onerror = () => {
        if (!hasLoggedIndexedDbGetUnavailable) {
          hasLoggedIndexedDbGetUnavailable = true;
          console.log(formatStorageLog('[QuotaSafeStorage] IndexedDB read transaction unavailable; continuing safely;', { key: redactStorageKey(key), error: describeStorageError(transaction.error) }));
        }
      };
    } catch (error) {
      if (!hasLoggedIndexedDbGetUnavailable) {
        hasLoggedIndexedDbGetUnavailable = true;
        console.log(formatStorageLog('[QuotaSafeStorage] IndexedDB get unavailable; continuing with empty fallback;', { key: redactStorageKey(key), error: describeStorageError(error) }));
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
        console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB set failed;', { key: redactStorageKey(key), error: describeStorageError(request.error), chars: getValueLength(value) }));
        finish(false);
      };
      transaction.oncomplete = () => finish(true);
      transaction.onerror = () => {
        console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB transaction failed;', { key: redactStorageKey(key), error: describeStorageError(transaction.error), chars: getValueLength(value) }));
        finish(false);
      };
      transaction.onabort = () => {
        console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB transaction aborted;', { key: redactStorageKey(key), error: describeStorageError(transaction.error), chars: getValueLength(value) }));
        finish(false);
      };
    } catch (error) {
      console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB set threw;', { key: redactStorageKey(key), error: describeStorageError(error), chars: getValueLength(value) }));
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
        console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB delete failed;', { key: redactStorageKey(key), error: describeStorageError(request.error) }));
        resolve();
      };
    } catch (error) {
      console.warn(formatStorageLog('[QuotaSafeStorage] IndexedDB delete threw;', { key: redactStorageKey(key), error: describeStorageError(error) }));
      resetDbCache();
      resolve();
    }
  });
}

async function storeInFallback(key: string, value: string, reason: string): Promise<boolean> {
  const stored = await idbSetItem(key, value);
  if (stored) {
    await AsyncStorage.removeItem(key).catch((error) => {
      console.warn(formatStorageLog('[QuotaSafeStorage] Failed to remove AsyncStorage copy after fallback write;', { key: redactStorageKey(key), error: describeStorageError(error) }));
    });
    console.log(formatStorageLog('[QuotaSafeStorage] Stored key in IndexedDB fallback;', { key: redactStorageKey(key), reason, chars: getValueLength(value) }));
    return true;
  }

  console.error(formatStorageLog('[QuotaSafeStorage] Could not persist key in AsyncStorage or IndexedDB fallback;', { key: redactStorageKey(key), reason, chars: getValueLength(value) }));
  return false;
}

async function migrateBulkyAsyncStorageKeysToFallback(): Promise<number> {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let freed = 0;

      for (const key of keys) {
        if (freed >= MAX_LOCAL_STORAGE_CLEANUP_KEYS) {
          break;
        }
        if (!isBulkyStorageKey(key)) {
          continue;
        }

        const value = await AsyncStorage.getItem(key).catch(() => null);
        if (!value || value.length < LOCAL_STORAGE_CLEANUP_MIN_VALUE_CHARS) {
          continue;
        }

        if (canUseIndexedDb()) {
          const stored = await idbSetItem(key, value);
          if (!stored && !isPurgeableCacheKey(key)) {
            continue;
          }
        } else if (!isPurgeableCacheKey(key)) {
          continue;
        }

        await AsyncStorage.removeItem(key).catch(() => undefined);
        freed += 1;
      }

      if (freed > 0 || !hasLoggedStoragePressure) {
        hasLoggedStoragePressure = true;
        console.log(formatStorageLog('[QuotaSafeStorage] Local storage pressure cleanup complete;', { freedKeys: freed, indexedDb: canUseIndexedDb() }));
      }
      return freed;
    } catch (error) {
      console.warn(formatStorageLog('[QuotaSafeStorage] Local storage pressure cleanup failed;', { error: describeStorageError(error) }));
      return 0;
    } finally {
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
}

export async function quotaSafeGetItem(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch (error) {
    console.warn(formatStorageLog('[QuotaSafeStorage] AsyncStorage get failed, trying fallback;', { key: redactStorageKey(key), error: describeStorageError(error) }));
  }

  return idbGetItem(key);
}

export async function quotaSafeSetItem(key: string, value: string): Promise<void> {
  const valueLength = getValueLength(value);
  const shouldPreferFallback = canUseIndexedDb() && (valueLength >= LOCAL_STORAGE_VALUE_CHAR_LIMIT || isBulkyStorageKey(key));

  if (shouldPreferFallback) {
    const stored = await storeInFallback(key, value, valueLength >= LOCAL_STORAGE_VALUE_CHAR_LIMIT ? 'large-value' : 'bulky-cache-key');
    if (stored) {
      return;
    }
  }

  try {
    await AsyncStorage.setItem(key, value);
    await idbRemoveItem(key);
  } catch (error) {
    const errorDescription = describeStorageError(error);
    if (canUseIndexedDb() || isQuotaError(error)) {
      const freedKeys = await migrateBulkyAsyncStorageKeysToFallback();
      if (!shouldPreferFallback) {
        try {
          await AsyncStorage.setItem(key, value);
          await idbRemoveItem(key);
          if (freedKeys > 0) {
            console.log(formatStorageLog('[QuotaSafeStorage] AsyncStorage write recovered after cleanup;', { key: redactStorageKey(key), freedKeys, chars: valueLength }));
          }
          return;
        } catch (retryError) {
          const stored = canUseIndexedDb()
            ? await storeInFallback(key, value, isQuotaError(retryError) ? 'quota-exceeded-after-cleanup' : 'async-storage-error-after-cleanup')
            : false;
          if (stored) {
            return;
          }
          console.error(formatStorageLog('[QuotaSafeStorage] AsyncStorage set failed after cleanup and fallback failed;', { key: redactStorageKey(key), error: describeStorageError(retryError), originalError: errorDescription, chars: valueLength, freedKeys }));
          throw retryError;
        }
      }

      const stored = canUseIndexedDb()
        ? await storeInFallback(key, value, isQuotaError(error) ? 'quota-exceeded' : 'async-storage-error')
        : false;
      if (stored) {
        return;
      }
    }

    console.error(formatStorageLog('[QuotaSafeStorage] AsyncStorage set failed;', { key: redactStorageKey(key), error: errorDescription, chars: valueLength }));
    throw error;
  }
}

export async function quotaSafeSetJsonItem(key: string, value: unknown): Promise<void> {
  await quotaSafeSetItem(key, JSON.stringify(value));
}

export async function quotaSafeRemoveItem(key: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(key).catch((error) => {
      console.warn(formatStorageLog('[QuotaSafeStorage] AsyncStorage remove failed;', { key: redactStorageKey(key), error: describeStorageError(error) }));
    }),
    idbRemoveItem(key),
  ]);
}
