import React from 'react';
import { Text, View, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { withAlpha } from '@/constants/loyaltyColors';
import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface LoyaltyPillProps {
  label: string;
  color?: string | null;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const SIZE_STYLES = {
  small: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    borderRadius: BORDER_RADIUS.round,
  },
  medium: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSizeSM,
    borderRadius: BORDER_RADIUS.round,
  },
  large: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    borderRadius: BORDER_RADIUS.round,
  },
} as const;

export const LoyaltyPill = React.memo(function LoyaltyPill({
  label,
  color,
  size = 'medium',
  style,
  textStyle,
  testID,
}: LoyaltyPillProps) {
  const accentColor = color ?? COLORS.navyDeep;
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          borderColor: withAlpha(accentColor, 0.22),
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          borderRadius: sizeStyle.borderRadius,
          shadowColor: accentColor,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          {
            color: accentColor,
            fontSize: sizeStyle.fontSize,
          },
          textStyle,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    maxWidth: '100%',
  },
  text: {
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
});
