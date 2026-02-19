import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target,
  Award,
  Activity,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { SessionAnalytics, CasinoSession, MachineType } from '@/state/CasinoSessionProvider';
import { formatNumber } from '@/lib/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PointsPerHourCardProps {
  analytics: SessionAnalytics;
  sessions: CasinoSession[];
  compact?: boolean;
}

interface MachineTypeStats {
  machineType: MachineType;
  pointsPerHour: number;
  totalPoints: number;
  totalHours: number;
  sessionCount: number;
}

const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  'penny-slots': 'Penny Slots',
  'nickel-slots': 'Nickel Slots',
  'quarter-slots': 'Quarter Slots',
  'dollar-slots': 'Dollar Slots',
  'high-limit-slots': 'High Limit',
  'video-poker': 'Video Poker',
  'blackjack': 'Blackjack',
  'roulette': 'Roulette',
  'craps': 'Craps',
  'baccarat': 'Baccarat',
  'poker': 'Poker',
  'other': 'Other',
};

export const PointsPerHourCard = React.memo(function PointsPerHourCard({
  analytics,
  sessions,
  compact = false,
}: PointsPerHourCardProps) {
  const machineTypeStats = useMemo((): MachineTypeStats[] => {
    const stats: Record<string, { points: number; minutes: number; count: number }> = {};
    
    sessions.forEach(session => {
      const mt = session.machineType || 'other';
      if (!stats[mt]) {
        stats[mt] = { points: 0, minutes: 0, count: 0 };
      }
      stats[mt].points += session.pointsEarned || 0;
      stats[mt].minutes += session.durationMinutes;
      stats[mt].count += 1;
    });

    return Object.entries(stats)
      .filter(([, data]) => data.points > 0 && data.minutes > 0)
      .map(([machineType, data]) => ({
        machineType: machineType as MachineType,
        totalPoints: data.points,
        totalHours: data.minutes / 60,
        pointsPerHour: (data.points / data.minutes) * 60,
        sessionCount: data.count,
      }))
      .sort((a, b) => b.pointsPerHour - a.pointsPerHour);
  }, [sessions]);

  const trend = useMemo(() => {
    if (sessions.length < 2) return { direction: 'none' as const, change: 0 };
    
    const sortedSessions = [...sessions]
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (sortedSessions.length < 2) return { direction: 'none' as const, change: 0 };
    
    const recentSessions = sortedSessions.slice(0, Math.min(3, sortedSessions.length));
    const olderSessions = sortedSessions.slice(Math.min(3, sortedSessions.length));
    
    if (olderSessions.length === 0) return { direction: 'none' as const, change: 0 };
    
    const recentPPH = recentSessions.reduce((sum, s) => sum + ((s.pointsEarned || 0) / s.durationMinutes) * 60, 0) / recentSessions.length;
    const olderPPH = olderSessions.reduce((sum, s) => sum + ((s.pointsEarned || 0) / s.durationMinutes) * 60, 0) / olderSessions.length;
    
    const change = ((recentPPH - olderPPH) / olderPPH) * 100;
    
    return {
      direction: change > 5 ? 'up' as const : change < -5 ? 'down' as const : 'stable' as const,
      change: Math.abs(change),
    };
  }, [sessions]);

  const bestSession = useMemo(() => {
    const sessionsWithPPH = sessions
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .map(s => ({
        ...s,
        pph: ((s.pointsEarned || 0) / s.durationMinutes) * 60,
      }))
      .sort((a, b) => b.pph - a.pph);
    
    return sessionsWithPPH[0] || null;
  }, [sessions]);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.compactIconContainer}>
            <Zap size={16} color="#F59E0B" />
          </View>
          <Text style={styles.compactTitle}>Points/Hour</Text>
        </View>
        <View style={styles.compactValueRow}>
          <Text style={styles.compactValue}>
            {analytics.pointsPerHour.toFixed(1)}
          </Text>
          <Text style={styles.compactUnit}>pts/hr</Text>
          {trend.direction !== 'none' && (
            <View style={[
              styles.compactTrend,
              { backgroundColor: trend.direction === 'up' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
            ]}>
              {trend.direction === 'up' ? (
                <TrendingUp size={10} color="#10B981" />
              ) : (
                <TrendingDown size={10} color="#EF4444" />
              )}
              <Text style={[
                styles.compactTrendText,
                { color: trend.direction === 'up' ? '#10B981' : '#EF4444' }
              ]}>
                {trend.change.toFixed(0)}%
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Zap size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Points Per Hour</Text>
            <Text style={styles.headerSubtitle}>Earning efficiency</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.mainStatRow}>
          <Text style={styles.mainStatLabel}>Current PPH</Text>
          <Text style={styles.mainStatValue}>{analytics.pointsPerHour.toFixed(1)}</Text>
          <Text style={styles.mainStatUnit}>pts/hr</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Award size={14} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{formatNumber(analytics.totalPointsEarned)}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Clock size={14} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>
              {(analytics.totalPlayTimeMinutes / 60).toFixed(1)}h
            </Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Target size={14} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{analytics.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Activity size={14} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>
              {(analytics.avgSessionLength / 60).toFixed(1)}h
            </Text>
            <Text style={styles.statLabel}>Avg Session</Text>
          </View>
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
    color: COLORS.white,
  },
  content: {
    padding: SPACING.md,
  },
  mainStatRow: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    marginBottom: 4,
  },
  mainStatValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: -1,
  },
  mainStatUnit: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    marginTop: 4,
  },
  gaugeContainer: {
    width: '100%',
  },
  gaugeTrack: {
    height: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  gaugeLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  gaugeBenchmark: {
    fontSize: 9,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statItem: {
    width: (SCREEN_WIDTH - SPACING.md * 4 - SPACING.sm * 3) / 4,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  bestSessionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bestSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  bestSessionIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestSessionTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bestSessionContent: {
    gap: 4,
  },
  bestSessionStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bestSessionValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#8B5CF6',
  },
  bestSessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  bestSessionDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  bestSessionDot: {
    color: '#64748B',
  },
  bestSessionDetails: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
  },
  bestSessionMachine: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#D97706',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  breakdownSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  breakdownRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  breakdownRankText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#6B7280',
  },
  breakdownRankTextTop: {
    color: '#F59E0B',
  },
  breakdownContent: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breakdownName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  breakdownPPH: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#6B7280',
  },
  breakdownPPHTop: {
    color: '#F59E0B',
  },
  breakdownBarContainer: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    marginBottom: 4,
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 2,
  },
  breakdownMeta: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  compactContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  compactIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#92400E',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  compactValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  compactValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F59E0B',
  },
  compactUnit: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#B45309',
  },
  compactTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  compactTrendText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
});
