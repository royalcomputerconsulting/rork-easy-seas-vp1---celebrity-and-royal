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
  Coins
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, CLEAN_THEME } from '@/constants/theme';
import { RiskAnalysis } from '@/lib/whatIfSimulator';
import { formatCurrency, formatNumber } from '@/lib/format';

interface RiskAnalysisChartProps {
  riskAnalysis: RiskAnalysis;
  title?: string;
  totalSpent?: number;
  totalRetailValue?: number;
  totalSavings?: number;
  casinoNetResult?: number;
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
  title = 'Financial Health Analysis',
  totalSpent = 0,
  totalRetailValue = 0,
  totalSavings = 0,
  casinoNetResult = 0,
  totalCruises = 0,
  pointsEarned = 0,
}: RiskAnalysisChartProps) {
  const healthScore = useMemo(() => {
    let score = 50;
    
    if (totalSavings > 0) score += Math.min(25, (totalSavings / 1000) * 5);
    if (totalSavings < 0) score -= Math.min(25, (Math.abs(totalSavings) / 1000) * 5);
    
    if (casinoNetResult > 0) score += Math.min(15, (casinoNetResult / 500) * 5);
    if (casinoNetResult < 0) score -= Math.min(15, (Math.abs(casinoNetResult) / 500) * 2);
    
    if (totalCruises >= 5) score += 10;
    if (totalCruises >= 10) score += 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [totalSavings, casinoNetResult, totalCruises]);

  const gaugeAngle = useMemo(() => {
    return (healthScore / 100) * 180 - 90;
  }, [healthScore]);

  const healthLevel = useMemo(() => {
    if (healthScore >= 70) return 'excellent';
    if (healthScore >= 50) return 'good';
    if (healthScore >= 30) return 'fair';
    return 'poor';
  }, [healthScore]);

  const healthColor = useMemo(() => {
    if (healthScore >= 70) return COLORS.success;
    if (healthScore >= 50) return COLORS.aquaAccent;
    if (healthScore >= 30) return COLORS.warning;
    return COLORS.error;
  }, [healthScore]);

  const sortedFactors = useMemo(() => {
    return [...riskAnalysis.factors].sort((a, b) => b.weight - a.weight);
  }, [riskAnalysis.factors]);
  
  const financialMetrics = useMemo(() => [
    {
      icon: DollarSign,
      label: 'Total Spent',
      value: formatCurrency(totalSpent),
      color: COLORS.error,
    },
    {
      icon: TrendingUp,
      label: 'Savings',
      value: formatCurrency(totalSavings),
      color: totalSavings >= 0 ? COLORS.success : COLORS.error,
    },
    {
      icon: Coins,
      label: 'Casino Net',
      value: formatCurrency(casinoNetResult),
      color: casinoNetResult >= 0 ? COLORS.success : COLORS.error,
    },
  ], [totalSpent, totalSavings, casinoNetResult]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, { backgroundColor: `${healthColor}20` }]}>
            <Shield size={18} color={healthColor} />
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Portfolio health metrics</Text>
          </View>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: `${healthColor}25` }]}>
          {healthLevel === 'excellent' && <CheckCircle size={14} color={healthColor} />}
          {healthLevel === 'good' && <TrendingUp size={14} color={healthColor} />}
          {healthLevel === 'fair' && <AlertTriangle size={14} color={healthColor} />}
          {healthLevel === 'poor' && <XCircle size={14} color={healthColor} />}
          <Text style={[styles.riskLabel, { color: healthColor }]}>
            {healthLevel.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.content}>

        <View style={styles.metricsRow}>
          {financialMetrics.map((metric, index) => (
            <View key={index} style={styles.metricCard}>
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
            <View
              style={[
                styles.gaugeNeedle,
                { transform: [{ rotate: `${gaugeAngle}deg` }] },
              ]}
            />
            <View style={styles.gaugeCenter}>
              <Text style={[styles.scoreValue, { color: healthColor }]}>
                {healthScore}
              </Text>
              <Text style={styles.scoreLabel}>Health</Text>
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
            <Text style={styles.sectionTitle}>Key Factors</Text>
          </View>
          <View style={styles.factorsList}>
            {sortedFactors.slice(0, 4).map((factor, index) => {
              const ImpactIcon = getImpactIcon(factor.impact);
              const impactColor = getImpactColor(factor.impact);
              
              return (
                <View key={index} style={styles.factorItem}>
                  <View style={styles.factorHeader}>
                    <View style={[styles.impactIcon, { backgroundColor: `${impactColor}20` }]}>
                      <ImpactIcon size={12} color={impactColor} />
                    </View>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <View style={styles.factorWeight}>
                      <Text style={[styles.weightText, { color: impactColor }]}>
                        {factor.impact === 'negative' ? '-' : factor.impact === 'positive' ? '+' : ''}
                        {factor.weight}%
                      </Text>
                    </View>
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
            <Text style={styles.summaryText}>
              {totalCruises} cruises booked • {formatNumber(pointsEarned)} points earned
            </Text>
          </View>
          {totalSavings > 0 && (
            <View style={styles.summaryRow}>
              <CheckCircle size={14} color={COLORS.success} />
              <Text style={styles.summaryText}>
                You are saving {formatCurrency(totalSavings)} compared to retail prices
              </Text>
            </View>
          )}
          {casinoNetResult !== 0 && (
            <View style={styles.summaryRow}>
              <Coins size={14} color={casinoNetResult >= 0 ? COLORS.success : COLORS.warning} />
              <Text style={styles.summaryText}>
                Casino {casinoNetResult >= 0 ? 'winnings' : 'losses'}: {formatCurrency(Math.abs(casinoNetResult))}
              </Text>
            </View>
          )}
        </View>

        {riskAnalysis.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <View style={styles.sectionHeader}>
              <Lightbulb size={14} color={COLORS.beigeWarm} />
              <Text style={styles.sectionTitle}>Recommendations</Text>
            </View>
            <View style={styles.recommendationsList}>
              {riskAnalysis.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <View style={styles.recommendationBullet} />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.volatilityRow}>
          <Text style={styles.volatilityLabel}>Volatility Index:</Text>
          <View style={styles.volatilityBar}>
            <View
              style={[
                styles.volatilityFill,
                { 
                  width: `${Math.min(100, riskAnalysis.volatility * 100)}%`,
                  backgroundColor: riskAnalysis.volatility > 0.5 ? COLORS.warning : COLORS.aquaAccent,
                },
              ]}
            />
          </View>
          <Text style={styles.volatilityValue}>
            {(riskAnalysis.volatility * 100).toFixed(0)}%
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
    borderColor: COLORS.success,
    ...SHADOW.md,
  },
  header: {
    backgroundColor: '#F0FDF4',
    padding: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.success,
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
    color: '#166534',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#166534',
    opacity: 0.8,
  },
  content: {
    padding: SPACING.md,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  riskLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 0.5,
  },
  gaugeSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gaugeContainer: {
    width: 140,
    height: 80,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  gaugeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: 'row',
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    overflow: 'hidden',
  },
  gaugeSegment: {
    flex: 1,
    height: '100%',
  },
  segmentPoor: {
    backgroundColor: COLORS.error,
    opacity: 0.3,
  },
  segmentFair: {
    backgroundColor: COLORS.warning,
    opacity: 0.3,
  },
  segmentGood: {
    backgroundColor: COLORS.aquaAccent,
    opacity: 0.3,
  },
  segmentExcellent: {
    backgroundColor: COLORS.success,
    opacity: 0.3,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  gaugeNeedle: {
    position: 'absolute',
    bottom: 10,
    width: 4,
    height: 50,
    backgroundColor: '#333333',
    borderRadius: 2,
    transformOrigin: 'bottom center',
  },
  gaugeCenter: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  scoreLabel: {
    fontSize: 10,
    color: CLEAN_THEME.text.secondary,
  },
  gaugeLegend: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
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
  factorsSection: {
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#000000',
  },
  factorsList: {
    gap: SPACING.sm,
  },
  factorItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  impactIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factorName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: '#000000',
  },
  factorWeight: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  weightText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  factorDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginLeft: 28,
  },
  summarySection: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    flex: 1,
  },
  recommendationsSection: {
    marginBottom: SPACING.md,
  },
  recommendationsList: {
    gap: SPACING.xs,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recommendationBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.beigeWarm,
    marginTop: 5,
  },
  recommendationText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
    lineHeight: 16,
  },
  volatilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  volatilityLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#000000',
  },
  volatilityBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  volatilityFill: {
    height: '100%',
    borderRadius: 3,
  },
  volatilityValue: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#000000',
    width: 35,
    textAlign: 'right',
  },
});
