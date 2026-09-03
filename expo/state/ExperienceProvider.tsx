import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';
import { useAuth } from '@/state/AuthProvider';
import {
  CHART_PALETTE,
  COLOR_BLIND_SAFE_CHART_PALETTE,
  DEFAULT_EXPERIENCE_PREFERENCES,
  EASY_SEAS_THEME,
  EASY_SEAS_TOKENS,
  getTextScaleMultiplier,
  type ExperiencePreferences,
} from '@/constants/easySeasDesignSystem';
import { loadExperiencePreferences, saveExperiencePreferences } from '@/lib/experience/experiencePreferences';

type ResolvedTheme = (typeof EASY_SEAS_THEME)[keyof typeof EASY_SEAS_THEME];

interface ExperienceContextValue {
  ownerId: string;
  preferences: ExperiencePreferences;
  colors: ResolvedTheme;
  isDark: boolean;
  textScale: number;
  minimumControlSize: number;
  chartPalette: readonly string[];
  motionDuration: (duration?: number) => number;
  updatePreferences: (patch: Partial<ExperiencePreferences>) => Promise<void>;
  reloadPreferences: () => Promise<void>;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const { authenticatedEmail } = useAuth();
  const systemScheme = useColorScheme();
  const ownerId = authenticatedEmail?.trim().toLowerCase() || 'local-default';
  const [preferences, setPreferences] = useState(DEFAULT_EXPERIENCE_PREFERENCES);

  const reloadPreferences = useCallback(async () => {
    setPreferences(await loadExperiencePreferences(ownerId));
  }, [ownerId]);

  useEffect(() => { void reloadPreferences(); }, [reloadPreferences]);
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (enabled) setPreferences((current) => ({ ...current, reducedMotion: true }));
    });
    return () => subscription.remove();
  }, []);

  const updatePreferences = useCallback(async (patch: Partial<ExperiencePreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    await saveExperiencePreferences(ownerId, next);
    // React Native Web exposes Appearance without the native-only setter.
    // The provider's resolved palette already applies the selected theme on
    // every platform, so only ask the operating system to follow it where the
    // setter actually exists.
    if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
      if (patch.theme === 'light' || patch.theme === 'dark') Appearance.setColorScheme(patch.theme);
      if (patch.theme === 'system') Appearance.setColorScheme(null);
    }
  }, [ownerId, preferences]);

  const value = useMemo<ExperienceContextValue>(() => {
    const resolvedMode = preferences.theme === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : preferences.theme === 'high-contrast' ? 'highContrast' : preferences.theme;
    const colors = EASY_SEAS_THEME[resolvedMode];
    return {
      ownerId,
      preferences,
      colors,
      isDark: resolvedMode !== 'light',
      textScale: getTextScaleMultiplier(preferences.textScale),
      minimumControlSize: preferences.largeControls ? EASY_SEAS_TOKENS.control.large : EASY_SEAS_TOKENS.control.minimum,
      chartPalette: preferences.chartMode === 'color-blind-safe' ? COLOR_BLIND_SAFE_CHART_PALETTE : CHART_PALETTE,
      motionDuration: (duration = EASY_SEAS_TOKENS.motion.standard) => preferences.reducedMotion ? 0 : duration,
      updatePreferences,
      reloadPreferences,
    };
  }, [ownerId, preferences, systemScheme, updatePreferences, reloadPreferences]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceContextValue {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('useExperience must be used inside ExperienceProvider');
  return value;
}
