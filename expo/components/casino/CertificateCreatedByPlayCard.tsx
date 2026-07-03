import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Award } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { formatCurrencyDetailed, formatNumber } from '@/lib/format';
import type { CasinoValueAttributionSummary } from '@/lib/analytics/casinoValueAttribution';

type Props = { summary: CasinoValueAttributionSummary };

export function CertificateCreatedByPlayCard({ summary }: Props) {
  const chains = summary.certificateEarningChains.slice(0, 5);
  return (
    <View style={styles.card} testID="certificate-created-by-play-card">
      <View style={styles.header}><Award size={18} color={COLORS.goldDark} /><Text style={styles.title}>Certificate Created by Play</Text></View>
      <Text style={styles.subtitle}>Links prior completed cruise play to instant certificates used for booked cruises.</Text>
      {chains.length === 0 ? <Text style={styles.empty}>No instant-certificate earning chains linked yet.</Text> : chains.map((chain) => (
        <View key={`${chain.bookedCruiseId}-${chain.offerCode}`} style={styles.chainRow}>
          <Text style={styles.chainTitle}>{chain.offerCode} → {chain.bookedCruiseName}</Text>
          <Text style={styles.chainMeta}>Requires {formatNumber(chain.pointsRequired)} pts · coin-in volume {formatCurrencyDetailed(chain.acquisitionCoinInVolume || 0)}</Text>
          <Text style={styles.chainMeta}>Likely earned from: {chain.likelyEarningCruiseName || 'not linked'} · result {formatCurrencyDetailed(chain.casinoResultOnEarningCruise || 0)} · confidence {chain.confidence}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDeep },
  subtitle: { color: COLORS.gray[600], fontSize: 12, lineHeight: 17, marginBottom: 10 },
  empty: { color: COLORS.gray[600], fontSize: 13 },
  chainRow: { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 10, marginTop: 8 },
  chainTitle: { fontWeight: '800', color: COLORS.navyDeep, fontSize: 13 },
  chainMeta: { color: COLORS.gray[700], fontSize: 12, marginTop: 3, lineHeight: 16 },
});
