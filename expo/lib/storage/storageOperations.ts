import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_STORAGE_KEYS, GLOBAL_KEYS } from './storageKeys';

const AUTH_PRESERVE_KEYS = new Set<string>([
  ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE,
  ALL_STORAGE_KEYS.AUTHENTICATED,
  ALL_STORAGE_KEYS.EMAIL_WHITELIST,
  ALL_STORAGE_KEYS.USERS,
  ALL_STORAGE_KEYS.CURRENT_USER,
  'easyseas_auth_email',
  'easyseas_authenticated',
  'easyseas_fresh_start',
  'easyseas_pending_account_switch',
]);

export async function clearUserSpecificData(): Promise<void> {
  console.log('[StorageOps] Clearing user-specific data for account switch (scoped keys mean this is now a safety net)...');
  
  try {
    const allStoredKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allStoredKeys.filter(key => {
      if (AUTH_PRESERVE_KEYS.has(key)) return false;
      if (key === ALL_STORAGE_KEYS.USERS || key === ALL_STORAGE_KEYS.CURRENT_USER) return true;
      if (GLOBAL_KEYS.has(key)) return false;
      if (key.includes('::')) return false;
      if (key.startsWith('easyseas') || key.startsWith('@easyseas') || key.startsWith('crew_recognition')) {
        return true;
      }
      return false;
    });

    for (const key of keysToRemove) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error(`[StorageOps] Error removing ${key}:`, error);
      }
    }

    console.log('[StorageOps] Cleared', keysToRemove.length, 'legacy unscoped keys for account switch');
  } catch (error) {
    console.error('[StorageOps] Error scanning keys:', error);
  }

  try {
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      console.log('[StorageOps] Dispatching appDataCleared event for account switch');
      window.dispatchEvent(new CustomEvent('appDataCleared'));
    }
  } catch (e) {
    console.log('[StorageOps] Could not dispatch appDataCleared event:', e);
  }
}

interface ClearAllAppDataOptions {
  preserveAuth?: boolean;
}

export async function clearAllAppData(options: ClearAllAppDataOptions = {}): Promise<{
  success: boolean;
  clearedKeys: string[];
  errors: string[];
}> {
  const { preserveAuth = false } = options;
  console.log('[StorageOps] Clearing ALL app data...', { preserveAuth });
  const errors: string[] = [];
  const clearedKeys: string[] = [];

  const hasLaunchedBefore = await AsyncStorage.getItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE);
  const authenticated = preserveAuth ? await AsyncStorage.getItem(ALL_STORAGE_KEYS.AUTHENTICATED) : null;
  const authEmail = preserveAuth ? await AsyncStorage.getItem('easyseas_auth_email') : null;
  const emailWhitelist = await AsyncStorage.getItem(ALL_STORAGE_KEYS.EMAIL_WHITELIST);
  console.log('[StorageOps] Preserved keys snapshot:', { hasLaunchedBefore: !!hasLaunchedBefore, authenticated: !!authenticated, email: !!authEmail, hasWhitelist: !!emailWhitelist });

  const allKeys = Object.values(ALL_STORAGE_KEYS);
  const preserveKeys = new Set<string>([
    ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE,
    ALL_STORAGE_KEYS.EMAIL_WHITELIST,
    ...(preserveAuth ? [ALL_STORAGE_KEYS.AUTHENTICATED] : []),
  ]);

  for (const key of allKeys) {
    if (preserveKeys.has(key)) {
      console.log(`[StorageOps] Skipping ${key} (preserved for persistence)`);
      continue;
    }
    try {
      await AsyncStorage.removeItem(key);
      clearedKeys.push(key);
      console.log(`[StorageOps] Cleared: ${key}`);
    } catch (error) {
      errors.push(`Failed to clear ${key}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[StorageOps] Error clearing ${key}:`, error);
    }
  }

  try {
    const additionalKeys = await AsyncStorage.getAllKeys();
    const easySeaKeys = additionalKeys.filter(
      key => key.startsWith('easyseas') || key.startsWith('@easyseas') || key.startsWith('crew_recognition')
    );
    
    const preserveAdditionalKeys = new Set<string>([
      ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE,
      ALL_STORAGE_KEYS.EMAIL_WHITELIST,
      ...(preserveAuth ? [
        ALL_STORAGE_KEYS.AUTHENTICATED,
        'easyseas_auth_email',
        'easyseas_fresh_start',
        'easyseas_pending_account_switch',
      ] : []),
    ]);
    
    for (const key of easySeaKeys) {
      if (preserveAdditionalKeys.has(key)) {
        console.log(`[StorageOps] Skipping additional key ${key} (preserved for persistence)`);
        continue;
      }
      if (!clearedKeys.includes(key)) {
        try {
          await AsyncStorage.removeItem(key);
          clearedKeys.push(key);
          console.log(`[StorageOps] Cleared additional key: ${key}`);
        } catch (error) {
          errors.push(`Failed to clear ${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  } catch (error) {
    console.error('[StorageOps] Error getting additional keys:', error);
  }

  if (hasLaunchedBefore) {
    try {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE, hasLaunchedBefore);
      console.log('[StorageOps] Restored HAS_LAUNCHED_BEFORE flag');
    } catch (error) {
      console.error('[StorageOps] Error restoring HAS_LAUNCHED_BEFORE flag:', error);
    }
  }
  
  if (preserveAuth && authenticated) {
    try {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.AUTHENTICATED, authenticated);
      console.log('[StorageOps] Restored authentication state');
    } catch (error) {
      console.error('[StorageOps] Error restoring authentication:', error);
    }
  }
  
  if (preserveAuth && authEmail) {
    try {
      await AsyncStorage.setItem('easyseas_auth_email', authEmail);
      console.log('[StorageOps] Restored auth email');
    } catch (error) {
      console.error('[StorageOps] Error restoring auth email:', error);
    }
  }
  
  if (emailWhitelist) {
    try {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.EMAIL_WHITELIST, emailWhitelist);
      console.log('[StorageOps] Restored email whitelist');
    } catch (error) {
      console.error('[StorageOps] Error restoring email whitelist:', error);
    }
  }

  const success = errors.length === 0;
  console.log('[StorageOps] Clear complete:', { 
    success, 
    clearedCount: clearedKeys.length, 
    errorCount: errors.length 
  });

  try {
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      console.log('[StorageOps] Dispatching appDataCleared event');
      window.dispatchEvent(new CustomEvent('appDataCleared'));
    }
  } catch (e) {
    console.log('[StorageOps] Could not dispatch appDataCleared event:', e);
  }

  return { success, clearedKeys, errors };
}
