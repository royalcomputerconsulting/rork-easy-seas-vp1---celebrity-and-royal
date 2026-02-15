import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, DollarSign, PiggyBank, Percent, ArrowUpRight, ArrowDownRight, CreditCard, Wallet } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { ROIProjection } from '@/lib/whatIfSimulator';
import { formatCurrency, formatPercentage } from '@/lib/format';
import { DOLLARS_PER_POINT } from '@/types/models';



interface ROIProjectionChartProps {
  roiProjection: ROIProjection;
  comparisonROI?: number;
  title?: string;
  totalSpent?: number;
  totalRetailValue?: number;
  totalPointsEarned?: number;
}

export function ROIProjectionChart({
  roiProjection,
  comparisonROI,
  title = 'Spending vs Savings Analysis',
  totalSpent,
  totalRetailValue,
  totalPointsEarned,
}: ROIProjectionChartProps) {
  const actualSpent = totalSpent ?? roiProjection.totalInvestment;
  const actualRetailValue = totalRetailValue ?? roiProjection.projectedValue;
  const actualSavings = Math.max(0, actualRetailValue - actualSpent);
  const pointsValue = (totalPointsEarned ?? 0) * DOLLARS_PER_POINT;
  const totalValueWithPoints = actualRetailValue + pointsValue;
  const roiTrend = useMemo(() => {
    if (comparisonROI === undefined) return 'neutral';
    if (roiProjection.projectedROI > comparisonROI) return 'up';
    if (roiProjection.projectedROI < comparisonROI) return 'down';
    return 'neutral';
  }, [roiProjection.projectedROI, comparisonROI]);

  const roiColor = useMemo(() => {
    if (roiProjection.projectedROI >= 50) return COLORS.success;
    if (roiProjection.projectedROI >= 20) return COLORS.warning;
    if (roiProjection.projectedROI >= 0) return COLORS.aquaAccent;
    return COLORS.error;
  }, [roiProjection.projectedROI]);

  const barData = useMemo(() => {
    const maxValue = Math.max(
      actualSpent,
      totalValueWithPoints,
      1
    );
    
    return {
      spentWidth: (actualSpent / maxValue) * 100,
      retailWidth: (actualRetailValue / maxValue) * 100,
      pointsValueWidth: (pointsValue / maxValue) * 100,
      savingsWidth: (actualSavings / maxValue) * 100,
    };
  }, [actualSpent, actualRetailValue, pointsValue, actualSavings, totalValueWithPoints]);

  const valueBreakdown = useMemo(() => {
    const total = totalValueWithPoints;
    if (total === 0) return { spent: 50, savings: 30, points: 20 };
    
    return {
      spent: Math.min(100, (actualSpent / total) * 100),
      savings: Math.min(100 - (actualSpent / total) * 100, (actualSavings / total) * 100),
      points: Math.min(100, (pointsValue / total) * 100),
    };
  }, [actualSpent, actualSavings, pointsValue, totalValueWithPoints]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, { backgroundColor: 'rgba(77, 208, 225, 0.15)' }]}>
            <TrendingUp size={18} color={COLORS.aquaAccent} />
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Compare spending to value received</Text>
          </View>
        </View>
        <View style={[styles.roiBadge, { backgroundColor: `${roiColor}20` }]}>
          {roiTrend === 'up' && <ArrowUpRight size={12} color={COLORS.success} />}
          {roiTrend === 'down' && <ArrowDownRight size={12} color={COLORS.error} />}
          <Text style={[styles.roiValue, { color: roiColor }]}>
            {formatPercentage(roiProjection.projectedROI, 1)} ROI
          </Text>
        </View>
      </View>

      <View style={styles.content}>

        <View style={styles.chartSection}>
          <View style={styles.barChartContainer}>
            <View style={styles.barRow}>
              <View style={styles.barLabelContainer}>
                <CreditCard size={12} color={COLORS.error} />
                <Text style={styles.barLabel}>Spent</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    styles.spentBar,
                    { width: `${barData.spentWidth}%` },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: COLORS.error }]}>{formatCurrency(actualSpent)}</Text>
            </View>
            
            <View style={styles.barRow}>
              <View style={styles.barLabelContainer}>
                <DollarSign size={12} color={COLORS.aquaAccent} />
                <Text style={styles.barLabel}>Retail</Text>
              </View>
              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    styles.retailBar,
                    { width: `${barData.retailWidth}%` },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: COLORS.aquaAccent }]}>
                {formatCurrency(actualRetailValue)}
              </Text>
            </View>

            <View style={styles.barRow}>
              <View style={styles.barLabelContainer}>
                <Wallet size={12} color={COLORS.success} />
                <Text style={styles.barLabel}>Saved</Text>
              </View>
              <View style={styles.barWrapper}>
                <LinearGradient
                  colors={[COLORS.success, COLORS.aquaAccent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.bar,
                    { width: `${barData.savingsWidth}%`, borderRadius: 4 },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: COLORS.success }]}>
                {formatCurrency(actualSavings)}
              </Text>
            </View>
          </View>

          <View style={styles.valueStackContainer}>
            <Text style={styles.stackLabel}>Value Breakdown</Text>
            <View style={styles.valueStack}>
              <View
                style={[
                  styles.stackSegment,
                  styles.stackSpent,
                  { width: `${valueBreakdown.spent}%` },
                ]}
              />
              <View
                style={[
                  styles.stackSegment,
                  styles.stackSavings,
                  { width: `${valueBreakdown.savings}%` },
                ]}
              />
              {pointsValue > 0 && (
                <View
                  style={[
                    styles.stackSegment,
                    styles.stackPoints,
                    { width: `${valueBreakdown.points}%` },
                  ]}
                />
              )}
            </View>
            <View style={styles.stackLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
                <Text style={styles.legendText}>Out-of-Pocket</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.legendText}>Savings</Text>
              </View>
              {pointsValue > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.goldAccent }]} />
                  <Text style={styles.legendText}>Points Value</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <DollarSign size={16} color={COLORS.success} />
            <Text style={[styles.metricValue, { color: COLORS.success }]}>{formatCurrency(actualSavings)}</Text>
            <Text style={styles.metricLabel}>Total Saved</Text>
          </View>
          <View style={styles.metricCard}>
            <PiggyBank size={16} color={COLORS.goldAccent} />
            <Text style={[styles.metricValue, { color: COLORS.goldAccent }]}>{formatCurrency(pointsValue)}</Text>
            <Text style={styles.metricLabel}>Points @ $5/pt</Text>
          </View>
          <View style={styles.metricCard}>
            <Percent size={16} color={roiColor} />
            <Text style={[styles.metricValue, { color: roiColor }]}>
              {actualSpent > 0 ? formatPercentage((actualSavings / actualSpent) * 100, 0) : '0%'}
            </Text>
            <Text style={styles.metricLabel}>Savings Rate</Text>
          </View>
        </View>

        {actualSavings > 0 && (
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryText}>
              You have saved{' '}
              <Text style={{ fontWeight: '700' as const, color: COLORS.success }}>
                {formatCurrency(actualSavings)}
              </Text>
              {' '}off retail prices. {pointsValue > 0 && (
                <>
                  Your {totalPointsEarned?.toLocaleString() ?? 0} points are worth{' '}
                  <Text style={{ fontWeight: '700' as const, color: COLORS.goldAccent }}>
                    {formatCurrency(pointsValue)}
                  </Text>
                  {' '}at $5/point machine play.
                </>
              )}
            </Text>
          </View>
        )}

        {actualSavings <= 0 && actualSpent > 0 && (
          <View style={[styles.summaryInfo, { borderLeftColor: COLORS.warning, backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.summaryText}>
              You paid{' '}
              <Text style={{ fontWeight: '700' as const, color: COLORS.error }}>
                {formatCurrency(Math.abs(actualSavings))}
              </Text>
              {' '}more than retail value. Consider looking for better offers.
            </Text>
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
    borderColor: COLORS.aquaAccent,
    ...SHADOW.md,
  },
  header: {
    backgroundColor: '#E0F7FA',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.aquaAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#006064',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#006064',
    opacity: 0.8,
  },
  content: {
    padding: SPACING.md,
  },
  roiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  roiValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  chartSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  barChartContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  barLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
  },
  barWrapper: {
    flex: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  spentBar: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
  },
  retailBar: {
    backgroundColor: 'rgba(77, 208, 225, 0.6)',
  },
  barLabelContainer: {
    width: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    width: 70,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    textAlign: 'right',
  },
  valueStackContainer: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stackLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    marginBottom: SPACING.xs,
  },
  valueStack: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  stackSegment: {
    height: '100%',
  },
  stackSpent: {
    backgroundColor: 'rgba(239, 68, 68, 0.5)',
  },
  stackSavings: {
    backgroundColor: COLORS.success,
  },
  stackPoints: {
    backgroundColor: COLORS.goldAccent,
  },
  stackLegend: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
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
    color: '#000000',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  riskAdjustedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  riskAdjustedLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
  },
  riskAdjustedValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  summaryInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    lineHeight: 18,
  },
});
