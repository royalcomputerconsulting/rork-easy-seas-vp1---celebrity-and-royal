import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Coins, Dices, DollarSign, Target, TrendingUp } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, SHADOW, SPACING } from '@/constants/theme';
import { formatCurrency, formatNumber } from '@/lib/format';

interface CasinoOverviewCardProps {
  tier: string;
  currentPoints: number;
  totalCoinIn: number;
  netResult: number;
  totalRetailValue: number;
  totalTaxesFees: number;
  totalProfit: number;
  avgCoinInPerCruise: number;
  avgWinLossPerCruise: number;
  completedCount: number;
  testID?: string;
}

export function CasinoOverviewCard({
  tier,
  currentPoints,
  totalCoinIn,
  netResult,
  totalRetailValue,
  totalTaxesFees,
  totalProfit,
  avgCoinInPerCruise,
  avgWinLossPerCruise,
  completedCount,
  testID,
}: CasinoOverviewCardProps) {
  return (
    <View style={styles.casinoSection} testID={testID}>
      <LinearGradient
        colors={['#E0F2FE', '#DBEAFE', '#E0F7FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.casinoGradient}
      >
        <View style={styles.casinoHeader}>
          <View style={styles.casinoIconBadge}>
            <Dices size={20} color={COLORS.white} />
          </View>
          <Text style={styles.casinoTitle}>Casino</Text>
          <View style={styles.casinoTierBadge}>
            <Text style={styles.casinoTierText}>{tier}</Text>
          </View>
        </View>

        <View style={styles.casinoMetricsGrid}>
          <View style={styles.casinoMetricCard}>
            <View style={[styles.casinoMetricIcon, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
              <Coins size={16} color={COLORS.goldDark} />
            </View>
            <Text style={styles.casinoMetricValue}>{formatCurrency(totalCoinIn)}</Text>
            <Text style={styles.casinoMetricLabel}>Total Coin-In</Text>
          </View>

          <View style={styles.casinoMetricCard}>
            <View style={[styles.casinoMetricIcon, { backgroundColor: netResult >= 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }]}>
              <Target size={16} color={netResult >= 0 ? COLORS.success : COLORS.error} />
            </View>
            <Text style={[styles.casinoMetricValue, { color: netResult >= 0 ? COLORS.success : COLORS.error }]}>
              {netResult >= 0 ? '+' : ''}{formatCurrency(netResult)}
            </Text>
            <Text style={styles.casinoMetricLabel}>Net Win/Loss</Text>
          </View>

          <View style={styles.casinoMetricCard}>
            <View style={[styles.casinoMetricIcon, { backgroundColor: 'rgba(103, 58, 183, 0.15)' }]}>
              <Award size={16} color={COLORS.royalPurple} />
            </View>
            <Text style={styles.casinoMetricValue}>{formatNumber(currentPoints)}</Text>
            <Text style={styles.casinoMetricLabel}>Current Points</Text>
          </View>
        </View>

        <View style={styles.casinoFinancialsRow}>
          <View style={styles.casinoFinancialItem}>
            <TrendingUp size={14} color={COLORS.success} />
            <View style={styles.casinoFinancialText}>
              <Text style={styles.casinoFinancialLabel}>Retail Value</Text>
              <Text style={[styles.casinoFinancialValue, { color: COLORS.success }]}>
                {formatCurrency(totalRetailValue)}
              </Text>
            </View>
          </View>
          <View style={styles.casinoFinancialDivider} />
          <View style={styles.casinoFinancialItem}>
            <DollarSign size={14} color={COLORS.navyDeep} />
            <View style={styles.casinoFinancialText}>
              <Text style={styles.casinoFinancialLabel}>Taxes Paid</Text>
              <Text style={styles.casinoFinancialValue}>{formatCurrency(totalTaxesFees)}</Text>
            </View>
          </View>
          <View style={styles.casinoFinancialDivider} />
          <View style={styles.casinoFinancialItem}>
            <TrendingUp size={14} color={totalProfit >= 0 ? COLORS.success : COLORS.error} />
            <View style={styles.casinoFinancialText}>
              <Text style={styles.casinoFinancialLabel}>Net Profit</Text>
              <Text style={[styles.casinoFinancialValue, { color: totalProfit >= 0 ? COLORS.success : COLORS.error }]}>
                {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
              </Text>
            </View>
          </View>
        </View>

        {completedCount > 0 ? (
          <View style={styles.casinoAvgRow}>
            <View style={styles.casinoAvgItem}>
              <Text style={styles.casinoAvgLabel}>Avg Coin-In/Cruise</Text>
              <Text style={styles.casinoAvgValue}>{formatCurrency(avgCoinInPerCruise)}</Text>
            </View>
            <View style={styles.casinoAvgDivider} />
            <View style={styles.casinoAvgItem}>
              <Text style={styles.casinoAvgLabel}>Avg Win/Loss</Text>
              <Text style={[styles.casinoAvgValue, { color: avgWinLossPerCruise >= 0 ? COLORS.success : COLORS.error }]}>
                {avgWinLossPerCruise >= 0 ? '+' : ''}{formatCurrency(avgWinLossPerCruise)}
              </Text>
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  casinoSection: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  casinoGradient: {
    padding: SPACING.md,
  },
  casinoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    flex: 1,
  },
  casinoTierBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  casinoTierText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  casinoMetricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  casinoMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  casinoMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  casinoMetricValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    textAlign: 'center' as const,
  },
  casinoMetricLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  casinoFinancialsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  casinoFinancialItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  casinoFinancialText: {
    flex: 1,
  },
  casinoFinancialLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  casinoFinancialValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  casinoFinancialDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.xs,
  },
  casinoAvgRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  casinoAvgItem: {
    flex: 1,
    alignItems: 'center',
  },
  casinoAvgLabel: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.7,
    marginBottom: 2,
  },
  casinoAvgValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
  },
  casinoAvgDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.sm,
  },
});
