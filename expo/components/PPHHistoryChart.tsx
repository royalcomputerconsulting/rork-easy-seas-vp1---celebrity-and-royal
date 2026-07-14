import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Calendar,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

const CHART_HEIGHT = 90;

interface PPHHistoryChartProps {
  sessions: CasinoSession[];
  maxDataPoints?: number;
}

interface DataPoint {
  date: string;
  pph: number;
  sessionId: string;
  pointsEarned: number;
  durationMinutes: number;
}

function AnimatedBar({
  height,
  maxHeight,
  color,
  delay,
  index,
}: {
  height: number;
  maxHeight: number;
  color: string;
  delay: number;
  index: number;
}) {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: height,
      duration: 600,
      delay: delay,
      useNativeDriver: false,
    }).start();
  }, [height, delay, animatedHeight]);

  return (
    <Animated.View
      style={[
        styles.chartBar,
        {
          height: animatedHeight,
          backgroundColor: color,
          maxHeight: maxHeight,
        },
      ]}
    />
  );
}

export function PPHHistoryChart({
  sessions,
  maxDataPoints = 10,
}: PPHHistoryChartProps) {
  const dataPoints = useMemo((): DataPoint[] => {
    const validSessions = sessions
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const grouped: Record<string, { totalPoints: number; totalMinutes: number; sessions: CasinoSession[] }> = {};

    validSessions.forEach(session => {
      if (!grouped[session.date]) {
        grouped[session.date] = { totalPoints: 0, totalMinutes: 0, sessions: [] };
      }
      grouped[session.date].totalPoints += session.pointsEarned || 0;
      grouped[session.date].totalMinutes += session.durationMinutes;
      grouped[session.date].sessions.push(session);
    });

    const points = Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        pph: data.totalMinutes > 0 ? (data.totalPoints / data.totalMinutes) * 60 : 0,
        sessionId: data.sessions[0]?.id || '',
        pointsEarned: data.totalPoints,
        durationMinutes: data.totalMinutes,
      }))
      .slice(-maxDataPoints);

    return points;
  }, [sessions, maxDataPoints]);

  const { maxPPH, minPPH, avgPPH, trend } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { maxPPH: 0, minPPH: 0, avgPPH: 0, trend: 0 };
    }

    const pphValues = dataPoints.map(d => d.pph);
    const max = Math.max(...pphValues);
    const min = Math.min(...pphValues);
    const avg = pphValues.reduce((sum, v) => sum + v, 0) / pphValues.length;

    let trendValue = 0;
    if (pphValues.length >= 2) {
      const recentHalf = pphValues.slice(Math.floor(pphValues.length / 2));
      const olderHalf = pphValues.slice(0, Math.floor(pphValues.length / 2));
      const recentAvg = recentHalf.reduce((s, v) => s + v, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((s, v) => s + v, 0) / olderHalf.length;
      trendValue = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    }

    return { maxPPH: max, minPPH: min, avgPPH: avg, trend: trendValue };
  }, [dataPoints]);

  const chartMax = Math.max(maxPPH * 1.2, 100);

  const getTrendIcon = () => {
    if (trend > 5) return <TrendingUp size={14} color="#10B981" />;
    if (trend < -5) return <TrendingDown size={14} color="#EF4444" />;
    return <Minus size={14} color="#6B7280" />;
  };

  const getTrendColor = () => {
    if (trend > 5) return '#10B981';
    if (trend < -5) return '#EF4444';
    return '#6B7280';
  };

  const getBarColor = (pph: number): string => {
    if (pph >= avgPPH * 1.2) return '#10B981';
    if (pph >= avgPPH) return '#3B82F6';
    if (pph >= avgPPH * 0.7) return '#F59E0B';
    return '#EF4444';
  };

  if (dataPoints.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Activity size={18} color={COLORS.navyDeep} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>PPH History</Text>
              <Text style={styles.headerSubtitle}>Points per hour over time</Text>
            </View>
          </View>
        </View>

        <View style={styles.emptyContent}>
          <Calendar size={40} color="#D1D5DB" />
          <Text style={styles.emptyText}>No session data with points yet</Text>
          <Text style={styles.emptySubtext}>Track sessions with points to see your PPH history</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Activity size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>PPH History</Text>
            <Text style={styles.headerSubtitle}>Points per hour over time</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Best</Text>
            <Text style={styles.statValue}>{maxPPH.toFixed(0)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>{avgPPH.toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.chartContainer}>
          <View style={styles.yAxisLabels}>
            <Text style={styles.yAxisLabel}>{chartMax.toFixed(0)}</Text>
            <Text style={styles.yAxisLabel}>{(chartMax / 2).toFixed(0)}</Text>
            <Text style={styles.yAxisLabel}>0</Text>
          </View>

          <View style={styles.chartArea}>
            <View style={styles.gridLines}>
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
            </View>

            <View style={[styles.avgLine, { bottom: (avgPPH / chartMax) * CHART_HEIGHT }]}>
              <View style={styles.avgLineDash} />
              <Text style={styles.avgLineLabel}>Avg: {avgPPH.toFixed(0)}</Text>
            </View>

            <View style={styles.barsContainer}>
              {dataPoints.map((point, index) => {
                const barHeight = Math.max(4, (point.pph / chartMax) * CHART_HEIGHT);
                return (
                  <View key={point.date} style={styles.barWrapper}>
                    <AnimatedBar
                      height={barHeight}
                      maxHeight={CHART_HEIGHT}
                      color={getBarColor(point.pph)}
                      delay={index * 50}
                      index={index}
                    />
                    <Text style={styles.barLabel}>
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).split(' ')[1]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Above Avg</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>On Track</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Below</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Low</Text>
          </View>
        </View>


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.navyDeep,
    ...SHADOW.md,
  },
  header: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.navyDeep,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 31, 63, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  trendText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  content: {
    padding: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SPACING.sm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 4,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 30,
    marginBottom: SPACING.sm,
  },
  yAxisLabels: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
    height: CHART_HEIGHT,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    height: CHART_HEIGHT + 30,
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  avgLineDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  avgLineLabel: {
    fontSize: 9,
    color: '#8B5CF6',
    fontWeight: TYPOGRAPHY.fontWeightBold,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: CHART_HEIGHT,
    paddingTop: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 35,
  },
  chartBar: {
    width: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  insightCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  insightTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginBottom: SPACING.xs,
  },
  insightText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    lineHeight: 18,
  },
  emptyContent: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
