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
import { BORDER_RADIUS, COLORS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useSimpleAnalytics } from '@/state/SimpleAnalyticsProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import type { BookedCruise } from '@/types/models';
import { createDateFromString, formatDate } from '@/lib/date';
import { calculateCruiseValue, type ValueBreakdown } from '@/lib/valueCalculator';
import { formatCurrency, formatNumber } from '@/lib/format';

const HERO_COLORS = ['#102544', '#1E3A5F', '#2E5077'] as const;
const CARD_SURFACE = 'rgba(241, 247, 255, 0.97)';
const CARD_BORDER = 'rgba(125, 184, 255, 0.26)';
const INNER_SURFACE = 'rgba(16, 37, 68, 0.06)';
const INNER_BORDER = 'rgba(30, 58, 95, 0.08)';
const FEATURE_SURFACE = 'rgba(255, 244, 214, 0.96)';
const FEATURE_BORDER = 'rgba(212,160,10,0.28)';

type MetricTone = 'default' | 'positive' | 'negative';

interface SummaryMetric {
  id: string;
  label: string;
  value: string;
  tone: MetricTone;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

interface CruisePerformance {
  cruise: BookedCruise;
  sailDate: Date;
  points: number;
  winnings: number;
  breakdown: ValueBreakdown;
}

function getMetricColor(tone: MetricTone): string {
  if (tone === 'positive') {
    return COLORS.success;
  }

  if (tone === 'negative') {
    return COLORS.error;
  }

  return COLORS.navyDeep;
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
    const list = completedCruises
      .map((cruise: BookedCruise) => {
        const points = cruise.earnedPoints ?? cruise.casinoPoints ?? 0;
        const winnings = cruise.winnings ?? cruise.netResult ?? cruise.totalWinnings ?? 0;

        return {
          cruise,
          sailDate: createDateFromString(cruise.sailDate),
          points,
          winnings,
          breakdown: calculateCruiseValue(cruise),
        };
      })
      .filter((entry: CruisePerformance) => entry.points > 0 || entry.winnings !== 0)
      .sort((left: CruisePerformance, right: CruisePerformance) => right.sailDate.getTime() - left.sailDate.getTime());

    console.log('[AnalyticsScreen] Cruise performance prepared', { count: list.length });
    return list;
  }, [completedCruises]);

  const totalCurrentPoints = useMemo(() => {
    return clubRoyalePoints || casinoAnalytics.totalPointsEarned || analytics.totalPoints || 0;
  }, [analytics.totalPoints, casinoAnalytics.totalPointsEarned, clubRoyalePoints]);

  const summaryMetrics = useMemo((): SummaryMetric[] => {
    const totalValuePerDollar = portfolioMetrics.totalAmountPaid > 0
      ? portfolioMetrics.totalCompValue / portfolioMetrics.totalAmountPaid
      : 0;

    return [
      {
        id: 'points',
        label: 'Current points',
        value: formatNumber(totalCurrentPoints),
        tone: 'default',
        icon: Award,
      },
      {
        id: 'coinin',
        label: 'Total coin-in',
        value: formatCurrency(casinoAnalytics.totalCoinIn),
        tone: 'default',
        icon: Coins,
      },
      {
        id: 'profit',
        label: 'Net result',
        value: formatCurrency(casinoAnalytics.netResult),
        tone: casinoAnalytics.netResult >= 0 ? 'positive' : 'negative',
        icon: casinoAnalytics.netResult >= 0 ? TrendingUp : TrendingDown,
      },
      {
        id: 'value',
        label: 'Value per $1',
        value: totalValuePerDollar > 0 ? `${totalValuePerDollar.toFixed(2)}x` : '0.00x',
        tone: 'positive',
        icon: DollarSign,
      },
    ];
  }, [casinoAnalytics.netResult, casinoAnalytics.totalCoinIn, portfolioMetrics.totalAmountPaid, portfolioMetrics.totalCompValue, totalCurrentPoints]);

  const bestCruise = useMemo(() => {
    if (cruisePerformance.length === 0) {
      return null;
    }

    const nextBest = cruisePerformance.reduce((best: CruisePerformance, current: CruisePerformance) => {
      return current.breakdown.totalProfit > best.breakdown.totalProfit ? current : best;
    }, cruisePerformance[0]);

    console.log('[AnalyticsScreen] Best cruise identified', {
      cruiseId: nextBest.cruise.id,
      profit: nextBest.breakdown.totalProfit,
    });

    return nextBest;
  }, [cruisePerformance]);

  const favoriteDestination = useMemo(() => {
    return analytics.destinationDistribution[0]?.destination ?? 'Not enough sailings yet';
  }, [analytics.destinationDistribution]);

  const averagePointsPerCruise = useMemo(() => {
    return casinoAnalytics.completedCruisesCount > 0
      ? casinoAnalytics.avgPointsPerCruise
      : 0;
  }, [casinoAnalytics.avgPointsPerCruise, casinoAnalytics.completedCruisesCount]);

  const handleRefresh = useCallback(async () => {
    console.log('[AnalyticsScreen] Manual refresh requested');
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('[AnalyticsScreen] Refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  const handleCruisePress = useCallback(
    (cruiseId: string) => {
      console.log('[AnalyticsScreen] Opening cruise details', { cruiseId });
      router.push({
        pathname: '/(tabs)/(overview)/cruise-details' as any,
        params: { id: cruiseId },
      });
    },
    [router],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.navyDeep}
              colors={[COLORS.navyDeep]}
            />
          }
          testID="casino-scroll"
        >
          <LinearGradient colors={HERO_COLORS} style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Image source={{ uri: IMAGES.logo }} style={styles.heroLogo} resizeMode="contain" />
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle}>Easy Seas™ Casino</Text>
                <Text style={styles.heroSubtitle}>Offers-tab styling, cleaner stats, and no more broken text nodes.</Text>
              </View>
            </View>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Sparkles size={14} color={COLORS.goldLight} />
                <Text style={styles.heroBadgeText}>{clubRoyaleTier}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Target size={14} color={COLORS.skyBlue} />
                <Text style={styles.heroBadgeText}>{crownAnchorLevel}</Text>
              </View>
              <View style={styles.heroBadge}>
                <BarChart3 size={14} color={COLORS.seafoam} />
                <Text style={styles.heroBadgeText}>{coreLoading ? 'Syncing' : 'Portfolio live'}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.metricGrid}>
            {summaryMetrics.map((metric: SummaryMetric) => {
              const color = getMetricColor(metric.tone);
              const Icon = metric.icon;

              return (
                <View key={metric.id} style={styles.metricCard} testID={`casino-metric-${metric.id}`}>
                  <View style={[styles.metricIconWrap, { backgroundColor: `${color}15` }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={[styles.metricValue, { color }]}>{metric.value}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.contentCard} testID="casino-insights-card">
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles size={18} color={COLORS.goldDark} />
                <Text style={styles.sectionTitle}>Casino pulse</Text>
              </View>
              <Text style={styles.sectionMeta}>{cruisePerformance.length} tracked sailings</Text>
            </View>

            <View style={styles.insightGrid}>
              <View style={styles.insightItem}>
                <Text style={styles.insightLabel}>Favorite destination</Text>
                <Text style={styles.insightValue}>{favoriteDestination}</Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightLabel}>Avg points per cruise</Text>
                <Text style={styles.insightValue}>{formatNumber(Math.round(averagePointsPerCruise))}</Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightLabel}>Portfolio ROI</Text>
                <Text style={[styles.insightValue, { color: portfolioMetrics.avgROI >= 0 ? COLORS.success : COLORS.error }]}>
                  {portfolioMetrics.avgROI.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.insightItem}>
                <Text style={styles.insightLabel}>Retail value tracked</Text>
                <Text style={styles.insightValue}>{formatCurrency(portfolioMetrics.totalRetailValue)}</Text>
              </View>
            </View>
          </View>

          {bestCruise ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => handleCruisePress(bestCruise.cruise.id)}
              style={styles.featureCard}
              testID="casino-best-cruise"
            >
              <View style={styles.featureHeader}>
                <View>
                  <Text style={styles.featureEyebrow}>Best completed cruise</Text>
                  <Text style={styles.featureTitle}>{bestCruise.cruise.shipName || 'Cruise highlight'}</Text>
                </View>
                <ChevronRight size={18} color={COLORS.navyDeep} />
              </View>

              <View style={styles.featureStatsRow}>
                <View style={styles.featureStat}>
                  <Text style={styles.featureStatLabel}>Profit</Text>
                  <Text style={[styles.featureStatValue, { color: bestCruise.breakdown.totalProfit >= 0 ? COLORS.success : COLORS.error }]}>
                    {formatCurrency(bestCruise.breakdown.totalProfit)}
                  </Text>
                </View>
                <View style={styles.featureStat}>
                  <Text style={styles.featureStatLabel}>Points</Text>
                  <Text style={styles.featureStatValue}>{formatNumber(bestCruise.points)}</Text>
                </View>
                <View style={styles.featureStat}>
                  <Text style={styles.featureStatLabel}>Value per $1</Text>
                  <Text style={styles.featureStatValue}>{bestCruise.breakdown.valuePerDollar.toFixed(2)}x</Text>
                </View>
              </View>

              <Text style={styles.featureMeta}>
                {formatDate(bestCruise.cruise.sailDate, 'long')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.contentCard} testID="casino-breakdown-card">
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <DollarSign size={18} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Portfolio value breakdown</Text>
              </View>
            </View>

            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Retail value</Text>
              <Text style={[styles.valueValue, { color: COLORS.success }]}>{formatCurrency(portfolioMetrics.totalRetailValue)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Out of pocket</Text>
              <Text style={styles.valueValue}>{formatCurrency(portfolioMetrics.totalAmountPaid)}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Comp value</Text>
              <Text style={styles.valueValue}>{formatCurrency(portfolioMetrics.totalCompValue)}</Text>
            </View>
            <View style={[styles.valueRow, styles.valueRowLast]}>
              <Text style={styles.valueLabelStrong}>Casino sailings tracked</Text>
              <Text style={styles.valueValueStrong}>{cruisePerformance.length}</Text>
            </View>
          </View>

          <View style={styles.contentCard} testID="casino-cruise-list">
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ship size={18} color={COLORS.navyDeep} />
                <Text style={styles.sectionTitle}>Recent casino cruises</Text>
              </View>
              <Text style={styles.sectionMeta}>Tap a sailing for details</Text>
            </View>

            {cruisePerformance.length > 0 ? (
              cruisePerformance.map((entry: CruisePerformance) => (
                <TouchableOpacity
                  key={entry.cruise.id}
                  activeOpacity={0.86}
                  onPress={() => handleCruisePress(entry.cruise.id)}
                  style={styles.cruiseRow}
                  testID={`casino-cruise-${entry.cruise.id}`}
                >
                  <View style={styles.cruiseRowMain}>
                    <View style={styles.cruiseRowIconWrap}>
                      <Ship size={18} color={COLORS.navyDeep} />
                    </View>
                    <View style={styles.cruiseRowTextWrap}>
                      <Text style={styles.cruiseRowTitle}>{entry.cruise.shipName || 'Cruise'}</Text>
                      <View style={styles.cruiseMetaRow}>
                        <Calendar size={12} color={COLORS.textSecondary} />
                        <Text style={styles.cruiseMetaText}>{formatDate(entry.cruise.sailDate, 'long')}</Text>
                      </View>
                      <Text style={styles.cruiseMetaText}>{entry.cruise.destination || entry.cruise.itineraryName || 'Casino sailing'}</Text>
                    </View>
                  </View>

                  <View style={styles.cruiseRowStats}>
                    <Text style={styles.cruiseRowPoints}>{formatNumber(entry.points)} pts</Text>
                    <Text style={[styles.cruiseRowProfit, { color: entry.winnings >= 0 ? COLORS.success : COLORS.error }]}>
                      {formatCurrency(entry.winnings)}
                    </Text>
                    <ChevronRight size={16} color={COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Coins size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyTitle}>No casino sailings yet</Text>
                <Text style={styles.emptyText}>Completed cruises with points or win/loss data will appear here.</Text>
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
    backgroundColor: '#0A1628',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 140,
  },
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...SHADOW.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLogo: {
    width: 68,
    height: 68,
    marginRight: SPACING.md,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: COLORS.white,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metricCard: {
    width: '48%',
    backgroundColor: CARD_SURFACE,
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
    color: COLORS.textSecondary,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '800' as const,
  },
  contentCard: {
    backgroundColor: CARD_SURFACE,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOW.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  sectionMeta: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  insightItem: {
    width: '48%',
    backgroundColor: INNER_SURFACE,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: INNER_BORDER,
  },
  insightLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '700' as const,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  insightValue: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  featureCard: {
    backgroundColor: FEATURE_SURFACE,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: FEATURE_BORDER,
    ...SHADOW.sm,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureEyebrow: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#8A5A00',
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureTitle: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  featureStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  featureStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,160,10,0.16)',
  },
  featureStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    fontWeight: '700' as const,
  },
  featureStatValue: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  featureMeta: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
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
    color: COLORS.textSecondary,
    fontWeight: '700' as const,
  },
  valueValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
  },
  valueLabelStrong: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
  },
  valueValueStrong: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: '800' as const,
  },
  cruiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: INNER_BORDER,
  },
  cruiseRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.sm,
  },
  cruiseRowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INNER_SURFACE,
    borderWidth: 1,
    borderColor: INNER_BORDER,
    marginRight: SPACING.sm,
  },
  cruiseRowTextWrap: {
    flex: 1,
  },
  cruiseRowTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  cruiseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cruiseMetaText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  cruiseRowStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cruiseRowPoints: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
    color: COLORS.navyDeep,
  },
  cruiseRowProfit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '800' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  emptyText: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
