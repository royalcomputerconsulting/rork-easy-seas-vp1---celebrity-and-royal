/**
 * "Dark Royal" theme — a deep navy + gold/amber visual language inspired by
 * Crown & Anchor loyalty branding (crowns, anchors, tiered progress). This is
 * an alternate skin to the light `casinoDashboardTheme`. Sections opt in one
 * at a time by importing from here instead of (or alongside) the light theme,
 * so we can roll the new look out gradually without breaking screens that
 * haven't been converted yet.
 */
import { StyleSheet } from 'react-native';

export const DARK_ROYAL_COLORS = {
  // Backgrounds
  background: '#0A1533',
  backgroundGradientTop: '#0D1B40',
  backgroundGradientBottom: '#081029',
  card: '#101F45',
  cardAlt: '#0C1936',
  sidebar: '#0B1739',
  border: '#1F2E5C',
  borderStrong: '#2A3C6E',

  // Gold / amber accents (loyalty, positive highlight, primary CTA)
  gold: '#F0B429',
  goldBright: '#FBCB4B',
  goldDim: '#8A6A1E',
  goldText: '#F5C94F',

  // Blues (secondary accent, links, "in progress")
  royalBlue: '#2F6FEB',
  brightBlue: '#4C8DFF',
  skyBlue: '#7FB3FF',

  // Status colors
  green: '#33C77E',
  red: '#F0546A',
  orange: '#F0B429',
  purple: '#9B7BF0',
  teal: '#2FD3C9',

  // Text
  textPrimary: '#F5F7FB',
  textSecondary: '#93A0C4',
  textMuted: '#5F6D93',
  white: '#FFFFFF',

  // Aliases matching the light `casinoDashboardTheme` key names, so screens
  // can switch themes with a single aliased import (`DARK_ROYAL_COLORS as
  // CASINO_DASHBOARD_COLORS`) instead of rewriting every color reference.
  deepNavy: '#F5F7FB',
  softNavy: '#B9C6E8',
  darkText: '#F5F7FB',
  mutedText: '#93A0C4',
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
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
    color: DARK_ROYAL_COLORS.textPrimary,
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
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
    color: DARK_ROYAL_COLORS.textPrimary,
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
