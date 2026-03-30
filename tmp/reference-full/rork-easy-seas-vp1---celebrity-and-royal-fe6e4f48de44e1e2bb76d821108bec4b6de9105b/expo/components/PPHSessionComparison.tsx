import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatNumber } from '@/lib/format';
import type { CasinoSession } from '@/state/CasinoSessionProvider';

interface PPHSessionComparisonProps {
  sessions: CasinoSession[];
}

interface SessionWithPPH extends CasinoSession {
  pph: number;
}

export function PPHSessionComparison({ sessions }: PPHSessionComparisonProps) {
  const sessionsWithPPH = useMemo((): SessionWithPPH[] => {
    return sessions
      .filter(s => (s.pointsEarned || 0) > 0 && s.durationMinutes > 0)
      .map(s => ({
        ...s,
        pph: ((s.pointsEarned || 0) / s.durationMinutes) * 60,
      }))
      .sort((a, b) => b.pph - a.pph);
  }, [sessions]);

  const comparison = useMemo(() => {
    if (sessionsWithPPH.length < 2) return null;
    
    const best = sessionsWithPPH[0];
    const average = sessionsWithPPH.reduce((sum, s) => sum + s.pph, 0) / sessionsWithPPH.length;
    const pphDiff = best.pph - average;
    const pphDiffPercent = average > 0 ? (pphDiff / average) * 100 : 0;
    
    return {
      best,
      average,
      pphDiff,
      pphDiffPercent,
    };
  }, [sessionsWithPPH]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });
  };

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  if (!comparison) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <GitCompare size={18} color={COLORS.navyDeep} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Session Comparison</Text>
              <Text style={styles.headerSubtitle}>Best vs Average</Text>
            </View>
          </View>
        </View>

        <View style={styles.emptyContent}>
          <GitCompare size={40} color="#D1D5DB" />
          <Text style={styles.emptyText}>Need at least 2 sessions</Text>
          <Text style={styles.emptySubtext}>Track more sessions to compare performance</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <GitCompare size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Session Comparison</Text>
            <Text style={styles.headerSubtitle}>Best vs Average</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.comparisonGrid}>
          <View style={styles.bestSessionCard}>
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>BEST</Text>
            </View>
            <Text style={styles.sessionDate}>{formatDate(comparison.best.date)}</Text>
            <Text style={styles.pphValue}>{comparison.best.pph.toFixed(1)}</Text>
            <Text style={styles.pphUnit}>pts/hr</Text>
            
            <View style={styles.sessionStats}>
              <View style={styles.sessionStatRow}>
                <Award size={12} color="#8B5CF6" />
                <Text style={styles.sessionStatLabel}>Points:</Text>
                <Text style={styles.sessionStatValue}>{formatNumber(comparison.best.pointsEarned || 0)}</Text>
              </View>
              <View style={styles.sessionStatRow}>
                <Clock size={12} color="#3B82F6" />
                <Text style={styles.sessionStatLabel}>Duration:</Text>
                <Text style={styles.sessionStatValue}>{formatDuration(comparison.best.durationMinutes)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.averageCard}>
            <Text style={styles.averageLabel}>Average PPH</Text>
            <Text style={styles.averageValue}>{comparison.average.toFixed(1)}</Text>
            <Text style={styles.averageUnit}>pts/hr</Text>
          </View>
        </View>

        <View style={styles.diffCard}>
          <View style={styles.diffHeader}>
            <Text style={styles.diffTitle}>Performance Gap</Text>
            <View style={[
              styles.diffBadge,
              { backgroundColor: comparison.pphDiff > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)' }
            ]}>
              {comparison.pphDiff > 0 && (
                <TrendingUp size={12} color="#10B981" />
              )}
              <Text style={[
                styles.diffText,
                { color: comparison.pphDiff > 0 ? '#10B981' : '#6B7280' }
              ]}>
                {comparison.pphDiff > 0 ? '+' : ''}{comparison.pphDiff.toFixed(1)} pts/hr
              </Text>
            </View>
          </View>
          <Text style={styles.diffDescription}>
            Your best session is {Math.abs(comparison.pphDiffPercent).toFixed(0)}% {comparison.pphDiff > 0 ? 'above' : 'below'} your average performance
          </Text>
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
  content: {
    padding: SPACING.md,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bestSessionCard: {
    flex: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative' as const,
  },
  bestBadge: {
    position: 'absolute' as const,
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: '#10B981',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  bestBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  sessionDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: SPACING.xs,
  },
  pphValue: {
    fontSize: 24,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: -1,
  },
  pphUnit: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: SPACING.sm,
  },
  sessionStats: {
    gap: SPACING.xs,
    width: '100%',
  },
  sessionStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionStatLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    flex: 1,
  },
  sessionStatValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  averageCard: {
    flex: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  averageLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  averageValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  averageUnit: {
    fontSize: 10,
    color: '#6B7280',
  },
  diffCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  diffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  diffTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E293B',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  diffText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  diffDescription: {
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
