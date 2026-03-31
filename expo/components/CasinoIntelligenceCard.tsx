import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Flame,
  Snowflake,
  Award,
  Clock,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle,
  Activity,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { SessionAnalytics, MachineType } from '@/state/CasinoSessionProvider';
import type { BookedCruise } from '@/types/models';


interface CasinoIntelligenceCardProps {
  analytics: SessionAnalytics;
  onViewDetails?: () => void;
  completedCruises?: BookedCruise[];
}

interface CruiseBasedMetrics {
  totalWinLoss: number;
  totalPointsEarned: number;
  totalHoursPlayed: number;
  totalTheoreticalLoss: number;
  cruiseCount: number;
  avgWinLossPerCruise: number;
  avgPointsPerCruise: number;
  valueVsTimeRatio: number;
  predictiveScore: number;
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

const MACHINE_HOUSE_EDGES: Record<MachineType, number> = {
  'penny-slots': 0.12,
  'nickel-slots': 0.10,
  'quarter-slots': 0.08,
  'dollar-slots': 0.05,
  'high-limit-slots': 0.03,
  'video-poker': 0.02,
  'blackjack': 0.005,
  'roulette': 0.053,
  'craps': 0.014,
  'baccarat': 0.0106,
  'poker': 0.025,
  'other': 0.08,
};

function HouseEdgeSection({ analytics, cruiseMetrics }: { analytics: SessionAnalytics; cruiseMetrics?: CruiseBasedMetrics }) {
  const theoreticalLoss = cruiseMetrics?.totalTheoreticalLoss || analytics.theoreticalVsActual.theoreticalLoss;
  const actualResult = cruiseMetrics?.totalWinLoss ?? analytics.netWinLoss;
  const variance = actualResult - (-theoreticalLoss);
  const isRunningHot = variance > theoreticalLoss * 0.2;
  const isRunningCold = variance < -theoreticalLoss * 0.2;
  
  const statusIcon = isRunningHot 
    ? Flame 
    : isRunningCold 
      ? Snowflake 
      : CheckCircle;
  
  const statusColor = isRunningHot 
    ? '#F59E0B' 
    : isRunningCold 
      ? '#3B82F6' 
      : '#10B981';
  
  const statusText = isRunningHot 
    ? 'Running Hot!' 
    : isRunningCold 
      ? 'Running Cold' 
      : 'Normal Variance';

  const sourceText = cruiseMetrics ? `Based on ${cruiseMetrics.cruiseCount} cruise${cruiseMetrics.cruiseCount !== 1 ? 's' : ''}` : 'Based on 8% avg edge';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
          <Target size={16} color="#8B5CF6" />
        </View>
        <Text style={styles.sectionTitle}>House Edge Analysis</Text>
      </View>
      
      <View style={styles.edgeGrid}>
        <View style={styles.edgeCard}>
          <Text style={styles.edgeLabel}>Theoretical Loss</Text>
          <Text style={styles.edgeValue}>
            {formatCurrency(theoreticalLoss)}
          </Text>
          <Text style={styles.edgeSubtext}>{sourceText}</Text>
        </View>
        
        <View style={styles.edgeCard}>
          <Text style={styles.edgeLabel}>Actual Result</Text>
          <Text style={[
            styles.edgeValue,
            { color: actualResult >= 0 ? COLORS.success : COLORS.error }
          ]}>
            {actualResult >= 0 ? '+' : ''}{formatCurrency(actualResult)}
          </Text>
          <Text style={styles.edgeSubtext}>Your real outcome</Text>
        </View>
      </View>

      <View style={[styles.statusBanner, { backgroundColor: `${statusColor}15` }]}>
        {React.createElement(statusIcon, { size: 18, color: statusColor })}
        <View style={styles.statusContent}>
          <Text style={[styles.statusTitle, { color: statusColor }]}>{statusText}</Text>
          <Text style={styles.statusDescription}>
            {isRunningHot 
              ? `You're ${formatCurrency(Math.abs(variance))} ahead of expected!`
              : isRunningCold
                ? `You're ${formatCurrency(Math.abs(variance))} behind expected`
                : 'Results are within normal variance range'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VarianceSection({ analytics }: { analytics: SessionAnalytics }) {
  const { varianceStats, streakData } = analytics;
  
  const riskLevel = varianceStats.standardDeviation > 500 
    ? 'High' 
    : varianceStats.standardDeviation > 200 
      ? 'Medium' 
      : 'Low';
  
  const riskColor = riskLevel === 'High' 
    ? COLORS.error 
    : riskLevel === 'Medium' 
      ? COLORS.warning 
      : COLORS.success;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Activity size={16} color="#3B82F6" />
        </View>
        <Text style={styles.sectionTitle}>Variance Analysis</Text>
      </View>
      
      <View style={styles.varianceGrid}>
        <View style={styles.varianceCard}>
          <Text style={styles.varianceLabel}>Std Deviation</Text>
          <Text style={styles.varianceValue}>
            {formatCurrency(varianceStats.standardDeviation)}
          </Text>
        </View>
        
        <View style={styles.varianceCard}>
          <Text style={styles.varianceLabel}>Median Win/Loss</Text>
          <Text style={[
            styles.varianceValue,
            { color: varianceStats.medianWinLoss >= 0 ? COLORS.success : COLORS.error }
          ]}>
            {varianceStats.medianWinLoss >= 0 ? '+' : ''}{formatCurrency(varianceStats.medianWinLoss)}
          </Text>
        </View>
        
        <View style={styles.varianceCard}>
          <Text style={styles.varianceLabel}>Best Session</Text>
          <Text style={[styles.varianceValue, { color: COLORS.success }]}>
            +{formatCurrency(varianceStats.maxWin)}
          </Text>
        </View>
        
        <View style={styles.varianceCard}>
          <Text style={styles.varianceLabel}>Worst Session</Text>
          <Text style={[styles.varianceValue, { color: COLORS.error }]}>
            {formatCurrency(varianceStats.maxLoss)}
          </Text>
        </View>
      </View>

      <View style={[styles.riskIndicator, { borderColor: riskColor }]}>
        <View style={styles.riskHeader}>
          <AlertTriangle size={14} color={riskColor} />
          <Text style={[styles.riskTitle, { color: riskColor }]}>{riskLevel} Variance Risk</Text>
        </View>
        <Text style={styles.riskDescription}>
          {riskLevel === 'High' 
            ? 'Your sessions have high variance. Consider smaller bets for consistency.'
            : riskLevel === 'Medium'
              ? 'Moderate variance detected. Stay within your bankroll limits.'
              : 'Low variance indicates consistent play patterns.'}
        </Text>
      </View>

      <View style={styles.streakRow}>
        <View style={styles.streakItem}>
          <View style={[styles.streakIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <TrendingUp size={14} color={COLORS.success} />
          </View>
          <View>
            <Text style={styles.streakLabel}>Best Win Streak</Text>
            <Text style={styles.streakValue}>{streakData.longestWinStreak} sessions</Text>
          </View>
        </View>
        
        <View style={styles.streakItem}>
          <View style={[styles.streakIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <TrendingDown size={14} color={COLORS.error} />
          </View>
          <View>
            <Text style={styles.streakLabel}>Longest Loss Streak</Text>
            <Text style={styles.streakValue}>{streakData.longestLossStreak} sessions</Text>
          </View>
        </View>
      </View>

      {streakData.currentStreak > 0 && (
        <View style={[
          styles.currentStreakBanner,
          { backgroundColor: streakData.currentStreakType === 'win' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
        ]}>
          <Zap size={16} color={streakData.currentStreakType === 'win' ? COLORS.success : COLORS.error} />
          <Text style={[
            styles.currentStreakText,
            { color: streakData.currentStreakType === 'win' ? COLORS.success : COLORS.error }
          ]}>
            Current {streakData.currentStreakType === 'win' ? 'Win' : 'Loss'} Streak: {streakData.currentStreak} sessions
          </Text>
        </View>
      )}
    </View>
  );
}

function WinRateSection({ analytics }: { analytics: SessionAnalytics }) {
  const topMachines = useMemo(() => {
    return Object.entries(analytics.machineTypeBreakdown)
      .filter(([_, data]) => data.sessions > 0)
      .sort((a, b) => b[1].winRate - a[1].winRate)
      .slice(0, 5);
  }, [analytics.machineTypeBreakdown]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
          <BarChart3 size={16} color="#10B981" />
        </View>
        <Text style={styles.sectionTitle}>Win Rate by Game Type</Text>
      </View>
      
      <View style={styles.rateGrid}>
        <View style={styles.rateCard}>
          <View style={styles.rateIconContainer}>
            <TrendingUp size={20} color={COLORS.success} />
          </View>
          <Text style={[styles.rateValue, { color: COLORS.success }]}>
            {analytics.winRate.toFixed(1)}%
          </Text>
          <Text style={styles.rateLabel}>Win Rate</Text>
        </View>
        
        <View style={styles.rateCard}>
          <View style={styles.rateIconContainer}>
            <TrendingDown size={20} color={COLORS.error} />
          </View>
          <Text style={[styles.rateValue, { color: COLORS.error }]}>
            {analytics.lossRate.toFixed(1)}%
          </Text>
          <Text style={styles.rateLabel}>Loss Rate</Text>
        </View>
        
        <View style={styles.rateCard}>
          <View style={styles.rateIconContainer}>
            <Target size={20} color="#6B7280" />
          </View>
          <Text style={styles.rateValue}>
            {analytics.breakEvenRate.toFixed(1)}%
          </Text>
          <Text style={styles.rateLabel}>Break Even</Text>
        </View>
      </View>

      {topMachines.length > 0 && (
        <View style={styles.machineBreakdown}>
          <Text style={styles.machineTitle}>Performance by Game</Text>
          {topMachines.map(([machineType, data]) => {
            const houseEdge = MACHINE_HOUSE_EDGES[machineType as MachineType];
            const isBeatingHouse = data.avgWinLoss > -(data.sessions * 100 * houseEdge);
            
            return (
              <View key={machineType} style={styles.machineRow}>
                <View style={styles.machineInfo}>
                  <Text style={styles.machineName}>
                    {MACHINE_TYPE_LABELS[machineType as MachineType]}
                  </Text>
                  <Text style={styles.machineSessions}>
                    {data.sessions} session{data.sessions !== 1 ? 's' : ''}
                  </Text>
                </View>
                
                <View style={styles.machineStats}>
                  <View style={styles.machineStatItem}>
                    <Text style={[
                      styles.machineWinRate,
                      { color: data.winRate >= 50 ? COLORS.success : COLORS.error }
                    ]}>
                      {data.winRate.toFixed(0)}%
                    </Text>
                    <Text style={styles.machineStatLabel}>Win Rate</Text>
                  </View>
                  
                  <View style={styles.machineStatItem}>
                    <Text style={[
                      styles.machineAvg,
                      { color: data.avgWinLoss >= 0 ? COLORS.success : COLORS.error }
                    ]}>
                      {data.avgWinLoss >= 0 ? '+' : ''}{formatCurrency(data.avgWinLoss)}
                    </Text>
                    <Text style={styles.machineStatLabel}>Avg W/L</Text>
                  </View>
                </View>
                
                {isBeatingHouse && (
                  <View style={styles.beatingHouseBadge}>
                    <Zap size={10} color="#F59E0B" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function PointsEfficiencySection({ analytics, cruiseMetrics }: { analytics: SessionAnalytics; cruiseMetrics?: CruiseBasedMetrics }) {
  const hoursPlayed = cruiseMetrics?.totalHoursPlayed || (analytics.totalPlayTimeMinutes / 60);
  const totalPointsEarned = cruiseMetrics?.totalPointsEarned || analytics.totalPointsEarned;
  const pointsPerHour = hoursPlayed > 0 ? totalPointsEarned / hoursPlayed : analytics.pointsPerHour;
  const efficiency = pointsPerHour > 50 
    ? 'Excellent' 
    : pointsPerHour > 25 
      ? 'Good' 
      : pointsPerHour > 10 
        ? 'Average' 
        : 'Low';
  
  const efficiencyColor = efficiency === 'Excellent' 
    ? COLORS.success 
    : efficiency === 'Good' 
      ? '#3B82F6' 
      : efficiency === 'Average' 
        ? COLORS.warning 
        : COLORS.error;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Clock size={16} color="#F59E0B" />
        </View>
        <Text style={styles.sectionTitle}>Points Efficiency</Text>
      </View>
      
      <View style={styles.efficiencyCard}>
        <View style={styles.efficiencyMain}>
          <View style={styles.efficiencyCircle}>
            <Award size={24} color={efficiencyColor} />
            <Text style={[styles.efficiencyValue, { color: efficiencyColor }]}>
              {pointsPerHour.toFixed(1)}
            </Text>
            <Text style={styles.efficiencyUnit}>pts/hr</Text>
          </View>
          <View style={styles.efficiencyInfo}>
            <View style={[styles.efficiencyBadge, { backgroundColor: `${efficiencyColor}20` }]}>
              <Text style={[styles.efficiencyBadgeText, { color: efficiencyColor }]}>
                {efficiency}
              </Text>
            </View>
            <Text style={styles.efficiencyDescription}>
              {efficiency === 'Excellent' 
                ? 'Outstanding point generation!'
                : efficiency === 'Good'
                  ? 'Solid earning rate'
                  : efficiency === 'Average'
                    ? 'Consider higher denomination'
                    : 'Try playing during multiplier events'}
            </Text>
          </View>
        </View>
        
        <View style={styles.efficiencyStats}>
          <View style={styles.efficiencyStat}>
            <Text style={styles.efficiencyStatValue}>{formatNumber(totalPointsEarned)}</Text>
            <Text style={styles.efficiencyStatLabel}>Total Points</Text>
          </View>
          <View style={styles.efficiencyStatDivider} />
          <View style={styles.efficiencyStat}>
            <Text style={styles.efficiencyStatValue}>{hoursPlayed.toFixed(1)}h</Text>
            <Text style={styles.efficiencyStatLabel}>Hours Played</Text>
          </View>
          <View style={styles.efficiencyStatDivider} />
          <View style={styles.efficiencyStat}>
            <Text style={styles.efficiencyStatValue}>{cruiseMetrics ? `${cruiseMetrics.cruiseCount} cruises` : formatCurrency(analytics.avgBuyIn)}</Text>
            <Text style={styles.efficiencyStatLabel}>{cruiseMetrics ? 'Data Source' : 'Avg Buy-In'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function CasinoIntelligenceCard({ analytics, onViewDetails, completedCruises }: CasinoIntelligenceCardProps) {
  const cruiseMetrics = useMemo((): CruiseBasedMetrics | undefined => {
    if (!completedCruises || completedCruises.length === 0) return undefined;
    
    const cruisesWithData = completedCruises.filter(c => {
      const hasWinnings = c.winnings !== undefined;
      const hasPoints = (c.earnedPoints !== undefined && c.earnedPoints > 0) || 
                       (c.casinoPoints !== undefined && c.casinoPoints > 0);
      return hasWinnings || hasPoints;
    });
    
    if (cruisesWithData.length === 0) return undefined;
    
    const totalWinLoss = cruisesWithData.reduce((sum, c) => sum + (c.winnings || 0), 0);
    const totalPointsEarned = cruisesWithData.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
    const totalHoursPlayed = cruisesWithData.reduce((sum, c) => sum + (c.hoursPlayed || (c.nights || 0) * 4), 0);
    
    const totalTheoreticalLoss = cruisesWithData.reduce((sum, c) => {
      if (c.theoreticalLoss) return sum + c.theoreticalLoss;
      const estimatedCoinIn = (c.actualSpend || 0) * 5;
      return sum + (estimatedCoinIn * 0.08);
    }, 0);
    
    const cruiseCount = cruisesWithData.length;
    const avgWinLossPerCruise = cruiseCount > 0 ? totalWinLoss / cruiseCount : 0;
    const avgPointsPerCruise = cruiseCount > 0 ? totalPointsEarned / cruiseCount : 0;
    const valueVsTimeRatio = totalHoursPlayed > 0 ? totalPointsEarned / totalHoursPlayed : 0;
    
    const winningCruises = cruisesWithData.filter(c => (c.winnings || 0) > 0).length;
    const winRate = cruiseCount > 0 ? (winningCruises / cruiseCount) * 100 : 0;
    const consistencyFactor = Math.min(cruiseCount / 5, 1);
    const predictiveScore = (winRate * 0.4) + (valueVsTimeRatio * 0.3) + (consistencyFactor * 30);
    
    return {
      totalWinLoss,
      totalPointsEarned,
      totalHoursPlayed,
      totalTheoreticalLoss,
      cruiseCount,
      avgWinLossPerCruise,
      avgPointsPerCruise,
      valueVsTimeRatio,
      predictiveScore,
    };
  }, [completedCruises]);

  if (analytics.totalSessions === 0 && !cruiseMetrics) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={['#8B5CF6', '#6366F1']}
          style={styles.emptyHeader}
        >
          <Brain size={24} color={COLORS.white} />
          <Text style={styles.emptyTitle}>Casino Intelligence</Text>
        </LinearGradient>
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Brain size={40} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyText}>No Session Data</Text>
          <Text style={styles.emptySubtext}>
            Log your first casino session to unlock{'\n'}professional gambler analytics
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Brain size={18} color={COLORS.navyDeep} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Casino Intelligence</Text>
            <Text style={styles.headerSubtitle}>
              {analytics.totalSessions} sessions analyzed
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <HouseEdgeSection analytics={analytics} cruiseMetrics={cruiseMetrics} />
        <VarianceSection analytics={analytics} />
        <WinRateSection analytics={analytics} />
        <PointsEfficiencySection analytics={analytics} cruiseMetrics={cruiseMetrics} />
        
        {cruiseMetrics && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <TrendingUp size={16} color="#10B981" />
              </View>
              <Text style={styles.sectionTitle}>Predictive Score Factors</Text>
            </View>
            
            <View style={styles.predictiveGrid}>
              <View style={styles.predictiveCard}>
                <Text style={styles.predictiveLabel}>Value vs Time</Text>
                <Text style={styles.predictiveValue}>{cruiseMetrics.valueVsTimeRatio.toFixed(1)}</Text>
                <Text style={styles.predictiveSubtext}>pts/hour played</Text>
              </View>
              
              <View style={styles.predictiveCard}>
                <Text style={styles.predictiveLabel}>Avg Win/Loss</Text>
                <Text style={[
                  styles.predictiveValue,
                  { color: cruiseMetrics.avgWinLossPerCruise >= 0 ? COLORS.success : COLORS.error }
                ]}>
                  {cruiseMetrics.avgWinLossPerCruise >= 0 ? '+' : ''}{formatCurrency(cruiseMetrics.avgWinLossPerCruise)}
                </Text>
                <Text style={styles.predictiveSubtext}>per cruise</Text>
              </View>
              
              <View style={styles.predictiveCard}>
                <Text style={styles.predictiveLabel}>Predictive Score</Text>
                <Text style={[
                  styles.predictiveValue,
                  { color: cruiseMetrics.predictiveScore >= 50 ? COLORS.success : cruiseMetrics.predictiveScore >= 30 ? '#F59E0B' : COLORS.error }
                ]}>
                  {cruiseMetrics.predictiveScore.toFixed(0)}
                </Text>
                <Text style={styles.predictiveSubtext}>out of 100</Text>
              </View>
            </View>
          </View>
        )}
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
    gap: SPACING.lg,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
  },
  edgeGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  edgeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  edgeLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: 4,
  },
  edgeValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  edgeSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  statusDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginTop: 2,
  },
  varianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  varianceCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  varianceLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: 2,
  },
  varianceValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  riskIndicator: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  riskTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  riskDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    lineHeight: 16,
  },
  streakRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  streakItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  streakIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  streakValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  currentStreakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  currentStreakText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  rateGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rateCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  rateIconContainer: {
    marginBottom: 4,
  },
  rateValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  rateLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  machineBreakdown: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  machineTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    marginBottom: SPACING.xs,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#1F2937',
  },
  machineSessions: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  machineStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  machineStatItem: {
    alignItems: 'flex-end',
  },
  machineWinRate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  machineAvg: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  machineStatLabel: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  beatingHouseBadge: {
    marginLeft: SPACING.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  efficiencyCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  efficiencyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  efficiencyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  efficiencyValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginTop: 2,
  },
  efficiencyUnit: {
    fontSize: 10,
    color: '#6B7280',
  },
  efficiencyInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  efficiencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  efficiencyBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  efficiencyDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    lineHeight: 16,
  },
  efficiencyStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: SPACING.sm,
  },
  efficiencyStat: {
    flex: 1,
    alignItems: 'center',
  },
  efficiencyStatDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
  },
  efficiencyStatValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  efficiencyStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyContainer: {
    backgroundColor: '#F5F3FF',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    ...SHADOW.md,
  },
  emptyHeader: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  emptyContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#000000',
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  predictiveGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  predictiveCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  predictiveLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#6B7280',
    marginBottom: 4,
  },
  predictiveValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#1E293B',
  },
  predictiveSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
