import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileDown, Share2 } from 'lucide-react-native';
import { DARK_ROYAL_COLORS } from '@/constants/darkRoyalTheme';
import { useCasinoLedger } from '@/hooks/useCasinoLedger';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { formatDate } from '@/lib/date';

/**
 * Stage 9.5, checklist item 99 — a single exportable casino report (markdown,
 * shareable as a .md file which opens cleanly as plain text/Word on most
 * devices) summarizing portfolio status, tier progress, the full value
 * ledger, and cruise-by-cruise results, all sourced from the same canonical
 * casino ledger and economics summary every other Casino screen reads from.
 */
export default function CasinoExportReportScreen() {
  const router = useRouter();
  const ledger = useCasinoLedger();
  const { cruiseEconomicsSummary } = useCasinoEconomicsData();
  const {
    clubRoyalePoints,
    clubRoyaleTier,
    clubRoyaleCurrentYearPoints,
    crownAnchorPoints,
    crownAnchorLevel,
  } = useLoyalty();
  const [isSharing, setIsSharing] = useState(false);

  const reportMarkdown = useMemo(() => {
    const lines: string[] = [];
    lines.push('# EasySeas Casino Report');
    lines.push(`Generated ${formatDate(new Date().toISOString(), 'long')}`);
    lines.push('');
    lines.push('## Portfolio Status');
    lines.push(`- Club Royale Tier: ${clubRoyaleTier ?? 'Unknown'}`);
    lines.push(`- Club Royale Points (lifetime): ${clubRoyalePoints?.toLocaleString() ?? '0'}`);
    lines.push(`- Current Season Points: ${clubRoyaleCurrentYearPoints?.toLocaleString() ?? '0'}`);
    lines.push(`- Crown & Anchor Level: ${crownAnchorLevel ?? 'Unknown'}`);
    lines.push(`- Crown & Anchor Cruise Points: ${crownAnchorPoints?.toLocaleString() ?? '0'}`);
    lines.push('');
    lines.push('## Value Ledger Totals');
    lines.push(`- Cruises Included: ${ledger.totals.cruiseCount}`);
    lines.push(`- Total Casino Points: ${Math.round(ledger.totals.totalPoints).toLocaleString()}`);
    lines.push(`- Total Coin-In: $${Math.round(ledger.totals.totalCoinIn).toLocaleString()}`);
    lines.push(`- Total Win/Loss: $${Math.round(ledger.totals.totalWinLoss).toLocaleString()}`);
    lines.push(`- Total Retail Value: $${Math.round(ledger.totals.totalRetailValue).toLocaleString()}`);
    lines.push(`- Total Cash Paid: $${Math.round(ledger.totals.totalCashPaid).toLocaleString()}`);
    lines.push(`- Total Cruise Value Captured: $${Math.round(ledger.totals.totalCruiseValueCaptured).toLocaleString()}`);
    lines.push(`- Total Economic Value: $${Math.round(ledger.totals.totalEconomicValue).toLocaleString()}`);
    lines.push(`- FreePlay Counted: $${Math.round(ledger.totals.totalFreePlayCounted).toLocaleString()}`);
    lines.push(`- OBC Counted: $${Math.round(ledger.totals.totalObcCounted).toLocaleString()}`);
    lines.push(`- Certificate Value Counted: $${Math.round(ledger.totals.totalCertificateValueCounted).toLocaleString()}`);
    lines.push(`- Overall Source Confidence: ${ledger.totals.overallConfidence}`);
    if (ledger.totals.cruisesWithMissingWinLoss > 0) lines.push(`- \u26a0\ufe0f ${ledger.totals.cruisesWithMissingWinLoss} cruise(s) missing win/loss data`);
    if (ledger.totals.cruisesWithMissingPoints > 0) lines.push(`- \u26a0\ufe0f ${ledger.totals.cruisesWithMissingPoints} cruise(s) missing points data`);
    lines.push('');
    lines.push('## Cruise-by-Cruise Results');
    lines.push('| Ship | Sail Date | Points | Coin-In | Win/Loss | Total Value | Confidence |');
    lines.push('|---|---|---|---|---|---|---|');
    ledger.entries
      .slice()
      .sort((a, b) => (b.sailDate || '').localeCompare(a.sailDate || ''))
      .forEach((entry) => {
        lines.push(
          `| ${entry.shipName} | ${entry.sailDate} | ${Math.round(entry.points.value).toLocaleString()} | $${Math.round(entry.coinIn.value).toLocaleString()} | $${Math.round(entry.winLoss.value).toLocaleString()} | $${Math.round(entry.totalEconomicValue.value).toLocaleString()} | ${entry.overallConfidence} |`,
        );
      });
    lines.push('');
    lines.push('## Future Value Projections');
    lines.push(`- Data as of: ${cruiseEconomicsSummary.rows.length} cruise(s) in economics summary`);
    lines.push('');
    lines.push('---');
    lines.push('_All figures are pulled from the same canonical casino ledger used across Casino Portfolio, Value, Action Center, History, and Simulator. Confidence labels (Actual/Imported/User-Entered/Estimated/Generated/Mixed/Missing) reflect how each number was sourced._');
    return lines.join('\n');
  }, [ledger, cruiseEconomicsSummary, clubRoyaleTier, clubRoyalePoints, clubRoyaleCurrentYearPoints, crownAnchorLevel, crownAnchorPoints]);

  const handleShare = useCallback(async () => {
    try {
      setIsSharing(true);
      const filename = `EasySeas-Casino-Report-${new Date().toISOString().split('T')[0]}.md`;

      if (Platform.OS === 'web') {
        const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[CasinoExportReport] Web download started');
        return;
      }

      const file = new ExpoFile(ExpoPaths.cache, filename);
      file.write(reportMarkdown);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        console.log('[CasinoExportReport] Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: 'Share Casino Report' });
    } catch (error) {
      console.error('[CasinoExportReport] Export failed:', error);
    } finally {
      setIsSharing(false);
    }
  }, [reportMarkdown]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="export-report-back">
            <ArrowLeft size={20} color={DARK_ROYAL_COLORS.gold} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Casino Report</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtitle}>
            A full markdown summary of your portfolio status, value ledger, and cruise-by-cruise casino results — every
            figure sourced from the same canonical ledger used across the Casino tab.
          </Text>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare} disabled={isSharing} activeOpacity={0.85} testID="export-report-share">
            {isSharing ? <ActivityIndicator color={DARK_ROYAL_COLORS.deepNavy} /> : <Share2 size={18} color={DARK_ROYAL_COLORS.deepNavy} />}
            <Text style={styles.shareButtonText}>{isSharing ? 'Preparing…' : 'Share / Download Report'}</Text>
          </TouchableOpacity>

          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <FileDown size={15} color={DARK_ROYAL_COLORS.gold} />
              <Text style={styles.previewHeaderText}>Preview</Text>
            </View>
            <Text style={styles.previewText}>{reportMarkdown}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_ROYAL_COLORS.deepNavy },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800' as const, color: DARK_ROYAL_COLORS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  subtitle: { fontSize: 13, lineHeight: 19, color: DARK_ROYAL_COLORS.mutedText, marginBottom: 16 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DARK_ROYAL_COLORS.gold,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  shareButtonText: { fontSize: 15, fontWeight: '800' as const, color: DARK_ROYAL_COLORS.deepNavy },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  previewHeaderText: { fontSize: 12, fontWeight: '700' as const, color: DARK_ROYAL_COLORS.gold, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  previewText: { fontSize: 12, lineHeight: 18, color: DARK_ROYAL_COLORS.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
