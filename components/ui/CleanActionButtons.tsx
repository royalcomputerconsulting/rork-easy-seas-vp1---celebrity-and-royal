import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

interface ActionButton {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  active?: boolean;
  onPress: () => void;
}

interface CleanActionButtonsProps {
  actions: ActionButton[];
}

export function CleanActionButtons({ actions }: CleanActionButtonsProps) {
  const scaleValues = useRef(actions.map(() => new Animated.Value(1))).current;

  const handlePressIn = useCallback((index: number) => {
    Animated.spring(scaleValues[index], {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scaleValues]);

  const handlePressOut = useCallback((index: number) => {
    Animated.spring(scaleValues[index], {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [scaleValues]);

  return (
    <View style={styles.container}>
      {actions.map((action, index) => {
        const Icon = action.icon;
        const isActive = action.active;
        return (
          <Animated.View
            key={action.key}
            style={{ transform: [{ scale: scaleValues[index] || new Animated.Value(1) }] }}
          >
            <TouchableOpacity
              style={styles.button}
              onPress={action.onPress}
              onPressIn={() => handlePressIn(index)}
              onPressOut={() => handlePressOut(index)}
              activeOpacity={1}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Icon 
                  size={20} 
                  color={isActive ? COLORS.textNavy : COLORS.textDarkGrey} 
                />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {action.badge > 99 ? '99+' : action.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.lg,
  },
  button: {
    alignItems: 'center',
    minWidth: 56,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative',
  },
  iconContainerActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.textNavy,
    ...SHADOW.tab,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    textAlign: 'center',
  },
  labelActive: {
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
});
