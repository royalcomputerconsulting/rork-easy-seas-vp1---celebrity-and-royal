import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_HEALTHCHECK_KEY = '@easyseas_storage_healthcheck';
const STORAGE_OPERATION_TIMEOUT_MS = 1500;

function withStorageTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`[StorageRecovery] ${label} timed out after ${STORAGE_OPERATION_TIMEOUT_MS}ms`)), STORAGE_OPERATION_TIMEOUT_MS);
  });
  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function getStorageErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isStorageMigrationFailure(error: unknown): boolean {
  const normalizedMessage = getStorageErrorMessage(error).toLowerCase();
  return normalizedMessage.includes('migration failed')
    || normalizedMessage.includes('failed to migrate')
    || (normalizedMessage.includes('asyncstorage') && normalizedMessage.includes('database'))
    || (normalizedMessage.includes('sqlite') && normalizedMessage.includes('-1'));
}

async function runStorageHealthcheck(): Promise<void> {
  // Read-only by design: if the native driver stalls, no late mutation can
  // continue after the fail-open timeout. Authoritative writes always use the
  // persistence coordinator instead.
  await AsyncStorage.getItem(STORAGE_HEALTHCHECK_KEY);
}

export interface StorageHealthResult {
  healthy: boolean;
  recovered: boolean;
  errorMessage: string | null;
}

export async function ensureStorageHealthy(): Promise<StorageHealthResult> {
  try {
    await withStorageTimeout(runStorageHealthcheck(), 'non-destructive healthcheck');
    return { healthy: true, recovered: false, errorMessage: null };
  } catch (error) {
    const errorMessage = getStorageErrorMessage(error);
    console.warn('[StorageRecovery] Storage check failed; app will continue in safe local mode without deleting data:', errorMessage);
    return { healthy: false, recovered: false, errorMessage };
  }
}
