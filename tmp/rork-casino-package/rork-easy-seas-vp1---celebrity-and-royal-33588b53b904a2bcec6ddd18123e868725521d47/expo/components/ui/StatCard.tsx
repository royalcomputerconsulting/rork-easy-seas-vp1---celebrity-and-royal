import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import type { LucideIcon } from 'lucide-react-native';

type StatType = 'default' | 'money' | 'points' | 'loyalty';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  onPress?: () => void;
  compact?: boolean;
  highlight?: boolean;
  statType?: StatType;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  trendValue,
  onPress,
  compact = false,
  highlight = false,
  statType = 'default',
}: StatCardProps) {
  const getStatColor = () => {
    switch (statType) {
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

  const getStatBgColor = () => {
    switch (statType) {
      case 'money':
        return COLORS.moneyBg;
      case 'points':
        return COLORS.pointsBg;
      case 'loyalty':
        return COLORS.loyaltyBg;
      default:
        return COLORS.bgSecondary;
    }
  };

  const actualIconColor = iconColor || getStatColor();
  const valueColor = getStatColor();
  const marbleConfig = MARBLE_TEXTURES.white;

  const content = (
    <LinearGradient
      colors={marbleConfig.gradientColors as unknown as [string, string, ...string[]]}
      locations={marbleConfig.gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, compact && styles.containerCompact, highlight && styles.containerHighlight]}
    >
      {highlight && (
        <LinearGradient
          colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
        />
      )}
      
      <View style={styles.header}>
        {Icon && (
          <View style={[styles.iconContainer, { backgroundColor: getStatBgColor() }]}>
            <Icon size={compact ? 16 : 20} color={actualIconColor} />
          </View>
        )}
        {trend && (
          <View style={[
            styles.trendBadge,
            trend === 'up' && styles.trendUp,
            trend === 'down' && styles.trendDown,
          ]}>
            <Text style={[
              styles.trendText,
              trend === 'up' && styles.trendTextUp,
              trend === 'down' && styles.trendTextDown,
            ]}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={[styles.value, compact && styles.valueCompact, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      
      <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
        {title}
      </Text>
      
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  containerCompact: {
    padding: SPACING.sm,
  },
  containerHighlight: {
    borderColor: COLORS.gold,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.bgSecondary,
  },
  trendUp: {
    backgroundColor: COLORS.moneyBg,
  },
  trendDown: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  trendText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  trendTextUp: {
    color: COLORS.money,
  },
  trendTextDown: {
    color: COLORS.error,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSizeTitle,
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    marginBottom: 2,
  },
  valueCompact: {
    fontSize: TYPOGRAPHY.fontSizeXL,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSizeXS,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
