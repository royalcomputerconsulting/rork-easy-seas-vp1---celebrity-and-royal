import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Ship, ChevronDown, Check, Search } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, COLORS, SHADOW } from '@/constants/theme';
import { useExperience } from '@/state/ExperienceProvider';

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
  countLabel?: string;
  bookedCount?: number;
  ships?: string[];
  selectedShips?: string[];
  onShipToggle?: (ship: string) => void;
  onClearShips?: () => void;
  showShipFilterControl?: boolean;
}

export const MinimalistFilterBar = React.memo(function MinimalistFilterBar({
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
  countLabel,
  bookedCount,
  ships = [],
  selectedShips = [],
  onShipToggle,
  onClearShips,
  showShipFilterControl = true,
}: MinimalistFilterBarProps) {
  const [showShipFilter, setShowShipFilter] = useState(false);
  const { colors, minimumControlSize, textScale } = useExperience();
  // Every action supplied by the consuming screen is part of its behavior
  // contract. Never hide actions here merely to make the bar look simpler.
  const visibleActions = actions;
  const hasVisibleActions = visibleActions.length > 0;

  const handleShipPress = (ship: string) => {
    if (onShipToggle) {
      onShipToggle(ship);
    }
  };

  return (
    <LinearGradient
      colors={[colors.surfaceRaised, colors.surfaceRaised, colors.surfaceMuted]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: colors.border }]}
    >
      <View style={[styles.searchShell, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Search size={17} color={colors.accentSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}
          value={searchValue}
          onChangeText={onSearchChange}
          onSubmitEditing={() => onSearch?.(searchValue)}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search cruises"
          testID="cruises-search-input"
        />
        {searchValue ? (
          <TouchableOpacity
            style={[styles.searchClearButton, { minWidth: minimumControlSize, minHeight: minimumControlSize, backgroundColor: colors.surfaceMuted }]}
            onPress={() => onSearchChange?.('')}
            accessibilityRole="button"
            accessibilityLabel="Clear cruise search"
            testID="cruises-clear-search"
          >
            <X size={15} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showShipFilterControl ? <TouchableOpacity 
        style={[styles.shipFilterButton, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }]} 
        onPress={() => setShowShipFilter(!showShipFilter)}
        activeOpacity={0.7}
      >
        <Ship size={16} color={colors.accent} />
        <Text style={[styles.shipFilterLabel, { color: colors.text, fontSize: TYPOGRAPHY.fontSizeSM * textScale }]}> 
          {selectedShips.length === 0 
            ? 'All Ships' 
            : selectedShips.length === 1 
            ? selectedShips[0] 
            : `${selectedShips.length} Ships Selected`}
        </Text>
        {selectedShips.length > 0 && (
          <View style={styles.shipCountBadge}>
            <Text style={styles.shipCountText}>{selectedShips.length}</Text>
          </View>
        )}
        <ChevronDown size={16} color={colors.muted} style={showShipFilter ? styles.chevronUp : undefined} />
      </TouchableOpacity> : null}

      {showShipFilterControl && showShipFilter && (
        <View style={[styles.shipFilterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <ScrollView 
            style={styles.shipScrollView}
            contentContainerStyle={styles.shipList}
            showsVerticalScrollIndicator={false}
          >
            {ships.length === 0 ? (
              <Text style={styles.noShipsText}>No ships available</Text>
            ) : (
              ships.map(ship => {
                const isSelected = selectedShips.includes(ship);
                return (
                  <TouchableOpacity
                    key={ship}
                    style={[styles.shipOption, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => handleShipPress(ship)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.shipCheckbox, isSelected && styles.shipCheckboxActive]}>
                      {isSelected && <Check size={12} color={COLORS.white} />}
                    </View>
                    <Text style={[styles.shipOptionText, { color: colors.text }, isSelected && styles.shipOptionTextActive]}>
                      {ship}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          {selectedShips.length > 0 && (
            <TouchableOpacity 
              style={styles.clearShipsButton} 
              onPress={() => {
                if (onClearShips) onClearShips();
              }}
              activeOpacity={0.7}
            >
              <X size={14} color={COLORS.error} />
              <Text style={styles.clearShipsText}>Clear Selection</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.mainRow}>
        <View style={[styles.tabsContainer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, !hasVisibleActions && styles.tabsContainerFull]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, isActive && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => onTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: colors.text, fontSize: 11 * textScale }, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasVisibleActions ? <View style={styles.actionsContainer}>
          {visibleActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <TouchableOpacity
                key={action.key}
                style={[styles.actionPill, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, action.active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={action.onPress}
                activeOpacity={0.7}
                testID={`filter-action-${action.key}`}
              >
                <ActionIcon size={14} color={action.active ? colors.inverseText : colors.text} />
                <Text style={[styles.actionPillText, { color: colors.text }, action.active && styles.actionPillTextActive]}>{action.label}</Text>
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>
                      {action.badge > 9 ? '9+' : action.badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View> : null}
      </View>

      {(showingCount !== undefined || totalCount !== undefined) && (
        <View style={styles.statsRow}>
          <View style={styles.statsTextContainer}>
            <Text style={styles.statsHighlight}>{showingCount}</Text>
            <Text style={styles.statsLabel}> of </Text>
            <Text style={styles.statsHighlight}>{totalCount}</Text>
            {countLabel ? <Text style={styles.statsLabel}> {countLabel}</Text> : null}
            {bookedCount !== undefined && bookedCount > 0 && (
              <>
                <Text style={styles.statsLabel}> • </Text>
                <Text style={styles.statsBooked}>{bookedCount} booked</Text>
              </>
            )}
          </View>
        </View>
      )}
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 10,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30, 58, 95, 0.12)',
    gap: 8,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  searchShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(21, 40, 59, 0.13)',
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 9,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.textNavy,
  },
  searchClearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,127,167,0.10)',
  },
  shipFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 40, 59, 0.13)',
    gap: SPACING.xs,
    minHeight: 44,
  },
  shipFilterLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textNavy,
    fontWeight: '700' as const,
  },
  shipCountBadge: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  shipCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
  shipFilterPanel: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.10)',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  shipScrollView: {
    maxHeight: 250,
  },
  shipList: {
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  noShipsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textMuted,
    textAlign: 'center' as const,
    paddingVertical: SPACING.lg,
  },
  shipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#F2F6F5',
    borderWidth: 1,
    borderColor: '#D8E2E0',
    gap: SPACING.sm,
  },
  shipOptionActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  shipCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shipCheckboxActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  shipOptionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textNavy,
    fontWeight: '700' as const,
  },
  shipOptionTextActive: {
    color: COLORS.white,
    fontWeight: '800' as const,
  },
  clearShipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  clearShipsText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  mainRow: {
    alignItems: 'stretch',
    gap: 8,
  },
  tabsContainer: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    gap: 8,
    borderWidth: 0,
  },
  tabsContainerFull: {
    flexGrow: 0,
  },
  tab: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7DFDF',
  },
  activeTab: {
    backgroundColor: '#167C80',
    borderColor: '#167C80',
    ...SHADOW.tab,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.textNavy,
  },
  activeTabText: {
    color: COLORS.white,
    fontWeight: '800' as const,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(21, 40, 59, 0.13)',
    ...SHADOW.sm,
  },
  actionPillActive: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: COLORS.textNavy,
  },
  actionPillTextActive: {
    color: COLORS.white,
  },
  alertBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    marginLeft: -1,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  statsRow: {
    marginTop: SPACING.xs,
  },
  statsTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
