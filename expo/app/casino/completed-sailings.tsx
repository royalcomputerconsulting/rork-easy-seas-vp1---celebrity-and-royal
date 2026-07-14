import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions, Modal } from 'react-native';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Filter, Download, ChevronLeft, ChevronDown, X, Anchor, Clock, DollarSign, Award, TrendingUp } from 'lucide-react-native';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { formatCurrency, formatCurrencyDetailed, formatNumber } from '@/lib/format';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles, darkRoyalValueColor as valueColor, DARK_ROYAL_DATA_QUALITY_COLOR, DARK_ROYAL_DATA_QUALITY_LABEL, type DarkRoyalDataQuality } from '@/constants/darkRoyalTheme';
import { useDrillDown } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import type { CruiseEconomicsRow } from '@/lib/casinoCruiseEconomics';

const PAGE_SIZE = 8;

function getDataQuality(row: CruiseEconomicsRow): DarkRoyalDataQuality {
  if ((row.points ?? 0) === 0 && (row.paid ?? 0) === 0 && (row.retail ?? 0) === 0) return 'missing';
  if (row.calculationConfidence === 'actual') return 'verified';
  if (row.calculationConfidence === 'mixed') return 'mixed';
  return 'estimated';
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  const needsQuotes = /[\n\r\t",]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Dedicated Completed Cruise Sailings screen (Stage 8 mockup screen 3 of 4).
 * A real, filterable, paginated ledger of every completed casino cruise,
 * with a Data Quality badge per row, CSV export, and a totals footer.
 */
export default function CompletedSailingsScreen() {
  const router = useRouter();
  const { bookedCruises, cruiseEconomicsSummary } = useCasinoEconomicsData();
  const { clubRoyaleTier, clubRoyaleCurrentYearPoints } = useLoyalty();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const drill = useDrillDown();

  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [qualityFilter, setQualityFilter] = useState<DarkRoyalDataQuality | 'all'>('all');
  const [shipFilter, setShipFilter] = useState<string>('all');

  const cruiseById = useMemo(() => {
    return new Map(bookedCruises.map((cruise) => [cruise.id, cruise]));
  }, [bookedCruises]);

  const rowsWithQuality = useMemo(() => {
    return cruiseEconomicsSummary.rows.map((row) => ({
      row,
      quality: getDataQuality(row),
      cruise: cruiseById.get(row.cruiseId),
    })).sort((a, b) => new Date(b.row.sailDate).getTime() - new Date(a.row.sailDate).getTime());
  }, [cruiseEconomicsSummary.rows, cruiseById]);

  const shipNames = useMemo(() => {
    return Array.from(new Set(rowsWithQuality.map((entry) => entry.row.ship))).sort();
  }, [rowsWithQuality]);

  const filteredRows = useMemo(() => {
    return rowsWithQuality.filter((entry) => {
      if (qualityFilter !== 'all' && entry.quality !== qualityFilter) return false;
      if (shipFilter !== 'all' && entry.row.ship !== shipFilter) return false;
      return true;
    });
  }, [rowsWithQuality, qualityFilter, shipFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const summary = useMemo(() => {
    return filteredRows.reduce((acc, entry) => {
      acc.cruises += 1;
      acc.nights += entry.row.nights;
      acc.coinIn += entry.row.coinIn ?? 0;
      acc.points += entry.row.points;
      acc.winLoss += entry.row.cashResult ?? 0;
      acc.netMakeOut += entry.row.totalEconomic ?? 0;
      return acc;
    }, { cruises: 0, nights: 0, coinIn: 0, points: 0, winLoss: 0, netMakeOut: 0 });
  }, [filteredRows]);

  const openRowDrill = useCallback((entry: typeof rowsWithQuality[number]) => {
    const { row, quality, cruise } = entry;
    const offerCode = cruise?.instantCertificateOfferCode || cruise?.offerCode || '—';
    drill.open({
      title: row.ship,
      subtitle: `${row.sailDate} · ${row.nights} night${row.nights === 1 ? '' : 's'}`,
      summary: `Data quality: ${DARK_ROYAL_DATA_QUALITY_LABEL[quality]}. ${row.notes ?? ''}`.trim(),
      formula: 'Net Make-Out = (Retail Value − Net Effective Paid) + (Winnings Brought Home − Net Effective Paid)',
      inputs: [
        { label: 'Itinerary', value: cruise?.itineraryName || cruise?.destination || '—' },
        { label: 'Casino points', value: formatNumber(row.points) },
        { label: 'Est. coin-in', value: formatCurrencyDetailed(row.coinIn ?? 0) },
        { label: 'Win / loss', value: formatCurrencyDetailed(row.cashResult ?? 0) },
        { label: 'Points / night', value: row.pointsPerNight.toFixed(0) },
        { label: 'Offer / certificate', value: offerCode },
        { label: 'Data quality', value: DARK_ROYAL_DATA_QUALITY_LABEL[quality] },
      ],
      missing: row.calculationConfidence !== 'actual' && row.notes ? [row.notes] : [],
    });
  }, [drill]);

  const openSummaryDrill = useCallback((label: string, value: string, formula: string) => {
    drill.open({
      title: label,
      subtitle: 'Across filtered completed sailings',
      formula,
      inputs: [{ label, value }],
    });
  }, [drill]);

  const handleExport = useCallback(async () => {
    const header = ['Ship', 'Sailing Date', 'Nights', 'Itinerary', 'Casino Points', 'Est. Coin-In', 'Win/Loss', 'Pts/Night', 'Offer/Certificate', 'Data Quality'];
    const csvRows = filteredRows.map(({ row, quality, cruise }) => [
      row.ship,
      row.sailDate,
      row.nights,
      cruise?.itineraryName || cruise?.destination || '',
      row.points,
      row.coinIn ?? 0,
      row.cashResult ?? 0,
      row.pointsPerNight.toFixed(0),
      cruise?.instantCertificateOfferCode || cruise?.offerCode || '',
      DARK_ROYAL_DATA_QUALITY_LABEL[quality],
    ].map(escapeCsv).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const filename = 'CompletedCruiseSailings.csv';

    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[CompletedSailingsExport] Web download started');
        return;
      }

      const file = new ExpoFile(ExpoPaths.cache, filename);
      file.write(csv);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        console.log('[CompletedSailingsExport] Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export CompletedCruiseSailings.csv',
      });
    } catch (error) {
      console.log('[CompletedSailingsExport] Export failed', error);
    }
  }, [filteredRows]);

  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / CLUB_ROYALE_TIERS.Signature.threshold) * 100));

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={dashStyles.screenTitle}>Completed Cruise Sailings</Text>
          <Text style={dashStyles.screenSubtitle}>Your completed casino cruises and performance</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionPill} activeOpacity={0.75} onPress={() => setShowFilters(true)} testID="sailings-filters-button">
            <Filter size={13} color={COLORS.textPrimary} />
            <Text style={styles.actionPillText}>Filters</Text>
            <ChevronDown size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionPill, styles.exportPill]} activeOpacity={0.75} onPress={handleExport} testID="sailings-export-button">
            <Download size={13} color={COLORS.background} />
            <Text style={[styles.actionPillText, { color: COLORS.background }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[dashStyles.card, styles.tableCard]}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Ship</Text>
          <Text style={styles.tableHeaderCell}>Date</Text>
          <Text style={styles.tableHeaderCell}>Nights</Text>
          <Text style={styles.tableHeaderCell}>Points</Text>
          <Text style={styles.tableHeaderCell}>Win/Loss</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Quality</Text>
        </View>
        {pagedRows.map(({ row, quality }) => (
          <TouchableOpacity
            key={row.cruiseId}
            style={styles.tableRow}
            activeOpacity={0.7}
            onPress={() => openRowDrill({ row, quality, cruise: cruiseById.get(row.cruiseId) })}
            testID={`sailing-row-${row.cruiseId}`}
          >
            <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '700' as const, color: COLORS.textPrimary }]} numberOfLines={1}>{row.ship}</Text>
            <Text style={styles.tableCell} numberOfLines={1}>{row.sailDate}</Text>
            <Text style={styles.tableCell}>{row.nights}</Text>
            <Text style={styles.tableCell}>{formatNumber(row.points)}</Text>
            <Text style={[styles.tableCell, { color: valueColor(row.cashResult ?? 0) }]}>{formatCurrency(row.cashResult ?? 0)}</Text>
            <View style={{ flex: 1.2 }}>
              <View style={[styles.qualityBadge, { backgroundColor: `${DARK_ROYAL_DATA_QUALITY_COLOR[quality]}22`, borderColor: `${DARK_ROYAL_DATA_QUALITY_COLOR[quality]}55` }]}>
                <Text style={[styles.qualityBadgeText, { color: DARK_ROYAL_DATA_QUALITY_COLOR[quality] }]} numberOfLines={1}>{DARK_ROYAL_DATA_QUALITY_LABEL[quality]}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        {pagedRows.length === 0 && (
          <Text style={{ color: COLORS.textMuted, fontSize: 12, paddingVertical: 16, textAlign: 'center' as const }}>No completed sailings match this filter.</Text>
        )}

        {pageCount > 1 && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationLabel}>
              Showing {safePage * PAGE_SIZE + 1}-{Math.min(filteredRows.length, (safePage + 1) * PAGE_SIZE)} of {filteredRows.length}
            </Text>
            <View style={styles.paginationButtons}>
              {Array.from({ length: pageCount }).map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.pageButton, index === safePage && styles.pageButtonActive]}
                  onPress={() => setPage(index)}
                  testID={`sailings-page-${index + 1}`}
                >
                  <Text style={[styles.pageButtonText, index === safePage && styles.pageButtonTextActive]}>{index + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={[dashStyles.card, styles.summaryCard]}>
        <Text style={styles.summaryTitle}>Sailing Summary</Text>
        <View style={styles.summaryGrid}>
          <TouchableOpacity style={styles.summaryItem} onPress={() => openSummaryDrill('Completed Cruises', String(summary.cruises), 'Completed Cruises = Count of filtered rows in this ledger')}>
            <Anchor size={15} color={COLORS.gold} />
            <Text style={styles.summaryValue}>{summary.cruises}</Text>
            <Text style={styles.summaryLabel}>Completed Cruises</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryItem} onPress={() => openSummaryDrill('Total Nights', formatNumber(summary.nights), 'Total Nights = Sum of nights across filtered sailings')}>
            <Clock size={15} color={COLORS.brightBlue} />
            <Text style={styles.summaryValue}>{formatNumber(summary.nights)}</Text>
            <Text style={styles.summaryLabel}>Total Nights</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryItem} onPress={() => openSummaryDrill('Est. Lifetime Coin-In', formatCurrency(summary.coinIn), 'Est. Coin-In = Casino Points × $5 (Club Royale coin-in rate)')}>
            <DollarSign size={15} color={COLORS.teal} />
            <Text style={styles.summaryValue}>{formatCurrency(summary.coinIn)}</Text>
            <Text style={styles.summaryLabel}>Est. Lifetime Coin-In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryItem} onPress={() => openSummaryDrill('Total Casino Points', formatNumber(summary.points), 'Total Casino Points = Sum of points across filtered sailings')}>
            <Award size={15} color={COLORS.purple} />
            <Text style={styles.summaryValue}>{formatNumber(summary.points)}</Text>
            <Text style={styles.summaryLabel}>Total Casino Points</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryItem} onPress={() => openSummaryDrill('Net Make-Out', formatCurrency(summary.netMakeOut), 'Net Make-Out = Sum of (Comp Value + Win/Loss) across filtered sailings')}>
            <TrendingUp size={15} color={valueColor(summary.netMakeOut)} />
            <Text style={[styles.summaryValue, { color: valueColor(summary.netMakeOut) }]}>{formatCurrency(summary.netMakeOut)}</Text>
            <Text style={styles.summaryLabel}>Net Make-Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="sailings-back-button">
            <ChevronLeft size={20} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Casino</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.contentRow}>
        {showSidebar && (
          <CasinoSidebar
            activeTab="portfolio"
            onTabChange={(tab) => router.replace({ pathname: '/(tabs)/analytics' as any, params: { tab } })}
            onOverviewPress={() => router.push('/(tabs)/(overview)' as any)}
            onSettingsPress={() => router.push('/(tabs)/settings' as any)}
            clubRoyaleTier={clubRoyaleTier}
            clubRoyalePoints={clubRoyaleCurrentYearPoints}
            tierProgressPct={signaturePct}
            tierProgressLabel="Signature progress"
            onStatusPress={() => router.push('/casino/loyalty-data' as any)}
          />
        )}
        <View style={{ flex: 1 }}>{body}</View>
      </View>

      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Filter Sailings</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}><X size={18} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.pickerSectionLabel}>Data Quality</Text>
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setQualityFilter('all'); setPage(0); }}>
                <Text style={[styles.pickerRowText, qualityFilter === 'all' && styles.pickerRowTextActive]}>All</Text>
              </TouchableOpacity>
              {(['verified', 'mixed', 'estimated', 'missing'] as DarkRoyalDataQuality[]).map((quality) => (
                <TouchableOpacity key={quality} style={styles.pickerRow} onPress={() => { setQualityFilter(quality); setPage(0); }}>
                  <Text style={[styles.pickerRowText, qualityFilter === quality && styles.pickerRowTextActive]}>{DARK_ROYAL_DATA_QUALITY_LABEL[quality]}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.pickerSectionLabel, { marginTop: 10 }]}>Ship</Text>
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setShipFilter('all'); setPage(0); }}>
                <Text style={[styles.pickerRowText, shipFilter === 'all' && styles.pickerRowTextActive]}>All Ships</Text>
              </TouchableOpacity>
              {shipNames.map((name) => (
                <TouchableOpacity key={name} style={styles.pickerRow} onPress={() => { setShipFilter(name); setPage(0); }}>
                  <Text style={[styles.pickerRowText, shipFilter === name && styles.pickerRowTextActive]} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.pickerDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {drill.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  contentRow: { flex: 1, flexDirection: 'row' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backButtonText: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 20,
    paddingVertical: 7, paddingHorizontal: 12, backgroundColor: COLORS.cardAlt,
  },
  actionPillText: { fontSize: 12, fontWeight: '700' as const, color: COLORS.textPrimary },
  exportPill: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tableCard: { gap: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 8 },
  tableHeaderCell: { flex: 1, fontSize: 10, fontWeight: '700' as const, color: COLORS.textMuted, textTransform: 'uppercase' as const },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  tableCell: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  qualityBadge: { borderRadius: 8, borderWidth: 1, paddingVertical: 3, paddingHorizontal: 6, alignSelf: 'flex-start' },
  qualityBadgeText: { fontSize: 10, fontWeight: '700' as const },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' as const, gap: 8 },
  paginationLabel: { fontSize: 11, color: COLORS.textMuted },
  paginationButtons: { flexDirection: 'row', gap: 6 },
  pageButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardAlt, borderWidth: 1, borderColor: COLORS.border },
  pageButtonActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  pageButtonText: { fontSize: 11, fontWeight: '700' as const, color: COLORS.textSecondary },
  pageButtonTextActive: { color: COLORS.background },
  summaryCard: { gap: 12 },
  summaryTitle: { fontSize: 14, fontWeight: '700' as const, color: COLORS.textPrimary },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 14 },
  summaryItem: { flex: 1, minWidth: 90, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 15, fontWeight: '800' as const, color: COLORS.textPrimary, marginTop: 2 },
  summaryLabel: { fontSize: 9.5, color: COLORS.textMuted, textAlign: 'center' as const },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(2,8,25,0.65)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, maxHeight: 500 },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700' as const, color: COLORS.textPrimary },
  pickerSectionLabel: { fontSize: 11, fontWeight: '700' as const, color: COLORS.textMuted, textTransform: 'uppercase' as const, marginBottom: 4 },
  pickerRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerRowText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' as const },
  pickerRowTextActive: { color: COLORS.goldText, fontWeight: '800' as const },
  pickerDoneButton: { marginTop: 12, backgroundColor: COLORS.royalBlue, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  pickerDoneButtonText: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF' },
});
