import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  Edit3,
  Check,
  BarChart3,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatNumber } from '@/lib/format';
import type { CasinoSession, SessionAnalytics } from '@/state/CasinoSessionProvider';

interface PPHGoalsCardProps {
  analytics: SessionAnalytics;
  sessions: CasinoSession[];
  targetPPH: number;
  onTargetChange: (target: number) => void;
}

type TimePeriod = 'today' | 'week' | 'month' | 'all';

interface PeriodStats {
  period: TimePeriod;
  label: string;
  pointsPerHour: number;
  totalPoints: number;
  totalHours: number;
  sessionCount: number;
  trend: number;
}

export const PPHGoalsCard = React.memo(function PPHGoalsCard({
  analytics,
  sessions,
  targetPPH,
  onTargetChange,
}: PPHGoalsCardProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetPPH.toString());
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const periodStats = useMemo((): Record<TimePeriod, PeriodStats> => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const calculateStats = (
      filtered: CasinoSession[],
      compareSessions: CasinoSession[],
      label: string,
      period: TimePeriod
    ): PeriodStats => {
      const totalPoints = filtered.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
      const totalMinutes = filtered.reduce((sum, s) => sum + s.durationMinutes, 0);
      const totalHours = totalMinutes / 60;
      const pph = totalHours > 0 ? totalPoints / totalHours : 0;

      const comparePoints = compareSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
      const compareMinutes = compareSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      const compareHours = compareMinutes / 60;
      const comparePPH = compareHours > 0 ? comparePoints / compareHours : 0;
      
      const trend = comparePPH > 0 ? ((pph - comparePPH) / comparePPH) * 100 : 0;

      return {
        period,
        label,
        pointsPerHour: pph,
        totalPoints,
        totalHours,
        sessionCount: filtered.length,
        trend,
      };
    };

    const todaySessions = sessions.filter(s => s.date === todayStr);
    const yesterdaySessions = sessions.filter(s => {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return s.date === yesterday.toISOString().split('T')[0];
    });

    const weekSessions = sessions.filter(s => new Date(s.date) >= weekAgo);
    const prevWeekSessions = sessions.filter(s => {
      const d = new Date(s.date);
      return d >= twoWeeksAgo && d < weekAgo;
    });

    const monthSessions = sessions.filter(s => new Date(s.date) >= monthAgo);
    const prevMonthSessions = sessions.filter(s => {
      const d = new Date(s.date);
      return d >= twoMonthsAgo && d < monthAgo;
    });

    return {
      today: calculateStats(todaySessions, yesterdaySessions, 'Today', 'today'),
      week: calculateStats(weekSessions, prevWeekSessions, 'This Week', 'week'),
      month: calculateStats(monthSessions, prevMonthSessions, 'This Month', 'month'),
      all: calculateStats(sessions, [], 'All Time', 'all'),
    };
  }, [sessions]);

  const currentStats = periodStats[selectedPeriod];
  const progressPercentage = targetPPH > 0 ? Math.min((currentStats.pointsPerHour / targetPPH) * 100, 100) : 0;
  const isAboveTarget = currentStats.pointsPerHour >= targetPPH;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 800,
      useNativeDriver: false,
    }).start();

    if (isAboveTarget) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [progressPercentage, isAboveTarget, progressAnim, glowAnim]);

  const handleEditTarget = useCallback(() => {
    setTempTarget(targetPPH.toString());
    setIsEditingTarget(true);
  }, [targetPPH]);

  const handleSaveTarget = useCallback(() => {
    const newTarget = parseInt(tempTarget, 10);
    if (!isNaN(newTarget) && newTarget > 0) {
      onTargetChange(newTarget);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    setIsEditingTarget(false);
  }, [tempTarget, onTargetChange]);

  const handleSelectPeriod = useCallback((period: TimePeriod) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedPeriod(period);
  }, []);

  const getStatusColor = useCallback((pph: number): string => {
    if (pph >= targetPPH * 1.2) return '#10B981';
    if (pph >= targetPPH) return '#3B82F6';
    if (pph >= targetPPH * 0.7) return '#F59E0B';
    return '#EF4444';
  }, [targetPPH]);

  const getStatusText = useCallback((pph: number): string => {
    if (pph >= targetPPH * 1.2) return 'Exceeding Goal';
    if (pph >= targetPPH) return 'Goal Achieved';
    if (pph >= targetPPH * 0.7) return 'Close to Goal';
    if (pph > 0) return 'Below Goal';
    return 'No Data';
  }, [targetPPH]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Target size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>PPH Goals & Analysis</Text>
            <Text style={styles.headerSubtitle}>Track your earning efficiency</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.periodTabs}>
          {(['today', 'week', 'month', 'all'] as TimePeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodTab,
                selectedPeriod === period && styles.periodTabActive,
              ]}
              onPress={() => handleSelectPeriod(period)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodTabText,
                selectedPeriod === period && styles.periodTabTextActive,
              ]}>
                {periodStats[period].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mainStatsContainer}>
          <Animated.View
            style={[
              styles.mainStatCard,
              isAboveTarget && {
                shadowOpacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.4],
                }),
                shadowRadius: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 12],
                }),
                shadowColor: '#10B981',
              },
            ]}
          >
            <View style={styles.pphValueRow}>
              <Zap size={24} color={getStatusColor(currentStats.pointsPerHour)} />
              <Text style={[styles.pphValue, { color: getStatusColor(currentStats.pointsPerHour) }]}>
                {currentStats.pointsPerHour.toFixed(1)}
              </Text>
              <Text style={styles.pphUnit}>pts/hr</Text>
            </View>
            
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(currentStats.pointsPerHour)}15` }]}>
              {currentStats.pointsPerHour >= targetPPH ? (
                <TrendingUp size={14} color={getStatusColor(currentStats.pointsPerHour)} />
              ) : (
                <TrendingDown size={14} color={getStatusColor(currentStats.pointsPerHour)} />
              )}
              <Text style={[styles.statusText, { color: getStatusColor(currentStats.pointsPerHour) }]}>
                {getStatusText(currentStats.pointsPerHour)}
              </Text>
            </View>

            {currentStats.trend !== 0 && selectedPeriod !== 'all' && (
              <View style={styles.trendRow}>
                {currentStats.trend > 0 ? (
                  <TrendingUp size={12} color="#10B981" />
                ) : (
                  <TrendingDown size={12} color="#EF4444" />
                )}
                <Text style={[
                  styles.trendText,
                  { color: currentStats.trend > 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {currentStats.trend > 0 ? '+' : ''}{currentStats.trend.toFixed(0)}% vs previous
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.targetCard}>
            <View style={styles.targetHeader}>
              <Text style={styles.targetLabel}>Target</Text>
              {isEditingTarget ? (
                <TouchableOpacity onPress={handleSaveTarget} activeOpacity={0.7}>
                  <Check size={16} color="#10B981" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleEditTarget} activeOpacity={0.7}>
                  <Edit3 size={14} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>
            {isEditingTarget ? (
              <TextInput
                style={styles.targetInput}
                value={tempTarget}
                onChangeText={setTempTarget}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <Text style={styles.targetValue}>{targetPPH}</Text>
            )}
            <Text style={styles.targetUnit}>pts/hr</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress to Goal</Text>
            <Text style={styles.progressPercentage}>{progressPercentage.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: getStatusColor(currentStats.pointsPerHour),
                },
              ]}
            />
          </View>
          <View style={styles.progressLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>&lt;70%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>70-99%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>100%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>&gt;120%</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Award size={16} color="#8B5CF6" />
            <Text style={styles.statValue}>{formatNumber(currentStats.totalPoints)}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={16} color="#3B82F6" />
            <Text style={styles.statValue}>{currentStats.totalHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Play Time</Text>
          </View>
          <View style={styles.statCard}>
            <BarChart3 size={16} color="#F59E0B" />
            <Text style={styles.statValue}>{currentStats.sessionCount}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>Period Comparison</Text>
          {(['today', 'week', 'month', 'all'] as TimePeriod[]).map((period) => {
            const stats = periodStats[period];
            return (
              <TouchableOpacity
                key={period}
                style={[
                  styles.comparisonRow,
                  selectedPeriod === period && styles.comparisonRowActive,
                ]}
                onPress={() => handleSelectPeriod(period)}
                activeOpacity={0.7}
              >
                <View style={styles.comparisonLeft}>
                  <Calendar size={14} color="#6B7280" />
                  <Text style={styles.comparisonPeriod}>{stats.label}</Text>
                </View>
                <View style={styles.comparisonRight}>
                  <Text style={[
                    styles.comparisonValue,
                    { color: getStatusColor(stats.pointsPerHour) }
                  ]}>
                    {stats.pointsPerHour.toFixed(0)} pts/hr
                  </Text>
                  {stats.trend !== 0 && period !== 'all' && (
                    <View style={[
                      styles.comparisonTrend,
                      { backgroundColor: stats.trend > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                    ]}>
                      {stats.trend > 0 ? (
                        <TrendingUp size={10} color="#10B981" />
                      ) : (
                        <TrendingDown size={10} color="#EF4444" />
                      )}
                      <Text style={[
                        styles.comparisonTrendText,
                        { color: stats.trend > 0 ? '#10B981' : '#EF4444' }
                      ]}>
                        {Math.abs(stats.trend).toFixed(0)}%
                      </Text>
                    </View>
                  )}
                  <ChevronRight size={14} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

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
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
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
  content: {
    padding: SPACING.md,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  periodTab: {
    flex: 1,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodTabActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  periodTabText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#6B7280',
  },
  periodTabTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  mainStatCard: {
    flex: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pphValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  pphValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: -1,
  },
  pphUnit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  targetCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: SPACING.xs,
  },
  targetLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textTransform: 'uppercase',
  },
  targetValue: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8B5CF6',
  },
  targetInput: {
    fontSize: 22,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8B5CF6',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#8B5CF6',
    paddingVertical: 0,
    minWidth: 60,
  },
  targetUnit: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#9CA3AF',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  progressPercentage: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
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
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  comparisonSection: {
    display: 'none',
  },
  comparisonTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  comparisonRowActive: {
    backgroundColor: '#F3E8FF',
    marginHorizontal: -SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  comparisonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  comparisonPeriod: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#374151',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  comparisonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  comparisonValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  comparisonTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  comparisonTrendText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
