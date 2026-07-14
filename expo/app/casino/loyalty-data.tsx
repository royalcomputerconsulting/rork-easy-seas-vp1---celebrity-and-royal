import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Anchor,
  Crown,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Database,
  Pencil,
  ShieldCheck,
} from 'lucide-react-native';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useAuth } from '@/state/AuthProvider';
import { useUserDataSync } from '@/state/UserDataSyncProvider';
import { formatNumber } from '@/lib/format';
import { CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { CROWN_ANCHOR_LEVELS, LEVEL_ORDER } from '@/constants/crownAnchor';
import { DARK_ROYAL_COLORS as COLORS, darkRoyalDashboardStyles as dashStyles } from '@/constants/darkRoyalTheme';
import { useDrillDown, type CalculationDrillDownData } from '@/components/casino-dashboard/CalculationDrillDownDrawer';
import { CasinoSidebar } from '@/components/casino-dashboard/CasinoSidebar';
import { LARGE_SCREEN_BREAKPOINT } from '@/constants/layout';

/**
 * Dedicated Crown & Anchor / Loyalty Data screen (Stage 8 mockup screen 2
 * of 4). Shows the two loyalty program hero cards, a data-integrity panel,
 * Signature/Masters progress bars, and the full Pinnacle Club level
 * stepper — all backed by the real `useLoyalty` provider data.
 */
export default function LoyaltyDataScreen() {
  const router = useRouter();
  const { authenticatedEmail } = useAuth();
  const { lastSyncTime, isSyncing, forceSyncNow } = useUserDataSync();
  const {
    clubRoyaleTier,
    clubRoyaleCurrentYearPoints,
    clubRoyaleHistoricalPoints,
    clubRoyaleHistoricalTier,
    clubRoyaleSyncDiscrepancy,
    clubRoyalePointsSource,
    crownAnchorPoints,
    crownAnchorLevel,
    projectedCrownAnchorPoints,
    crownAnchorProgress,
  } = useLoyalty();
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const drill = useDrillDown();

  const dataAsOfLabel = useMemo(() => {
    if (!lastSyncTime) return 'Data as of your last local update';
    const parsed = new Date(lastSyncTime);
    if (Number.isNaN(parsed.getTime())) return 'Data as of your last local update';
    return `Data as of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [lastSyncTime]);

  const handleSyncNow = useCallback(() => {
    if (authenticatedEmail) {
      forceSyncNow().catch((error) => console.error('[LoyaltyData] Sync Now failed:', error));
    }
  }, [authenticatedEmail, forceSyncNow]);

  const signatureThreshold = CLUB_ROYALE_TIERS.Signature.threshold;
  const mastersThreshold = CLUB_ROYALE_TIERS.Masters.threshold;
  const signaturePct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / signatureThreshold) * 100));
  const mastersPct = Math.min(100, Math.max(0, (clubRoyaleCurrentYearPoints / mastersThreshold) * 100));
  const pointsToSignature = Math.max(0, signatureThreshold - clubRoyaleCurrentYearPoints);
  const pointsToMasters = Math.max(0, mastersThreshold - clubRoyaleCurrentYearPoints);

  const currentLevelIndex = LEVEL_ORDER.indexOf(crownAnchorLevel);
  const nextLevelKey = currentLevelIndex >= 0 && currentLevelIndex < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentLevelIndex + 1] : null;
  const pinnacleStepperLabels: Record<string, string> = { Pinnacle: 'Pinnacle Club' };

  const manualEntryCount = clubRoyalePointsSource === 'manual' ? 1 : 0;
  const hasDiscrepancy = clubRoyaleSyncDiscrepancy?.hasDiscrepancy ?? false;

  const openCrownAnchorDrill = useCallback(() => {
    drill.open({
      title: 'Crown & Anchor Society',
      subtitle: crownAnchorLevel,
      summary: 'Crown & Anchor cruise points are earned per completed night — 1 point/night double occupancy, 2 points/night solo, with a suite bonus. Levels are lifetime totals, they never reset.',
      formula: 'Crown & Anchor Points = Sum of per-cruise points across every completed sailing (solo/suite multipliers applied)',
      inputs: [
        { label: 'Current cruise points', value: formatNumber(crownAnchorPoints) },
        { label: 'Projected after booked cruises', value: formatNumber(projectedCrownAnchorPoints) },
        { label: 'Current level', value: crownAnchorLevel },
        { label: 'Next level', value: crownAnchorProgress.nextLevel ?? 'Max level reached' },
        { label: 'Points to next level', value: formatNumber(crownAnchorProgress.nightsToNext) },
      ],
      assumptions: ['Booked-cruise projections assume each reservation completes as currently scheduled.'],
    });
  }, [drill, crownAnchorLevel, crownAnchorPoints, projectedCrownAnchorPoints, crownAnchorProgress]);

  const openClubRoyaleDrill = useCallback(() => {
    drill.open({
      title: 'Club Royale',
      subtitle: clubRoyaleTier,
      summary: 'Current Year Points reset every April 1st and determine your Club Royale tier for the season. Historical Points is your all-time lifetime casino point total across every completed cruise.',
      formula: 'Current Year Points = Casino points earned since the last April 1st season reset',
      inputs: [
        { label: 'Current year points', value: formatNumber(clubRoyaleCurrentYearPoints) },
        { label: 'Historical (all-time) points', value: formatNumber(clubRoyaleHistoricalPoints) },
        { label: 'Historical tier', value: clubRoyaleHistoricalTier },
        { label: 'Current tier', value: clubRoyaleTier },
      ],
      missing: hasDiscrepancy && clubRoyaleSyncDiscrepancy.message ? [clubRoyaleSyncDiscrepancy.message] : [],
    });
  }, [drill, clubRoyaleTier, clubRoyaleCurrentYearPoints, clubRoyaleHistoricalPoints, clubRoyaleHistoricalTier, hasDiscrepancy, clubRoyaleSyncDiscrepancy]);

  const openProgressDrill = useCallback((label: string, current: number, threshold: number, remaining: number) => {
    const data: CalculationDrillDownData = {
      title: `${label} Progress`,
      subtitle: `${formatNumber(current)} / ${formatNumber(threshold)} pts`,
      formula: `${label} Progress % = Current Year Points ÷ ${label} Threshold × 100`,
      inputs: [
        { label: 'Current year points', value: formatNumber(current) },
        { label: `${label} threshold`, value: formatNumber(threshold) },
        { label: 'Points remaining', value: formatNumber(remaining) },
      ],
    };
    drill.open(data);
  }, [drill]);

  const openPinnacleDrill = useCallback(() => {
    drill.open({
      title: 'Pinnacle Club Progress',
      subtitle: `${crownAnchorLevel} → ${nextLevelKey ?? 'Max level'}`,
      summary: 'Crown & Anchor levels are lifetime cruise-point milestones. Reaching Pinnacle Club unlocks the top tier of Royal Caribbean loyalty benefits for life.',
      formula: 'Level = Highest tier whose point threshold your lifetime Crown & Anchor points meet or exceed',
      inputs: LEVEL_ORDER.map((level) => ({
        label: pinnacleStepperLabels[level] ?? level,
        value: `${formatNumber(CROWN_ANCHOR_LEVELS[level].cruiseNights)} pts`,
      })),
    });
  }, [drill, crownAnchorLevel, nextLevelKey]);

  const openDataIntegrityDrill = useCallback(() => {
    drill.open({
      title: 'Loyalty Data Integrity',
      subtitle: hasDiscrepancy ? 'Discrepancy detected' : 'No discrepancies',
      summary: 'This panel compares the points calculated from your logged cruises against any points captured from a Royal Caribbean sync. App-entered cruise points are always treated as authoritative.',
      formula: 'Discrepancy = App-Calculated Points − Last Synced Points',
      inputs: [
        { label: 'App-calculated points', value: formatNumber(clubRoyaleSyncDiscrepancy?.appPoints ?? clubRoyaleCurrentYearPoints) },
        { label: 'Last synced points', value: clubRoyaleSyncDiscrepancy?.syncedPoints != null ? formatNumber(clubRoyaleSyncDiscrepancy.syncedPoints) : 'Not synced yet' },
        { label: 'Manual entries on file', value: String(manualEntryCount) },
        { label: 'Last sync', value: dataAsOfLabel },
      ],
      missing: hasDiscrepancy && clubRoyaleSyncDiscrepancy.message ? [clubRoyaleSyncDiscrepancy.message] : [],
    });
  }, [drill, hasDiscrepancy, clubRoyaleSyncDiscrepancy, clubRoyaleCurrentYearPoints, manualEntryCount, dataAsOfLabel]);

  const body = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={dashStyles.screenTitle}>Crown & Anchor / Loyalty Data</Text>
          <Text style={dashStyles.screenSubtitle}>Loyalty status and data integrity overview</Text>
        </View>
        <View>
          <Text style={styles.dataAsOfText} numberOfLines={1}>{dataAsOfLabel}</Text>
          <TouchableOpacity style={styles.syncButton} activeOpacity={0.75} onPress={handleSyncNow} testID="loyalty-sync-now">
            <RefreshCw size={12} color={COLORS.royalBlue} style={isSyncing ? { transform: [{ rotate: '45deg' }] } : undefined} />
            <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing…' : 'Sync Now'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroRow}>
        <TouchableOpacity style={[dashStyles.card, styles.heroCard]} activeOpacity={0.85} onPress={openCrownAnchorDrill} testID="loyalty-crown-anchor-card">
          <View style={styles.heroBrandRow}>
            <Anchor size={16} color={COLORS.brightBlue} />
            <Text style={styles.heroBrandLabel}>Crown & Anchor Society</Text>
          </View>
          <Text style={[styles.heroTier, { color: COLORS.brightBlue }]}>{crownAnchorLevel}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={dashStyles.bigNumber}>{formatNumber(crownAnchorPoints)}</Text>
              <Text style={styles.heroStatLabel}>Current Cruise Points</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={dashStyles.bigNumber}>{formatNumber(projectedCrownAnchorPoints)}</Text>
              <Text style={styles.heroStatLabel}>Projected After Booked Cruises</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[dashStyles.bigNumber, { fontSize: 20 }]}>{formatNumber(crownAnchorProgress.nightsToNext)}</Text>
              <Text style={styles.heroStatLabel}>Points to {crownAnchorProgress.nextLevel ?? 'Max Level'}</Text>
            </View>
          </View>
          <View style={styles.progressTrackFallback}>
            <View style={[styles.progressFill, { width: `${Math.max(2, crownAnchorProgress.percentComplete)}%`, backgroundColor: COLORS.brightBlue }]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[dashStyles.card, styles.heroCard]} activeOpacity={0.85} onPress={openClubRoyaleDrill} testID="loyalty-club-royale-card">
          <View style={styles.heroBrandRow}>
            <Crown size={16} color={COLORS.goldText} />
            <Text style={[styles.heroBrandLabel, { color: COLORS.goldText }]}>Club Royale</Text>
          </View>
          <Text style={[styles.heroTier, { color: COLORS.goldText }]}>{clubRoyaleTier}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={dashStyles.bigNumber}>{formatNumber(clubRoyaleCurrentYearPoints)}</Text>
              <Text style={styles.heroStatLabel}>Current Year Points</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={dashStyles.bigNumber}>{formatNumber(clubRoyaleHistoricalPoints)}</Text>
              <Text style={styles.heroStatLabel}>Historical Points</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[dashStyles.bigNumber, { fontSize: 20 }]}>{clubRoyaleHistoricalTier}</Text>
              <Text style={styles.heroStatLabel}>All Time Tier</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[dashStyles.card, styles.integrityCard]} activeOpacity={0.85} onPress={openDataIntegrityDrill} testID="loyalty-data-integrity-card">
        <View style={styles.integrityRow}>
          <View style={styles.integrityItem}>
            <View style={styles.integrityIconRow}>
              <Database size={14} color={COLORS.green} />
              <Text style={styles.integrityLabel}>Data Source</Text>
            </View>
            <Text style={[styles.integrityValue, { color: COLORS.green }]}>{lastSyncTime ? 'Synced' : 'Local Only'}</Text>
          </View>
          <View style={styles.integrityDivider} />
          <View style={styles.integrityItem}>
            <View style={styles.integrityIconRow}>
              <ShieldCheck size={14} color={hasDiscrepancy ? COLORS.orange : COLORS.green} />
              <Text style={styles.integrityLabel}>Loyalty Data Status</Text>
            </View>
            <Text style={[styles.integrityValue, { color: hasDiscrepancy ? COLORS.orange : COLORS.green }]}>{hasDiscrepancy ? 'Needs Review' : 'Good'}</Text>
          </View>
          <View style={styles.integrityDivider} />
          <View style={styles.integrityItem}>
            <View style={styles.integrityIconRow}>
              <Pencil size={14} color={COLORS.skyBlue} />
              <Text style={styles.integrityLabel}>Manual Entries</Text>
            </View>
            <Text style={styles.integrityValue}>{manualEntryCount}</Text>
          </View>
        </View>
        <View style={[styles.discrepancyBanner, { backgroundColor: hasDiscrepancy ? 'rgba(240,84,106,0.12)' : 'rgba(51,199,126,0.12)', borderColor: hasDiscrepancy ? 'rgba(240,84,106,0.35)' : 'rgba(51,199,126,0.35)' }]}>
          {hasDiscrepancy ? <AlertTriangle size={14} color={COLORS.red} /> : <CheckCircle2 size={14} color={COLORS.green} />}
          <Text style={[styles.discrepancyText, { color: hasDiscrepancy ? COLORS.red : COLORS.green }]} numberOfLines={2}>
            {hasDiscrepancy ? (clubRoyaleSyncDiscrepancy.message ?? 'Values differ between synced and app data.') : 'All values match between synced and app data.'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={[dashStyles.card, styles.progressSectionCard]}>
        <Text style={styles.sectionHeading}>Loyalty Progress</Text>
        <View style={styles.progressColsRow}>
          <TouchableOpacity style={styles.progressCol} activeOpacity={0.8} onPress={() => openProgressDrill('Signature', clubRoyaleCurrentYearPoints, signatureThreshold, pointsToSignature)} testID="loyalty-signature-progress">
            <View style={styles.progressColHeaderRow}>
              <Text style={styles.progressColLabel}>Signature Progress</Text>
              <Text style={styles.progressColPct}>{signaturePct.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressTrackFallback}>
              <View style={[styles.progressFill, { width: `${Math.max(2, signaturePct)}%`, backgroundColor: COLORS.gold }]} />
            </View>
            <Text style={styles.progressColDetail}>{formatNumber(pointsToSignature)} pts to retain Signature</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.progressCol} activeOpacity={0.8} onPress={() => openProgressDrill('Masters', clubRoyaleCurrentYearPoints, mastersThreshold, pointsToMasters)} testID="loyalty-masters-progress">
            <View style={styles.progressColHeaderRow}>
              <Text style={styles.progressColLabel}>Masters Progress</Text>
              <Text style={styles.progressColPct}>{mastersPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressTrackFallback}>
              <View style={[styles.progressFill, { width: `${Math.max(2, mastersPct)}%`, backgroundColor: COLORS.brightBlue }]} />
            </View>
            <Text style={styles.progressColDetail}>{formatNumber(pointsToMasters)} pts to reach Masters</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[dashStyles.card, styles.pinnacleCard]} activeOpacity={0.85} onPress={openPinnacleDrill} testID="loyalty-pinnacle-stepper">
        <Text style={styles.sectionHeading}>Pinnacle Club Progress</Text>
        <View style={styles.stepperRow}>
          {LEVEL_ORDER.map((level, index) => {
            const isAchieved = index < currentLevelIndex;
            const isCurrent = index === currentLevelIndex;
            const color = isAchieved || isCurrent ? COLORS.gold : COLORS.textMuted;
            return (
              <View key={level} style={styles.stepperItem}>
                <View style={[
                  styles.stepperDot,
                  { borderColor: color },
                  isAchieved ? { backgroundColor: COLORS.gold } : null,
                  isCurrent ? { backgroundColor: COLORS.cardAlt, borderWidth: 2 } : null,
                ]}>
                  {isAchieved ? <CheckCircle2 size={14} color={COLORS.background} /> : (
                    <Text style={[styles.stepperDotText, { color }]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepperLabel, isCurrent && { color: COLORS.goldText, fontWeight: '800' }]} numberOfLines={1}>
                  {pinnacleStepperLabels[level] ?? level}
                </Text>
                {index < LEVEL_ORDER.length - 1 ? <View style={[styles.stepperLine, isAchieved ? { backgroundColor: COLORS.gold } : null]} /> : null}
              </View>
            );
          })}
        </View>
        <View style={styles.pinnacleFooterRow}>
          <Text style={styles.pinnacleFooterText}>
            {nextLevelKey ? `You are ${formatNumber(crownAnchorProgress.nightsToNext)} points away from ${nextLevelKey}` : 'You have reached the top Crown & Anchor level'}
          </Text>
          <Text style={styles.pinnacleFooterFraction}>
            {formatNumber(crownAnchorPoints)} / {formatNumber(CROWN_ANCHOR_LEVELS[nextLevelKey ?? crownAnchorLevel]?.cruiseNights ?? crownAnchorPoints)}
          </Text>
        </View>
        <View style={styles.progressTrackFallback}>
          <View style={[styles.progressFill, { width: `${Math.max(2, crownAnchorProgress.percentComplete)}%`, backgroundColor: COLORS.gold }]} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {!showSidebar && (
        <View style={styles.mobileTopBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.75} onPress={() => router.back()} testID="loyalty-back-button">
            <ChevronLeft size={20} color={COLORS.textPrimary} />
            <Text style={styles.backButtonText}>Casino</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.contentRow}>
        {showSidebar && (
          <CasinoSidebar
            activeTab="portfolio"
            onTabChange={(tab) => router.replace({ pathname: '/(tabs)/analytics' as any, params: { tab } })}
            onOverviewPress={() => router.push('/(tabs)/(overview)' as any)}
            onSettingsPress={() => router.push('/(tabs)/settings' as any)}
            clubRoyaleTier={clubRoyaleTier}
            clubRoyalePoints={clubRoyaleCurrentYearPoints}
            tierProgressPct={signaturePct}
            tierProgressLabel={`${formatNumber(pointsToSignature)} pts to Signature`}
            onStatusPress={openClubRoyaleDrill}
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
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  backButtonText: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  dataAsOfText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right' as const },
  syncButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 10, alignSelf: 'flex-end',
  },
  syncButtonText: { fontSize: 11.5, fontWeight: '700' as const, color: COLORS.royalBlue },
  heroRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' as const },
  heroCard: { flex: 1, minWidth: 260, gap: 10 },
  heroBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBrandLabel: { fontSize: 11, fontWeight: '700' as const, color: COLORS.brightBlue, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  heroTier: { fontSize: 20, fontWeight: '800' as const, fontStyle: 'italic' as const },
  heroStatsRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  heroStat: { flex: 1 },
  heroStatLabel: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 2 },
  progressTrackFallback: { height: 8, borderRadius: 4, backgroundColor: COLORS.cardAlt, overflow: 'hidden' as const, marginTop: 8 },
  progressFill: { height: '100%' as const, borderRadius: 4 },
  integrityCard: { gap: 12 },
  integrityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  integrityItem: { flex: 1, gap: 4 },
  integrityIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  integrityLabel: { fontSize: 10.5, fontWeight: '700' as const, color: COLORS.textSecondary, textTransform: 'uppercase' as const },
  integrityValue: { fontSize: 15, fontWeight: '800' as const, color: COLORS.textPrimary },
  integrityDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 10, alignSelf: 'stretch' },
  discrepancyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  discrepancyText: { flex: 1, fontSize: 12, fontWeight: '600' as const, lineHeight: 17 },
  progressSectionCard: { gap: 12 },
  sectionHeading: { fontSize: 13, fontWeight: '700' as const, color: COLORS.textPrimary },
  progressColsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' as const },
  progressCol: { flex: 1, minWidth: 200, gap: 6 },
  progressColHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressColLabel: { fontSize: 12, fontWeight: '700' as const, color: COLORS.textSecondary },
  progressColPct: { fontSize: 12, fontWeight: '800' as const, color: COLORS.textPrimary },
  progressColDetail: { fontSize: 11, color: COLORS.textMuted },
  pinnacleCard: { gap: 14 },
  stepperRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepperItem: { flex: 1, alignItems: 'center', position: 'relative' as const },
  stepperDot: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent',
  },
  stepperDotText: { fontSize: 12, fontWeight: '800' as const },
  stepperLabel: { fontSize: 9.5, color: COLORS.textSecondary, marginTop: 6, fontWeight: '600' as const, textAlign: 'center' as const },
  stepperLine: {
    position: 'absolute' as const, top: 14, left: '50%', width: '100%',
    height: 2, backgroundColor: COLORS.border, zIndex: -1,
  },
  pinnacleFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinnacleFooterText: { flex: 1, fontSize: 12, fontWeight: '600' as const, color: COLORS.goldText, paddingRight: 8 },
  pinnacleFooterFraction: { fontSize: 12, fontWeight: '700' as const, color: COLORS.textSecondary },
});
