import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { CompletedCruiseCasinoValueRecord } from '@/lib/cruise/completedCruiseHistory';

function money(value?: number): string {
  if (value === undefined || value === null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

export function CompletedCruiseLedgerCard({ records }: { records: CompletedCruiseCasinoValueRecord[] }) {
  const sorted = [...records].sort((a, b) => b.sailingDate.localeCompare(a.sailingDate));
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Completed Cruise Casino & Value Ledger</Text>
      <Text style={styles.subtitle}>Every completed sailing with points, win/loss, or value stays in analytics.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.header]}>
            <Text style={styles.cellShip}>Ship</Text><Text style={styles.cell}>Sail Date</Text><Text style={styles.cell}>Pts</Text><Text style={styles.cell}>Win/Loss</Text><Text style={styles.cell}>Casino Value</Text><Text style={styles.cell}>Confidence</Text>
          </View>
          {sorted.map((record) => (
            <View key={record.id} style={styles.row}>
              <Text style={styles.cellShip}>{record.shipName}</Text>
              <Text style={styles.cell}>{record.sailingDate}</Text>
              <Text style={styles.cell}>{record.pointsEarned?.toLocaleString() ?? '—'}</Text>
              <Text style={styles.cell}>{money(record.casinoWinLoss)}</Text>
              <Text style={styles.cell}>{money(record.casinoCompValue ?? record.totalValueReceived)}</Text>
              <Text style={styles.cell}>{record.dataConfidence}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {sorted.some((record) => record.warnings.length) ? <Text style={styles.warning}>Some completed cruises need points, win/loss, value, or source verification.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, backgroundColor: '#111827', marginVertical: 8 },
  title: { color: '#fff', fontWeight: '700', fontSize: 18 },
  subtitle: { color: '#cbd5e1', marginBottom: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: 8 },
  header: { borderBottomColor: 'rgba(255,255,255,0.25)' },
  cellShip: { color: '#fff', width: 170, fontWeight: '600' },
  cell: { color: '#cbd5e1', width: 110 },
  warning: { color: '#fbbf24', marginTop: 10 },
});

export default CompletedCruiseLedgerCard;
