import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { calculateTrueMakeout } from '@/lib/value/trueMakeout';

export function TrueMakeoutLedgerCard({ input }: { input: Parameters<typeof calculateTrueMakeout>[0] }) {
  const value = calculateTrueMakeout(input);
  return <View style={styles.card}><Text style={styles.title}>True Make-Out</Text><Text style={styles.metric}>${Math.round(value.trueMakeout).toLocaleString()}</Text><Text style={styles.body}>Coin-in is wagering volume, not cost.</Text></View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' }, title: { fontWeight: '800', color: '#123D73' }, metric: { marginTop: 6, fontWeight: '900', color: '#059669', fontSize: 18 }, body: { marginTop: 6, color: '#334155' } });
