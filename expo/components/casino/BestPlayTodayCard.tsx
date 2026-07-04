import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { buildBestPlayTodayPlan, type BestPlayTodayPlan } from '@/lib/casino/bestPlayToday';

type Props = { plan?: BestPlayTodayPlan; cruises?: Parameters<typeof buildBestPlayTodayPlan>[0]['cruises'] };

export function BestPlayTodayCard({ plan, cruises }: Props) {
  const resolved = plan ?? buildBestPlayTodayPlan({ cruises });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Best Play Today</Text>
      <Text style={styles.subtitle}>{resolved.shipName} · {resolved.date}</Text>
      <Text style={styles.action}>{resolved.recommendedAction.toUpperCase()}</Text>
      <Text style={styles.body}>{resolved.reason}</Text>
      <Text style={styles.metric}>{resolved.targetPoints.toLocaleString()} pts · ${resolved.estimatedCoinIn.toLocaleString()} est. coin-in</Text>
      <Text style={styles.warning}>Coin-in is wagering volume, not cost.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' },
  title: { fontSize: 16, fontWeight: '800', color: '#123D73' },
  subtitle: { marginTop: 2, color: '#64748B' },
  action: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#1557C7' },
  body: { marginTop: 6, color: '#334155' },
  metric: { marginTop: 8, fontWeight: '800', color: '#059669' },
  warning: { marginTop: 6, fontSize: 11, color: '#92400E' },
});
