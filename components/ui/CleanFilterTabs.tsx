import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS, CLEAN_THEME, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

interface Tab {
  key: string;
  label: string;
}

interface CleanFilterTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (key: string) => void;
}

export function CleanFilterTabs({ tabs, activeTab, onTabPress }: CleanFilterTabsProps) {
  const scaleValues = useRef(tabs.map(() => new Animated.Value(1))).current;

  const handlePressIn = useCallback((index: number) => {
    Animated.spring(scaleValues[index], {
      toValue: 0.96,
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
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.key;
        return (
          <Animated.View
            key={tab.key}
            style={{ transform: [{ scale: scaleValues[index] || new Animated.Value(1) }] }}
          >
            <TouchableOpacity
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => onTabPress(tab.key)}
              onPressIn={() => handlePressIn(index)}
              onPressOut={() => handlePressOut(index)}
              activeOpacity={1}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
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
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    gap: SPACING.xs,
  },
  tab: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
  },
  activeTab: {
    backgroundColor: COLORS.white,
    ...SHADOW.tab,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.tab.unselectedText,
  },
  activeTabText: {
    color: CLEAN_THEME.tab.selectedText,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
});
