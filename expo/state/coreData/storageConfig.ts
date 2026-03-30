import { getUserScopedKey } from '@/lib/storage/storageKeys';

export const BASE_STORAGE_KEYS = {
  CRUISES: 'easyseas_cruises',
  BOOKED_CRUISES: 'easyseas_booked_cruises',
  CASINO_OFFERS: 'easyseas_casino_offers',
  CALENDAR_EVENTS: 'easyseas_calendar_events',
  LAST_SYNC: 'easyseas_last_sync',
  SETTINGS: 'easyseas_settings',
  USER_POINTS: 'easyseas_user_points',
  CLUB_PROFILE: 'easyseas_club_profile',
  REMOVED_MOCK_CRUISES: 'easyseas_removed_mock_cruises',
  HAS_IMPORTED_DATA: 'easyseas_has_imported_data',
  CRUISE_DATA_VERSION: 'easyseas_cruise_data_version',
} as const;

export type StorageKeyName = keyof typeof BASE_STORAGE_KEYS;

export function getScopedStorageKeys(email: string | null): Record<StorageKeyName, string> {
  const scoped = {} as Record<StorageKeyName, string>;
  for (const [name, baseKey] of Object.entries(BASE_STORAGE_KEYS)) {
    scoped[name as StorageKeyName] = getUserScopedKey(baseKey, email);
  }
  return scoped;
}

export const STORAGE_KEYS = BASE_STORAGE_KEYS;

export const CURRENT_CRUISE_DATA_VERSION = '2';

export interface AppSettings {
  showTaxesInList: boolean;
  showPricePerNight: boolean;
  priceDropAlerts: boolean;
  dailySummaryNotifications?: boolean;
  theme?: 'system' | 'light' | 'dark';
  currency: string;
  pointsPerDay?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showTaxesInList: true,
  showPricePerNight: true,
  priceDropAlerts: true,
  dailySummaryNotifications: false,
  theme: 'system',
  currency: 'USD',
  pointsPerDay: 0,
};
