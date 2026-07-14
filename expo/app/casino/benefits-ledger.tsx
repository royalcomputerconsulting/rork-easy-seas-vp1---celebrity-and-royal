import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gift, ChevronLeft, Wifi, Utensils, Waves, Coins, Wallet } from 'lucide-react-native';
import { useCasinoEconomicsData } from '@/hooks/useCasinoEconomicsData';
import { useCasinoSettings } from '@/state/CasinoSettingsProvider';
import { resolveFreePlayInclusion, resolveObcInclusion } from '@/lib/casinoLedger/duplicateGuard';
import { formatCurrency, formatCurrencyDetailed } from '@/lib/format';
import { createDateFromString } from '@/lib/date';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles } from '@/constants/darkRoyalTheme';
import { useDrillDown, type CalculationDrillDownData } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import type { BookedCruise } from '@/types/models';

type BenefitKey = 'freePlay' | 'obc' | 'signatureObc' | 'voom' | 'dining' | 'spa' | 'beverage' | 'tradeIn';

interface BenefitRow {
  key: BenefitKey;
  label: string;
  icon: typeof Gift;
  amount: number;
  included: boolean;
  reason: string;
}

/**
 * Stage 9.4 - Full Casino Benefits Ledger. Groups every non-cash-result
 * benefit (FreePlay, OBC, Signature $75 OBC, VOOM, dining, spa, beverage,
 * trade-in) per cruise, using the same duplicate-counting guard already
 * powering the shared ledger so nothing here contradicts Cruise Value.
 */
