import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLOUD_BACKUP_ENABLED_STORAGE_KEY = 'easyseas_cloud_backup_enabled_v1';
export const DEFAULT_CLOUD_BACKUP_ENABLED = false;

function parseBooleanFlag(value: string | null | undefined): boolean {
  if (value === undefined || value === null) return DEFAULT_CLOUD_BACKUP_ENABLED;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'enabled';
}

export function isCloudBackupEnabledByEnv(): boolean {
  return parseBooleanFlag(process.env.EXPO_PUBLIC_EASYSEAS_CLOUD_BACKUP_ENABLED);
}

export async function getCloudBackupEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(CLOUD_BACKUP_ENABLED_STORAGE_KEY);
    if (stored !== null) return parseBooleanFlag(stored);
  } catch (error) {
    console.warn('[LocalFirstMode] Could not read cloud backup setting; defaulting to local-first mode', error);
  }
  return isCloudBackupEnabledByEnv();
}

export async function setCloudBackupEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CLOUD_BACKUP_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function describeLocalFirstMode(): string {
  return isCloudBackupEnabledByEnv()
    ? 'Cloud backup is enabled by environment configuration.'
    : 'Local-first mode is enabled by default; Render/backend cloud backup is optional and off.';
}
