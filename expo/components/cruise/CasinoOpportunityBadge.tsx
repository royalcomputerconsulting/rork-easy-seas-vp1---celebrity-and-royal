import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { calculateCasinoOpportunityScore, type CasinoOpportunityScore } from '@/lib/cruise/casinoOpportunityScore';

type Props = { cruise?: Parameters<typeof calculateCasinoOpportunityScore>[0]; score?: CasinoOpportunityScore };

export function CasinoOpportunityBadge({ cruise, score }: Props) {
  const resolved = score ?? calculateCasinoOpportunityScore(cruise);
  const color = resolved.score === null ? '#6B7280' : resolved.score >= 70 ? '#059669' : resolved.score >= 45 ? '#D97706' : '#DC2626';
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}12` }]}>
      <Text style={[styles.text, { color }]}>{resolved.score === null ? 'Casino opportunity unknown' : `${resolved.score}/100 · ${resolved.label}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
