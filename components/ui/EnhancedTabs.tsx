import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, CLEAN_THEME, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

interface Tab {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface EnhancedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (key: string) => void;
  variant?: 'pill' | 'underline' | 'segmented';
}

export function EnhancedTabs({
  tabs,
  activeTab,
  onTabPress,
  variant = 'pill',
}: EnhancedTabsProps) {
  const scaleValues = useRef(tabs.map(() => new Animated.Value(1))).current;

  const handlePressIn = useCallback((index: number) => {
    Animated.spring(scaleValues[index], {
      toValue: 0.95,
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

  const handlePress = useCallback((key: string, index: number) => {
    handlePressOut(index);
    onTabPress(key);
  }, [onTabPress, handlePressOut]);

  if (variant === 'underline') {
    return (
      <View style={styles.underlineContainer}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Animated.View
              key={tab.key}
              style={{ transform: [{ scale: scaleValues[index] }], flex: 1 }}
            >
              <TouchableOpacity
                style={[styles.underlineTab, isActive && styles.underlineTabActive]}
                onPress={() => handlePress(tab.key, index)}
                onPressIn={() => handlePressIn(index)}
                onPressOut={() => handlePressOut(index)}
                activeOpacity={1}
              >
                {Icon && (
                  <Icon 
                    size={16} 
                    color={isActive ? COLORS.textNavy : COLORS.textDarkGrey} 
                  />
                )}
                <Text style={[styles.underlineText, isActive && styles.underlineTextActive]}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {isActive && <View style={styles.underlineIndicator} />}
            </Animated.View>
          );
        })}
      </View>
    );
  }

  if (variant === 'segmented') {
    return (
      <View style={styles.segmentedContainer}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Animated.View
              key={tab.key}
              style={{ transform: [{ scale: scaleValues[index] }], flex: 1 }}
            >
              <TouchableOpacity
                style={[styles.segmentedTab, isActive && styles.segmentedTabActive]}
                onPress={() => handlePress(tab.key, index)}
                onPressIn={() => handlePressIn(index)}
                onPressOut={() => handlePressOut(index)}
                activeOpacity={1}
              >
                {Icon && <Icon size={14} color={isActive ? COLORS.textNavy : COLORS.textDarkGrey} />}
                <Text style={[styles.segmentedText, isActive && styles.segmentedTextActive]}>
                  {tab.label}
                </Text>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <View style={[styles.badge, isActive && styles.badgeActive]}>
                    <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.pillContainer}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <Animated.View
            key={tab.key}
            style={{ transform: [{ scale: scaleValues[index] }], flex: 1 }}
          >
            <TouchableOpacity
              style={[styles.pillTab, isActive && styles.pillTabActive]}
              onPress={() => handlePress(tab.key, index)}
              onPressIn={() => handlePressIn(index)}
              onPressOut={() => handlePressOut(index)}
              activeOpacity={1}
            >
              {Icon && <Icon size={14} color={isActive ? COLORS.textNavy : COLORS.textDarkGrey} />}
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: 4,
    marginBottom: SPACING.md,
    gap: 4,
  },
  pillTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
    gap: 4,
  },
  pillTabActive: {
    backgroundColor: COLORS.white,
    ...SHADOW.tab,
  },
  pillText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.tab.unselectedText,
  },
  pillTextActive: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.tab.selectedText,
  },
  underlineContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  underlineTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 6,
  },
  underlineTabActive: {},
  underlineText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textDarkGrey,
  },
  underlineTextActive: {
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  underlineIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: COLORS.textNavy,
    borderRadius: BORDER_RADIUS.round,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 3,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 2,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
    gap: 4,
  },
  segmentedTabActive: {
    backgroundColor: COLORS.white,
    ...SHADOW.tab,
  },
  segmentedText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.tab.unselectedText,
  },
  segmentedTextActive: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.tab.selectedText,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.round,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  badgeActive: {
    backgroundColor: COLORS.points,
  },
});
