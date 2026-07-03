import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CasinoStrengthForecast } from '@/lib/casino/casinoForecasting';

function titleCase(value: string | null | undefined): string {
  return String(value ?? 'unknown').split('-').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ');
}

function money(value: number | null | undefined): string {
  const parsed = Number(value ?? 0);
  return `$${Math.round(Number.isFinite(parsed) ? parsed : 0).toLocaleString()}`;
}

function points(value: number | null | undefined): string {
  const parsed = Number(value ?? 0);
  return `${Math.round(Number.isFinite(parsed) ? parsed : 0).toLocaleString()} pts`;
}

export function CasinoForecastingCard({ forecast }: { forecast: CasinoStrengthForecast }) {
  const primaryPrediction = forecast.predictedNextMonthCertificates.find((item) => item.bank === 'C') ?? forecast.predictedNextMonthCertificates[0];
  const instant = forecast.instantCertificatePrediction;
  const movement = forecast.movementForecast;
  const ev = forecast.futurePlayExpectedValue;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Casino Forecasting Engine</Text>
      <Text style={styles.subtitle}>Next-month certificates, instant certificate pace, movement forecast, annual value, and future play EV.</Text>

      <View style={styles.highlightBox}>
        <Text style={styles.highlightLabel}>Predicted next monthly certificate</Text>
        <Text style={styles.highlightValue}>{primaryPrediction?.predictedOfferCodeExample ?? 'Needs data'} · {titleCase(primaryPrediction?.predictedClassification)}</Text>
        <Text style={styles.muted}>{primaryPrediction?.reason ?? 'Add certificate history or completed-cruise points for a prediction.'}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Instant level</Text>
          <Text style={styles.metricValue}>{instant.earnedLevelCode ?? 'None yet'}</Text>
          <Text style={styles.metricNote}>Next: {instant.nextLevelCode ?? 'Top level'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Points needed</Text>
          <Text style={styles.metricValue}>{points(instant.pointsNeeded)}</Text>
          <Text style={styles.metricNote}>Slots: {money(instant.estimatedSlotCoinInNeeded)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Annual value</Text>
          <Text style={styles.metricValue}>{titleCase(forecast.annualCruiseValueForecast.expectedAnnualBenefit)}</Text>
          <Text style={styles.metricNote}>{money(forecast.annualCruiseValueForecast.estimatedValue)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Movement</Text>
          <Text style={styles.metricValue}>{titleCase(movement.currentClassification)} → {movement.nextUpClassification ? titleCase(movement.nextUpClassification) : 'Top/unknown'}</Text>
          <Text style={styles.metricNote}>{movement.pointsNeededForNextSignal === null ? 'Needs data' : `${points(movement.pointsNeededForNextSignal)} signal gap`}</Text>
        </View>
      </View>

      <View style={styles.evBox}>
        <Text style={styles.sectionTitle}>Future casino-play value estimate</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Certificate value</Text><Text style={styles.rowValue}>{money(ev.expectedCertificateValue)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Expected FreePlay</Text><Text style={styles.rowValue}>{money(ev.expectedFreePlay)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Expected trade-in</Text><Text style={styles.rowValue}>{money(ev.expectedTradeIn)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Offer improvement</Text><Text style={styles.rowValue}>{money(ev.expectedOfferImprovementValue)}</Text></View>
      </View>

      <Text style={styles.warning}>EasySeas forecasting is directional and internal. It is not an official Royal Caribbean rating, offer promise, win prediction, or gambling recommendation. Estimated coin-in is not expected loss.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, backgroundColor: '#111827', marginVertical: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#cbd5e1', marginTop: 4, marginBottom: 12, fontSize: 13 },
  highlightBox: { backgroundColor: '#1f2937', borderRadius: 14, padding: 12, marginBottom: 12 },
  highlightLabel: { color: '#93c5fd', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  highlightValue: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  muted: { color: '#cbd5e1', marginTop: 6, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', backgroundColor: '#0f172a', borderRadius: 14, padding: 10 },
  metricLabel: { color: '#94a3b8', fontSize: 12 },
  metricValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 3 },
  metricNote: { color: '#cbd5e1', fontSize: 12, marginTop: 3 },
  evBox: { backgroundColor: '#0f172a', borderRadius: 14, padding: 12, marginTop: 12 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { color: '#cbd5e1' },
  rowValue: { color: '#fff', fontWeight: '800' },
  warning: { color: '#fbbf24', fontSize: 12, marginTop: 12, lineHeight: 17 },
});

export default CasinoForecastingCard;
