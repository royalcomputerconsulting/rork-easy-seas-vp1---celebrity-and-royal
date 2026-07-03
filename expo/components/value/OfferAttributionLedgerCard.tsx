import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ticket, AlertTriangle } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { formatNumber } from '@/lib/format';
import type { CasinoValueAttributionSummary } from '@/lib/analytics/casinoValueAttribution';

type Props = { summary: CasinoValueAttributionSummary; limit?: number };

export function OfferAttributionLedgerCard({ summary, limit = 8 }: Props) {
  const rows = summary.bookedCruiseAttributions.slice(0, limit);
  return (
    <View style={styles.card} testID="offer-attribution-ledger-card">
      <View style={styles.header}><Ticket size={18} color={COLORS.navyDeep} /><Text style={styles.title}>Offer Attribution Ledger</Text></View>
      <Text style={styles.subtitle}>Shows the offer/certificate used to book each cruise, its type, and whether points were required.</Text>
      {rows.length === 0 ? <Text style={styles.empty}>No booked cruise offer codes attached yet.</Text> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {rows.map((row) => (
              <View key={row.cruiseId} style={styles.row}>
                <View style={styles.mainCell}><Text style={styles.ship}>{row.shipName}</Text><Text style={styles.date}>{row.sailDate || 'Date missing'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>Offer</Text><Text style={styles.value}>{row.offerCode || 'Not attached'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>Type</Text><Text style={styles.value}>{row.offerType}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>Points cost</Text><Text style={styles.value}>{formatNumber(row.pointsRequired || 0)}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>Confidence</Text><Text style={styles.value}>{row.confidence}</Text></View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {summary.warnings.length > 0 && (
        <View style={styles.warning}><AlertTriangle size={14} color={COLORS.warning} /><Text style={styles.warningText}>{summary.warnings.slice(0, 2).join(' • ')}</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDeep },
  subtitle: { fontSize: 12, color: COLORS.gray[600], marginBottom: 12, lineHeight: 17 },
  empty: { color: COLORS.gray[600], fontSize: 13 },
  table: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: 'rgba(15,23,42,0.03)', borderRadius: 12, padding: 10, gap: 12, minWidth: 720 },
  mainCell: { width: 170 },
  cell: { width: 120 },
  ship: { fontWeight: '800', color: COLORS.navyDeep, fontSize: 13 },
  date: { color: COLORS.gray[600], fontSize: 12, marginTop: 2 },
  label: { color: COLORS.gray[500], fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { color: COLORS.navyDeep, fontSize: 13, fontWeight: '700', marginTop: 2 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: 'rgba(245,158,11,0.1)', padding: 8, borderRadius: 10 },
  warningText: { flex: 1, color: COLORS.gray[700], fontSize: 12, lineHeight: 16 },
});
