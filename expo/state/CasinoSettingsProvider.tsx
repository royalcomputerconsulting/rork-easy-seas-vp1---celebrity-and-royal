import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';

/** Which slice of casino data a screen should currently display. */
export type CasinoViewMode = 'combined' | 'actual-only' | 'estimated-only';

export interface CasinoSettings {
  pointDollarValue: number;
  voomDailyPrice: number;
  voomDeviceCount: number;
  defaultPointsPerHour: number;
  defaultCasinoHoursPerDay: number;
  defaultHouseEdge: number;
  defaultStopLoss: number;
  signatureObcAmount: number;
  signatureObcStartDate: string;
  signatureObcEndDate: string;
  countFreePlayInValue: boolean;
  projectionScenario: 'conservative' | 'base' | 'aggressive';
}

export const DEFAULT_CASINO_SETTINGS: CasinoSettings = {
  pointDollarValue: 0.01,
  voomDailyPrice: 30,
  voomDeviceCount: 1,
  defaultPointsPerHour: 400,
  defaultCasinoHoursPerDay: 4,
  defaultHouseEdge: 0.08,
  defaultStopLoss: 300,
  signatureObcAmount: 75,
  signatureObcStartDate: '2025-01-01',
  signatureObcEndDate: '2026-02-28',
  countFreePlayInValue: true,
  projectionScenario: 'base',
};

const BASE_SETTINGS_KEY = 'easyseas_casino_settings';
const BASE_VIEW_MODE_KEY = 'easyseas_casino_view_mode';

interface CasinoSettingsState {
  settings: CasinoSettings;
  viewMode: CasinoViewMode;
  isLoading: boolean;
  updateSettings: (updates: Partial<CasinoSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  setViewMode: (mode: CasinoViewMode) => Promise<void>;
}

/**
 * Editable casino assumptions (Stage 9.1, checklist item 97) + the
 * Actual/Estimated/Combined view toggle (checklist item 98). Every
 * calculation that currently hardcodes one of these values (point value,
 * VOOM pricing, default PPH, house edge, stop-loss, Signature OBC) can read
 * from here going forward without changing behavior for anyone who hasn't
 * customized it, since the defaults match what's already used today.
 */
export const [CasinoSettingsProvider, useCasinoSettings] = createContextHook((): CasinoSettingsState => {
  const { authenticatedEmail } = useAuth();
  const [settings, setSettings] = useState<CasinoSettings>(DEFAULT_CASINO_SETTINGS);
  const [viewMode, setViewModeState] = useState<CasinoViewMode>('combined');
  const [isLoading, setIsLoading] = useState(true);

  const settingsKey = useMemo(() => getUserScopedKey(BASE_SETTINGS_KEY, authenticatedEmail), [authenticatedEmail]);
  const viewModeKey = useMemo(() => getUserScopedKey(BASE_VIEW_MODE_KEY, authenticatedEmail), [authenticatedEmail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const [storedSettings, storedViewMode] = await Promise.all([
          AsyncStorage.getItem(settingsKey),
          AsyncStorage.getItem(viewModeKey),
        ]);
        if (cancelled) return;
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings) as Partial<CasinoSettings>;
          setSettings({ ...DEFAULT_CASINO_SETTINGS, ...parsed });
        } else {
          setSettings(DEFAULT_CASINO_SETTINGS);
        }
        if (storedViewMode === 'combined' || storedViewMode === 'actual-only' || storedViewMode === 'estimated-only') {
          setViewModeState(storedViewMode);
        } else {
          setViewModeState('combined');
        }
      } catch (error) {
        console.error('[CasinoSettingsProvider] Failed to load settings:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsKey, viewModeKey]);

  const updateSettings = useCallback(async (updates: Partial<CasinoSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(settingsKey, JSON.stringify(next)).catch((error) =>
        console.error('[CasinoSettingsProvider] Failed to persist settings:', error),
      );
      return next;
    });
  }, [settingsKey]);

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_CASINO_SETTINGS);
    await AsyncStorage.setItem(settingsKey, JSON.stringify(DEFAULT_CASINO_SETTINGS));
  }, [settingsKey]);

  const setViewMode = useCallback(async (mode: CasinoViewMode) => {
    setViewModeState(mode);
    await AsyncStorage.setItem(viewModeKey, mode);
  }, [viewModeKey]);

  return useMemo(() => ({
    settings,
    viewMode,
    isLoading,
    updateSettings,
    resetSettings,
    setViewMode,
  }), [settings, viewMode, isLoading, updateSettings, resetSettings, setViewMode]);
});
