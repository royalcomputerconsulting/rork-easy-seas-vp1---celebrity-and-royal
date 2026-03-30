import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, TrendingUp, Award, DollarSign, RefreshCw, MessageSquare } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';

import type { BookedCruise } from '@/types/models';

interface AgentXAnalysisCardProps {
  onViewDetails?: () => void;
  onRefresh?: () => void;
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
      await syncFromStorage();

      if (onRefresh) {
        await onRefresh();
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
      // Explicitly marked as completed
      if (cruise.completionState === 'completed') return true;
      
      // Or sail date is in the past (cruise has ended)
      if (cruise.returnDate) {
        const returnDate = new Date(cruise.returnDate);
        returnDate.setHours(0, 0, 0, 0);
        if (returnDate < today) return true;
      } else if (cruise.sailDate && cruise.nights) {
        // Calculate return date from sail date + nights
        const sailDate = new Date(cruise.sailDate);
        const returnDate = new Date(sailDate);
        returnDate.setDate(returnDate.getDate() + cruise.nights);
        returnDate.setHours(0, 0, 0, 0);
        if (returnDate < today) return true;
      }
      
      return false;
    });
    
    const totalNights = allCompletedCruises.reduce(
      (sum: number, c: BookedCruise) => sum + (c.nights || 0),
      0
    );

    const earnedPointsFromCruises = allCompletedCruises.reduce(
      (sum: number, c: BookedCruise) => sum + (c.earnedPoints || c.casinoPoints || 0),
      0
    );
    
    const totalPoints = clubRoyalePoints > 0 ? clubRoyalePoints : earnedPointsFromCruises;

    const totalWinnings = allCompletedCruises.reduce(
      (sum: number, c: BookedCruise) => sum + (c.winnings || 0),
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

  if (analysis.cruiseCount === 0 && analysis.totalBookedCount === 0) {
    return (
      <View style={styles.container}>
        <ImageBackground 
          source={{ uri: OCEAN_BG }} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(30, 58, 95, 0.85)', 'rgba(123, 45, 142, 0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientOverlay}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <Bot size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.title}>AI Analysis</Text>
                  <Text style={styles.subtitle}>No Recent Data</Text>
                </View>
              </View>
            </View>

            <Text style={styles.emptyText}>
              No completed cruises found. Complete some cruises to see your performance analysis.
            </Text>
            
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <RefreshCw size={14} color="#FFFFFF" />
              )}
              <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing...' : 'Refresh Analysis'}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={{ uri: OCEAN_BG }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(30, 58, 95, 0.88)', 'rgba(123, 45, 142, 0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientOverlay}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Bot size={18} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.title}>AI Analysis</Text>
                <Text style={styles.subtitle}>
                  {analysis.totalBookedCount} Total • {analysis.cruiseCount} Completed • {analysis.totalPoints.toLocaleString()} Points
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summaryText}>
              {analysis.totalNights} nights cruised. Net result: {formatCurrency(analysis.totalWinnings)}.
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Award size={14} color="#FEF3C7" />
              <Text style={styles.metricLabel}>Avg pts/night</Text>
              <Text style={styles.metricValue}>{analysis.avgPointsPerNight}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <DollarSign size={14} color="#A7F3D0" />
              <Text style={styles.metricLabel}>Est. coin-in</Text>
              <Text style={styles.metricValue}>${(analysis.estimatedCoinIn / 1000).toFixed(0)}k</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <TrendingUp size={14} color={analysis.winRate >= 0 ? '#A7F3D0' : '#FCA5A5'} />
              <Text style={styles.metricLabel}>Win rate</Text>
              <Text style={[styles.metricValue, { color: analysis.winRate >= 0 ? '#A7F3D0' : '#FCA5A5' }]}>
                {analysis.winRate >= 0 ? '+' : ''}{analysis.winRate.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.assessmentSection}>
            <Text style={styles.assessmentText}>{analysis.assessment}</Text>
          </View>

          <View style={styles.actionsRow}>
            {onViewDetails && (
              <TouchableOpacity
                style={styles.fullChatButton}
                onPress={onViewDetails}
                activeOpacity={0.7}
              >
                <MessageSquare size={14} color={COLORS.navyDeep} />
                <Text style={styles.fullChatButtonText}>Full Chat</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <RefreshCw size={14} color="#FFFFFF" />
              )}
              <Text style={styles.refreshButtonText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const OCEAN_BG = 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=600&q=80';

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
  },
  gradientOverlay: {
    padding: SPACING.md,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },
  summarySection: {
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.xs,
  },
  metricLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  assessmentSection: {
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  assessmentText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FEF3C7',
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.9)',
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
    backgroundColor: '#FFFFFF',
  },
  fullChatButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  refreshButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  refreshButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#FFFFFF',
  },
});
