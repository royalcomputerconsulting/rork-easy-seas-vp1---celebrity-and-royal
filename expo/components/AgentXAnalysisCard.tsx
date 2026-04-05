import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, TrendingUp, Award, DollarSign, RefreshCw, MessageSquare } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { getFocusTheme } from '@/constants/focusThemes';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useUser } from '@/state/UserProvider';

import type { BookedCruise } from '@/types/models';

interface AgentXAnalysisCardProps {
  onViewDetails?: () => void;
  onRefresh?: () => void;
}

export function AgentXAnalysisCard({ onViewDetails, onRefresh }: AgentXAnalysisCardProps) {
  const { bookedCruises: storedCruises, refreshData: syncFromStorage } = useCoreData();
  const { clubRoyalePoints } = useLoyalty();
  const { currentUser } = useUser();
  const theme = getFocusTheme(currentUser?.preferredBrand);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const bookedCruises = useMemo(() => {
    return storedCruises || [];
  }, [storedCruises]);

  const handleRefresh = useCallback(async () => {
    console.log('[AgentX Analysis] Manual refresh triggered');
    setIsRefreshing(true);

    try {
      await syncFromStorage();

      if (onRefresh) {
        await Promise.resolve(onRefresh());
      }
    } catch (error) {
      console.error('[AgentX Analysis] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [syncFromStorage, onRefresh]);

  const analysis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allCompletedCruises = bookedCruises.filter((cruise: BookedCruise) => {
      if (cruise.completionState === 'completed') return true;

      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        returnDate.setHours(0, 0, 0, 0);
        if (returnDate < today) return true;
      } else if (cruise.sailDate && cruise.nights) {
        const sailDate = new Date(cruise.sailDate);
        const returnDate = new Date(sailDate);
        returnDate.setDate(returnDate.getDate() + cruise.nights);
        returnDate.setHours(0, 0, 0, 0);
        if (returnDate < today) return true;
      }

      return false;
    });

    const totalNights = allCompletedCruises.reduce(
      (sum: number, cruise: BookedCruise) => sum + (cruise.nights || 0),
      0
    );

    const earnedPointsFromCruises = allCompletedCruises.reduce(
      (sum: number, cruise: BookedCruise) => sum + (cruise.earnedPoints || cruise.casinoPoints || 0),
      0
    );

    const totalPoints = clubRoyalePoints > 0 ? clubRoyalePoints : earnedPointsFromCruises;

    const totalWinnings = allCompletedCruises.reduce(
      (sum: number, cruise: BookedCruise) => sum + (cruise.winnings || 0),
      0
    );

    const avgPointsPerNight = totalNights > 0 ? Math.round(totalPoints / totalNights) : 0;
    const estimatedCoinIn = totalPoints * 5;
    const winRate = estimatedCoinIn > 0 ? (totalWinnings / estimatedCoinIn) * 100 : 0;

    let assessment = '';
    if (totalPoints === 0 && allCompletedCruises.length === 0) {
      assessment = 'No play data available. Complete cruises to see performance insights.';
    } else if (totalPoints === 0 && allCompletedCruises.length > 0) {
      assessment = `${allCompletedCruises.length} cruise(s) completed. Add your Club Royale points in Settings.`;
    } else if (winRate > 5) {
      assessment = 'Excellent performance! Strong win rate above expected norms.';
    } else if (winRate > -5) {
      assessment = 'Break-even performance. Focus on maximizing comp value.';
    } else if (winRate > -15) {
      assessment = 'Below break-even. Consider adjusting play strategy.';
    } else {
      assessment = 'Significant losses detected. Review play patterns.';
    }

    console.log('[AgentX Analysis] Calculated:', {
      completedCruises: allCompletedCruises.length,
      totalBookedCruises: bookedCruises.length,
      clubRoyalePoints,
      earnedPointsFromCruises,
      totalPoints,
    });

    return {
      cruiseCount: allCompletedCruises.length,
      totalBookedCount: bookedCruises.length,
      totalNights,
      totalPoints,
      totalWinnings,
      avgPointsPerNight,
      estimatedCoinIn,
      winRate,
      assessment,
    };
  }, [bookedCruises, clubRoyalePoints]);

  const formatCurrency = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toLocaleString()}`;
  };

  const isEmpty = analysis.cruiseCount === 0 && analysis.totalBookedCount === 0;

  return (
    <View style={[styles.container, { borderColor: theme.cardBorder }]}> 
      <LinearGradient
        colors={theme.marbleGradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientOverlay}
      >
        <View pointerEvents="none" style={[styles.marbleBlobPrimary, { backgroundColor: theme.marbleVein }]} />
        <View pointerEvents="none" style={[styles.marbleBlobSecondary, { borderColor: theme.marbleVeinAlt }]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.iconSurface, borderColor: theme.iconBorder }]}>
              <Bot size={18} color={theme.actionPrimary} />
            </View>
            <View>
              <Text style={[styles.title, { color: theme.textPrimary }]}>AI Analysis</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}> 
                {isEmpty
                  ? 'No Recent Data'
                  : `${analysis.totalBookedCount} Total • ${analysis.cruiseCount} Completed • ${analysis.totalPoints.toLocaleString()} Points`}
              </Text>
            </View>
          </View>
        </View>

        {isEmpty ? (
          <>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}> 
              No completed cruises found. Complete some cruises to see your performance analysis.
            </Text>

            <TouchableOpacity
              style={[styles.singleButton, { backgroundColor: theme.actionPrimary }]}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing}
              testID="agentx-analysis-refresh-button"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={theme.actionText} />
              ) : (
                <RefreshCw size={14} color={theme.actionText} />
              )}
              <Text style={[styles.primaryButtonText, { color: theme.actionText }]}> 
                {isRefreshing ? 'Refreshing...' : 'Refresh Analysis'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.summarySection, { borderBottomColor: theme.cardBorder }]}> 
              <Text style={[styles.summaryText, { color: theme.textPrimary }]}> 
                {analysis.totalNights} nights cruised. Net result: {formatCurrency(analysis.totalWinnings)}.
              </Text>
            </View>

            <View style={[styles.metricsRow, { backgroundColor: theme.panelSurface, borderColor: theme.cardBorder }]}> 
              <View style={styles.metricItem}>
                <Award size={14} color={theme.actionSecondary} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Avg pts/night</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{analysis.avgPointsPerNight}</Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.metricItem}>
                <DollarSign size={14} color={theme.actionPrimary} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Est. coin-in</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>${(analysis.estimatedCoinIn / 1000).toFixed(0)}k</Text>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.cardBorder }]} />
              <View style={styles.metricItem}>
                <TrendingUp size={14} color={analysis.winRate >= 0 ? COLORS.success : COLORS.error} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Win rate</Text>
                <Text style={[styles.metricValue, { color: analysis.winRate >= 0 ? COLORS.success : COLORS.error }]}> 
                  {analysis.winRate >= 0 ? '+' : ''}{analysis.winRate.toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={[styles.assessmentSection, { backgroundColor: theme.panelSurface, borderColor: theme.cardBorder }]}> 
              <Text style={[styles.assessmentText, { color: theme.textPrimary }]}>{analysis.assessment}</Text>
            </View>

            <View style={styles.actionsRow}>
              {onViewDetails && (
                <TouchableOpacity
                  style={[styles.fullChatButton, { backgroundColor: theme.actionPrimary }]}
                  onPress={onViewDetails}
                  activeOpacity={0.7}
                  testID="agentx-analysis-full-chat-button"
                >
                  <MessageSquare size={14} color={theme.actionText} />
                  <Text style={[styles.primaryButtonText, { color: theme.actionText }]}>Full Chat</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.refreshButton, { backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }]}
                onPress={handleRefresh}
                activeOpacity={0.7}
                disabled={isRefreshing}
                testID="agentx-analysis-secondary-refresh-button"
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={theme.textPrimary} />
                ) : (
                  <RefreshCw size={14} color={theme.textPrimary} />
                )}
                <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}> 
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gradientOverlay: {
    padding: SPACING.md,
    position: 'relative',
  },
  marbleBlobPrimary: {
    position: 'absolute',
    top: -26,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  marbleBlobSecondary: {
    position: 'absolute',
    left: -54,
    bottom: -58,
    width: 230,
    height: 132,
    borderRadius: 66,
    borderWidth: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 1,
  },
  summarySection: {
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  metricsRow: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    marginHorizontal: SPACING.xs,
  },
  metricLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 2,
  },
  assessmentSection: {
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  assessmentText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  fullChatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  refreshButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  singleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
});
