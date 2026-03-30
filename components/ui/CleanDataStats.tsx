import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOW, GRADIENTS } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

type StatType = 'default' | 'money' | 'points' | 'loyalty';

interface StatItem {
  value: number | string;
  label: string;
  type?: StatType;
}

interface CleanDataStatsProps {
  stats: StatItem[];
}

export function CleanDataStats({ stats }: CleanDataStatsProps) {
  const getValueColor = (type?: StatType) => {
    switch (type) {
      case 'money':
        return COLORS.money;
      case 'points':
        return COLORS.points;
      case 'loyalty':
        return COLORS.loyalty;
      default:
        return COLORS.textNavy;
    }
  };

  return (
    <View style={styles.container}>
      {stats.map((stat, index) => (
        <React.Fragment key={stat.label}>
          <Text style={styles.stat}>
            <Text style={[styles.value, { color: getValueColor(stat.type) }]}>{stat.value}</Text>
            <Text style={styles.label}> {stat.label}</Text>
          </Text>
          {index < stats.length - 1 && (
            <Text style={styles.dot}>•</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

interface CleanDataRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  valueType?: StatType;
}

export function CleanDataRow({ label, value, valueColor, valueType }: CleanDataRowProps) {
  const getTypeColor = () => {
    switch (valueType) {
      case 'money':
        return COLORS.money;
      case 'points':
        return COLORS.points;
      case 'loyalty':
        return COLORS.loyalty;
      default:
        return COLORS.textNavy;
    }
  };

  const finalColor = valueColor || (valueType ? getTypeColor() : COLORS.textNavy);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: finalColor }]}>{value}</Text>
    </View>
  );
}

interface CleanDataCardProps {
  children: React.ReactNode;
  title?: string;
  useGradientBg?: boolean;
}

export function CleanDataCard({ children, title, useGradientBg = false }: CleanDataCardProps) {
  if (useGradientBg) {
    return (
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {title && <Text style={styles.cardTitle}>{title}</Text>}
          {children}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: {
    fontSize: TYPOGRAPHY.fontSizeSM,
  },
  value: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
  },
  label: {
    color: COLORS.textDarkGrey,
  },
  dot: {
    marginHorizontal: SPACING.sm,
    color: COLORS.textMuted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rowLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
  },
  rowValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.card,
  },
  cardWrapper: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  cardGradient: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
});
