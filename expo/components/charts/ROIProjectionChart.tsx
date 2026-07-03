import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, CreditCard, Gem, DollarSign, Wallet, Info } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import type { ROIProjection } from '@/lib/whatIfSimulator';
import { formatCurrency, formatPercentage } from '@/lib/format';

interface ROIProjectionChartProps {
  roiProjection?: ROIProjection;
  comparisonROI?: number;
  title?: string;
  totalSpent?: number;
  totalRetailValue?: number;
  totalCruiseValueCaptured?: number;
  totalCashResult?: number;
  totalEconomicValue?: number;
  /** Optional tap targets so every bar/metric can open a calculation drill-down. */
  onPressPaid?: () => void;
  onPressCruiseValue?: () => void;
  onPressEconomicValue?: () => void;
  onPressRetailValue?: () => void;
  onPressWinningsHome?: () => void;
  onPressCashResult?: () => void;
}

export function ROIProjectionChart({
  title = 'Annual Value Capture',
  totalSpent = 0,
  totalRetailValue = 0,
  totalCruiseValueCaptured = 0,
  totalCashResult = 0,
  totalEconomicValue = 0,
  onPressPaid,
  onPressCruiseValue,
  onPressEconomicValue,
  onPressRetailValue,
  onPressWinningsHome,
  onPressCashResult,
}: ROIProjectionChartProps) {
  const effectiveWinnings = useMemo(() => {
    return totalEconomicValue - totalCruiseValueCaptured;
  }, [totalCruiseValueCaptured, totalEconomicValue]);

  const valueMultiple = useMemo(() => {
    if (totalSpent <= 0) {
      return 0;
    }

    return totalEconomicValue / totalSpent;
  }, [totalEconomicValue, totalSpent]);

  const chartBars = useMemo(() => {
    const maxValue = Math.max(totalSpent, totalCruiseValueCaptured, totalEconomicValue, 1);

    return {
      paidWidth: (totalSpent / maxValue) * 100,
      cruiseValueWidth: (totalCruiseValueCaptured / maxValue) * 100,
      economicWidth: (totalEconomicValue / maxValue) * 100,
    };
  }, [totalCruiseValueCaptured, totalEconomicValue, totalSpent]);

  const stackBreakdown = useMemo(() => {
    const total = Math.max(totalEconomicValue, 1);
    const cruiseShare = Math.max(0, (totalCruiseValueCaptured / total) * 100);
    const cashShare = Math.max(0, (Math.max(totalCashResult, 0) / total) * 100);

    return {
      cruiseShare: Math.min(100, cruiseShare),
      cashShare: Math.min(100 - cruiseShare, cashShare),
      remainder: Math.max(0, 100 - cruiseShare - cashShare),
    };
  }, [totalCashResult, totalCruiseValueCaptured, totalEconomicValue]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerMainRow}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <TrendingUp size={18} color={COLORS.aquaAccent} />
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalSpent > 0 ? `${valueMultiple.toFixed(2)}x` : '—'}</Text>
            <Text style={styles.badgeSubtext}>value / paid</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Cash result and cruise value are separated from gaming activity</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.chartSection}>
          <TouchableOpacity style={styles.barRow} activeOpacity={onPressPaid ? 0.7 : 1} onPress={onPressPaid} disabled={!onPressPaid} testID="roi-projection-bar-paid">
            <View style={styles.barHeaderRow}>
              <View style={styles.barLabelContainer}>
                <CreditCard size={12} color={COLORS.error} />
                <Text style={styles.barLabel}>Amount Paid</Text>
              </View>
              <Text style={[styles.barValue, { color: COLORS.error }]}>{formatCurrency(totalSpent)}</Text>
              {onPressPaid ? <Info size={11} color={CLEAN_THEME.text.secondary} /> : null}
            </View>
            <View style={styles.barWrapper}>
              <View style={[styles.bar, styles.paidBar, { width: `${chartBars.paidWidth}%` }]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.barRow} activeOpacity={onPressCruiseValue ? 0.7 : 1} onPress={onPressCruiseValue} disabled={!onPressCruiseValue} testID="roi-projection-bar-cruisevalue">
            <View style={styles.barHeaderRow}>
              <View style={styles.barLabelContainer}>
                <Gem size={12} color={COLORS.success} />
                <Text style={styles.barLabel}>Cruise Value Captured</Text>
              </View>
              <Text style={[styles.barValue, { color: COLORS.success }]}>{formatCurrency(totalCruiseValueCaptured)}</Text>
              {onPressCruiseValue ? <Info size={11} color={CLEAN_THEME.text.secondary} /> : null}
            </View>
            <View style={styles.barWrapper}>
              <LinearGradient
                colors={[COLORS.success, COLORS.aquaAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.bar, { width: `${chartBars.cruiseValueWidth}%` }]}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.barRow} activeOpacity={onPressEconomicValue ? 0.7 : 1} onPress={onPressEconomicValue} disabled={!onPressEconomicValue} testID="roi-projection-bar-economicvalue">
            <View style={styles.barHeaderRow}>
              <View style={styles.barLabelContainer}>
                <Wallet size={12} color={COLORS.goldAccent} />
                <Text style={styles.barLabel}>Total Economic Value</Text>
              </View>
              <Text style={[styles.barValue, { color: COLORS.goldAccent }]}>{formatCurrency(totalEconomicValue)}</Text>
              {onPressEconomicValue ? <Info size={11} color={CLEAN_THEME.text.secondary} /> : null}
            </View>
            <View style={styles.barWrapper}>
              <LinearGradient
                colors={[COLORS.goldAccent, COLORS.aquaAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.bar, { width: `${chartBars.economicWidth}%` }]}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.stackSection}>
          <Text style={styles.stackTitle}>Economic composition</Text>
          <View style={styles.stackBar}>
            <View style={[styles.stackSegment, styles.stackCruiseValue, { width: `${stackBreakdown.cruiseShare}%` }]} />
            <View style={[styles.stackSegment, styles.stackCash, { width: `${stackBreakdown.cashShare}%` }]} />
            <View style={[styles.stackSegment, styles.stackRemainder, { width: `${stackBreakdown.remainder}%` }]} />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>Cruise value</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.goldAccent }]} />
              <Text style={styles.legendText}>Cash result</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <TouchableOpacity style={styles.metricCard} activeOpacity={onPressRetailValue ? 0.7 : 1} onPress={onPressRetailValue} disabled={!onPressRetailValue} testID="roi-projection-metric-retail">
            <DollarSign size={16} color={COLORS.aquaAccent} />
            <Text style={[styles.metricValue, { color: COLORS.aquaAccent }]}>{formatCurrency(totalRetailValue)}</Text>
            <Text style={styles.metricLabel}>Retail Value</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard} activeOpacity={onPressWinningsHome ? 0.7 : 1} onPress={onPressWinningsHome} disabled={!onPressWinningsHome} testID="roi-projection-metric-winnings">
            <Wallet size={16} color={effectiveWinnings >= 0 ? COLORS.success : COLORS.error} />
            <Text style={[styles.metricValue, { color: effectiveWinnings >= 0 ? COLORS.success : COLORS.error }]}>
              {effectiveWinnings >= 0 ? '+' : ''}{formatCurrency(effectiveWinnings)}
            </Text>
            <Text style={styles.metricLabel}>Winnings Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metricCard} activeOpacity={onPressCashResult ? 0.7 : 1} onPress={onPressCashResult} disabled={!onPressCashResult} testID="roi-projection-metric-cashresult">
            <TrendingUp size={16} color={totalCashResult >= 0 ? COLORS.success : COLORS.error} />
            <Text style={[styles.metricValue, { color: totalCashResult >= 0 ? COLORS.success : COLORS.error }]}>
              {totalCashResult >= 0 ? '+' : ''}{formatCurrency(totalCashResult)}
            </Text>
            <Text style={styles.metricLabel}>Cash Result</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryInfo}>
          <Text style={styles.summaryText}>
            Cash result is shown separately from cruise value, and Coin-In is excluded from every value bar on this chart.
            {' '}
            <Text style={styles.summaryHighlight}>
              {totalSpent > 0 ? formatPercentage((totalCashResult / totalSpent) * 100, 1) : '0.0%'}
            </Text>
            {' '}cash ROI on paid spend.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.sm,
  },
  header: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(77, 208, 225, 0.15)',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(77, 208, 225, 0.12)',
    alignItems: 'center',
    minWidth: 62,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.aquaAccent,
  },
  badgeSubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  content: {
    gap: SPACING.lg,
  },
  chartSection: {
    gap: SPACING.md,
  },
  barRow: {
    gap: SPACING.xs,
  },
  barHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  barLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  barLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    flexShrink: 1,
  },
  barWrapper: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5EEF8',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 999,
  },
  paidBar: {
    backgroundColor: COLORS.error,
  },
  barValue: {
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    flexShrink: 0,
  },
  stackSection: {
    gap: SPACING.sm,
  },
  stackTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  stackBar: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#E5EEF8',
  },
  stackSegment: {
    height: '100%',
  },
  stackCruiseValue: {
    backgroundColor: COLORS.success,
  },
  stackCash: {
    backgroundColor: COLORS.goldAccent,
  },
  stackRemainder: {
    backgroundColor: '#D7E4F4',
  },
  legendRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FBFF',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5EEF8',
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    textAlign: 'center',
  },
  summaryInfo: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FBFF',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.aquaAccent,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    lineHeight: 20,
  },
  summaryHighlight: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
});
