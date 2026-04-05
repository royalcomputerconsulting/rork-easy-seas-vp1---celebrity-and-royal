export type FocusThemeName = 'royal' | 'celebrity';

export interface FocusTheme {
  key: FocusThemeName;
  label: string;
  screenGradient: readonly [string, string, string];
  marbleGradient: readonly [string, string, string, string];
  accentGradient: readonly [string, string];
  actionPrimary: string;
  actionSecondary: string;
  actionText: string;
  textPrimary: string;
  textSecondary: string;
  textOnDark: string;
  cardSurface: string;
  panelSurface: string;
  pillSurface: string;
  cardBorder: string;
  pillBorder: string;
  iconSurface: string;
  iconBorder: string;
  marbleVein: string;
  marbleVeinAlt: string;
  highlight: string;
  successTint: string;
}

export const FOCUS_THEMES: Record<FocusThemeName, FocusTheme> = {
  royal: {
    key: 'royal',
    label: 'Royal Caribbean',
    screenGradient: ['#F8F4EC', '#EEF3FB', '#E7EEF9'],
    marbleGradient: ['#FFF9EE', '#F6F8FC', '#EEF4FF', '#FAF1DF'],
    accentGradient: ['#183C72', '#D6A547'],
    actionPrimary: '#183C72',
    actionSecondary: '#D6A547',
    actionText: '#FFFFFF',
    textPrimary: '#173B72',
    textSecondary: '#5F6F87',
    textOnDark: '#FFFFFF',
    cardSurface: 'rgba(255, 255, 255, 0.82)',
    panelSurface: 'rgba(255, 255, 255, 0.68)',
    pillSurface: 'rgba(255, 255, 255, 0.72)',
    cardBorder: 'rgba(24, 60, 114, 0.16)',
    pillBorder: 'rgba(24, 60, 114, 0.14)',
    iconSurface: 'rgba(255, 255, 255, 0.58)',
    iconBorder: 'rgba(24, 60, 114, 0.12)',
    marbleVein: 'rgba(214, 165, 71, 0.14)',
    marbleVeinAlt: 'rgba(24, 60, 114, 0.08)',
    highlight: '#E7B94E',
    successTint: '#A7F3D0',
  },
  celebrity: {
    key: 'celebrity',
    label: 'Celebrity Cruises',
    screenGradient: ['#F3FAFC', '#EAF4FD', '#E6EEF9'],
    marbleGradient: ['#F6FDFF', '#EEF8FF', '#E8F0FB', '#F5FBFF'],
    accentGradient: ['#2C7FA6', '#4367B2'],
    actionPrimary: '#2C7FA6',
    actionSecondary: '#4367B2',
    actionText: '#FFFFFF',
    textPrimary: '#24536E',
    textSecondary: '#627489',
    textOnDark: '#FFFFFF',
    cardSurface: 'rgba(255, 255, 255, 0.84)',
    panelSurface: 'rgba(255, 255, 255, 0.7)',
    pillSurface: 'rgba(255, 255, 255, 0.76)',
    cardBorder: 'rgba(44, 127, 166, 0.18)',
    pillBorder: 'rgba(67, 103, 178, 0.14)',
    iconSurface: 'rgba(255, 255, 255, 0.62)',
    iconBorder: 'rgba(44, 127, 166, 0.12)',
    marbleVein: 'rgba(44, 127, 166, 0.13)',
    marbleVeinAlt: 'rgba(67, 103, 178, 0.08)',
    highlight: '#4BA3C7',
    successTint: '#BAE6FD',
  },
};

export function resolveFocusTheme(brand?: string | null): FocusThemeName {
  return brand === 'celebrity' ? 'celebrity' : 'royal';
}

export function getFocusTheme(brand?: string | null): FocusTheme {
  return FOCUS_THEMES[resolveFocusTheme(brand)];
}
