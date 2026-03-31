import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { X, Bell, Ship, ChevronDown, Check } from 'lucide-react-native';
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
    ships?: string[];
    selectedShips?: string[];
    onShipToggle?: (ship: string) => void;
    onClearShips?: () => void;
}
export const MinimalistFilterBar = React.memo(function MinimalistFilterBar({ tabs, activeTab, onTabPress, actions = [], searchPlaceholder = 'Search cruises...', searchValue = '', onSearchChange, onSearch, showingCount, totalCount, bookedCount, ships = [], selectedShips = [], onShipToggle, onClearShips, }: MinimalistFilterBarProps) {
    const [showShipFilter, setShowShipFilter] = useState(false);
    const alertAction = actions.find(a => a.key === 'alerts');
    const handleShipPress = (ship: string) => {
        if (onShipToggle) {
            onShipToggle(ship);
        }
    };
    return (<View style={styles.container}>
      <TouchableOpacity style={styles.shipFilterButton} onPress={() => setShowShipFilter(!showShipFilter)} activeOpacity={0.7}>
        <Ship size={16} color={COLORS.navyDeep}/>
        <Text style={styles.shipFilterLabel}>
          {selectedShips.length === 0
            ? 'All Ships'
            : selectedShips.length === 1
                ? selectedShips[0]
                : `${selectedShips.length} Ships Selected`}
        </Text>
        
        <ChevronDown size={16} color={COLORS.textDarkGrey} style={showShipFilter ? styles.chevronUp : undefined}/>
      </TouchableOpacity>

      

      <View style={styles.mainRow}>
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (<TouchableOpacity key={tab.key} style={[styles.tab, isActive && styles.activeTab]} onPress={() => onTabPress(tab.key)} activeOpacity={0.7}>
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>);
        })}
        </View>

        <View style={styles.actionsContainer}>
          
        </View>
      </View>

      
    </View>);
});
const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    shipFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        gap: SPACING.xs,
        minHeight: 44,
    },
    shipFilterLabel: {
        flex: 1,
        fontSize: TYPOGRAPHY.fontSizeSM,
        color: COLORS.textNavy,
        fontWeight: TYPOGRAPHY.fontWeightMedium,
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
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        overflow: 'hidden',
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
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.bgSecondary,
        gap: SPACING.sm,
    },
    shipOptionActive: {
        backgroundColor: 'rgba(30, 58, 95, 0.1)',
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
    },
    shipOptionTextActive: {
        fontWeight: TYPOGRAPHY.fontWeightSemiBold,
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
