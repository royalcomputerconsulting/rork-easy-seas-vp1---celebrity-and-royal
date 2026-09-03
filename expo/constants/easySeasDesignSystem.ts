export const SEA_PASS_COLORS = {
  celebrity: { preview: '#55742C', classic: '#3D87BF', select: '#D96B38', elite: '#58585B', elitePlus: '#822A25', zenith: '#2B2930' },
  crownAnchor: { gold: '#E6B63D', platinum: '#BFC4CC', emerald: '#4EC0A5', diamond: '#3E84D9', diamondPlus: '#5A43D6', pinnacle: '#273D9A' },
  clubRoyale: { choice: '#D87924', prime: '#8A1FD1', signature: '#2C1D9A', masters: '#22201E' },
  blueChip: { pearl: '#E7E7E4', onyx: '#4A4A4A', amethyst: '#8C3FC8', sapphire: '#2F8EEB', sapphirePlus: '#5067D8', ruby: '#D83A4A' },
} as const;

export const EASY_SEAS_TOKENS = {
  color: {
    background: '#F7F9FA', surface: '#FFFFFF', surfaceAlt: '#DFF2EF', border: '#D9E1E6',
    text: '#17212B', muted: '#66737F', navy: '#17324D', deepBlue: '#123D73', deepNavy: '#0B2740',
    teal: '#0E7FA7', oceanTeal: '#167C80', sky: '#DCECF4', ivory: '#FFFDF9', seafoam: '#DFF2EF', sand: '#F5F1E8',
    success: '#16755F', warning: '#A46000', error: '#A52B34', info: '#3E84D9', estimated: '#6B4BB6',
    exact: '#16755F', inferred: '#3E84D9', unresolved: '#A52B34', focus: '#E6B63D', overlay: 'rgba(15,34,71,.58)',
  },
  space: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 40 },
  radius: { xs: 6, sm: 8, md: 13, lg: 18, xl: 24, pill: 999 },
  type: { micro: 10, caption: 11, supporting: 13, body: 15, emphasized: 17, title: 22, hero: 30, display: 38 },
  weight: { regular: '400', medium: '600', strong: '800', black: '900' },
  control: { minimum: 44, large: 54 },
  motion: { quick: 140, standard: 220, progress: 320 },
  elevation: { card: { shadowColor: '#0F2247', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 } },
} as const;

export const EASY_SEAS_THEME = {
  light: {
    background: '#F7F9FA', surface: '#FFFFFF', surfaceRaised: '#FFFFFF', surfaceMuted: '#DFF2EF',
    text: '#17212B', muted: '#66737F', border: '#D9E1E6', accent: '#17324D', accentSecondary: '#167C80',
    heroText: '#0F2247', inverseText: '#FFFFFF', track: '#DDE5E7', overlay: 'rgba(15,34,71,.56)',
    pageGradient: ['#EDF7F6', '#F7F9FA', '#F5F1E8'] as const,
  },
  dark: {
    background: '#071624', surface: '#102536', surfaceRaised: '#153044', surfaceMuted: '#0B2031',
    text: '#F7FAFC', muted: '#BECCD5', border: '#2D485B', accent: '#6ED4C6', accentSecondary: '#72C7E7',
    heroText: '#FFFFFF', inverseText: '#071624', track: '#294354', overlay: 'rgba(3,12,22,.68)',
    pageGradient: ['#071624', '#0A2132', '#0D2637'] as const,
  },
  highContrast: {
    background: '#000000', surface: '#000000', surfaceRaised: '#101010', surfaceMuted: '#000000',
    text: '#FFFFFF', muted: '#FFFFFF', border: '#FFFFFF', accent: '#FFD84D', accentSecondary: '#73E5FF',
    heroText: '#FFFFFF', inverseText: '#000000', track: '#404040', overlay: 'rgba(0,0,0,.82)',
    pageGradient: ['#000000', '#000000', '#000000'] as const,
  },
} as const;

export type EasySeasThemeMode = 'system' | 'light' | 'dark' | 'high-contrast';
export type EasySeasDensity = 'comfortable' | 'simplified';
export type EasySeasTextScale = 'system' | 'large' | 'extra-large';
export type EasySeasChartMode = 'tier' | 'color-blind-safe';

export interface ExperiencePreferences {
  theme: EasySeasThemeMode;
  density: EasySeasDensity;
  reducedMotion: boolean;
  largeControls: boolean;
  textScale: EasySeasTextScale;
  chartMode: EasySeasChartMode;
}

export const DEFAULT_EXPERIENCE_PREFERENCES: ExperiencePreferences = {
  theme: 'system', density: 'comfortable', reducedMotion: false, largeControls: false,
  textScale: 'system', chartMode: 'color-blind-safe',
};

export const CHART_PALETTE = ['#273D9A', '#D87924', '#4EC0A5', '#8C3FC8', '#D83A4A', '#3D87BF'];
export const COLOR_BLIND_SAFE_CHART_PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#F0E442', '#000000'];

export const STATUS_PRESENTATION = {
  success: { color: '#16755F', label: 'Complete', symbol: '✓' },
  warning: { color: '#A46000', label: 'Needs attention', symbol: '!' },
  error: { color: '#A52B34', label: 'Blocked', symbol: '×' },
  info: { color: '#3E84D9', label: 'Information', symbol: 'i' },
  estimated: { color: '#6B4BB6', label: 'Estimated', symbol: '≈' },
  missing: { color: '#676A70', label: 'Not recorded', symbol: '—' },
} as const;

export function getTextScaleMultiplier(scale: EasySeasTextScale): number {
  return scale === 'extra-large' ? 1.35 : scale === 'large' ? 1.18 : 1;
}
