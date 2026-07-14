import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_HEALTHCHECK_KEY = '@easyseas_storage_healthcheck';

function getStorageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

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
    || normalizedMessage.includes('asyncstorage') && normalizedMessage.includes('database')
    || normalizedMessage.includes('storage') && normalizedMessage.includes('database') && normalizedMessage.includes('-1')
    || normalizedMessage.includes('sqlite') && normalizedMessage.includes('-1');
}

async function runStorageHealthcheck(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_HEALTHCHECK_KEY, 'ok');
  const storedValue = await AsyncStorage.getItem(STORAGE_HEALTHCHECK_KEY);

  if (storedValue !== 'ok') {
    throw new Error('[StorageRecovery] Storage healthcheck value mismatch');
  }

  await AsyncStorage.removeItem(STORAGE_HEALTHCHECK_KEY);
}

async function clearStorageSafely(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();

    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
      return;
    }
  } catch (error) {
    console.error('[StorageRecovery] Failed to enumerate keys before clearing storage:', error);
  }

  await AsyncStorage.clear();
}

export interface StorageHealthResult {
  healthy: boolean;
  recovered: boolean;
  errorMessage: string | null;
}

export async function ensureStorageHealthy(): Promise<StorageHealthResult> {
  try {
    await runStorageHealthcheck();
    console.log('[StorageRecovery] AsyncStorage healthcheck passed');
    return {
      healthy: true,
      recovered: false,
      errorMessage: null,
    };
  } catch (error) {
    console.error('[StorageRecovery] AsyncStorage healthcheck failed:', error);

    if (!isStorageMigrationFailure(error)) {
      return {
        healthy: false,
        recovered: false,
        errorMessage: getStorageErrorMessage(error),
      };
    }

    try {
      console.warn('[StorageRecovery] Detected storage migration failure, clearing local storage and retrying');
      await clearStorageSafely();
      await runStorageHealthcheck();
      console.log('[StorageRecovery] AsyncStorage recovered after local reset');

      return {
        healthy: true,
        recovered: true,
        errorMessage: getStorageErrorMessage(error),
      };
    } catch (recoveryError) {
      console.error('[StorageRecovery] AsyncStorage recovery failed:', recoveryError);
      return {
        healthy: false,
        recovered: false,
        errorMessage: getStorageErrorMessage(recoveryError),
      };
    }
  }
}
