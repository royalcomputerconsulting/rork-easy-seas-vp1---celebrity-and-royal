import AsyncStorage from '@react-native-async-storage/async-storage';

export type LoyaltyCardBrand = 'royal' | 'celebrity' | 'silversea' | 'carnival';

const STORAGE_PREFIX = '@easyseas_offers_loyalty_card_brand_v1:';
const memoryPreferences = new Map<string, LoyaltyCardBrand>();

export function isLoyaltyCardBrand(value: unknown): value is LoyaltyCardBrand {
  return value === 'royal' || value === 'celebrity' || value === 'silversea' || value === 'carnival';
}

export function getLoyaltyCardBrandPreferenceKey(profileId: string): string {
  const normalizedProfileId = String(profileId || '__default__').trim() || '__default__';
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizedProfileId)}`;
}

export function getCachedLoyaltyCardBrandPreference(profileId: string): LoyaltyCardBrand | null {
  return memoryPreferences.get(getLoyaltyCardBrandPreferenceKey(profileId)) ?? null;
}

export async function loadLoyaltyCardBrandPreference(
  profileId: string,
  fallback: LoyaltyCardBrand,
): Promise<LoyaltyCardBrand> {
  const key = getLoyaltyCardBrandPreferenceKey(profileId);
  const cached = memoryPreferences.get(key);
  if (cached) return cached;

  const stored = await AsyncStorage.getItem(key).catch(() => null);
  // A tap may have occurred while the native read was pending. The user's most
  // recent in-memory choice always wins that race.
  const selectedWhileLoading = memoryPreferences.get(key);
  if (selectedWhileLoading) return selectedWhileLoading;

  const resolved = isLoyaltyCardBrand(stored) ? stored : fallback;
  memoryPreferences.set(key, resolved);
  return resolved;
}

export async function saveLoyaltyCardBrandPreference(
  profileId: string,
  brand: LoyaltyCardBrand,
): Promise<void> {
  const key = getLoyaltyCardBrandPreferenceKey(profileId);
  memoryPreferences.set(key, brand);
  await AsyncStorage.setItem(key, brand);
}
