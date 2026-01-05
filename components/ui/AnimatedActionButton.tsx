import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

interface AnimatedActionButtonProps {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  badge?: number;
  fullWidth?: boolean;
  iconPosition?: 'left' | 'top';
}

export function AnimatedActionButton({
  label,
  icon: Icon,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  badge,
  fullWidth = false,
  iconPosition = 'left',
}: AnimatedActionButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const sizeConfig = {
    small: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs + 2,
      iconSize: 14,
      fontSize: TYPOGRAPHY.fontSizeXS,
      gap: 4,
      minHeight: 32,
    },
    medium: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      iconSize: 16,
      fontSize: TYPOGRAPHY.fontSizeSM,
      gap: 6,
      minHeight: 40,
    },
    large: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      iconSize: 20,
      fontSize: TYPOGRAPHY.fontSizeMD,
      gap: 8,
      minHeight: 48,
    },
  };

  const variantConfig = {
    primary: {
      gradient: [COLORS.beigeWarm, COLORS.goldDark] as [string, string],
      textColor: COLORS.navyDeep,
      borderColor: 'transparent',
      backgroundColor: COLORS.beigeWarm,
    },
    secondary: {
      gradient: null,
      textColor: COLORS.textPrimary,
      borderColor: 'rgba(212, 165, 116, 0.3)',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    danger: {
      gradient: ['#EF4444', '#DC2626'] as [string, string],
      textColor: COLORS.white,
      borderColor: 'transparent',
      backgroundColor: COLORS.error,
    },
    ghost: {
      gradient: null,
      textColor: COLORS.beigeWarm,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    outline: {
      gradient: null,
      textColor: COLORS.beigeWarm,
      borderColor: COLORS.beigeWarm,
      backgroundColor: 'transparent',
    },
  };

  const currentSize = sizeConfig[size];
  const currentVariant = variantConfig[variant];
  const isVertical = iconPosition === 'top';

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={currentVariant.textColor} 
        />
      ) : (
        <>
          {Icon && (
            <View style={styles.iconContainer}>
              <Icon 
                size={currentSize.iconSize} 
                color={disabled ? COLORS.textSecondary : currentVariant.textColor} 
              />
            </View>
          )}
          <Text
            style={[
              styles.label,
              {
                fontSize: currentSize.fontSize,
                color: disabled ? COLORS.textSecondary : currentVariant.textColor,
              },
            ]}
            numberOfLines={1}
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
          minHeight: currentSize.minHeight,
          flexDirection: isVertical ? 'column' : 'row',
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {renderContent()}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentVariant.backgroundColor,
          borderColor: currentVariant.borderColor,
          borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          gap: currentSize.gap,
          minHeight: currentSize.minHeight,
          flexDirection: isVertical ? 'column' : 'row',
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {renderContent()}
    </View>
  );

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        fullWidth && styles.touchableFullWidth,
        disabled && { opacity: 0.5 },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        style={[
          styles.touchable,
          fullWidth && styles.touchableFullWidth,
        ]}
      >
        {buttonContent}
      </TouchableOpacity>
    </Animated.View>
  );
}

interface AnimatedActionButtonGroupProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  gap?: number;
}

export function AnimatedActionButtonGroup({ 
  children, 
  columns = 4,
  gap = SPACING.sm,
}: AnimatedActionButtonGroupProps) {
  return (
    <View style={[styles.group, { gap }]}>
      {React.Children.map(children, (child, index) => (
        <View 
          style={{ 
            width: `${(100 / columns) - 2}%`,
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
  touchable: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  touchableFullWidth: {
    width: '100%',
  },
  fullWidth: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'absolute',
    top: -4,
    right: -4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  group: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