export default function BenefitsLedgerScreen() {
  const router = useRouter();
  const { bookedCruises } = useCasinoEconomicsData();
  const { settings } = useCasinoSettings();
  const { clubRoyaleTier, clubRoyaleCurrentYearPoints } = useLoyalty();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const drill = useDrillDown();

  const isSignatureObcEligible = useCallback((cruise: BookedCruise): boolean => {
    if (!cruise.sailDate) return false;
    const sail = createDateFromString(cruise.sailDate).getTime();
    const start = createDateFromString(settings.signatureObcStartDate).getTime();
    const end = createDateFromString(settings.signatureObcEndDate).getTime();
    return sail >= start && sail <= end;
  }, [settings.signatureObcStartDate, settings.signatureObcEndDate]);

  const rows = useMemo(() => {
    return bookedCruises
      .map((cruise) => {
        const freePlayInclusion = resolveFreePlayInclusion(cruise);
        const obcInclusion = resolveObcInclusion(cruise);
        const nights = cruise.nights ?? 0;
        const voomValue = cruise.voomValue ?? (nights > 0 ? settings.voomDailyPrice * settings.voomDeviceCount * nights : 0);
        const signatureEligible = isSignatureObcEligible(cruise);

        const benefits: BenefitRow[] = [
          { key: 'freePlay', label: 'FreePlay', icon: Coins, amount: freePlayInclusion.amount, included: freePlayInclusion.includedInTotal, reason: freePlayInclusion.reason },
          { key: 'obc', label: 'Onboard Credit (OBC)', icon: Wallet, amount: obcInclusion.amount, included: obcInclusion.includedInTotal, reason: obcInclusion.reason },
          {
            key: 'signatureObc',
            label: 'Signature $75 OBC',
            icon: Wallet,
            amount: signatureEligible ? settings.signatureObcAmount : 0,
            included: signatureEligible,
            reason: signatureEligible
              ? `Cruise sails within the Signature OBC window (${settings.signatureObcStartDate} to ${settings.signatureObcEndDate}) set in Casino Settings.`
              : 'This cruise sails outside the Signature OBC window set in Casino Settings, so no Signature OBC is assumed.',
          },
          {
            key: 'voom',
            label: 'VOOM / Internet',
            icon: Wifi,
            amount: voomValue,
            included: voomValue > 0,
            reason: cruise.voomValue
              ? 'Actual VOOM value entered on this cruise.'
              : `Estimated as ${formatCurrency(settings.voomDailyPrice)}/day x ${settings.voomDeviceCount} device(s) x ${nights} night(s) from Casino Settings defaults.`,
          },
          { key: 'dining', label: 'Specialty Dining', icon: Utensils, amount: cruise.diningValue ?? 0, included: (cruise.diningValue ?? 0) > 0, reason: (cruise.diningValue ?? 0) > 0 ? 'Entered on this cruise\u2019s casino ledger details.' : 'No specialty dining value recorded.' },
          { key: 'spa', label: 'Spa', icon: Waves, amount: cruise.spaValue ?? 0, included: (cruise.spaValue ?? 0) > 0, reason: (cruise.spaValue ?? 0) > 0 ? 'Entered on this cruise\u2019s casino ledger details.' : 'No spa value recorded.' },
          { key: 'beverage', label: 'Beverage Package', icon: Gift, amount: cruise.beverageValue ?? 0, included: (cruise.beverageValue ?? 0) > 0, reason: (cruise.beverageValue ?? 0) > 0 ? 'Entered on this cruise\u2019s casino ledger details.' : 'No beverage package value recorded.' },
          { key: 'tradeIn', label: 'Trade-In Value', icon: Gift, amount: cruise.tradeInValue ?? 0, included: (cruise.tradeInValue ?? 0) > 0, reason: (cruise.tradeInValue ?? 0) > 0 ? 'Entered on this cruise\u2019s casino ledger details.' : 'No trade-in value recorded.' },
        ];

        const totalIncluded = benefits.reduce((sum, b) => sum + (b.included ? b.amount : 0), 0);
        const anyBenefit = benefits.some((b) => b.amount > 0);
        return { cruise, benefits, totalIncluded, anyBenefit };
      })
      .filter((row) => row.anyBenefit)
      .sort((a, b) => createDateFromString(b.cruise.sailDate).getTime() - createDateFromString(a.cruise.sailDate).getTime());
  }, [bookedCruises, settings, isSignatureObcEligible]);

  const grandTotal = useMemo(() => rows.reduce((sum, r) => sum + r.totalIncluded, 0), [rows]);

  const openBenefitDrill = useCallback((cruise: BookedCruise, benefit: BenefitRow) => {
    const data: CalculationDrillDownData = {
      title: benefit.label,
      subtitle: `${cruise.shipName || 'Unknown Ship'} — ${cruise.sailDate}`,
      summary: benefit.reason,
      inputs: [
        { label: 'Amount', value: formatCurrencyDetailed(benefit.amount) },
        { label: 'Counted in total value?', value: benefit.included ? 'Yes' : 'No — excluded to avoid double-counting' },
      ],
      relatedActions: [
        { label: 'Edit Casino Record', onPress: () => { drill.close(); router.push({ pathname: '/(tabs)/analytics', params: { tab: 'portfolio' } } as any); } },
      ],
    };
    drill.open(data);
  }, [drill, router]);

  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / CLUB_ROYALE_TIERS.Signature.threshold) * 100));

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={dashStyles.screenTitle}>Casino Benefits Ledger</Text>
        <Text style={dashStyles.screenSubtitle}>FreePlay, OBC, VOOM, dining, spa, and more — with duplicate-counting protection</Text>
      </View>

      <View style={[dashStyles.card, styles.totalCard]}>
        <Text style={dashStyles.cardLabel}>Total Counted Benefit Value</Text>
        <Text style={[dashStyles.bigNumber, { fontSize: 26, color: COLORS.gold }]}>{formatCurrency(grandTotal)}</Text>
        <Text style={styles.totalSub}>Only amounts marked "counted" below are included, to avoid double-counting value already reflected elsewhere.</Text>
      </View>

      <View style={{ gap: 12 }}>
        {rows.map(({ cruise, benefits, totalIncluded }) => (
          <View key={cruise.id} style={[dashStyles.card, styles.cruiseCard]}>
            <View style={styles.cruiseHeaderRow}>
              <Text style={styles.cruiseTitle} numberOfLines={1}>{cruise.shipName || 'Unknown Ship'}</Text>
              <Text style={styles.cruiseValue}>{formatCurrency(totalIncluded)}</Text>
            </View>
            <Text style={styles.cruiseSub}>{cruise.sailDate}</Text>
            <View style={{ marginTop: 8, gap: 6 }}>
              {benefits.filter((b) => b.amount > 0).map((benefit) => (
                <TouchableOpacity
                  key={benefit.key}
                  style={styles.benefitRow}
                  activeOpacity={0.75}
                  onPress={() => openBenefitDrill(cruise, benefit)}
                  testID={`benefit-row-${cruise.id}-${benefit.key}`}
                >
                  <benefit.icon size={14} color={COLORS.textSecondary} />
                  <Text style={styles.benefitLabel} numberOfLines={1}>{benefit.label}</Text>
                  <Text style={[styles.benefitPill, { color: benefit.included ? COLORS.green : COLORS.textMuted }]}>
                    {benefit.included ? 'Counted' : 'Excluded'}
                  </Text>
                  <Text style={styles.benefitValue}>{formatCurrency(benefit.amount)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {rows.length === 0 && (
          <View style={[dashStyles.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Gift size={22} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}>No benefit values recorded on any cruise yet.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="benefits-ledger-back-button">
            <ChevronLeft size={20} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Casino</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.contentRow}>
        {showSidebar && (
          <CasinoSidebar
            activeTab="action"
            onTabChange={(tab) => router.replace({ pathname: '/(tabs)/analytics' as any, params: { tab } })}
            onOverviewPress={() => router.push('/(tabs)/(overview)' as any)}
            onSettingsPress={() => router.push('/(tabs)/settings' as any)}
            clubRoyaleTier={clubRoyaleTier}
            clubRoyalePoints={clubRoyaleCurrentYearPoints}
            tierProgressPct={signaturePct}
            tierProgressLabel="Signature progress"
            onStatusPress={() => router.push('/casino/loyalty-data' as any)}
          />
        )}
        <View style={{ flex: 1 }}>{body}</View>
      </View>
      {drill.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  contentRow: { flex: 1, flexDirection: 'row' },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 14 },
  mobileTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backButtonText: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  totalCard: { gap: 4 },
  totalSub: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 4 },
  cruiseCard: { gap: 2 },
  cruiseHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cruiseTitle: { fontSize: 14, fontWeight: '700' as const, color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  cruiseValue: { fontSize: 15, fontWeight: '800' as const, color: COLORS.gold },
  cruiseSub: { fontSize: 11.5, color: COLORS.textMuted },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  benefitLabel: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary },
  benefitPill: { fontSize: 10.5, fontWeight: '700' as const },
  benefitValue: { fontSize: 12.5, fontWeight: '700' as const, color: COLORS.textPrimary, minWidth: 60, textAlign: 'right' as const },
});
