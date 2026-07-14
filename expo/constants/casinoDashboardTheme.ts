/**
 * Shared visual language for the Casino dashboard v2 (Cruise Value, Casino
 * Action Center, History & Insights, Simulator). Light, Royal Caribbean
 * inspired, financial-dashboard-quality styling used across all four
 * sections so the whole area feels like one cohesive product.
 */
import { StyleSheet } from 'react-native';

export const CASINO_DASHBOARD_COLORS = {
  royalBlue: '#0052CC',
  brightBlue: '#0074FF',
  deepNavy: '#071B4D',
  softNavy: '#102A5C',
  teal: '#13B8B5',
  green: '#12A866',
  purple: '#7A3FF2',
  orange: '#F59E0B',
  red: '#DC2626',
  background: '#F7F9FC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  mutedText: '#64748B',
  darkText: '#0F172A',
} as const;

/** Semantic helper: pick green/red/navy based on a signed money value. */
export function casinoValueColor(value: number, opts?: { neutralIfZero?: boolean }): string {
  if (opts?.neutralIfZero && value === 0) return CASINO_DASHBOARD_COLORS.darkText;
  if (value > 0) return CASINO_DASHBOARD_COLORS.green;
  if (value < 0) return CASINO_DASHBOARD_COLORS.red;
  return CASINO_DASHBOARD_COLORS.darkText;
}

export const casinoDashboardStyles = StyleSheet.create({
  card: {
    backgroundColor: CASINO_DASHBOARD_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.border,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardPressed: {
    borderColor: CASINO_DASHBOARD_COLORS.brightBlue,
    shadowOpacity: 0.08,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.deepNavy,
  },
  screenSubtitle: {
    fontSize: 13,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    marginTop: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: CASINO_DASHBOARD_COLORS.mutedText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  bigNumber: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.deepNavy,
  },
});

/** Source-confidence labels used in every drill-down ledger row. */
export type SourceConfidence =
  | 'verified-invoice'
  | 'imported-csv'
  | 'user-entered'
  | 'calculated'
  | 'estimated-default'
  | 'needs-review';

export const SOURCE_CONFIDENCE_LABEL: Record<SourceConfidence, string> = {
  'verified-invoice': 'Verified from invoice',
  'imported-csv': 'Imported from CSV',
  'user-entered': 'Entered by user',
  calculated: 'Calculated by EasySeas',
  'estimated-default': 'Estimated using default',
  'needs-review': 'Needs review',
};

export const SOURCE_CONFIDENCE_COLOR: Record<SourceConfidence, string> = {
  'verified-invoice': CASINO_DASHBOARD_COLORS.green,
  'imported-csv': CASINO_DASHBOARD_COLORS.brightBlue,
  'user-entered': CASINO_DASHBOARD_COLORS.purple,
  calculated: CASINO_DASHBOARD_COLORS.teal,
  'estimated-default': CASINO_DASHBOARD_COLORS.orange,
  'needs-review': CASINO_DASHBOARD_COLORS.red,
};
