import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  DollarSign,
  Target,
  Gauge,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { formatCurrencyDetailed, formatNumber } from '@/lib/format';
import type { CruiseEconomicsSummary } from '@/lib/casinoCruiseEconomics';

interface CasinoMetricsCardProps {
  summary: CruiseEconomicsSummary;
  alwaysExpanded?: boolean;
}

export const CasinoMetricsCard = React.memo(function CasinoMetricsCard({
  summary,
  alwaysExpanded = false,
}: CasinoMetricsCardProps) {
  const [expanded, setExpanded] = useState<boolean>(alwaysExpanded);

  const metrics = useMemo(() => {
    const totalCoinIn = summary.totals.totalCoinIn;
    const totalHours = summary.totals.totalHours;
    const totalPoints = summary.totals.totalPoints;
    const totalEconomicValue = summary.totals.totalEconomicValue;
    const totalTheoreticalLoss = summary.totals.totalTheoreticalLoss;
    const totalPointValueEarned = summary.totals.totalPointValueEarned;
    const totalNetTheoretical = summary.totals.totalNetTheoretical;
    const weightedHouseEdge = totalCoinIn > 0 ? totalTheoreticalLoss / totalCoinIn : 0;
    const coinInPerHour = totalHours > 0 ? totalCoinIn / totalHours : 0;
    const pointsPerHour = totalHours > 0 ? totalPoints / totalHours : 0;
    const valuePerHour = totalHours > 0 ? totalEconomicValue / totalHours : 0;

    console.log('[CasinoMetricsCard] Aggregated casino analytics', {
      totalCoinIn,
      totalHours,
      totalPoints,
      totalEconomicValue,
      totalTheoreticalLoss,
      totalPointValueEarned,
      totalNetTheoretical,
      weightedHouseEdge,
      coinInPerHour,
      pointsPerHour,
      valuePerHour,
    });

    return {
      totalCoinIn,
      totalHours,
      totalPoints,
      totalEconomicValue,
      totalTheoreticalLoss,
      totalPointValueEarned,
      totalNetTheoretical,
      weightedHouseEdge,
      coinInPerHour,
      pointsPerHour,
      valuePerHour,
    };
  }, [summary]);

  const marbleConfig = MARBLE_TEXTURES.white;

  return (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={alwaysExpanded ? undefined : () => setExpanded((prev) => !prev)}
        activeOpacity={alwaysExpanded ? 1 : 0.8}
        disabled={alwaysExpanded}
        testID="casino-analytics-card-header"
      >
        <View style={styles.headerLeft}>
          <Calculator size={18} color={COLORS.navyDeep} />
          <View>
            <Text style={styles.headerTitle}>Casino Analytics</Text>
            <Text style={styles.headerSubtitle}>Coin-In is isolated to gaming activity only</Text>
          </View>
        </View>
        {!alwaysExpanded && (expanded ? <ChevronUp size={18} color={COLORS.navyDeep} /> : <ChevronDown size={18} color={COLORS.navyDeep} />)}
      </TouchableOpacity>

      <View style={styles.topMetricsRow}>
        <View style={styles.topMetricCard}>
          <Coins size={15} color={COLORS.navyDeep} />
          <Text style={styles.topMetricValue}>{formatCurrencyDetailed(metrics.totalCoinIn)}</Text>
          <Text style={styles.topMetricLabel}>Coin-In</Text>
        </View>
        <View style={styles.topMetricCard}>
          <Target size={15} color={COLORS.error} />
          <Text style={[styles.topMetricValue, { color: COLORS.error }]}>-{formatCurrencyDetailed(metrics.totalTheoreticalLoss)}</Text>
          <Text style={styles.topMetricLabel}>Theoretical Loss</Text>
        </View>
        <View style={styles.topMetricCard}>
          <Gauge size={15} color={metrics.valuePerHour >= 0 ? COLORS.success : COLORS.error} />
          <Text style={[styles.topMetricValue, { color: metrics.valuePerHour >= 0 ? COLORS.success : COLORS.error }]}>
            {metrics.valuePerHour > 0 ? formatCurrencyDetailed(metrics.valuePerHour) : '—'}
          </Text>
          <Text style={styles.topMetricLabel}>Value / Hour</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent} testID="casino-analytics-expanded">
          <View style={styles.sectionHeader}>
            <DollarSign size={14} color={COLORS.navyDeep} />
            <Text style={styles.sectionTitle}>Gaming activity metrics</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Coin-In</Text>
            <Text style={styles.detailValue}>{formatCurrencyDetailed(metrics.totalCoinIn)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hours Played</Text>
            <Text style={styles.detailValue}>{metrics.totalHours > 0 ? metrics.totalHours.toFixed(2) : '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>House Edge</Text>
            <Text style={styles.detailValue}>{metrics.weightedHouseEdge > 0 ? `${(metrics.weightedHouseEdge * 100).toFixed(2)}%` : '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Theoretical Loss</Text>
            <Text style={[styles.detailValue, { color: COLORS.error }]}>-{formatCurrencyDetailed(metrics.totalTheoreticalLoss)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Point Value Earned</Text>
            <Text style={[styles.detailValue, { color: COLORS.success }]}>+{formatCurrencyDetailed(metrics.totalPointValueEarned)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Net Theoretical</Text>
            <Text style={[styles.detailValue, { color: metrics.totalNetTheoretical >= 0 ? COLORS.success : COLORS.error }]}> 
              {metrics.totalNetTheoretical >= 0 ? '+' : ''}{formatCurrencyDetailed(metrics.totalNetTheoretical)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Coin-In Per Hour</Text>
            <Text style={styles.detailValue}>{metrics.coinInPerHour > 0 ? formatCurrencyDetailed(metrics.coinInPerHour) : '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Points Per Hour</Text>
            <Text style={styles.detailValue}>{metrics.pointsPerHour > 0 ? formatNumber(Math.round(metrics.pointsPerHour)) : '—'}</Text>
          </View>
          <View style={[styles.detailRow, styles.highlightRow]}>
            <Text style={styles.highlightLabel}>Value Per Hour</Text>
            <Text style={[styles.highlightValue, { color: metrics.valuePerHour >= 0 ? COLORS.success : COLORS.error }]}> 
              {metrics.valuePerHour > 0 ? formatCurrencyDetailed(metrics.valuePerHour) : '—'}
            </Text>
          </View>

          {summary.footnotes.length > 0 && (
            <View style={styles.footnoteCard}>
              <Clock size={14} color={COLORS.warning} />
              <Text style={styles.footnoteText}>{summary.footnotes[0]}</Text>
            </View>
          )}
        </View>
      )}
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  topMetricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  topMetricCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#E5EEF8',
    alignItems: 'center',
    gap: 6,
  },
  topMetricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    textAlign: 'center',
  },
  topMetricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    textAlign: 'center',
  },
  expandedContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EEF8',
    gap: SPACING.sm,
  },
  detailLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    textAlign: 'right',
  },
  highlightRow: {
    marginTop: SPACING.xs,
    borderBottomWidth: 0,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#F8FBFF',
  },
  highlightLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  highlightValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  footnoteCard: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: '#F6D38B',
  },
  footnoteText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    lineHeight: 20,
  },
});
