import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus,
  Lightbulb,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Ship,
  Coins,
  Gem,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import type { RiskAnalysis } from '@/lib/whatIfSimulator';
import { formatCurrency, formatNumber } from '@/lib/format';

interface RiskAnalysisChartProps {
  riskAnalysis: RiskAnalysis;
  title?: string;
  totalSpent?: number;
  totalRetailValue?: number;
  cruiseValueCaptured?: number;
  cashResult?: number;
  totalEconomicValue?: number;
  totalCruises?: number;
  pointsEarned?: number;
}

const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
  switch (impact) {
    case 'positive':
      return TrendingUp;
    case 'negative':
      return TrendingDown;
    case 'neutral':
      return Minus;
  }
};

const getImpactColor = (impact: 'positive' | 'negative' | 'neutral'): string => {
  switch (impact) {
    case 'positive':
      return COLORS.success;
    case 'negative':
      return COLORS.error;
    case 'neutral':
      return COLORS.textSecondary;
  }
};

export function RiskAnalysisChart({
  riskAnalysis,
  title = 'Economic Health Analysis',
  totalSpent = 0,
  totalRetailValue = 0,
  cruiseValueCaptured = 0,
  cashResult = 0,
  totalEconomicValue = 0,
  totalCruises = 0,
  pointsEarned = 0,
}: RiskAnalysisChartProps) {
  const healthScore = useMemo(() => {
    let score = 50;

    if (cruiseValueCaptured > 0) score += Math.min(20, (cruiseValueCaptured / 1000) * 2);
    if (cashResult > 0) score += Math.min(20, (cashResult / 500) * 3);
    if (cashResult < 0) score -= Math.min(20, (Math.abs(cashResult) / 500) * 2);
    if (totalEconomicValue > 0) score += Math.min(20, (totalEconomicValue / 5000) * 5);
    if (totalCruises >= 5) score += 5;
    if (totalCruises >= 10) score += 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [cashResult, cruiseValueCaptured, totalCruises, totalEconomicValue]);

  const gaugeAngle = useMemo(() => {
    return (healthScore / 100) * 180 - 90;
  }, [healthScore]);

  const healthLevel = useMemo(() => {
    if (healthScore >= 75) return 'excellent';
    if (healthScore >= 55) return 'good';
    if (healthScore >= 35) return 'fair';
    return 'poor';
  }, [healthScore]);

  const healthColor = useMemo(() => {
    if (healthScore >= 75) return COLORS.success;
    if (healthScore >= 55) return COLORS.aquaAccent;
    if (healthScore >= 35) return COLORS.warning;
    return COLORS.error;
  }, [healthScore]);

  const sortedFactors = useMemo(() => {
    return [...riskAnalysis.factors].sort((a, b) => b.weight - a.weight);
  }, [riskAnalysis.factors]);

  const metrics = useMemo(() => [
    {
      icon: DollarSign,
      label: 'Amount Paid',
      value: formatCurrency(totalSpent),
      color: COLORS.error,
    },
    {
      icon: Gem,
      label: 'Cruise Value',
      value: formatCurrency(cruiseValueCaptured),
      color: COLORS.success,
    },
    {
      icon: Coins,
      label: 'Cash Result',
      value: `${cashResult >= 0 ? '+' : ''}${formatCurrency(cashResult)}`,
      color: cashResult >= 0 ? COLORS.success : COLORS.error,
    },
  ], [cashResult, cruiseValueCaptured, totalSpent]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, { backgroundColor: `${healthColor}20` }]}>
            <Shield size={18} color={healthColor} />
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Coin-In is excluded from this health score</Text>
          </View>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: `${healthColor}20` }]}>
          {healthLevel === 'excellent' && <CheckCircle size={14} color={healthColor} />}
          {healthLevel === 'good' && <TrendingUp size={14} color={healthColor} />}
          {healthLevel === 'fair' && <AlertTriangle size={14} color={healthColor} />}
          {healthLevel === 'poor' && <XCircle size={14} color={healthColor} />}
          <Text style={[styles.riskLabel, { color: healthColor }]}>{healthLevel.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.metricsRow}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <metric.icon size={14} color={metric.color} />
              <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.gaugeSection}>
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeBackground}>
              <View style={[styles.gaugeSegment, styles.segmentPoor]} />
              <View style={[styles.gaugeSegment, styles.segmentFair]} />
              <View style={[styles.gaugeSegment, styles.segmentGood]} />
              <View style={[styles.gaugeSegment, styles.segmentExcellent]} />
            </View>
            <View style={[styles.gaugeNeedle, { transform: [{ rotate: `${gaugeAngle}deg` }] }]} />
            <View style={styles.gaugeCenter}>
              <Text style={[styles.scoreValue, { color: healthColor }]}>{healthScore}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
          </View>
          <View style={styles.gaugeLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
              <Text style={styles.legendText}>Poor</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.legendText}>Fair</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.aquaAccent }]} />
              <Text style={styles.legendText}>Good</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>Excellent</Text>
            </View>
          </View>
        </View>

        <View style={styles.factorsSection}>
          <View style={styles.sectionHeader}>
            <Activity size={14} color={COLORS.textSecondary} />
            <Text style={styles.sectionTitle}>Key factors</Text>
          </View>
          <View style={styles.factorsList}>
            {sortedFactors.slice(0, 4).map((factor, index) => {
              const ImpactIcon = getImpactIcon(factor.impact);
              const impactColor = getImpactColor(factor.impact);

              return (
                <View key={`${factor.name}-${index}`} style={styles.factorItem}>
                  <View style={styles.factorHeader}>
                    <View style={[styles.impactIcon, { backgroundColor: `${impactColor}20` }]}>
                      <ImpactIcon size={12} color={impactColor} />
                    </View>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <Text style={[styles.weightText, { color: impactColor }]}>
                      {factor.impact === 'negative' ? '-' : factor.impact === 'positive' ? '+' : ''}
                      {factor.weight}%
                    </Text>
                  </View>
                  <Text style={styles.factorDescription}>{factor.description}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Ship size={14} color={COLORS.beigeWarm} />
            <Text style={styles.summaryText}>{totalCruises} cruises • {formatNumber(pointsEarned)} points • {formatCurrency(totalRetailValue)} retail</Text>
          </View>
          <View style={styles.summaryRow}>
            <Gem size={14} color={COLORS.success} />
            <Text style={styles.summaryText}>Cruise value captured: {formatCurrency(cruiseValueCaptured)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Coins size={14} color={cashResult >= 0 ? COLORS.success : COLORS.warning} />
            <Text style={styles.summaryText}>Cash result: {cashResult >= 0 ? '+' : ''}{formatCurrency(cashResult)}</Text>
          </View>
        </View>

        {riskAnalysis.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <View style={styles.sectionHeader}>
              <Lightbulb size={14} color={COLORS.beigeWarm} />
              <Text style={styles.sectionTitle}>Recommendations</Text>
            </View>
            <View style={styles.recommendationsList}>
              {riskAnalysis.recommendations.map((rec, index) => (
                <View key={`${rec}-${index}`} style={styles.recommendationItem}>
                  <View style={styles.recommendationDot} />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
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
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  riskLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  content: {
    gap: SPACING.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FBFF',
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
  gaugeSection: {
    gap: SPACING.md,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  gaugeBackground: {
    position: 'absolute',
    top: 20,
    width: 220,
    height: 110,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  gaugeSegment: {
    flex: 1,
    height: '100%',
  },
  segmentPoor: {
    backgroundColor: COLORS.error,
  },
  segmentFair: {
    backgroundColor: COLORS.warning,
  },
  segmentGood: {
    backgroundColor: COLORS.aquaAccent,
  },
  segmentExcellent: {
    backgroundColor: COLORS.success,
  },
  gaugeNeedle: {
    position: 'absolute',
    width: 4,
    height: 70,
    backgroundColor: COLORS.navyDeep,
    borderRadius: 999,
    bottom: 28,
  },
  gaugeCenter: {
    marginTop: 46,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  scoreLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 4,
  },
  gaugeLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: SPACING.md,
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
  factorsSection: {
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  factorsList: {
    gap: SPACING.sm,
  },
  factorItem: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#E5EEF8',
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  impactIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  weightText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  factorDescription: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 18,
  },
  summarySection: {
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  summaryText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    lineHeight: 20,
  },
  recommendationsSection: {
    gap: SPACING.sm,
  },
  recommendationsList: {
    gap: SPACING.sm,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  recommendationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.goldAccent,
    marginTop: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 20,
  },
});
