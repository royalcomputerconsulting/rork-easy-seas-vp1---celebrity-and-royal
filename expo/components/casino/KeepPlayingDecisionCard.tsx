import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Target } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { formatCurrencyDetailed, formatNumber } from '@/lib/format';
import { INSTANT_CERTIFICATE_POINTS_LADDER } from '@/lib/offers/offerCodeClassifier';
import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';

type Props = { currentPoints: number; stopLoss?: number; estimatedNextCertificateValue?: number };

const THRESHOLDS = Object.entries(INSTANT_CERTIFICATE_POINTS_LADDER)
  .map(([level, points]) => ({ level, points }))
  .sort((a, b) => a.points - b.points);

export function KeepPlayingDecisionCard({ currentPoints, stopLoss = 200, estimatedNextCertificateValue = 2500 }: Props) {
  const next = THRESHOLDS.find((row) => row.points > currentPoints) || THRESHOLDS[THRESHOLDS.length - 1];
  const pointsNeeded = Math.max(0, next.points - currentPoints);
  const coinInNeeded = pointsNeeded > 0 ? estimateCoinInForPoints({ targetPoints: pointsNeeded, brand: 'royal', gameCategory: 'reel-slot' }).coinIn ?? 0 : 0;
  const worthPursuing = pointsNeeded > 0 && estimatedNextCertificateValue > stopLoss;
  return (
    <View style={styles.card} testID="keep-playing-decision-card">
      <View style={styles.header}><Target size={18} color={COLORS.royalPurple} /><Text style={styles.title}>Keep Playing / Stop Playing Decision</Text></View>
      <View style={styles.grid}>
        <Metric label="Current points" value={`${formatNumber(currentPoints)} pts`} />
        <Metric label={`Next target ${next.level}`} value={`${formatNumber(pointsNeeded)} pts needed`} />
        <Metric label="Coin-in volume" value={formatCurrencyDetailed(coinInNeeded)} />
        <Metric label="Stop-loss cap" value={formatCurrencyDetailed(stopLoss)} />
      </View>
      <Text style={[styles.recommendation, { color: worthPursuing ? COLORS.success : COLORS.warning }]}>
        {pointsNeeded === 0 ? 'You are already at or above the tracked certificate target.' : worthPursuing ? 'Worth considering only if you stay within bankroll cap; coin-in is volume, not cost.' : 'Do not chase. The next certificate value may not justify exceeding your bankroll cap.'}
      </Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDeep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', backgroundColor: 'rgba(15,23,42,0.04)', borderRadius: 12, padding: 10 },
  metricValue: { color: COLORS.navyDeep, fontWeight: '900', fontSize: 14 },
  metricLabel: { color: COLORS.gray[600], fontSize: 10, marginTop: 3 },
  recommendation: { marginTop: 12, fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
