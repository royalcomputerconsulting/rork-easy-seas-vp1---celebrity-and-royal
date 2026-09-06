import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';
import { DEFAULT_EXPERIENCE_PREFERENCES, type ExperiencePreferences } from '@/constants/easySeasDesignSystem';

const normalizeOwner = (owner: string) => owner.trim().toLowerCase() || 'local-default';
const key = (owner: string) => `@easyseas/experiencePreferences/v1::${normalizeOwner(owner)}`;
const OWNER_PREFERENCE_PREFIXES = ['@easyseas/experiencePreferences/', '@easyseas/disclosure/', '@easyseas/actionInboxDecisions/', '@easyseas/relationshipCorrections/', '@easyseas/lifecycleHomePreferences', '@easyseas/savedWatchlists/'];
const GLOBAL_PREFERENCE_KEYS = new Set(['@easyseas/operatingCenterPreferences/v1', '@easyseas/lifecycleHomePreferences', '@easyseas/intelligenceFilters', '@easyseas/priceMonitorPreferences', '@easyseas/responsiblePlayLimits']);

export async function loadExperiencePreferences(owner: string): Promise<ExperiencePreferences> {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(key(owner)) || 'null');
    const systemReduced = await AccessibilityInfo.isReduceMotionEnabled();
    return { ...DEFAULT_EXPERIENCE_PREFERENCES, ...saved, reducedMotion: Boolean(saved?.reducedMotion || systemReduced) };
  } catch { return DEFAULT_EXPERIENCE_PREFERENCES; }
}
export async function saveExperiencePreferences(owner: string, value: ExperiencePreferences) { await AsyncStorage.setItem(key(owner), JSON.stringify(value)); }
export const disclosureKey = (owner: string, screen: string, section: string) => `@easyseas/disclosure/v1::${normalizeOwner(owner)}::${screen}::${section}`;
export async function loadDisclosure(owner: string, screen: string, section: string, fallback = false) { const value = await AsyncStorage.getItem(disclosureKey(owner, screen, section)); return value === null ? fallback : value === 'open'; }
export async function saveDisclosure(owner: string, screen: string, section: string, open: boolean) { await AsyncStorage.setItem(disclosureKey(owner, screen, section), open ? 'open' : 'closed'); }

/** Export only UI/decision preferences, never another profile's private data. */
export async function exportUserPreferenceStorage(owner: string): Promise<Record<string, unknown>> {
  const normalized = normalizeOwner(owner); const keys = await AsyncStorage.getAllKeys();
  const selected = keys.filter((storageKey) => GLOBAL_PREFERENCE_KEYS.has(storageKey) || (OWNER_PREFERENCE_PREFIXES.some((prefix) => storageKey.startsWith(prefix)) && storageKey.toLowerCase().includes(normalized)));
  const rows = await AsyncStorage.multiGet(selected); const result: Record<string, unknown> = {};
  rows.forEach(([storageKey, raw]) => { if (raw === null) return; try { result[storageKey] = JSON.parse(raw); } catch { result[storageKey] = raw; } });
  return result;
}

/** Restore only allow-listed preference records; typed domain importers handle private app data. */
export async function restoreUserPreferenceStorage(owner: string, records: Record<string, unknown>): Promise<number> {
  const normalized = normalizeOwner(owner); const rows = Object.entries(records).filter(([storageKey]) => GLOBAL_PREFERENCE_KEYS.has(storageKey) || (OWNER_PREFERENCE_PREFIXES.some((prefix) => storageKey.startsWith(prefix)) && storageKey.toLowerCase().includes(normalized)));
  if (rows.length) await AsyncStorage.multiSet(rows.map(([storageKey, value]) => [storageKey, typeof value === 'string' ? value : JSON.stringify(value)]));
  return rows.length;
}
