import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Award,
  Target,
  Trophy,
  Dices,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { CasinoSession, SessionAnalytics } from '@/state/CasinoSessionProvider';
import { formatNumber, formatCurrency } from '@/lib/format';

interface SessionsSummaryCardProps {
  analytics: SessionAnalytics;
  sessions: CasinoSession[];
  targetPPH: number;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export const SessionsSummaryCard = React.memo(function SessionsSummaryCard({
  analytics,
  sessions,
  targetPPH,
}: SessionsSummaryCardProps) {
  const recentTrend = useMemo(() => {
    if (sessions.length < 2) return { direction: 'stable' as const, change: 0 };
    
    const sortedSessions = [...sessions]
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (sortedSessions.length < 2) return { direction: 'stable' as const, change: 0 };
    
    const recentSessions = sortedSessions.slice(0, Math.min(3, sortedSessions.length));
    const olderSessions = sortedSessions.slice(Math.min(3, sortedSessions.length));
    
    if (olderSessions.length === 0) return { direction: 'stable' as const, change: 0 };
    
    const recentPPH = recentSessions.reduce((sum, s) => sum + ((s.pointsEarned || 0) / s.durationMinutes) * 60, 0) / recentSessions.length;
    const olderPPH = olderSessions.reduce((sum, s) => sum + ((s.pointsEarned || 0) / s.durationMinutes) * 60, 0) / olderSessions.length;
    
    const change = ((recentPPH - olderPPH) / olderPPH) * 100;
    
    return {
      direction: change > 5 ? 'up' as const : change < -5 ? 'down' as const : 'stable' as const,
      change: Math.abs(change),
    };
  }, [sessions]);

  const pphStatus = useMemo(() => {
    if (targetPPH === 0) return { status: 'N/A', color: '#6B7280' };
    const percentage = (analytics.pointsPerHour / targetPPH) * 100;
    if (percentage >= 120) return { status: 'Exceptional', color: '#10B981' };
    if (percentage >= 100) return { status: 'On Target', color: '#3B82F6' };
    if (percentage >= 70) return { status: 'Close', color: '#F59E0B' };
    return { status: 'Below', color: '#EF4444' };
  }, [analytics.pointsPerHour, targetPPH]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Dices size={18} color={COLORS.navyDeep} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Session Summary</Text>
            <Text style={styles.headerSubtitle}>Complete performance overview</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Zap size={16} color="#8B5CF6" />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricLabel}>Points Per Hour</Text>
            <Text style={styles.metricSubtext}>Current performance rate</Text>
          </View>
          <View style={styles.metricValueContainer}>
            <Text style={[styles.metricValue, { color: pphStatus.color }]}>
              {analytics.pointsPerHour.toFixed(1)}
            </Text>
            {recentTrend.direction !== 'stable' && (
              <View style={styles.trendBadge}>
                {recentTrend.direction === 'up' ? (
                  <TrendingUp size={10} color="#10B981" />
                ) : (
                  <TrendingDown size={10} color="#EF4444" />
                )}
                <Text style={[
                  styles.trendText,
                  { color: recentTrend.direction === 'up' ? '#10B981' : '#EF4444' }
                ]}>
                  {recentTrend.change.toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Target size={16} color="#3B82F6" />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricLabel}>Target Progress</Text>
            <Text style={styles.metricSubtext}>Goal: {targetPPH} pts/hr</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#3B82F6' }]}>
            {targetPPH > 0 ? `${Math.min((analytics.pointsPerHour / targetPPH) * 100, 100).toFixed(0)}%` : 'N/A'}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Award size={16} color="#10B981" />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricLabel}>Total Points Earned</Text>
            <Text style={styles.metricSubtext}>Avg {formatNumber(Math.round(analytics.totalSessions > 0 ? analytics.totalPointsEarned / analytics.totalSessions : 0))} per session</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>
            {formatNumber(analytics.totalPointsEarned)}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Clock size={16} color="#F59E0B" />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricLabel}>Total Play Time</Text>
            <Text style={styles.metricSubtext}>Avg {formatDuration(analytics.avgSessionLength)} per session</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
            {(analytics.totalPlayTimeMinutes / 60).toFixed(1)}h
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: analytics.netWinLoss >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
            <TrendingUp size={16} color={analytics.netWinLoss >= 0 ? '#10B981' : '#EF4444'} />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricLabel}>Net Win/Loss</Text>
            <Text style={styles.metricSubtext}>Total gambling result</Text>
          </View>
          <Text style={[styles.metricValue, { color: analytics.netWinLoss >= 0 ? '#10B981' : '#EF4444' }]}>
            {analytics.netWinLoss >= 0 ? '+' : ''}{formatCurrency(analytics.netWinLoss)}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={[styles.metricRow, styles.metricRowLast]}>
          <View style={styles.metricInfo}>
            <Text style={[styles.metricLabel, styles.metricTotalLabel]}>Sessions Tracked</Text>
            <Text style={styles.metricSubtext}>
              {sessions.filter(s => (s.winLoss || 0) >= 0).length} wins • {analytics.winRate.toFixed(0)}% win rate
            </Text>
          </View>
          <Text style={[styles.metricTotalValue]}>
            {analytics.totalSessions}
          </Text>
        </View>

        {bestSession && (
          <>
            <View style={styles.highlightDivider} />
            <View style={styles.highlightSection}>
              <View style={styles.highlightHeader}>
                <View style={[styles.highlightIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Trophy size={16} color="#F59E0B" />
                </View>
                <View style={styles.highlightInfo}>
                  <Text style={styles.highlightLabel}>Best Session</Text>
                  <Text style={styles.highlightSubtext}>
                    {new Date(bestSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                  </Text>
                </View>
              </View>
              <View style={styles.highlightStats}>
                <View style={styles.highlightStat}>
                  <Text style={styles.highlightStatLabel}>PPH</Text>
                  <Text style={[styles.highlightStatValue, { color: '#F59E0B' }]}>
                    {bestSession.pph.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.highlightDividerVertical} />
                <View style={styles.highlightStat}>
                  <Text style={styles.highlightStatLabel}>Points</Text>
                  <Text style={[styles.highlightStatValue, { color: '#8B5CF6' }]}>
                    {formatNumber(bestSession.pointsEarned || 0)}
                  </Text>
                </View>
                <View style={styles.highlightDividerVertical} />
                <View style={styles.highlightStat}>
                  <Text style={styles.highlightStatLabel}>Duration</Text>
                  <Text style={[styles.highlightStatValue, { color: '#3B82F6' }]}>
                    {formatDuration(bestSession.durationMinutes)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
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
    borderColor: '#8B5CF6',
    ...SHADOW.md,
  },
  header: {
    backgroundColor: '#F8FAFC',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: '#8B5CF6',
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
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  metricRowLast: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: -SPACING.md,
    marginBottom: -SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: '#8B5CF6',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1E293B',
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  metricTotalLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  metricSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  metricValueContainer: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  metricTotalValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  trendText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.xs,
  },
  highlightDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: SPACING.md,
  },
  highlightSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightInfo: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#92400E',
  },
  highlightSubtext: {
    fontSize: 10,
    color: '#92400E',
    opacity: 0.8,
  },
  highlightStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  highlightStat: {
    flex: 1,
    alignItems: 'center',
  },
  highlightStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  highlightStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  highlightDividerVertical: {
    width: 1,
    backgroundColor: '#FDE68A',
    marginHorizontal: SPACING.sm,
  },
});
