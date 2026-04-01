import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, TrendingUp, Award, DollarSign, RefreshCw, MessageSquare } from 'lucide-react-native';
import { GlassSurface } from '@/components/premium/GlassSurface';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';

import type { BookedCruise } from '@/types/models';

interface AgentXAnalysisCardProps {
  onViewDetails?: () => void;
  onRefresh?: () => Promise<void> | void;
}

export function AgentXAnalysisCard({ onViewDetails, onRefresh }: AgentXAnalysisCardProps) {
  const { bookedCruises: storedCruises, refreshData: syncFromStorage } = useCoreData();
  const { clubRoyalePoints } = useLoyalty();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bookedCruises = useMemo(() => {
    return storedCruises || [];
  }, [storedCruises]);

  const handleRefresh = useCallback(async () => {
    console.log('[AgentX Analysis] Manual refresh triggered');
    setIsRefreshing(true);

    try {
      await Promise.resolve(syncFromStorage());

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

  const marbleConfig = MARBLE_TEXTURES.purple;

  const formatCurrency = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toLocaleString()}`;
  };

  const renderActionButton = (
    label: string,
    icon: React.ReactNode,
    onPress: (() => void) | undefined,
    disabled = false,
    testID?: string
  ) => {
    if (!onPress) {
      return null;
    }

    return (
      <GlassSurface style={styles.actionGlass} contentStyle={styles.actionGlassContent} testID={testID}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onPress}
          activeOpacity={0.82}
          disabled={disabled}
        >
          {icon}
          <Text style={styles.actionButtonText}>{label}</Text>
        </TouchableOpacity>
      </GlassSurface>
    );
  };

  if (analysis.cruiseCount === 0 && analysis.totalBookedCount === 0) {
    return (
      <LinearGradient
        colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
        locations={marbleConfig.gradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <LinearGradient
          colors={['rgba(90, 49, 132, 0.18)', 'rgba(46, 26, 92, 0.44)', 'rgba(18, 25, 52, 0.54)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundTint}
        />
        <View style={styles.backgroundOrbPrimary} />
        <View style={styles.backgroundOrbSecondary} />
        <View style={styles.contentLayer}>
          <GlassSurface style={styles.headerGlass} contentStyle={styles.headerGlassContent}>
            <View style={styles.headerRow}>
              <View style={styles.iconContainer}>
                <Bot size={18} color="#111111" />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>AI Analysis</Text>
                <Text style={styles.subtitle}>No Recent Data</Text>
              </View>
            </View>
          </GlassSurface>

          <GlassSurface style={styles.panelGlass} contentStyle={styles.panelGlassContent}>
            <Text style={styles.emptyText}>
              No completed cruises found. Complete some cruises to see your performance analysis.
            </Text>
          </GlassSurface>

          {renderActionButton(
            isRefreshing ? 'Refreshing...' : 'Refresh Analysis',
            isRefreshing ? <ActivityIndicator size="small" color="#111111" /> : <RefreshCw size={14} color="#111111" />,
            handleRefresh,
            isRefreshing,
            'ai-analysis-refresh-button'
          )}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(90, 49, 132, 0.18)', 'rgba(46, 26, 92, 0.44)', 'rgba(18, 25, 52, 0.54)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundTint}
      />
      <View style={styles.backgroundOrbPrimary} />
      <View style={styles.backgroundOrbSecondary} />

      <View style={styles.contentLayer}>
        <GlassSurface style={styles.headerGlass} contentStyle={styles.headerGlassContent}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Bot size={18} color="#111111" />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>AI Analysis</Text>
                <Text style={styles.subtitle}>
                  {analysis.totalBookedCount} Total • {analysis.cruiseCount} Completed • {analysis.totalPoints.toLocaleString()} Points
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.summaryText}>
            {analysis.totalNights} nights cruised. Net result: {formatCurrency(analysis.totalWinnings)}.
          </Text>
        </GlassSurface>

        <GlassSurface style={styles.panelGlass} contentStyle={styles.metricsGlassContent}>
          <View style={styles.metricItem}>
            <Award size={15} color="#8A6200" />
            <Text style={styles.metricLabel}>Avg pts/night</Text>
            <Text style={styles.metricValue}>{analysis.avgPointsPerNight}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <DollarSign size={15} color="#0F766E" />
            <Text style={styles.metricLabel}>Est. coin-in</Text>
            <Text style={styles.metricValue}>${(analysis.estimatedCoinIn / 1000).toFixed(0)}k</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <TrendingUp size={15} color={analysis.winRate >= 0 ? '#0F766E' : '#B91C1C'} />
            <Text style={styles.metricLabel}>Win rate</Text>
            <Text style={[styles.metricValue, { color: analysis.winRate >= 0 ? '#0F766E' : '#B91C1C' }]}>
              {analysis.winRate >= 0 ? '+' : ''}
              {analysis.winRate.toFixed(1)}%
            </Text>
          </View>
        </GlassSurface>

        <GlassSurface style={styles.panelGlass} contentStyle={styles.panelGlassContent}>
          <Text style={styles.assessmentLabel}>Read on the table</Text>
          <Text style={styles.assessmentText}>{analysis.assessment}</Text>
        </GlassSurface>

        <View style={styles.actionsRow}>
          {renderActionButton(
            'Full Chat',
            <MessageSquare size={14} color={COLORS.navyDeep} />,
            onViewDetails,
            false,
            'ai-analysis-full-chat-button'
          )}
          {renderActionButton(
            isRefreshing ? 'Refreshing...' : 'Refresh',
            isRefreshing ? <ActivityIndicator size="small" color="#111111" /> : <RefreshCw size={14} color="#111111" />,
            handleRefresh,
            isRefreshing,
            'ai-analysis-refresh-button'
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  backgroundTint: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOrbPrimary: {
    position: 'absolute',
    top: -34,
    right: -18,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backgroundOrbSecondary: {
    position: 'absolute',
    bottom: -52,
    left: -18,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  contentLayer: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerGlass: {
    borderRadius: 26,
    backgroundColor: 'rgba(255, 250, 242, 0.90)',
    borderColor: 'rgba(255,255,255,0.36)',
  },
  headerGlassContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  panelGlass: {
    borderRadius: 24,
    backgroundColor: 'rgba(255, 250, 242, 0.84)',
    borderColor: 'rgba(255,255,255,0.30)',
  },
  panelGlassContent: {
    padding: SPACING.md,
  },
  metricsGlassContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#111111',
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(17,17,17,0.70)',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
    lineHeight: 19,
    fontWeight: '600' as const,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(17,17,17,0.10)',
    marginVertical: 6,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 10,
    color: 'rgba(17,17,17,0.62)',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#111111',
  },
  assessmentLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(17,17,17,0.56)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  assessmentText: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
    lineHeight: 19,
    fontWeight: '600' as const,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#1F2937',
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionGlass: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 250, 242, 0.92)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  actionGlassContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 0,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#111111',
  },
});
