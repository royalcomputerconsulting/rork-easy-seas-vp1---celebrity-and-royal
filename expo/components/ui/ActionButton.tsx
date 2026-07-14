import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

interface ActionButtonProps {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  badge?: number;
  fullWidth?: boolean;
}

export function ActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  badge,
  fullWidth = false,
}: ActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scaleAnim]);
  const sizeStyles = {
    small: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      iconSize: 14,
      fontSize: TYPOGRAPHY.fontSizeXS,
      gap: 4,
    },
    medium: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      iconSize: 16,
      fontSize: TYPOGRAPHY.fontSizeSM,
      gap: 6,
    },
    large: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      iconSize: 20,
      fontSize: TYPOGRAPHY.fontSizeMD,
      gap: 8,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: COLORS.beigeWarm,
      textColor: COLORS.navyDeep,
      borderColor: 'transparent',
      gradient: [COLORS.beigeWarm, COLORS.goldDark] as [string, string],
    },
    secondary: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      textColor: COLORS.textPrimary,
      borderColor: COLORS.cardBorder,
      gradient: null,
    },
    danger: {
      backgroundColor: COLORS.error,
      textColor: COLORS.white,
      borderColor: 'transparent',
      gradient: ['#EF4444', '#DC2626'] as [string, string],
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: COLORS.beigeWarm,
      borderColor: 'transparent',
      gradient: null,
    },
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];

  const content = (
    <>
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={currentVariant.textColor} 
        />
      ) : (
        <>
          {Icon && (
            <Icon 
              size={currentSize.iconSize} 
              color={disabled ? COLORS.textSecondary : currentVariant.textColor} 
            />
          )}
          <Text
            style={[
              styles.label,
              {
                fontSize: currentSize.fontSize,
                color: disabled ? COLORS.textSecondary : currentVariant.textColor,
              },
            ]}
          >
            {label}
          </Text>
          {badge !== undefined && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  const buttonContent = currentVariant.gradient ? (
    <LinearGradient
      colors={currentVariant.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.container,
        {
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          gap: currentSize.gap,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {content}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentVariant.backgroundColor,
          borderColor: currentVariant.borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          gap: currentSize.gap,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {content}
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        style={fullWidth ? styles.touchableFullWidth : undefined}
      >
        {buttonContent}
      </TouchableOpacity>
    </Animated.View>
  );
}

interface ActionButtonGroupProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function ActionButtonGroup({ children, columns = 3 }: ActionButtonGroupProps) {
  return (
    <View style={[styles.group, { flexWrap: 'wrap' }]}>
      {React.Children.map(children, (child, index) => (
        <View 
          style={{ 
            width: `${100 / columns}%`,
            paddingHorizontal: SPACING.xs / 2,
            paddingVertical: SPACING.xs / 2,
          }}
          key={index}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    ...SHADOW.sm,
  },
  touchableFullWidth: {
    width: '100%',
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: '700' as const,
  },
  group: {
    flexDirection: 'row',
    marginHorizontal: -SPACING.xs / 2,
  },
});
