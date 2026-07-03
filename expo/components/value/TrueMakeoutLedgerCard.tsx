import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { DollarSign } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { formatCurrencyDetailed, formatNumber } from '@/lib/format';
import type { CasinoValueAttributionSummary } from '@/lib/analytics/casinoValueAttribution';

type Props = { summary: CasinoValueAttributionSummary; limit?: number };

export function TrueMakeoutLedgerCard({ summary, limit = 8 }: Props) {
  const rows = summary.trueMakeoutResults.slice(0, limit);
  return (
    <View style={styles.card} testID="true-makeout-ledger-card">
      <View style={styles.header}><DollarSign size={18} color={COLORS.success} /><Text style={styles.title}>True Make-Out Ledger</Text></View>
      <Text style={styles.subtitle}>Coin-in is volume, not cost. Actual make-out combines cruise value, casino wins, future value created, and real cash costs.</Text>
      <View style={styles.metricsRow}>
        <Metric label="Net make-out" value={formatCurrencyDetailed(summary.totals.netMakeout)} />
        <Metric label="Gross value" value={formatCurrencyDetailed(summary.totals.retailValueReceived + summary.totals.freeplayValue + summary.totals.tradeInValue + summary.totals.obcValue + summary.totals.futureValueCreated)} />
        <Metric label="Cash costs" value={formatCurrencyDetailed(summary.totals.farePaid + summary.totals.taxesAndFeesPaid + summary.totals.onboardSpend)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {rows.map((row) => (
            <View key={row.cruiseId} style={styles.row}>
              <View style={styles.mainCell}><Text style={styles.ship}>{row.shipName}</Text><Text style={styles.date}>{row.offerCode || row.offerType}</Text></View>
              <View style={styles.cell}><Text style={styles.label}>Value</Text><Text style={styles.value}>{formatCurrencyDetailed(row.grossValueReceived)}</Text></View>
              <View style={styles.cell}><Text style={styles.label}>Cash cost</Text><Text style={styles.value}>{formatCurrencyDetailed(row.actualCashCost)}</Text></View>
              <View style={styles.cell}><Text style={styles.label}>Casino</Text><Text style={styles.value}>{formatCurrencyDetailed(row.casinoWinLoss)}</Text></View>
              <View style={styles.cell}><Text style={styles.label}>Points</Text><Text style={styles.value}>{formatNumber(row.pointsEarned)}</Text></View>
              <View style={styles.cell}><Text style={styles.label}>Make-out</Text><Text style={[styles.value, { color: row.netMakeout >= 0 ? COLORS.success : COLORS.error }]}>{formatCurrencyDetailed(row.netMakeout)}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDeep },
  subtitle: { fontSize: 12, color: COLORS.gray[600], marginBottom: 12, lineHeight: 17 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: 'rgba(15,23,42,0.04)', borderRadius: 12, padding: 10 },
  metricValue: { fontWeight: '900', fontSize: 14, color: COLORS.navyDeep },
  metricLabel: { fontSize: 10, color: COLORS.gray[600], marginTop: 2 },
  table: { gap: 8 },
  row: { flexDirection: 'row', backgroundColor: 'rgba(15,23,42,0.03)', borderRadius: 12, padding: 10, gap: 12, minWidth: 800 },
  mainCell: { width: 170 },
  cell: { width: 110 },
  ship: { fontWeight: '800', color: COLORS.navyDeep, fontSize: 13 },
  date: { color: COLORS.gray[600], fontSize: 12, marginTop: 2 },
  label: { color: COLORS.gray[500], fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '700', marginTop: 2 },
});
