import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ship, ChevronDown, ChevronLeft, TrendingUp, TrendingDown, Award, X } from 'lucide-react-native';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { formatCurrency, formatCurrencyDetailed, formatNumber } from '@/lib/format';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles, darkRoyalValueColor as valueColor } from '@/constants/darkRoyalTheme';
import { useDrillDown } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';

type TimeFilter = 'all' | '12mo';

interface ShipRow {
  ship: string;
  cruises: number;
  points: number;
  paid: number;
  retail: number;
  cashResult: number;
  totalEconomic: number;
  avgPointsPerCruise: number;
  avgCoinInPerCruise: number;
  avgValuePerCruise: number;
}

/**
 * Dedicated Ship Casino Performance screen (Stage 8 mockup screen 4 of 4).
 * Groups the real cruise-economics rows by ship, surfaces best/worst
 * highlight cards, a full comparison table, and rule-based trend notes.
 */
export default function ShipPerformanceScreen() {
  const router = useRouter();
  const { cruiseEconomicsSummary } = useCasinoEconomicsData();
  const { clubRoyaleTier, clubRoyaleCurrentYearPoints } = useLoyalty();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const drill = useDrillDown();

  const [shipFilter, setShipFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showShipPicker, setShowShipPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const timeFilteredRows = useMemo(() => {
    if (timeFilter === 'all') return cruiseEconomicsSummary.rows;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    return cruiseEconomicsSummary.rows.filter((row) => {
      const parsed = row.sailDate ? new Date(row.sailDate) : null;
      return parsed && !Number.isNaN(parsed.getTime()) && parsed >= cutoff;
    });
  }, [cruiseEconomicsSummary.rows, timeFilter]);

  const shipRows = useMemo((): ShipRow[] => {
    const map = new Map<string, ShipRow>();
    timeFilteredRows.forEach((row) => {
      const key = row.ship || 'Unknown Ship';
      const existing = map.get(key) ?? {
        ship: key, cruises: 0, points: 0, paid: 0, retail: 0, cashResult: 0, totalEconomic: 0,
        avgPointsPerCruise: 0, avgCoinInPerCruise: 0, avgValuePerCruise: 0,
      };
      existing.cruises += 1;
      existing.points += row.points;
      existing.paid += row.paid;
      existing.retail += row.retail;
      existing.cashResult += row.cashResult ?? 0;
      existing.totalEconomic += row.totalEconomic ?? 0;
      map.set(key, existing);
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        avgPointsPerCruise: entry.cruises > 0 ? entry.points / entry.cruises : 0,
        avgCoinInPerCruise: entry.cruises > 0 ? (entry.points * 5) / entry.cruises : 0,
        avgValuePerCruise: entry.cruises > 0 ? entry.totalEconomic / entry.cruises : 0,
      }))
      .sort((a, b) => b.totalEconomic - a.totalEconomic);
  }, [timeFilteredRows]);

  const shipNames = useMemo(() => shipRows.map((s) => s.ship), [shipRows]);

  const filteredShipRows = useMemo(() => {
    if (shipFilter === 'all') return shipRows;
    return shipRows.filter((s) => s.ship === shipFilter);
  }, [shipRows, shipFilter]);

  const highlights = useMemo(() => {
    if (shipRows.length === 0) return null;
    const bestByPoints = [...shipRows].sort((a, b) => b.points - a.points)[0];
    const bestByWinLoss = [...shipRows].sort((a, b) => b.cashResult - a.cashResult)[0];
    const bestByMakeOut = [...shipRows].sort((a, b) => b.totalEconomic - a.totalEconomic)[0];
    const worstByCash = [...shipRows].sort((a, b) => a.cashResult - b.cashResult)[0];
    return { bestByPoints, bestByWinLoss, bestByMakeOut, worstByCash };
  }, [shipRows]);

  const trendNotes = useMemo(() => {
    if (!highlights) return [];
    const notes: string[] = [];
    notes.push(`${highlights.bestByPoints.ship} delivers the highest points per cruise (${formatNumber(Math.round(highlights.bestByPoints.avgPointsPerCruise))} avg).`);
    if (highlights.bestByWinLoss.cashResult > 0) {
      notes.push(`${highlights.bestByWinLoss.ship} shows the strongest cash win/loss result at ${formatCurrency(highlights.bestByWinLoss.cashResult)}.`);
    }
    if (highlights.worstByCash.cashResult < 0 && highlights.worstByCash.ship !== highlights.bestByWinLoss.ship) {
      notes.push(`${highlights.worstByCash.ship} had higher losses (${formatCurrency(highlights.worstByCash.cashResult)}) than other ships — consider it before rebooking.`);
    }
    notes.push(`${highlights.bestByMakeOut.ship} produces the best true make-out per cruise (${formatCurrency(highlights.bestByMakeOut.avgValuePerCruise)} avg).`);
    return notes;
  }, [highlights]);

  const openShipDrill = useCallback((ship: ShipRow) => {
    drill.open({
      title: ship.ship,
      subtitle: `${ship.cruises} sailing${ship.cruises === 1 ? '' : 's'}`,
      summary: 'Per-ship totals are built by summing every completed casino cruise economics row that matches this ship name.',
      formula: 'Net Make-Out (ship) = Sum of (Comp Value + Win/Loss) across every completed cruise on this ship',
      inputs: [
        { label: 'Sailings', value: String(ship.cruises) },
        { label: 'Total points', value: formatNumber(ship.points) },
        { label: 'Avg points / cruise', value: formatNumber(Math.round(ship.avgPointsPerCruise)) },
        { label: 'Avg coin-in / cruise', value: formatCurrencyDetailed(ship.avgCoinInPerCruise) },
        { label: 'Avg value / cruise', value: formatCurrencyDetailed(ship.avgValuePerCruise) },
        { label: 'Win / loss (total)', value: formatCurrencyDetailed(ship.cashResult) },
        { label: 'Net make-out (total)', value: formatCurrencyDetailed(ship.totalEconomic) },
      ],
    });
  }, [drill]);

  const openHighlightDrill = useCallback((label: string, ship: ShipRow, valueLabel: string, value: string) => {
    drill.open({
      title: label,
      subtitle: ship.ship,
      formula: `${label} = highest-ranked ship after comparing ${valueLabel.toLowerCase()} across all ships in the selected time range`,
      inputs: [
        { label: valueLabel, value },
        { label: 'Sailings', value: String(ship.cruises) },
      ],
    });
  }, [drill]);

  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / CLUB_ROYALE_TIERS.Signature.threshold) * 100));

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={dashStyles.screenTitle}>Ship Casino Performance</Text>
          <Text style={dashStyles.screenSubtitle}>Your performance by ship</Text>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterPill} activeOpacity={0.75} onPress={() => setShowShipPicker(true)} testID="ship-filter-pill">
            <Text style={styles.filterPillText} numberOfLines={1}>{shipFilter === 'all' ? 'All Ships' : shipFilter}</Text>
            <ChevronDown size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterPill} activeOpacity={0.75} onPress={() => setShowTimePicker(true)} testID="time-filter-pill">
            <Text style={styles.filterPillText}>{timeFilter === 'all' ? 'All Time' : 'Last 12 Months'}</Text>
            <ChevronDown size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {highlights ? (
        <View style={styles.highlightGrid}>
          <TouchableOpacity
            style={[dashStyles.card, styles.highlightCard]}
            activeOpacity={0.85}
            onPress={() => openHighlightDrill('Best Ship by Points', highlights.bestByPoints, 'Total points', formatNumber(highlights.bestByPoints.points))}
          >
            <View style={styles.highlightIconRow}>
              <Award size={14} color={COLORS.gold} />
              <Text style={styles.highlightLabel}>Best Ship by Points</Text>
            </View>
            <Text style={styles.highlightShip} numberOfLines={1}>{highlights.bestByPoints.ship}</Text>
            <Text style={[dashStyles.bigNumber, { fontSize: 20 }]}>{formatNumber(highlights.bestByPoints.points)} pts</Text>
            <Text style={styles.highlightSub}>{highlights.bestByPoints.cruises} sailings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.card, styles.highlightCard]}
            activeOpacity={0.85}
            onPress={() => openHighlightDrill('Best Ship by Win/Loss', highlights.bestByWinLoss, 'Win/loss total', formatCurrencyDetailed(highlights.bestByWinLoss.cashResult))}
          >
            <View style={styles.highlightIconRow}>
              <TrendingUp size={14} color={COLORS.green} />
              <Text style={styles.highlightLabel}>Best Ship by Win/Loss</Text>
            </View>
            <Text style={styles.highlightShip} numberOfLines={1}>{highlights.bestByWinLoss.ship}</Text>
            <Text style={[dashStyles.bigNumber, { fontSize: 20, color: valueColor(highlights.bestByWinLoss.cashResult) }]}>{formatCurrency(highlights.bestByWinLoss.cashResult)}</Text>
            <Text style={styles.highlightSub}>{highlights.bestByWinLoss.cruises} sailings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.card, styles.highlightCard]}
            activeOpacity={0.85}
            onPress={() => openHighlightDrill('Best Ship by True Make-Out', highlights.bestByMakeOut, 'Net make-out total', formatCurrencyDetailed(highlights.bestByMakeOut.totalEconomic))}
          >
            <View style={styles.highlightIconRow}>
              <Ship size={14} color={COLORS.brightBlue} />
              <Text style={styles.highlightLabel}>Best Ship by True Make-Out</Text>
            </View>
            <Text style={styles.highlightShip} numberOfLines={1}>{highlights.bestByMakeOut.ship}</Text>
            <Text style={[dashStyles.bigNumber, { fontSize: 20, color: valueColor(highlights.bestByMakeOut.totalEconomic) }]}>{formatCurrency(highlights.bestByMakeOut.totalEconomic)}</Text>
            <Text style={styles.highlightSub}>{highlights.bestByMakeOut.cruises} sailings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dashStyles.card, styles.highlightCard]}
            activeOpacity={0.85}
            onPress={() => openHighlightDrill('Worst Ship by Cash Result', highlights.worstByCash, 'Win/loss total', formatCurrencyDetailed(highlights.worstByCash.cashResult))}
          >
            <View style={styles.highlightIconRow}>
              <TrendingDown size={14} color={COLORS.red} />
              <Text style={styles.highlightLabel}>Worst Ship by Cash Result</Text>
            </View>
            <Text style={styles.highlightShip} numberOfLines={1}>{highlights.worstByCash.ship}</Text>
            <Text style={[dashStyles.bigNumber, { fontSize: 20, color: valueColor(highlights.worstByCash.cashResult) }]}>{formatCurrency(highlights.worstByCash.cashResult)}</Text>
            <Text style={styles.highlightSub}>{highlights.worstByCash.cruises} sailings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[dashStyles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Ship size={22} color={COLORS.textMuted} />
          <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}>No completed cruises yet to compare ships.</Text>
        </View>
      )}

      <View style={styles.tableSection}>
        <View style={[dashStyles.card, styles.tableCard]}>
          <Text style={styles.tableTitle}>Ship Performance Overview</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Ship</Text>
            <Text style={styles.tableHeaderCell}>Sailings</Text>
            <Text style={styles.tableHeaderCell}>Pts/Cruise</Text>
            <Text style={styles.tableHeaderCell}>Win/Loss</Text>
            <Text style={styles.tableHeaderCell}>Net Make-Out</Text>
          </View>
          {filteredShipRows.map((ship) => (
            <TouchableOpacity key={ship.ship} style={styles.tableRow} activeOpacity={0.7} onPress={() => openShipDrill(ship)} testID={`ship-row-${ship.ship}`}>
              <Text style={[styles.tableCell, { flex: 1.6, fontWeight: '700' as const, color: COLORS.textPrimary }]} numberOfLines={1}>{ship.ship}</Text>
              <Text style={styles.tableCell}>{ship.cruises}</Text>
              <Text style={styles.tableCell}>{formatNumber(Math.round(ship.avgPointsPerCruise))}</Text>
              <Text style={[styles.tableCell, { color: valueColor(ship.cashResult) }]}>{formatCurrency(ship.cashResult)}</Text>
              <Text style={[styles.tableCell, { color: valueColor(ship.totalEconomic), fontWeight: '700' as const }]}>{formatCurrency(ship.totalEconomic)}</Text>
            </TouchableOpacity>
          ))}
          {filteredShipRows.length === 0 && (
            <Text style={{ color: COLORS.textMuted, fontSize: 12, paddingVertical: 12, textAlign: 'center' as const }}>No ships match this filter.</Text>
          )}
        </View>

        {trendNotes.length > 0 && (
          <View style={[dashStyles.card, styles.notesCard]}>
            <Text style={styles.tableTitle}>Ship-Level Trend Notes</Text>
            {trendNotes.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.noteRow}>
                <View style={styles.noteDot} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="ship-perf-back-button">
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

      <Modal visible={showShipPicker} transparent animationType="fade" onRequestClose={() => setShowShipPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowShipPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Filter by Ship</Text>
              <TouchableOpacity onPress={() => setShowShipPicker(false)}><X size={18} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setShipFilter('all'); setShowShipPicker(false); }}>
                <Text style={[styles.pickerRowText, shipFilter === 'all' && styles.pickerRowTextActive]}>All Ships</Text>
              </TouchableOpacity>
              {shipNames.map((name) => (
                <TouchableOpacity key={name} style={styles.pickerRow} onPress={() => { setShipFilter(name); setShowShipPicker(false); }}>
                  <Text style={[styles.pickerRowText, shipFilter === name && styles.pickerRowTextActive]} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>Filter by Time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}><X size={18} color={COLORS.textPrimary} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.pickerRow} onPress={() => { setTimeFilter('all'); setShowTimePicker(false); }}>
              <Text style={[styles.pickerRowText, timeFilter === 'all' && styles.pickerRowTextActive]}>All Time</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerRow} onPress={() => { setTimeFilter('12mo'); setShowTimePicker(false); }}>
              <Text style={[styles.pickerRowText, timeFilter === '12mo' && styles.pickerRowTextActive]}>Last 12 Months</Text>
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
  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.cardAlt,
  },
  filterPillText: { fontSize: 12, fontWeight: '600' as const, color: COLORS.textPrimary, maxWidth: 110 },
  highlightGrid: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 12 },
  highlightCard: { flex: 1, minWidth: 150, gap: 4 },
  highlightIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  highlightLabel: { fontSize: 10, fontWeight: '700' as const, color: COLORS.textSecondary, textTransform: 'uppercase' as const },
  highlightShip: { fontSize: 13, fontWeight: '700' as const, color: COLORS.textPrimary, marginTop: 2 },
  highlightSub: { fontSize: 10.5, color: COLORS.textMuted },
  tableSection: { gap: 14 },
  tableCard: { gap: 10 },
  tableTitle: { fontSize: 14, fontWeight: '700' as const, color: COLORS.textPrimary, marginBottom: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 8 },
  tableHeaderCell: { flex: 1, fontSize: 10.5, fontWeight: '700' as const, color: COLORS.textMuted, textTransform: 'uppercase' as const },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  tableCell: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary },
  notesCard: { gap: 8 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.gold, marginTop: 7 },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.textSecondary },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(2,8,25,0.65)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, maxHeight: 440 },
  pickerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerTitle: { fontSize: 15, fontWeight: '700' as const, color: COLORS.textPrimary },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerRowText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' as const },
  pickerRowTextActive: { color: COLORS.goldText, fontWeight: '800' as const },
});
