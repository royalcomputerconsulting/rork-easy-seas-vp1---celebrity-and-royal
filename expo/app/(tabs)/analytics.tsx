import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Award,
  BarChart3,
  Calendar,
  ChevronRight,
  Coins,
  DollarSign,
  Ship,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { BORDER_RADIUS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import type { BookedCruise } from '@/types/models';
import { createDateFromString, formatDate } from '@/lib/date';
import { calculateCruiseValue, type ValueBreakdown } from '@/lib/valueCalculator';
import { formatCurrency, formatNumber } from '@/lib/format';

const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E2E8F0';
const INNER_BG = '#F8FAFC';
const INNER_BORDER = '#E2E8F0';

interface CruisePerformance {
  cruise: BookedCruise;
  sailDate: Date;
  points: number;
  winnings: number;
  breakdown: ValueBreakdown;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { refreshData, isLoading: coreLoading } = useCoreData();
  const { analytics, casinoAnalytics, portfolioMetrics, completedCruises } = useSimpleAnalytics();
  const { clubRoyalePoints, clubRoyaleTier, crownAnchorLevel } = useLoyalty();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    console.log('[AnalyticsScreen] Mounted', {
      completedCruises: completedCruises.length,
      totalPoints: casinoAnalytics.totalPointsEarned,
      totalCoinIn: casinoAnalytics.totalCoinIn,
    });
  }, [casinoAnalytics.totalCoinIn, casinoAnalytics.totalPointsEarned, completedCruises.length]);

  const cruisePerformance = useMemo((): CruisePerformance[] => {
    return completedCruises
      .map((cruise: BookedCruise) => ({
        cruise,
        sailDate: createDateFromString(cruise.sailDate),
        points: cruise.earnedPoints ?? cruise.casinoPoints ?? 0,
        winnings: cruise.winnings ?? cruise.netResult ?? cruise.totalWinnings ?? 0,
        breakdown: calculateCruiseValue(cruise),
      }))
      .filter((e: CruisePerformance) => e.points > 0 || e.winnings !== 0)
      .sort((a: CruisePerformance, b: CruisePerformance) => b.sailDate.getTime() - a.sailDate.getTime());
  }, [completedCruises]);

  const totalCurrentPoints = useMemo(() => {
    return clubRoyalePoints || casinoAnalytics.totalPointsEarned || analytics.totalPoints || 0;
  }, [analytics.totalPoints, casinoAnalytics.totalPointsEarned, clubRoyalePoints]);

  const bestCruise = useMemo((): CruisePerformance | null => {
    if (cruisePerformance.length === 0) return null;
    return cruisePerformance.reduce(
      (best: CruisePerformance, cur: CruisePerformance) =>
        cur.breakdown.totalProfit > best.breakdown.totalProfit ? cur : best,
      cruisePerformance[0],
    );
  }, [cruisePerformance]);

  const highestCoinInCruise = useMemo((): CruisePerformance | null => {
    if (cruisePerformance.length === 0) return null;
    return cruisePerformance.reduce(
      (best: CruisePerformance, cur: CruisePerformance) => {
        const bestCoin = best.cruise.totalSpend ?? best.cruise.actualSpend ?? 0;
        const curCoin = cur.cruise.totalSpend ?? cur.cruise.actualSpend ?? 0;
        return curCoin > bestCoin ? cur : best;
      },
      cruisePerformance[0],
    );
  }, [cruisePerformance]);

  const favoriteDestination = useMemo(() => {
    return analytics.destinationDistribution[0]?.destination ?? 'Not enough sailings yet';
  }, [analytics.destinationDistribution]);

  const avgPointsPerCruise = useMemo(() => {
    return casinoAnalytics.completedCruisesCount > 0 ? casinoAnalytics.avgPointsPerCruise : 0;
  }, [casinoAnalytics.avgPointsPerCruise, casinoAnalytics.completedCruisesCount]);

  const totalValuePerDollar = useMemo(() => {
    return portfolioMetrics.totalAmountPaid > 0
      ? portfolioMetrics.totalCompValue / portfolioMetrics.totalAmountPaid
      : 0;
  }, [portfolioMetrics.totalAmountPaid, portfolioMetrics.totalCompValue]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e) {
      console.error('[AnalyticsScreen] Refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  const handleCruisePress = useCallback(
    (cruiseId: string) => {
      router.push({ pathname: '/(tabs)/(overview)/cruise-details' as any, params: { id: cruiseId } });
    },
    [router],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#F0F4F8', '#F0F4F8'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#9EFDF2"
              colors={['#9EFDF2']}
            />
          }
          testID="casino-scroll"
        >
          <View style={styles.heroRow}>
            <Image source={{ uri: IMAGES.logo }} style={styles.heroLogo} resizeMode="contain" />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>{'Easy Seas™ Casino'}</Text>
              <Text style={styles.heroSubtitle}>
                {'Premium casino analytics — full sail history, coin-in, points & ROI'}
              </Text>
            </View>
          </View>

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Sparkles size={13} color="#FFE28F" />
              <Text style={styles.heroBadgeText}>{clubRoyaleTier}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Target size={13} color="#9EFDF2" />
              <Text style={styles.heroBadgeText}>{crownAnchorLevel}</Text>
            </View>
            <View style={styles.heroBadge}>
              <BarChart3 size={13} color="#D8C0FF" />
              <Text style={styles.heroBadgeText}>{coreLoading ? 'Syncing' : 'Live'}</Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricCard} testID="casino-metric-points">
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(255,226,143,0.16)' }]}>
                <Award size={18} color="#FFE28F" />
              </View>
              <Text style={styles.metricLabel}>{'Current Points'}</Text>
              <Text style={[styles.metricValue, { color: '#FFE28F' }]}>{formatNumber(totalCurrentPoints)}</Text>
            </View>
            <View style={styles.metricCard} testID="casino-metric-coinin">
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(158,253,242,0.12)' }]}>
                <Coins size={18} color="#9EFDF2" />
              </View>
              <Text style={styles.metricLabel}>{'Total Coin-in'}</Text>
              <Text style={[styles.metricValue, { color: '#9EFDF2' }]}>{formatCurrency(casinoAnalytics.totalCoinIn)}</Text>
            </View>
            <View style={styles.metricCard} testID="casino-metric-profit">
              <View style={[styles.metricIconWrap, { backgroundColor: casinoAnalytics.netResult >= 0 ? 'rgba(142,242,193,0.12)' : 'rgba(255,179,193,0.12)' }]}>
                {casinoAnalytics.netResult >= 0
                  ? <TrendingUp size={18} color="#8EF2C1" />
                  : <TrendingDown size={18} color="#FFB3C1" />}
              </View>
              <Text style={styles.metricLabel}>{'Net Result'}</Text>
              <Text style={[styles.metricValue, { color: casinoAnalytics.netResult >= 0 ? '#8EF2C1' : '#FFB3C1' }]}>
                {formatCurrency(casinoAnalytics.netResult)}
              </Text>
            </View>
            <View style={styles.metricCard} testID="casino-metric-roi">
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(168,198,255,0.12)' }]}>
                <DollarSign size={18} color="#A8C6FF" />
              </View>
              <Text style={styles.metricLabel}>{'Value / $1'}</Text>
              <Text style={[styles.metricValue, { color: '#A8C6FF' }]}>
                {totalValuePerDollar > 0 ? `${totalValuePerDollar.toFixed(2)}x` : '0.00x'}
              </Text>
            </View>
          </View>

          <View style={styles.card} testID="casino-insights-card">
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Sparkles size={17} color="#FFE28F" />
                <Text style={styles.cardTitle}>{'Casino Pulse'}</Text>
              </View>
              <Text style={styles.cardMeta}>{`${cruisePerformance.length} sailings`}</Text>
            </View>
            <View style={styles.insightGrid}>
              <View style={styles.insightCell}>
                <Text style={styles.insightLabel}>{'Favorite Destination'}</Text>
                <Text style={styles.insightValue}>{favoriteDestination}</Text>
              </View>
              <View style={styles.insightCell}>
                <Text style={styles.insightLabel}>{'Avg Pts / Cruise'}</Text>
                <Text style={styles.insightValue}>{formatNumber(Math.round(avgPointsPerCruise))}</Text>
              </View>
              <View style={styles.insightCell}>
                <Text style={styles.insightLabel}>{'Portfolio ROI'}</Text>
                <Text style={[styles.insightValue, { color: portfolioMetrics.avgROI >= 0 ? '#8EF2C1' : '#FFB3C1' }]}>
                  {`${portfolioMetrics.avgROI.toFixed(0)}%`}
                </Text>
              </View>
              <View style={styles.insightCell}>
                <Text style={styles.insightLabel}>{'Retail Tracked'}</Text>
                <Text style={styles.insightValue}>{formatCurrency(portfolioMetrics.totalRetailValue)}</Text>
              </View>
            </View>
          </View>

          {bestCruise ? (
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => handleCruisePress(bestCruise.cruise.id)}
              style={styles.featureCard}
              testID="casino-best-cruise"
            >
              <LinearGradient
                colors={['rgba(255,233,179,0.14)', 'rgba(255,245,214,0.08)']}
                style={styles.featureGradient}
              >
                <View style={styles.featureHeader}>
                  <View style={styles.featureTitleBlock}>
                    <Text style={styles.featureEyebrow}>{'Best completed cruise'}</Text>
                    <Text style={styles.featureTitle}>{bestCruise.cruise.shipName || 'Cruise highlight'}</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,226,143,0.7)" />
                </View>
                <View style={styles.featureStatsRow}>
                  <View style={styles.featureStat}>
                    <Text style={styles.featureStatLabel}>{'Profit'}</Text>
                    <Text style={[styles.featureStatValue, { color: bestCruise.breakdown.totalProfit >= 0 ? '#8EF2C1' : '#FFB3C1' }]}>
                      {formatCurrency(bestCruise.breakdown.totalProfit)}
                    </Text>
                  </View>
                  <View style={styles.featureStat}>
                    <Text style={styles.featureStatLabel}>{'Points'}</Text>
                    <Text style={styles.featureStatValue}>{formatNumber(bestCruise.points)}</Text>
                  </View>
                  <View style={styles.featureStat}>
                    <Text style={styles.featureStatLabel}>{'Value / $1'}</Text>
                    <Text style={styles.featureStatValue}>{`${bestCruise.breakdown.valuePerDollar.toFixed(2)}x`}</Text>
                  </View>
                </View>
                <Text style={styles.featureMeta}>{formatDate(bestCruise.cruise.sailDate, 'long')}</Text>
                {bestCruise.cruise.destination ? (
                  <Text style={styles.featureMeta}>{bestCruise.cruise.destination}</Text>
                ) : null}
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          <View style={styles.card} testID="casino-breakdown-card">
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <DollarSign size={17} color="#A8C6FF" />
                <Text style={styles.cardTitle}>{'Portfolio Breakdown'}</Text>
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>{'Retail value'}</Text>
              <Text style={[styles.valueNum, { color: '#8EF2C1' }]}>{formatCurrency(portfolioMetrics.totalRetailValue)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>{'Out of pocket'}</Text>
              <Text style={styles.valueNum}>{formatCurrency(portfolioMetrics.totalAmountPaid)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>{'Comp value'}</Text>
              <Text style={styles.valueNum}>{formatCurrency(portfolioMetrics.totalCompValue)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>{'Lifetime points'}</Text>
              <Text style={styles.valueNum}>{formatNumber(totalCurrentPoints)}</Text>
            </View>
            <View style={[styles.valueRow, styles.valueRowLast]}>
              <Text style={styles.valueLabelBold}>{'Casino sailings tracked'}</Text>
              <Text style={styles.valueNumBold}>{String(cruisePerformance.length)}</Text>
            </View>
          </View>

          <View style={styles.card} testID="casino-high-roll-card">
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Coins size={17} color="#FFE28F" />
                <Text style={styles.cardTitle}>{'High-Roll Snapshot'}</Text>
              </View>
            </View>

            {highestCoinInCruise ? (
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => handleCruisePress(highestCoinInCruise.cruise.id)}
                style={styles.highRollRow}
                testID="casino-high-roll-cruise"
              >
                <View style={styles.highRollIconWrap}>
                  <Coins size={18} color="#FFE28F" />
                </View>
                <View style={styles.highRollTextBlock}>
                  <Text style={styles.highRollTitle}>{highestCoinInCruise.cruise.shipName || 'Cruise highlight'}</Text>
                  <Text style={styles.highRollMeta}>{formatDate(highestCoinInCruise.cruise.sailDate, 'long')}</Text>
                </View>
                <View style={styles.highRollStats}>
                  <Text style={[styles.highRollStat, { color: highestCoinInCruise.winnings >= 0 ? '#8EF2C1' : '#FFB3C1' }]}>
                    {formatCurrency(highestCoinInCruise.winnings)}
                  </Text>
                  <Text style={styles.highRollStatLabel}>{formatCurrency(highestCoinInCruise.cruise.totalSpend ?? highestCoinInCruise.cruise.actualSpend ?? 0)}</Text>
                </View>
                <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyCompact}>
                <Text style={styles.emptyCompactText}>
                  {'Once spending data is available, your top gaming cruise will appear here.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card} testID="casino-cruise-list">
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ship size={17} color="#9EFDF2" />
                <Text style={styles.cardTitle}>{'Recent Casino Cruises'}</Text>
              </View>
              <Text style={styles.cardMeta}>{'Tap for detail'}</Text>
            </View>

            {cruisePerformance.length > 0 ? (
              cruisePerformance.map((entry: CruisePerformance, idx: number) => (
                <TouchableOpacity
                  key={entry.cruise.id}
                  activeOpacity={0.84}
                  onPress={() => handleCruisePress(entry.cruise.id)}
                  style={[styles.cruiseListRow, idx === cruisePerformance.length - 1 && styles.cruiseListRowLast]}
                  testID={`casino-cruise-${entry.cruise.id}`}
                >
                  <View style={styles.cruiseListIconWrap}>
                    <Ship size={17} color="#9EFDF2" />
                  </View>
                  <View style={styles.cruiseListTextBlock}>
                    <Text style={styles.cruiseListTitle}>{entry.cruise.shipName || 'Cruise'}</Text>
                    <View style={styles.cruiseListMetaRow}>
                      <Calendar size={11} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.cruiseListMeta}>{formatDate(entry.cruise.sailDate, 'long')}</Text>
                    </View>
                    {entry.cruise.destination ? (
                      <Text style={styles.cruiseListMeta}>{entry.cruise.destination}</Text>
                    ) : null}
                  </View>
                  <View style={styles.cruiseListRight}>
                    <Text style={styles.cruiseListPoints}>{`${formatNumber(entry.points)} pts`}</Text>
                    <Text style={[styles.cruiseListWinLoss, { color: entry.winnings >= 0 ? '#8EF2C1' : '#FFB3C1' }]}>
                      {formatCurrency(entry.winnings)}
                    </Text>
                  </View>
                  <ChevronRight size={15} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Coins size={28} color="rgba(255,255,255,0.22)" />
                <Text style={styles.emptyTitle}>{'No casino sailings yet'}</Text>
                <Text style={styles.emptyBody}>
                  {'Completed cruises with points or win/loss data will appear here.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  orbTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'transparent',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -120,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 140,
    gap: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroLogo: {
    width: 60,
    height: 60,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 3,
    lineHeight: 18,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: '#1A2A3D',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 7,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  cardMeta: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#9CA3AF',
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  insightCell: {
    width: '48%',
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  insightLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  insightValue: {
    marginTop: 7,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  featureCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(212,160,10,0.25)',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  featureGradient: {
    padding: SPACING.md,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  featureTitleBlock: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  featureEyebrow: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#92400E',
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  featureTitle: {
    marginTop: 5,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  featureStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  featureStat: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    fontWeight: '700' as const,
  },
  featureStatValue: {
    marginTop: 5,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  featureMeta: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: INNER_BORDER,
  },
  valueRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  valueLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  valueNum: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1A2A3D',
    fontWeight: '800' as const,
  },
  valueLabelBold: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1A2A3D',
    fontWeight: '800' as const,
  },
  valueNumBold: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#B8860B',
    fontWeight: '800' as const,
  },
  highRollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    gap: SPACING.sm,
  },
  highRollIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,160,10,0.10)',
  },
  highRollTextBlock: {
    flex: 1,
  },
  highRollTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  highRollMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
  },
  highRollStats: {
    alignItems: 'flex-end',
  },
  highRollStat: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
  },
  highRollStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cruiseListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: INNER_BORDER,
    gap: SPACING.sm,
  },
  cruiseListRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  cruiseListIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,151,167,0.08)',
  },
  cruiseListTextBlock: {
    flex: 1,
  },
  cruiseListTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: '#1A2A3D',
  },
  cruiseListMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  cruiseListMeta: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#9CA3AF',
    marginTop: 1,
  },
  cruiseListRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  cruiseListPoints: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: '#B8860B',
  },
  cruiseListWinLoss: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
  emptyCompact: {
    backgroundColor: INNER_BG,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  emptyCompactText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: '#6B7280',
  },
  emptyBody: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
});
