import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { summarizeFutureValueWallet, type FutureValueWalletItem } from '@/lib/value/futureValueWallet';

type Props = { items?: FutureValueWalletItem[] };

export function FutureValueWalletCard({ items = [] }: Props) {
  const summary = summarizeFutureValueWallet(items);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Future Value Wallet</Text>
      <Text style={styles.metric}>${summary.totalAvailable.toLocaleString()} available</Text>
      <Text style={styles.body}>{summary.expiringSoon.length} expiring soon · {summary.expired.length} expired kept for records</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' },
  title: { fontSize: 16, fontWeight: '800', color: '#123D73' },
  metric: { marginTop: 8, fontSize: 18, fontWeight: '900', color: '#059669' },
  body: { marginTop: 6, color: '#475569' },
});
