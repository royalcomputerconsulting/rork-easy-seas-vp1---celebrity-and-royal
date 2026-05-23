import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Ship, ChevronDown, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, COLORS, SHADOW } from '@/constants/theme';

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
  ships?: string[];
  selectedShips?: string[];
  onShipToggle?: (ship: string) => void;
  onClearShips?: () => void;
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
  bookedCount,
  ships = [],
  selectedShips = [],
  onShipToggle,
  onClearShips,
}: MinimalistFilterBarProps) {
  const [showShipFilter, setShowShipFilter] = useState(false);
  const visibleActions = actions.filter(action => action.key === 'alerts' || action.key === 'countries');
  const hasVisibleActions = visibleActions.length > 0;

  const handleShipPress = (ship: string) => {
    if (onShipToggle) {
      onShipToggle(ship);
    }
  };

  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.96)', 'rgba(224,242,241,0.92)', 'rgba(0,172,193,0.10)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <TouchableOpacity 
        style={styles.shipFilterButton} 
        onPress={() => setShowShipFilter(!showShipFilter)}
        activeOpacity={0.7}
      >
        <Ship size={16} color={COLORS.navyDeep} />
        <Text style={styles.shipFilterLabel}>
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
        <ChevronDown size={16} color={COLORS.textDarkGrey} style={showShipFilter ? styles.chevronUp : undefined} />
      </TouchableOpacity>

      {showShipFilter && (
        <View style={styles.shipFilterPanel}>
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
                    style={[styles.shipOption, isSelected && styles.shipOptionActive]}
                    onPress={() => handleShipPress(ship)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.shipCheckbox, isSelected && styles.shipCheckboxActive]}>
                      {isSelected && <Check size={12} color={COLORS.white} />}
                    </View>
                    <Text style={[styles.shipOptionText, isSelected && styles.shipOptionTextActive]}>
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
        <View style={[styles.tabsContainer, !hasVisibleActions && styles.tabsContainerFull]}>
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
          {visibleActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <TouchableOpacity
                key={action.key}
                style={[styles.actionPill, action.active && styles.actionPillActive]}
                onPress={action.onPress}
                activeOpacity={0.7}
                testID={`filter-action-${action.key}`}
              >
                <ActionIcon size={14} color={action.active ? COLORS.white : COLORS.textNavy} />
                <Text style={[styles.actionPillText, action.active && styles.actionPillTextActive]}>{action.label}</Text>
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
        </View>
      </View>

      {(showingCount !== undefined || totalCount !== undefined) && (
        <View style={styles.statsRow}>
          <View style={styles.statsTextContainer}>
            <Text style={styles.statsHighlight}>{showingCount}</Text>
            <Text style={styles.statsLabel}> of </Text>
            <Text style={styles.statsHighlight}>{totalCount}</Text>
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
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.12)',
    gap: 6,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  shipFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
    gap: SPACING.xs,
    minHeight: 42,
    ...SHADOW.sm,
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
    borderRadius: BORDER_RADIUS.md,
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
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.08)',
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
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#D8F1FF',
    borderWidth: 1,
    borderColor: '#A9DDF8',
  },
  activeTab: {
    backgroundColor: COLORS.goldAccent,
    borderColor: COLORS.goldAccent,
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
    gap: SPACING.xs,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: 7,
    paddingHorizontal: 7,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.10)',
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
