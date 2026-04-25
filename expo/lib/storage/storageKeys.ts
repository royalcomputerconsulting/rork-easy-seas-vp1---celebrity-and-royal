const _noEmailWarnedKeys = new Set<string>();

export function getUserScopedKey(baseKey: string, email: string | null): string {
  if (!email) {
    if (!_noEmailWarnedKeys.has(baseKey)) {
      _noEmailWarnedKeys.add(baseKey);
      console.log('[StorageKeys] No email yet for scoped key (initial load):', baseKey);
    }
    return `${baseKey}::__no_user__`;
  }
  const normalizedEmail = email.toLowerCase().trim();
  return `${baseKey}::${normalizedEmail}`;
}

export function getScopedKeys(email: string | null): Record<keyof typeof ALL_STORAGE_KEYS, string> {
  const scoped = {} as Record<string, string>;
  for (const [name, baseKey] of Object.entries(ALL_STORAGE_KEYS)) {
    if (GLOBAL_KEYS.has(baseKey)) {
      scoped[name] = baseKey;
    } else {
      scoped[name] = getUserScopedKey(baseKey, email);
    }
  }
  return scoped as Record<keyof typeof ALL_STORAGE_KEYS, string>;
}

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
  
  CROWN_ANCHOR_TIER: 'easyseas_crown_anchor_tier',
  CLUB_ROYALE_TIER: 'easyseas_club_royale_tier',
  VENETIAN_SOCIETY_TIER: 'easyseas_venetian_society_tier',
  VENETIAN_SOCIETY_MEMBER_NUMBER: 'easyseas_venetian_society_member_number',
  VENETIAN_SOCIETY_ENROLLED: 'easyseas_venetian_society_enrolled',
  LOYALTY_ACCOUNT_ID: 'easyseas_loyalty_account_id',
  CROWN_ANCHOR_ID: 'easyseas_crown_anchor_id',
  EXTENDED_LOYALTY_DATA: 'easyseas_extended_loyalty_data',
  CREW_RECOGNITION_ENTRIES: 'crew_recognition_entries_v2',
  CREW_RECOGNITION_SAILINGS: 'crew_recognition_sailings_v2',
  BANKROLL_LIMITS: 'easyseas_bankroll',
  BANKROLL_ALERTS: 'easyseas_bankroll_alerts',
  BANKROLL_DATA: 'easyseas_bankroll_data',
  LOYALTY_DATA: 'easyseas_loyalty_data',
  USER_SLOT_MACHINES: '@easyseas/user_slot_machines',
  DECK_PLAN_LOCATIONS: '@easyseas/deck_plan_locations',
  MACHINE_SETTINGS: '@easyseas/machine_settings',
  FAVORITE_STATEROOMS: 'easyseas_favorite_staterooms',
  CASINO_OPEN_HOURS: 'easyseas_casino_open_hours',
  COMP_ITEMS: '@easyseas/compItems',
  W2G_RECORDS: '@easyseas/w2gRecords',
} as const;

export const GLOBAL_KEYS = new Set<string>([
  ALL_STORAGE_KEYS.AUTHENTICATED,
  ALL_STORAGE_KEYS.EMAIL_WHITELIST,
  ALL_STORAGE_KEYS.HAS_LAUNCHED_BEFORE,
  ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA,
]);

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
