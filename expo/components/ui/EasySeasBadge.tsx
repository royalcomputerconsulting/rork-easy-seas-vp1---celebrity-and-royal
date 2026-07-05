import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';

import { EasySeasColors, EasySeasRadius, EasySeasSpacing, EasySeasTypography, withAlpha } from '@/constants/easySeasTheme';

export type EasySeasBadgeType = 'success' | 'warning' | 'danger' | 'info' | 'premium' | 'casino' | 'neutral';

interface EasySeasBadgeProps {
  label: string;
  type?: EasySeasBadgeType;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

const TYPE_COLORS: Record<EasySeasBadgeType, string> = {
  success: EasySeasColors.success,
  warning: EasySeasColors.warning,
  danger: EasySeasColors.danger,
  info: EasySeasColors.teal,
  premium: EasySeasColors.gold,
  casino: EasySeasColors.purple,
  neutral: EasySeasColors.textSecondary,
};

/**
 * One shared status pill used everywhere (Offers, Cruises, Casino, Slots,
 * Calendar, Data Health, Imports, Settings) instead of ad hoc colored views.
 */
export const EasySeasBadge = React.memo(function EasySeasBadge({
  label,
  type = 'neutral',
  size = 'medium',
  style,
}: EasySeasBadgeProps) {
  const color = TYPE_COLORS[type];
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(color, 0.12),
          borderColor: withAlpha(color, 0.3),
          paddingHorizontal: isSmall ? EasySeasSpacing.sm : EasySeasSpacing.md,
          paddingVertical: isSmall ? 3 : 5,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          isSmall ? EasySeasTypography.micro : EasySeasTypography.small,
          { color, fontWeight: '700' as const },
        ]}
      >
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: EasySeasRadius.pill,
    borderWidth: 1,
  },
});
