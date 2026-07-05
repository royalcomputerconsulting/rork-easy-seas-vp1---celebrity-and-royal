import React, { type ReactNode } from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { EasySeasColors, EasySeasRadius, EasySeasSpacing, EasySeasTypography, withAlpha } from '@/constants/easySeasTheme';

export type EasySeasButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium' | 'casino';

interface EasySeasButtonProps {
  label: string;
  onPress: () => void;
  variant?: EasySeasButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const VARIANT_STYLES: Record<EasySeasButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: EasySeasColors.navy, text: '#FFFFFF' },
  secondary: { bg: '#FFFFFF', text: EasySeasColors.navy, border: EasySeasColors.border },
  ghost: { bg: 'transparent', text: EasySeasColors.navy },
  danger: { bg: EasySeasColors.danger, text: '#FFFFFF' },
  premium: { bg: EasySeasColors.gold, text: EasySeasColors.navyDeep },
  casino: { bg: EasySeasColors.purple, text: '#FFFFFF' },
};

/** One shared button style used across the app instead of ad hoc button views. */
export const EasySeasButton = React.memo(function EasySeasButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
  testID,
}: EasySeasButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.base,
        {
          backgroundColor: variantStyle.bg,
          borderWidth: variantStyle.border ? 1 : 0,
          borderColor: variantStyle.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: variantStyle.text }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: EasySeasSpacing.sm,
    minHeight: 44,
    paddingHorizontal: EasySeasSpacing.lg,
    borderRadius: EasySeasRadius.md,
  },
  label: {
    ...EasySeasTypography.body,
    fontSize: 15,
    fontWeight: '700',
  },
});
