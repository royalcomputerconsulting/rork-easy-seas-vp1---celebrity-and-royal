import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CasinoStrengthRating } from '@/lib/casino/casinoStrengthRating';

function titleCase(value: string): string {
  return value.split('-').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ');
}

export function CasinoStrengthRatingCard({ rating }: { rating: CasinoStrengthRating }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Casino Strength Rating</Text>
      <Text style={styles.score}>{titleCase(rating.internalClassification)} — {rating.strengthScore}/100</Text>
      <Text style={styles.subtitle}>Official tier: {titleCase(rating.officialTier)}</Text>
      <View style={styles.row}><Text style={styles.label}>Certificate signal</Text><Text style={styles.value}>{rating.certificateSignalScore}/100</Text></View>
      <View style={styles.row}><Text style={styles.label}>Points signal</Text><Text style={styles.value}>{rating.pointsSignalScore}/100</Text></View>
      <View style={styles.row}><Text style={styles.label}>Offer value signal</Text><Text style={styles.value}>{rating.offerValueSignalScore}/100</Text></View>
      <Text style={styles.disclaimer}>Casino Strength Rating is an EasySeas internal estimate based on points, certificates, offers, FreePlay, trade-in value, and historical play. It is not an official Royal Caribbean Club Royale tier.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, backgroundColor: '#0f172a', marginVertical: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  score: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 6 },
  subtitle: { color: '#cbd5e1', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { color: '#cbd5e1' },
  value: { color: '#fff', fontWeight: '700' },
  disclaimer: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
});

export default CasinoStrengthRatingCard;
