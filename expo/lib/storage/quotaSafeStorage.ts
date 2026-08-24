import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { createPersistenceRunId, enqueuePersistence, isLatestPersistenceRun, type PersistenceCommitResult } from './persistenceCoordinator';
import { appendDiagnosticJournal } from './diagnosticJournal';

const DB_NAME = 'easyseas_large_storage_v1';
const DB_VERSION = 3;
const STORE_NAME = 'kv';
const LARGE_VALUE_CHAR_LIMIT = 100_000;
const FILE_POINTER_PREFIX = '__EASYSEAS_FILE_V1__:';
const LAST_GOOD_SUFFIX = '::__last_good__';
const CORRUPT_SUFFIX = '::__corrupt__';
const NATIVE_DATA_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}easyseas-data-v1/`
  : null;

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
  '@easyseas_certificates',
  '@easyseas_certificate_documents',
];

interface FilePointer {
  version: 1;
  path: string;
  chars: number;
  updatedAt: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
let nativeDirectoryPromise: Promise<boolean> | null = null;
let bulkySerializationTail: Promise<void> = Promise.resolve();
type JsonParseTask = { key: string; raw: string; resolve: (value: unknown) => void; reject: (reason: unknown) => void; priority: number };
const jsonParseQueue: JsonParseTask[] = [];
let jsonParseScheduled = false;

function redactStorageKey(key: string): string {
  return key.replace(/::[^:]+$/u, '::<user>');
}

function describeStorageError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isBulkyStorageKey(key: string): boolean {
  return BULKY_STORAGE_KEY_MARKERS.some((marker) => key.includes(marker));
}

function isJsonLike(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function isValidJsonLike(value: string): boolean {
  if (!isJsonLike(value)) return true;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function jsonParsePriority(key: string): number {
  if (key.includes('easyseas_cruises')) return 100;
  if (key.includes('easyseas_booked_cruises')) return 95;
  if (key.includes('easyseas_casino_offers')) return 90;
  if (key.includes('easyseas_calendar_events')) return 85;
  if (key.includes('@easyseas_certificate_documents')) return 20;
  return 50;
}

function scheduleNextJsonParse(): void {
  if (jsonParseScheduled || jsonParseQueue.length === 0) return;
  jsonParseScheduled = true;
  setTimeout(() => {
    jsonParseScheduled = false;
    jsonParseQueue.sort((left, right) => right.priority - left.priority);
    const task = jsonParseQueue.shift();
    if (!task) return;
    try {
      task.resolve(JSON.parse(task.raw));
    } catch (error) {
      task.reject(error);
    } finally {
      // Never run two multi-megabyte JSON parses back-to-back in one turn.
      // A native navigation/touch event gets a chance between every dataset.
      scheduleNextJsonParse();
    }
  }, 0);
}

function parseJsonCooperatively(key: string, raw: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    jsonParseQueue.push({ key, raw, resolve, reject, priority: jsonParsePriority(key) });
    scheduleNextJsonParse();
  });
}

async function withBulkySerializationSlot<T>(work: () => Promise<T>): Promise<T> {
  const previous = bulkySerializationTail;
  let release!: () => void;
  bulkySerializationTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

async function stringifyJsonCooperatively(key: string, value: unknown): Promise<string> {
  if (!Array.isArray(value) || !isBulkyStorageKey(key) || value.length === 0) {
    return JSON.stringify(value);
  }

  // Only one bulky dataset is serialized at a time. Royal/Carnival commits
  // submit offers, sailings and bookings together; interleaving three giant
  // JSON builders inflated peak memory and starved tab presses.
  return withBulkySerializationSlot(async () => {
    const serializedChunks: string[] = [];
    // Certificate documents contain retained PDF evidence and hundreds of parsed
    // sailings per element, so even a 20-item array is materially large. Keep
    // all other large collections below a frame-sized unit of work.
    const chunkSize = key.includes('@easyseas_certificate_documents') ? 1 : value.length < 100 ? value.length : 50;
    for (let index = 0; index < value.length; index += chunkSize) {
      const serializedChunk = JSON.stringify(value.slice(index, index + chunkSize));
      serializedChunks.push(serializedChunk.slice(1, -1));
      await yieldToEventLoop();
    }

    return `[${serializedChunks.filter(Boolean).join(',')}]`;
  });
}

function canUseIndexedDb(): boolean {
  return Platform.OS === 'web'
    && typeof globalThis !== 'undefined'
    && typeof globalThis.indexedDB !== 'undefined';
}

function canUseNativeFiles(): boolean {
  return Platform.OS !== 'web' && Boolean(NATIVE_DATA_DIRECTORY);
}

function hashKey(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashStorageValue(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function hashStorageValueCooperatively(value: string): Promise<string> {
  let hash = 2166136261;
  const chunkSize = 32_768;
  for (let chunkStart = 0; chunkStart < value.length; chunkStart += chunkSize) {
    const chunkEnd = Math.min(value.length, chunkStart + chunkSize);
    for (let index = chunkStart; index < chunkEnd; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    if (chunkEnd < value.length) await yieldToEventLoop();
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function utf8ByteLengthCooperatively(value: string): Promise<number> {
  let bytes = 0;
  const chunkSize = 32_768;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (index > 0 && index % chunkSize === 0) await yieldToEventLoop();
  }
  return bytes;
}

async function analyzeStorageValueCooperatively(value: string): Promise<{ hash: string; bytes: number }> {
  let hash = 2166136261;
  let bytes = 0;
  const chunkSize = 16_384;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash ^= code;
    hash = Math.imul(hash, 16777619);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        hash ^= next;
        hash = Math.imul(hash, 16777619);
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
    if (index > 0 && index % chunkSize === 0) await yieldToEventLoop();
  }
  return { hash: (hash >>> 0).toString(16).padStart(8, '0'), bytes };
}

function nativeFilePathForKey(key: string, suffix = ''): string | null {
  if (!NATIVE_DATA_DIRECTORY) return null;
  return `${NATIVE_DATA_DIRECTORY}${hashKey(key)}${suffix}.json`;
}

function encodePointer(pointer: FilePointer): string {
  return `${FILE_POINTER_PREFIX}${JSON.stringify(pointer)}`;
}

function decodePointer(value: string | null): FilePointer | null {
  if (!value?.startsWith(FILE_POINTER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(FILE_POINTER_PREFIX.length)) as Partial<FilePointer>;
    if (parsed.version !== 1 || typeof parsed.path !== 'string') return null;
    return {
      version: 1,
      path: parsed.path,
      chars: typeof parsed.chars === 'number' ? parsed.chars : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

async function ensureNativeDirectory(): Promise<boolean> {
  if (!canUseNativeFiles() || !NATIVE_DATA_DIRECTORY) return false;
  if (nativeDirectoryPromise) return nativeDirectoryPromise;
  nativeDirectoryPromise = (async () => {
    try {
      const info = await FileSystem.getInfoAsync(NATIVE_DATA_DIRECTORY);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(NATIVE_DATA_DIRECTORY, { intermediates: true });
      }
      return true;
    } catch (error) {
      console.warn('[QuotaSafeStorage] Native data directory unavailable:', describeStorageError(error));
      return false;
    }
  })();
  return nativeDirectoryPromise;
}

async function readNativePointer(pointer: FilePointer): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(pointer.path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(pointer.path, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    console.warn('[QuotaSafeStorage] Native file read failed:', describeStorageError(error));
    return null;
  }
}

async function writeNativeValue(
  key: string,
  value: string,
  runId: string,
  expectedHash: string,
): Promise<{ pointer: FilePointer; previousPointer: FilePointer | null } | null> {
  if (!(await ensureNativeDirectory())) return null;
  const transactionPath = nativeFilePathForKey(key, `.tx-${runId}`);
  if (!transactionPath) return null;

  try {
    const previousPointer = decodePointer(await AsyncStorage.getItem(key));
    await FileSystem.writeAsStringAsync(transactionPath, value, { encoding: FileSystem.EncodingType.UTF8 });
    const info = await FileSystem.getInfoAsync(transactionPath);
    if (!info.exists) throw new Error('NATIVE_TRANSACTION_FILE_MISSING');
    const verified = await FileSystem.readAsStringAsync(transactionPath, { encoding: FileSystem.EncodingType.UTF8 });
    if (verified.length !== value.length) throw new Error(`NATIVE_LENGTH_MISMATCH:${verified.length}:${value.length}`);
    if (await hashStorageValueCooperatively(verified) !== expectedHash) throw new Error('NATIVE_HASH_MISMATCH');
    if (!isLatestPersistenceRun(key, runId)) throw new Error('STALE_NATIVE_WRITE_BEFORE_ACTIVATION');

    const pointer: FilePointer = {
      version: 1,
      path: transactionPath,
      chars: value.length,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, encodePointer(pointer));
    appendDiagnosticJournal('STORAGE_POINTER_COMMITTED', { key: redactStorageKey(key), runId, chars: value.length, hash: expectedHash });
    return { pointer, previousPointer };
  } catch (error) {
    await FileSystem.deleteAsync(transactionPath, { idempotent: true }).catch(() => undefined);
    console.warn('[QuotaSafeStorage] Native transaction write failed:', redactStorageKey(key), describeStorageError(error));
    throw error;
  }
}

async function rotateNativeLastGoodAfterCommit(
  key: string,
  previousPointer: FilePointer | null,
  activePath: string,
): Promise<void> {
  if (!previousPointer || previousPointer.path === activePath) return;
  const lastGoodPath = nativeFilePathForKey(key, '.lastgood');
  if (!lastGoodPath) return;
  try {
    const previousInfo = await FileSystem.getInfoAsync(previousPointer.path);
    if (!previousInfo.exists) return;
    await FileSystem.deleteAsync(lastGoodPath, { idempotent: true });
    await FileSystem.copyAsync({ from: previousPointer.path, to: lastGoodPath });
    setTimeout(() => {
      void FileSystem.deleteAsync(previousPointer.path, { idempotent: true }).catch(() => undefined);
    }, 0);
  } catch (error) {
    console.warn('[QuotaSafeStorage] Last-good rotation skipped:', redactStorageKey(key), describeStorageError(error));
  }
}

async function readNativeLastGood(key: string): Promise<string | null> {
  const path = nativeFilePathForKey(key, '.lastgood');
  if (!path) return null;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    return null;
  }
}

async function removeNativeFiles(key: string): Promise<void> {
  const paths = [nativeFilePathForKey(key), nativeFilePathForKey(key, '.lastgood')].filter((path): path is string => Boolean(path));
  await Promise.all(paths.map((path) => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined)));
}

async function removeNativePrimaryFile(key: string): Promise<void> {
  const path = nativeFilePathForKey(key);
  if (!path) return;
  await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
}

function resetDbCache(): void {
  dbPromise = null;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return null;
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          resetDbCache();
        };
        resolve(db);
      };
      request.onerror = () => {
        resetDbCache();
        resolve(null);
      };
    } catch {
      resetDbCache();
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGetItem(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetItem(key: string, value: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (valueToResolve: boolean) => {
      if (!settled) {
        settled = true;
        resolve(valueToResolve);
      }
    };
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => finish(true);
      transaction.onerror = () => finish(false);
      transaction.onabort = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

async function idbRemoveItem(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readRawStoredValue(key: string): Promise<string | null> {
  const asyncValue = await AsyncStorage.getItem(key).catch(() => null);
  const pointer = decodePointer(asyncValue);
  if (pointer) return readNativePointer(pointer);
  if (asyncValue !== null) return asyncValue;
  return idbGetItem(key);
}

async function quarantineCorruptValue(key: string, value: string): Promise<void> {
  const quarantineKey = `${key}${CORRUPT_SUFFIX}`;
  const clipped = value.length > 50_000 ? value.slice(0, 50_000) : value;
  await AsyncStorage.setItem(quarantineKey, clipped).catch(() => undefined);
}

async function readLastGoodValue(key: string): Promise<string | null> {
  const nativeValue = await readNativeLastGood(key);
  if (nativeValue !== null && isValidJsonLike(nativeValue)) return nativeValue;
  const fallback = await readRawStoredValue(`${key}${LAST_GOOD_SUFFIX}`);
  if (fallback !== null && isValidJsonLike(fallback)) return fallback;
  return null;
}

function scheduleNativeMigration(key: string, value: string): void {
  if (!canUseNativeFiles() || (value.length < LARGE_VALUE_CHAR_LIMIT && !isBulkyStorageKey(key))) return;

  setTimeout(() => {
    void (async () => {
      try {
        const currentAsyncValue = await AsyncStorage.getItem(key);
        if (currentAsyncValue !== value || decodePointer(currentAsyncValue)) return;
        await quotaSafeSetItem(key, value, { runId: createPersistenceRunId('migration') });
        console.log('[QuotaSafeStorage] Migrated bulky local value to native file storage:', redactStorageKey(key));
      } catch (error) {
        console.warn('[QuotaSafeStorage] Background native migration skipped:', redactStorageKey(key), describeStorageError(error));
      }
    })();
  }, 0);
}

export async function quotaSafeGetItem(key: string): Promise<string | null> {
  let value: string | null = null;
  try {
    value = await readRawStoredValue(key);
  } catch (error) {
    console.warn('[QuotaSafeStorage] Read failed:', redactStorageKey(key), describeStorageError(error));
  }

  if (value === null) return readLastGoodValue(key);
  if (isValidJsonLike(value)) {
    scheduleNativeMigration(key, value);
    return value;
  }

  console.warn('[QuotaSafeStorage] Corrupt JSON isolated; using last-known-good value:', redactStorageKey(key));
  await quarantineCorruptValue(key, value);
  return readLastGoodValue(key);
}

export async function quotaSafeSetItem(
  key: string,
  value: string,
  options?: { runId?: string; timeoutMs?: number },
): Promise<PersistenceCommitResult> {
  const runId = options?.runId ?? createPersistenceRunId('storage');
  // One cooperative traversal replaces two simultaneous full-string scans.
  // This cuts save-time CPU and avoids competing work on Hermes while keeping
  // the same content hash and UTF-8 byte diagnostics.
  const { hash, bytes } = await analyzeStorageValueCooperatively(value);

  return enqueuePersistence<PersistenceCommitResult>({
    key,
    runId,
    hash,
    execute: async () => {
      appendDiagnosticJournal('STORAGE_WRITE_STARTED', { key: redactStorageKey(key), runId, bytes, hash });
      if (canUseNativeFiles() && (value.length >= LARGE_VALUE_CHAR_LIMIT || isBulkyStorageKey(key))) {
        const writeResult = await writeNativeValue(key, value, runId, hash);
        if (!writeResult) throw new Error(`NATIVE_STORAGE_UNAVAILABLE:${redactStorageKey(key)}`);
        await idbRemoveItem(key);
        await rotateNativeLastGoodAfterCommit(key, writeResult.previousPointer, writeResult.pointer.path);
      } else if (canUseIndexedDb() && (value.length >= LARGE_VALUE_CHAR_LIMIT || isBulkyStorageKey(key))) {
        if (!(await idbSetItem(key, value))) throw new Error(`INDEXEDDB_WRITE_FAILED:${redactStorageKey(key)}`);
        if (!isLatestPersistenceRun(key, runId)) throw new Error(`STALE_INDEXEDDB_WRITE:${redactStorageKey(key)}`);
        await AsyncStorage.removeItem(key).catch(() => undefined);
      } else {
        if (!isLatestPersistenceRun(key, runId)) throw new Error(`STALE_ASYNCSTORAGE_WRITE:${redactStorageKey(key)}`);
        await AsyncStorage.setItem(key, value);
        await Promise.all([idbRemoveItem(key), removeNativePrimaryFile(key)]);
      }
      const result: PersistenceCommitResult = { key, runId, bytes, hash, committedAt: new Date().toISOString() };
      appendDiagnosticJournal('STORAGE_WRITE_COMMITTED', { key: redactStorageKey(key), runId, bytes, hash });
      return result;
    },
  });
}

export async function quotaSafeSetJsonItem(
  key: string,
  value: unknown,
  options?: { runId?: string; timeoutMs?: number },
): Promise<PersistenceCommitResult> {
  appendDiagnosticJournal('STORAGE_SERIALIZE_STARTED', { key: redactStorageKey(key), runId: options?.runId });
  const serialized = await stringifyJsonCooperatively(key, value);
  return quotaSafeSetItem(key, serialized, options);
}

export interface QuotaSafeJsonRead<T> {
  raw: string | null;
  value: T;
}

export async function quotaSafeGetJsonItemWithRaw<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): Promise<QuotaSafeJsonRead<T>> {
  // JSON consumers used to pass through quotaSafeGetItem(), which parsed the
  // entire value once for corruption detection, and then parse it again here.
  // Large cruise/certificate/machine datasets made that duplicate main-thread
  // work visible as frozen tabs. Read the transactional value directly and
  // validate the single parsed object instead.
  let raw: string | null = null;
  try {
    raw = await readRawStoredValue(key);
  } catch (error) {
    console.warn('[QuotaSafeStorage] JSON read failed:', redactStorageKey(key), describeStorageError(error));
  }
  if (raw === null) raw = await readLastGoodValue(key);
  if (raw === null) return { raw: null, value: fallback };
  try {
    const parsed = await parseJsonCooperatively(key, raw);
    if (validate && !validate(parsed)) {
      await quarantineCorruptValue(key, raw);
      const lastGood = await readLastGoodValue(key);
      if (lastGood) {
        const recovered = await parseJsonCooperatively(`${key}:last-good`, lastGood);
        if (validate(recovered)) return { raw: lastGood, value: recovered };
      }
      return { raw: null, value: fallback };
    }
    scheduleNativeMigration(key, raw);
    return { raw, value: parsed as T };
  } catch {
    await quarantineCorruptValue(key, raw);
    const lastGood = await readLastGoodValue(key);
    if (lastGood && lastGood !== raw) {
      try {
        const recovered = await parseJsonCooperatively(`${key}:last-good`, lastGood);
        if (!validate || validate(recovered)) return { raw: lastGood, value: recovered as T };
      } catch {
        // The last-known-good candidate is also unusable; return the caller's
        // typed fallback without publishing a partial object.
      }
    }
    return { raw: null, value: fallback };
  }
}

export async function quotaSafeGetJsonItem<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): Promise<T> {
  return (await quotaSafeGetJsonItemWithRaw(key, fallback, validate)).value;
}

export async function quotaSafeRemoveItem(key: string): Promise<void> {
  const activePointer = decodePointer(await AsyncStorage.getItem(key).catch(() => null));
  await Promise.all([
    activePointer ? FileSystem.deleteAsync(activePointer.path, { idempotent: true }).catch(() => undefined) : Promise.resolve(),
    AsyncStorage.removeItem(key).catch(() => undefined),
    AsyncStorage.removeItem(`${key}${LAST_GOOD_SUFFIX}`).catch(() => undefined),
    AsyncStorage.removeItem(`${key}${CORRUPT_SUFFIX}`).catch(() => undefined),
    idbRemoveItem(key),
    idbRemoveItem(`${key}${LAST_GOOD_SUFFIX}`),
    removeNativeFiles(key),
    removeNativeFiles(`${key}${LAST_GOOD_SUFFIX}`),
  ]);
}
