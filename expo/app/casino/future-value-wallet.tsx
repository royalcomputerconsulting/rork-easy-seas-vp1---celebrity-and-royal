import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, WalletCards } from 'lucide-react-native';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { calculateCruiseValueWithLedger } from '@/lib/value/cruiseValueCalculations';
import { summarizeFutureValueWallet, type FutureValueWalletItem } from '@/lib/value/futureValueWallet';
import { buildDefaultUserBenefitOverrides } from '@/lib/value/userBenefitOverrides';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles } from '@/constants/darkRoyalTheme';

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export default function FutureValueWalletScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();

  const data = useMemo(() => {
    const ledgerWalletItems: FutureValueWalletItem[] = [];
    let casinoCompValue = 0;
    let crownAnchorValue = 0;
    let futureCreditApplied = 0;
    let signatureObc = 0;
    let internetBenefit = 0;

    for (const cruise of bookedCruises) {
      const result = calculateCruiseValueWithLedger(cruise as unknown as Record<string, unknown>);
      casinoCompValue += result.totals.casinoCompValue;
      crownAnchorValue += result.totals.crownAnchorValue;
      futureCreditApplied += result.totals.futureCreditApplied;
      signatureObc += result.totals.signatureObc;
      internetBenefit += result.totals.internetBenefitValue;

      for (const row of result.ledger) {
        if (!['future-cruise-credit', 'nextcruise-obc', 'nextcruise-instant-savings', 'signature-obc', 'club-royale-annual-cruise', 'crown-anchor-milestone-cruise'].includes(row.category)) continue;
        ledgerWalletItems.push({
          id: row.id,
          type: row.category === 'future-cruise-credit' ? 'fcc' : row.category === 'club-royale-annual-cruise' ? 'annual-cruise' : row.category === 'crown-anchor-milestone-cruise' ? 'crown-anchor-certificate' : row.category === 'signature-obc' ? 'obc' : 'nextcruise',
          label: row.label,
          amount: row.amount,
          assignedCruiseId: row.cruiseId,
          status: row.status === 'expected' || row.status === 'confirmed' ? 'assigned' : row.status,
          source: row.source === 'club-royale' || row.source === 'crown-anchor' || row.source === 'nextcruise' || row.source === 'fcc' ? row.source : 'unknown',
          notes: row.notes,
        });
      }
    }
    return { summary: summarizeFutureValueWallet(ledgerWalletItems), totals: { casinoCompValue, crownAnchorValue, futureCreditApplied, signatureObc, internetBenefit }, overrides: buildDefaultUserBenefitOverrides('scott') };
  }, [bookedCruises]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="future-value-wallet-back">
          <ChevronLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={dashStyles.screenTitle}>Future Value Wallet</Text>
          <Text style={dashStyles.screenSubtitle}>NextCruise, FCCs, annual cruises, milestone certificates, OBC, and expiring value.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[dashStyles.card, styles.hero]}>
          <WalletCards size={28} color={COLORS.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Available / assigned wallet value</Text>
            <Text style={styles.heroValue}>{money(data.summary.totalAvailable + data.summary.totalAssigned)}</Text>
            <Text style={styles.heroNote}>{data.summary.expiringSoon.length} expiring soon · {data.summary.expired.length} expired kept for records</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Metric label="Casino Comp Value" value={money(data.totals.casinoCompValue)} />
          <Metric label="Crown & Anchor Value" value={money(data.totals.crownAnchorValue)} />
          <Metric label="Future Credit Applied" value={money(data.totals.futureCreditApplied)} />
          <Metric label="Signature OBC" value={money(data.totals.signatureObc)} />
          <Metric label="VOOM Benefit" value={money(data.totals.internetBenefit)} />
          <Metric label="Loaded Items" value={String(data.summary.items.length)} />
        </View>

        <View style={[dashStyles.card, styles.guardrailCard]}>
          <Text style={styles.cardTitle}>Double-counting guardrails</Text>
          <Text style={styles.bodyText}>FCCs reduce cash owed but are not casino comp value. OBC is counted once; items purchased with OBC should be tagged as the spending category, not added again as separate value. Coin-in is wagering volume, not cost.</Text>
        </View>

        <View style={[dashStyles.card, styles.guardrailCard]}>
          <Text style={styles.cardTitle}>Default overrides loaded</Text>
          {data.overrides.map((override) => (
            <Text key={override.id} style={styles.bodyText}>• {override.benefitType}: {money(override.amount)} through {override.validThrough ?? 'open-ended'}</Text>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          {data.summary.items.slice(0, 80).map((item) => (
            <View key={item.id} style={[dashStyles.card, styles.itemCard]}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle}>{item.label}</Text>
                <Text style={styles.itemAmount}>{money(item.amount)}</Text>
              </View>
              <Text style={styles.itemMeta}>{item.type} · {item.status} · {item.source}</Text>
              {item.expirationDate ? <Text style={styles.itemMeta}>Expires: {item.expirationDate}</Text> : null}
            </View>
          ))}
          {data.summary.items.length === 0 ? (
            <View style={[dashStyles.card, styles.emptyCard]}>
              <Text style={styles.bodyText}>No future wallet rows were created from the current cruise data yet. Add FCC, NextCruise, annual cruise, OBC, or milestone values to cruises and they will appear here.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={[dashStyles.card, styles.metricCard]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 60, gap: 14 },
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroLabel: { color: COLORS.textSecondary, fontSize: 12.5, fontWeight: '700' as const },
  heroValue: { color: COLORS.gold, fontSize: 28, fontWeight: '900' as const, marginTop: 2 },
  heroNote: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minWidth: 150 },
  metricLabel: { color: COLORS.textMuted, fontSize: 11.5, fontWeight: '700' as const },
  metricValue: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' as const, marginTop: 4 },
  guardrailCard: { gap: 6 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' as const },
  bodyText: { color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18 },
  itemCard: { gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemTitle: { color: COLORS.textPrimary, fontSize: 13.5, fontWeight: '800' as const, flex: 1 },
  itemAmount: { color: COLORS.gold, fontSize: 13.5, fontWeight: '900' as const },
  itemMeta: { color: COLORS.textMuted, fontSize: 11.5 },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
});
