import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_STORAGE_KEYS } from './storageKeys';

export async function clearAllAppData(): Promise<{
  success: boolean;
  clearedKeys: string[];
  errors: string[];
}> {
  console.log('[StorageOps] Clearing ALL app data...');
  const errors: string[] = [];
  const clearedKeys: string[] = [];

  const hasLaunchedBefore = await AsyncStorage.getItem(ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE);
  const authenticated = await AsyncStorage.getItem(ALL_STORAGE_KEYS.AUTHENTICATED);
  const authEmail = await AsyncStorage.getItem('easyseas_auth_email');
  const emailWhitelist = await AsyncStorage.getItem(ALL_STORAGE_KEYS.EMAIL_WHITELIST);
  console.log('[StorageOps] Preserving authentication state:', { hasLaunchedBefore, authenticated: !!authenticated, email: !!authEmail });

  const allKeys = Object.values(ALL_STORAGE_KEYS);
  const preserveKeys = new Set<string>([
    ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE,
    ALL_STORAGE_KEYS.AUTHENTICATED,
    ALL_STORAGE_KEYS.EMAIL_WHITELIST,
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
      errors.push(`Failed to clear ${key}: ${error}`);
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
      ALL_STORAGE_KEYS.AUTHENTICATED,
      ALL_STORAGE_KEYS.EMAIL_WHITELIST,
      'easyseas_auth_email',
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
          errors.push(`Failed to clear ${key}: ${error}`);
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
  
  if (authenticated) {
    try {
      await AsyncStorage.setItem(ALL_STORAGE_KEYS.AUTHENTICATED, authenticated);
      console.log('[StorageOps] Restored authentication state');
    } catch (error) {
      console.error('[StorageOps] Error restoring authentication:', error);
    }
  }
  
  if (authEmail) {
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

  if (typeof window !== 'undefined') {
    console.log('[StorageOps] Dispatching appDataCleared event');
    window.dispatchEvent(new CustomEvent('appDataCleared'));
  }

  return { success, clearedKeys, errors };
}
