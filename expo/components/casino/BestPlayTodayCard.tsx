import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Coins, Dice5, Ship, Target, Timer, WalletCards } from 'lucide-react-native';
import { BORDER_RADIUS, COLORS, GRADIENTS, SHADOW, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { BestPlayTodayAction, BestPlayTodayPlan } from '@/lib/casino/bestPlayToday';

type BestPlayTodayCardProps = {
  plan: BestPlayTodayPlan;
};

function formatCurrency(value: number): string {
  return `$${Math.round(value || 0).toLocaleString()}`;
}

function actionLabel(action: BestPlayTodayAction): string {
  switch (action) {
    case 'play':
      return 'Play';
    case 'light-play':
      return 'Light play';
    case 'freeplay-only':
      return 'Freeplay only';
    case 'avoid':
      return 'Avoid';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

function getActionColor(action: BestPlayTodayAction): string {
  switch (action) {
    case 'play':
      return COLORS.success;
    case 'light-play':
      return COLORS.info;
    case 'freeplay-only':
      return COLORS.goldDark;
    case 'avoid':
      return COLORS.error;
    case 'unknown':
    default:
      return COLORS.textSecondary;
  }
}

export function BestPlayTodayCard({ plan }: BestPlayTodayCardProps) {
  const safePlan: BestPlayTodayPlan = plan ?? {
    date: '',
    cruiseDay: null,
    dayType: 'unknown',
    casinoAvailability: 'unknown',
    recommendedAction: 'unknown',
    targetPoints: 0,
    estimatedCoinIn: 0,
    suggestedBankrollCap: 200,
    suggestedBetRange: '$2.50–$5.00',
    suggestedSessionLengthMinutes: 0,
    reason: 'Best Play Today activates during an active sailing.',
    warnings: ['No Best Play Today plan provided.'],
  };
  const actionColor = getActionColor(safePlan.recommendedAction);

  return (
    <LinearGradient
      colors={GRADIENTS.card as unknown as [string, string, ...string[]]}
      style={styles.container}
      testID="best-play-today-card"
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Dice5 size={19} color={COLORS.primary} />
          <View>
            <Text style={styles.title}>Best Play Today</Text>
            <Text style={styles.subtitle}>{safePlan.date || 'No date available'}</Text>
          </View>
        </View>
        <View style={[styles.actionPill, { backgroundColor: `${actionColor}20`, borderColor: `${actionColor}55` }]}>
          <Text style={[styles.actionText, { color: actionColor }]}>{actionLabel(safePlan.recommendedAction)}</Text>
        </View>
      </View>

      <View style={styles.cruiseLine}>
        <Ship size={14} color={COLORS.textSecondary} />
        <Text style={styles.cruiseText} numberOfLines={1}>
          {safePlan.shipName || safePlan.cruiseName || 'No active cruise'}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Target size={15} color={COLORS.pointsDark} />
          <Text style={styles.metricValue}>{safePlan.targetPoints}</Text>
          <Text style={styles.metricLabel}>Target pts</Text>
        </View>
        <View style={styles.metricCard}>
          <Coins size={15} color={COLORS.moneyDark} />
          <Text style={styles.metricValue}>{formatCurrency(safePlan.estimatedCoinIn)}</Text>
          <Text style={styles.metricLabel}>Est. coin-in</Text>
        </View>
        <View style={styles.metricCard}>
          <WalletCards size={15} color={COLORS.goldDark} />
          <Text style={styles.metricValue}>{formatCurrency(safePlan.suggestedBankrollCap)}</Text>
          <Text style={styles.metricLabel}>Bankroll cap</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Timer size={14} color={COLORS.textSecondary} />
        <Text style={styles.detailText}>
          Day {safePlan.cruiseDay ?? '—'} • {safePlan.dayType.replace('-', ' ')} • {safePlan.suggestedSessionLengthMinutes} min • {safePlan.suggestedBetRange}
        </Text>
      </View>

      <Text style={styles.reason}>{safePlan.reason}</Text>

      {safePlan.recommendedMachines && safePlan.recommendedMachines.length > 0 && (
        <Text style={styles.machineText}>Machines: {safePlan.recommendedMachines.join(', ')}</Text>
      )}

      {safePlan.warnings.length > 0 && (
        <View style={styles.warningRow}>
          <AlertTriangle size={14} color={COLORS.warning} />
          <Text style={styles.warningText}>{safePlan.warnings[0]}</Text>
        </View>
      )}
    </LinearGradient>
  );
}

export default BestPlayTodayCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  actionPill: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  actionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  cruiseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cruiseText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.sm,
    gap: 3,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.primary,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  reason: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  machineText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    padding: SPACING.sm,
  },
  warningText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.warning,
    lineHeight: 17,
  },
});
