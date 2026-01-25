import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Search, X, Bell } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, COLORS, SHADOW } from '@/constants/theme';

interface Tab {
  key: string;
  label: string;
}

interface ActionButton {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  active?: boolean;
  onPress: () => void;
}

interface MinimalistFilterBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (key: string) => void;
  actions?: ActionButton[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  showingCount?: number;
  totalCount?: number;
  bookedCount?: number;
}

export function MinimalistFilterBar({
  tabs,
  activeTab,
  onTabPress,
  actions = [],
  searchPlaceholder = 'Search cruises...',
  searchValue = '',
  onSearchChange,
  onSearch,
  showingCount,
  totalCount,
  bookedCount,
}: MinimalistFilterBarProps) {
  const [inputValue, setInputValue] = useState(searchValue || '');
  const alertAction = actions.find(a => a.key === 'alerts');

  const handleTextChange = (text: string) => {
    setInputValue(text);
    if (onSearch) {
      onSearch(text);
    } else if (onSearchChange) {
      onSearchChange(text);
    }
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(inputValue);
    } else if (onSearchChange) {
      onSearchChange(inputValue);
    }
  };

  const handleClear = () => {
    handleTextChange('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer} pointerEvents="auto">
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={COLORS.textMuted}
          value={inputValue}
          onChangeText={handleTextChange}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          editable={true}
          selectTextOnFocus={true}
          blurOnSubmit={false}
          clearButtonMode="never"
          underlineColorAndroid="transparent"
        />
        {inputValue.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.clearButton}>
            <X size={16} color={COLORS.textDarkGrey} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton} activeOpacity={0.7}>
          <Search size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => onTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actionsContainer}>
          {alertAction && (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={alertAction.onPress}
              activeOpacity={0.7}
            >
              <Bell size={14} color={COLORS.textNavy} />
              <Text style={styles.actionPillText}>Alerts</Text>
              {alertAction.badge !== undefined && alertAction.badge > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>
                    {alertAction.badge > 9 ? '9+' : alertAction.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(showingCount !== undefined || totalCount !== undefined) && (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            <Text style={styles.statsHighlight}>{showingCount}</Text>
            <Text style={styles.statsLabel}> of </Text>
            <Text style={styles.statsHighlight}>{totalCount}</Text>
            {bookedCount !== undefined && bookedCount > 0 && (
              <Text style={styles.statsLabel}> • <Text style={styles.statsBooked}>{bookedCount} booked</Text></Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: Platform.OS === 'ios' ? SPACING.xs : 0,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.xs,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textNavy,
    paddingVertical: SPACING.sm,
    minHeight: 40,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        cursor: 'text',
      } as any,
      android: {
        paddingVertical: 8,
      },
    }),
  },
  clearButton: {
    padding: SPACING.xs,
  },
  searchButton: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 2,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: CLEAN_THEME.tab.unselectedBg,
  },
  activeTab: {
    backgroundColor: COLORS.white,
    ...SHADOW.tab,
  },
  tabText: {
    fontSize: 13,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textDarkGrey,
  },
  activeTabText: {
    color: COLORS.textNavy,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.textNavy,
  },
  alertBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  statsRow: {
    marginTop: SPACING.xs,
  },
  statsText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statsHighlight: {
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textDarkGrey,
  },
  statsLabel: {
    color: COLORS.textMuted,
  },
  statsBooked: {
    color: COLORS.money,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
});
