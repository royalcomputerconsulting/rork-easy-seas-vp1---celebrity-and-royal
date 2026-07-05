import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import {
  EasySeasColors,
  EasySeasRadius,
  EasySeasShadows,
  EasySeasSpacing,
  EasySeasTypography,
  withAlpha,
} from '@/constants/easySeasTheme';

/**
 * Summary card — hero metrics / top-of-screen summaries.
 * e.g. Best Offer Right Now, Next Cruise, Current Casino Tier.
 */
export function SummaryCard({
  title,
  value,
  subtitle,
  badge,
  onPress,
  accentColor = EasySeasColors.navy,
  style,
  children,
}: {
  title: string;
  value?: string;
  subtitle?: string;
  badge?: ReactNode;
  onPress?: () => void;
  accentColor?: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.summaryCard, { borderColor: withAlpha(accentColor, 0.18) }, style]}
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
    >
      <View style={styles.summaryHeaderRow}>
        <Text style={styles.summaryTitle}>{title}</Text>
        {badge}
      </View>
      {value ? <Text style={[styles.summaryValue, { color: accentColor }]}>{value}</Text> : null}
      {subtitle ? <Text style={styles.summarySubtitle}>{subtitle}</Text> : null}
      {children}
    </Wrapper>
  );
}

/**
 * Data card — metrics/secondary stats. e.g. Points, FreePlay value, sea days.
 */
export function DataCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accentColor = EasySeasColors.navy,
  style,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  accentColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.dataCard, style]}>
      <View style={styles.dataCardHeader}>
        {Icon ? (
          <View style={[styles.dataCardIcon, { backgroundColor: withAlpha(accentColor, 0.12) }]}>
            <Icon size={16} color={accentColor} />
          </View>
        ) : null}
        <Text style={styles.dataCardLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.dataCardValue, { color: accentColor }]} numberOfLines={1}>{value}</Text>
      {subtitle ? <Text style={styles.dataCardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Action card — tasks / next actions. e.g. Import offers, Sync, Build booklet.
 */
export function ActionCard({
  title,
  description,
  icon: Icon,
  accentColor = EasySeasColors.teal,
  onPress,
  style,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  accentColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: withAlpha(accentColor, 0.08), borderColor: withAlpha(accentColor, 0.2) }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      {Icon ? (
        <View style={[styles.actionCardIcon, { backgroundColor: withAlpha(accentColor, 0.15) }]}>
          <Icon size={20} color={accentColor} />
        </View>
      ) : null}
      <View style={styles.actionCardText}>
        <Text style={styles.actionCardTitle}>{title}</Text>
        {description ? <Text style={styles.actionCardDescription} numberOfLines={2}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Detail card — grouped rows inside detail screens. e.g. offer rules, financials.
 */
export function DetailCard({
  title,
  children,
  style,
}: {
  title?: string;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.detailCard, style]}>
      {title ? <Text style={styles.detailCardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={[styles.detailRowValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: EasySeasColors.card,
    borderRadius: EasySeasRadius.card,
    borderWidth: 1,
    padding: EasySeasSpacing.lg,
    ...EasySeasShadows.card,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: EasySeasSpacing.xs,
  },
  summaryTitle: {
    ...EasySeasTypography.small,
    color: EasySeasColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  summaryValue: {
    ...EasySeasTypography.heroNumber,
    marginTop: 2,
  },
  summarySubtitle: {
    ...EasySeasTypography.bodySmall,
    color: EasySeasColors.textSecondary,
    marginTop: 2,
  },
  dataCard: {
    flex: 1,
    backgroundColor: EasySeasColors.card,
    borderRadius: EasySeasRadius.md,
    borderWidth: 1,
    borderColor: EasySeasColors.border,
    padding: EasySeasSpacing.md,
    ...EasySeasShadows.soft,
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EasySeasSpacing.sm,
    marginBottom: EasySeasSpacing.xs,
  },
  dataCardIcon: {
    width: 28,
    height: 28,
    borderRadius: EasySeasRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataCardLabel: {
    ...EasySeasTypography.small,
    color: EasySeasColors.textSecondary,
    flex: 1,
  },
  dataCardValue: {
    ...EasySeasTypography.cardTitle,
  },
  dataCardSubtitle: {
    ...EasySeasTypography.micro,
    color: EasySeasColors.textMuted,
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EasySeasSpacing.md,
    borderRadius: EasySeasRadius.lg,
    borderWidth: 1,
    padding: EasySeasSpacing.md,
  },
  actionCardIcon: {
    width: 44,
    height: 44,
    borderRadius: EasySeasRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    ...EasySeasTypography.cardTitle,
    fontSize: 15,
    color: EasySeasColors.textPrimary,
  },
  actionCardDescription: {
    ...EasySeasTypography.small,
    color: EasySeasColors.textSecondary,
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: EasySeasColors.card,
    borderRadius: EasySeasRadius.lg,
    borderWidth: 1,
    borderColor: EasySeasColors.border,
    padding: EasySeasSpacing.lg,
    ...EasySeasShadows.soft,
  },
  detailCardTitle: {
    ...EasySeasTypography.cardTitle,
    color: EasySeasColors.textPrimary,
    marginBottom: EasySeasSpacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: EasySeasSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EasySeasColors.border,
  },
  detailRowLabel: {
    ...EasySeasTypography.bodySmall,
    color: EasySeasColors.textSecondary,
  },
  detailRowValue: {
    ...EasySeasTypography.bodySmall,
    fontWeight: '700',
    color: EasySeasColors.textPrimary,
  },
});
