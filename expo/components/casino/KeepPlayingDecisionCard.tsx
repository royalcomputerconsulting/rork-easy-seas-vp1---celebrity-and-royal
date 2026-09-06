import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { buildCertificateChaseRecommendation } from '@/lib/certificates/certificateChaseRecommendation';

export function KeepPlayingDecisionCard({ currentPoints }: { currentPoints: number }) {
  const rec = buildCertificateChaseRecommendation({ currentPoints });
  return <View style={styles.card}><Text style={styles.title}>Keep Playing Decision</Text><Text style={styles.metric}>{rec.recommendation}</Text><Text style={styles.body}>{rec.reasons[0]}</Text><Text style={styles.warning}>Estimated coin-in is wagering volume, not expected loss.</Text></View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDE7F5' }, title: { fontWeight: '800', color: '#123D73' }, metric: { marginTop: 6, fontWeight: '900', color: '#1557C7' }, body: { marginTop: 6, color: '#334155' }, warning: { marginTop: 6, fontSize: 11, color: '#92400E' } });
