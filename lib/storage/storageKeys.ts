export const ALL_STORAGE_KEYS = {
  CRUISES: 'easyseas_cruises',
  BOOKED_CRUISES: 'easyseas_booked_cruises',
  CASINO_OFFERS: 'easyseas_casino_offers',
  CALENDAR_EVENTS: 'easyseas_calendar_events',
  CASINO_SESSIONS: 'easyseas_casino_sessions',
  LAST_SYNC: 'easyseas_last_sync',
  SETTINGS: 'easyseas_settings',
  LOCAL_DATA: 'easyseas_local_data',
  USER_POINTS: 'easyseas_user_points',
  CLUB_PROFILE: 'easyseas_club_profile',
  MANUAL_CLUB_ROYALE_POINTS: 'easyseas_manual_club_royale_points',
  MANUAL_CROWN_ANCHOR_POINTS: 'easyseas_manual_crown_anchor_points',
  CERTIFICATES: '@easyseas_certificates',
  USERS: 'easyseas_users',
  CURRENT_USER: 'easyseas_current_user',
  ALERTS: 'easyseas_alerts',
  ALERT_RULES: 'easyseas_alert_rules',
  MACHINE_ENCYCLOPEDIA: 'easyseas_machine_encyclopedia',
  MY_SLOT_ATLAS: 'easyseas_my_slot_atlas',
  REMOVED_MOCK_CRUISES: 'easyseas_removed_mock_cruises',
  HAS_IMPORTED_DATA: 'easyseas_has_imported_data',
  AUTHENTICATED: 'easyseas_authenticated',
  EMAIL_WHITELIST: 'easyseas_email_whitelist',
  HAS_LAUNCHED_BEFORE: 'easyseas_has_launched_before',
  CELEBRITY_EMAIL: 'easyseas_celebrity_email',
  CELEBRITY_CAPTAINS_CLUB_NUMBER: 'easyseas_celebrity_captains_club_number',
  CELEBRITY_CAPTAINS_CLUB_POINTS: 'easyseas_celebrity_captains_club_points',
  CELEBRITY_BLUE_CHIP_POINTS: 'easyseas_celebrity_blue_chip_points',
  PREFERRED_BRAND: 'easyseas_preferred_brand',
} as const;

export const STORAGE_KEYS = ALL_STORAGE_KEYS;

export interface AppSettings {
  showTaxesInList: boolean;
  showPricePerNight: boolean;
  priceDropAlerts: boolean;
  dailySummaryNotifications?: boolean;
  theme?: 'system' | 'light' | 'dark';
  currency: string;
  pointsPerDay?: number;
}
