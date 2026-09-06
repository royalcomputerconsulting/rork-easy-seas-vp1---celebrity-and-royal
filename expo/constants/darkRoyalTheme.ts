/**
 * Compatibility theme for screens that historically imported "Dark Royal".
 *
 * Build 445 deliberately maps those semantic names onto the single Easy Seas
 * premium light system.  Keeping the exported shape means old consumers keep
 * every action and layout while full-screen navy panels disappear.  Loyalty
 * and casino tier colors remain bounded accents instead of page surfaces.
 */
import { StyleSheet } from 'react-native';

export const DARK_ROYAL_COLORS = {
  // Backgrounds
  background: '#F3F3F2',
  backgroundGradientTop: '#F3F3F2',
  backgroundGradientBottom: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F5F5F4',
  sidebar: '#FFFFFF',
  border: '#D5D5D0',
  borderStrong: '#BFC4CC',

  // Gold / amber accents (loyalty, positive highlight, primary CTA)
  gold: '#A46000',
  goldBright: '#E6B63D',
  goldDim: '#A46000',
  goldText: '#A46000',

  // Blues (secondary accent, links, "in progress")
  royalBlue: '#1C2F7A',
  brightBlue: '#0E7FA7',
  skyBlue: '#3D87BF',

  // Status colors
  green: '#16755F',
  red: '#A52B34',
  orange: '#D87924',
  purple: '#5A43D6',
  teal: '#0E7FA7',

  // Text
  textPrimary: '#333334',
  textSecondary: '#676A70',
  textMuted: '#8E8A89',
  white: '#FFFFFF',

  // Aliases matching the light `casinoDashboardTheme` key names, so screens
  // can switch themes with a single aliased import (`DARK_ROYAL_COLORS as
  // CASINO_DASHBOARD_COLORS`) instead of rewriting every color reference.
  deepNavy: '#1C2F7A',
  softNavy: '#123D73',
  darkText: '#333334',
  mutedText: '#676A70',
} as const;

/** Semantic helper: pick green/red/text based on a signed money value. */
export function darkRoyalValueColor(value: number, opts?: { neutralIfZero?: boolean }): string {
  if (opts?.neutralIfZero && value === 0) return DARK_ROYAL_COLORS.textPrimary;
  if (value > 0) return DARK_ROYAL_COLORS.green;
  if (value < 0) return DARK_ROYAL_COLORS.red;
  return DARK_ROYAL_COLORS.textPrimary;
}

/** Chart palette used across bar/line/donut charts in the dark royal theme. */
export const DARK_ROYAL_CHART_COLORS = [
  DARK_ROYAL_COLORS.gold,
  DARK_ROYAL_COLORS.brightBlue,
  DARK_ROYAL_COLORS.teal,
  DARK_ROYAL_COLORS.purple,
  DARK_ROYAL_COLORS.green,
] as const;

/**
 * Drop-in replacement for `casinoDashboardStyles` — same shape (card,
 * cardPressed, screenTitle, screenSubtitle, cardLabel, bigNumber) so a
 * screen can swap themes via aliased import only.
 */
export const darkRoyalDashboardStyles = StyleSheet.create({
  card: {
    backgroundColor: DARK_ROYAL_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK_ROYAL_COLORS.border,
    padding: 18,
    shadowColor: '#0F2247',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardPressed: {
    borderColor: DARK_ROYAL_COLORS.gold,
    shadowOpacity: 0.35,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: DARK_ROYAL_COLORS.deepNavy,
  },
  screenSubtitle: {
    fontSize: 13,
    color: DARK_ROYAL_COLORS.textSecondary,
    marginTop: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: DARK_ROYAL_COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  bigNumber: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: DARK_ROYAL_COLORS.textPrimary,
  },
});

export const darkRoyalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DARK_ROYAL_COLORS.background,
  },
  card: {
    backgroundColor: DARK_ROYAL_COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK_ROYAL_COLORS.border,
    padding: 16,
    shadowColor: '#0F2247',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  cardPressed: {
    borderColor: DARK_ROYAL_COLORS.gold,
    shadowOpacity: 0.35,
  },
  sidebarItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: DARK_ROYAL_COLORS.royalBlue,
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: DARK_ROYAL_COLORS.textSecondary,
  },
  sidebarItemTextActive: {
    color: DARK_ROYAL_COLORS.white,
    fontWeight: '700' as const,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: DARK_ROYAL_COLORS.deepNavy,
  },
  screenSubtitle: {
    fontSize: 13,
    color: DARK_ROYAL_COLORS.textSecondary,
    marginTop: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: DARK_ROYAL_COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  bigNumber: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: DARK_ROYAL_COLORS.textPrimary,
  },
  goldNumber: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: DARK_ROYAL_COLORS.goldText,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: DARK_ROYAL_COLORS.borderStrong,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: DARK_ROYAL_COLORS.border,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: DARK_ROYAL_COLORS.cardAlt,
    overflow: 'hidden' as const,
  },
  progressFillGold: {
    height: '100%' as const,
    borderRadius: 4,
    backgroundColor: DARK_ROYAL_COLORS.gold,
  },
  progressFillBlue: {
    height: '100%' as const,
    borderRadius: 4,
    backgroundColor: DARK_ROYAL_COLORS.brightBlue,
  },
});

/** Source-confidence labels reused from the light theme, restyled for dark. */
export type DarkRoyalDataQuality = 'verified' | 'mixed' | 'estimated' | 'missing';

export const DARK_ROYAL_DATA_QUALITY_LABEL: Record<DarkRoyalDataQuality, string> = {
  verified: 'Verified',
  mixed: 'Mixed',
  estimated: 'Estimated',
  missing: 'Missing',
};

export const DARK_ROYAL_DATA_QUALITY_COLOR: Record<DarkRoyalDataQuality, string> = {
  verified: DARK_ROYAL_COLORS.green,
  mixed: DARK_ROYAL_COLORS.orange,
  estimated: DARK_ROYAL_COLORS.skyBlue,
  missing: DARK_ROYAL_COLORS.red,
};
