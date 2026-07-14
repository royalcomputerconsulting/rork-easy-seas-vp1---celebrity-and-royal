import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, BookOpen } from 'lucide-react-native';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS, darkRoyalDashboardStyles as casinoDashboardStyles } from '@/constants/darkRoyalTheme';

interface FormulaEntry {
  title: string;
  formula: string;
  notes: string;
}

const SECTIONS: { heading: string; entries: FormulaEntry[] }[] = [
  {
    heading: 'Points & Coin-In',
    entries: [
      { title: 'Casino Points', formula: 'Sum of Club Royale points earned per completed casino cruise', notes: 'Only Royal Caribbean sailings count toward Club Royale. Celebrity, Virgin, and charter sailings are excluded.' },
      { title: 'Coin-In', formula: 'Coin-In = Casino Points \u00d7 $5', notes: "Royal Caribbean's published slot coin-in rule. A large gap between recorded coin-in and this formula is flagged by the data-health checker." },
      { title: 'Current Season Points', formula: 'Sum of casino points earned April 1 \u2013 March 31 (current Club Royale year)', notes: 'Excludes Crown & Anchor loyalty points and anything outside the current casino year.' },
    ],
  },
  {
    heading: 'Tiers & Goals',
    entries: [
      { title: 'Signature Retain Gap', formula: 'max(25,000 \u2212 current season points, 0)', notes: 'Coin-in still needed = points needed \u00d7 $5.' },
      { title: 'Masters Threshold', formula: 'Masters tier requires the season point threshold defined in Club Royale tiers', notes: 'Historical tier uses lifetime points; current tier uses current-season points.' },
      { title: 'Avg Points / Night', formula: 'Current season points \u00f7 completed casino nights this season', notes: 'An alternate points-per-casino-open-day figure is shown when casino-open-day data exists.' },
    ],
  },
  {
    heading: 'Play Hours',
    entries: [
      { title: 'Estimated Casino Play Hours', formula: 'Actual logged session hours, or points \u00f7 points-per-hour assumption if no sessions exist', notes: 'Points-per-hour assumption is editable in Casino Settings.' },
      { title: 'Estimated Daily Play Hours', formula: 'Estimated play hours \u00f7 casino-open days', notes: 'Not divided by total cruise nights \u2014 port days with the casino closed are excluded.' },
    ],
  },
  {
    heading: 'Cruise Value',
    entries: [
      { title: 'Cruise Value Captured', formula: 'Retail cruise value \u2212 actual cash paid', notes: 'Retail value and cash paid each carry their own confidence label.' },
      { title: 'Total Economic Value', formula: 'Cruise value captured + casino cash result + point value + FreePlay + OBC + perks', notes: 'Duplicate-counting guard excludes FreePlay/OBC/certificate value already reflected elsewhere.' },
      { title: 'Value Per Dollar', formula: 'Total economic value \u00f7 actual cash paid', notes: 'Shown as N/A when cash paid is zero, never divided by zero.' },
      { title: 'ROI', formula: '(Total economic value \u2212 actual cash paid) \u00f7 actual cash paid', notes: 'Same zero-cash-paid guard as Value Per Dollar.' },
    ],
  },
  {
    heading: 'Benefits & Duplicate-Counting',
    entries: [
      { title: 'FreePlay Treatment', formula: 'Counted once, as a benefit, unless a separate win/loss result already reflects it', notes: 'See the FreePlay row in any drill-down for the specific reason it was included or excluded.' },
      { title: 'OBC Treatment', formula: 'Counted once, unless it already reduced the recorded cash paid', notes: 'Prevents OBC from being counted both as a discount and as a benefit.' },
      { title: 'Certificate Value Treatment', formula: 'Counted once \u2014 either in the certificate wallet (unused) or in the redeeming cruise\u2019s value (used)', notes: 'Never counted in both places at once.' },
      { title: 'VOOM (Internet)', formula: 'Daily price \u00d7 device count \u00d7 cruise days (all editable defaults in Casino Settings)', notes: 'Overridden by an invoice, Cruise Planner price, or user entry when available.' },
      { title: 'Signature $75 OBC', formula: '$75 per eligible cruise within the configured eligibility window', notes: 'Amount and dates are editable in Casino Settings.' },
      { title: 'W2G Jackpots', formula: 'Included in win/loss only when explicitly linked to a cruise/session', notes: 'Unlinked W2G records are flagged by the data-health checker.' },
    ],
  },
];

/**
 * In-app Casino Formula Reference (Stage 9.1, checklist item 96). A single
 * place documenting every formula used across the Casino section in plain
 * English, so any drill-down can point here instead of repeating the same
 * explanation everywhere.
 */
export default function CasinoFormulaReferenceScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="formula-reference-back">
          <ChevronLeft size={22} color={CASINO_DASHBOARD_COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={casinoDashboardStyles.screenTitle}>Casino Formula Reference</Text>
          <Text style={casinoDashboardStyles.screenSubtitle}>How every number in the Casino section is calculated</Text>
        </View>
        <BookOpen size={20} color={CASINO_DASHBOARD_COLORS.gold} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.heading} style={{ marginBottom: 22 }}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <View style={casinoDashboardStyles.card}>
              {section.entries.map((entry, index) => (
                <View key={entry.title} style={[styles.entryRow, index === section.entries.length - 1 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }]}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <View style={styles.formulaBox}>
                    <Text style={styles.formulaText}>{entry.formula}</Text>
                  </View>
                  <Text style={styles.entryNotes}>{entry.notes}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CASINO_DASHBOARD_COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 60 },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  entryRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  entryTitle: { fontSize: 14.5, fontWeight: '800' as const, color: CASINO_DASHBOARD_COLORS.textPrimary, marginBottom: 6 },
  formulaBox: {
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.borderStrong,
    padding: 10,
    marginBottom: 6,
  },
  formulaText: { fontSize: 12.5, fontWeight: '700' as const, color: CASINO_DASHBOARD_COLORS.gold },
  entryNotes: { fontSize: 12, lineHeight: 17, color: CASINO_DASHBOARD_COLORS.textSecondary },
});
