export const STORAGE_KEYS = {
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
};

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
