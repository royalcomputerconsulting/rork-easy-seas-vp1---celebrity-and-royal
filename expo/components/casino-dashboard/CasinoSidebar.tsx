import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Award, DollarSign, Zap, LineChart, Settings as SettingsIcon, LayoutGrid } from 'lucide-react-native';
import { CASINO_DASHBOARD_COLORS } from '@/constants/casinoDashboardTheme';

export type CasinoSidebarTab = 'portfolio' | 'value' | 'action' | 'history';

interface CasinoSidebarProps {
  activeTab: CasinoSidebarTab;
  onTabChange: (tab: CasinoSidebarTab) => void;
  onOverviewPress: () => void;
  onSettingsPress: () => void;
  clubRoyaleTier: string;
  clubRoyalePoints: number;
  tierProgressPct: number;
  tierProgressLabel: string;
  onStatusPress: () => void;
}

const NAV_ITEMS: { key: CasinoSidebarTab; label: string; icon: typeof Award }[] = [
  { key: 'portfolio', label: 'Casino Portfolio', icon: Award },
  { key: 'value', label: 'Cruise Value', icon: DollarSign },
  { key: 'action', label: 'Casino Action Center', icon: Zap },
  { key: 'history', label: 'History & Simulator', icon: LineChart },
];

/**
 * Persistent left sidebar shown only on wide/desktop and web preview
 * screens. Phones keep the existing bottom tab navigation; this is an
 * additive layout for larger viewports per the dashboard spec.
 */
export function CasinoSidebar({
  activeTab,
  onTabChange,
  onOverviewPress,
  onSettingsPress,
  clubRoyaleTier,
  clubRoyalePoints,
  tierProgressPct,
  tierProgressLabel,
  onStatusPress,
}: CasinoSidebarProps) {
  return (
    <View style={styles.sidebar}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.navList}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.75} onPress={onOverviewPress} testID="sidebar-nav-overview">
          <LayoutGrid size={18} color={CASINO_DASHBOARD_COLORS.darkText} />
          <Text style={styles.navLabelInactive}>Overview</Text>
        </TouchableOpacity>

        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.navItem, active && styles.navItemActive]}
              activeOpacity={0.8}
              onPress={() => onTabChange(key)}
              testID={`sidebar-nav-${key}`}
            >
              <Icon size={18} color={active ? '#FFFFFF' : CASINO_DASHBOARD_COLORS.darkText} />
              <Text style={active ? styles.navLabelActive : styles.navLabelInactive}>{label}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.navItem} activeOpacity={0.75} onPress={onSettingsPress} testID="sidebar-nav-settings">
          <SettingsIcon size={18} color={CASINO_DASHBOARD_COLORS.darkText} />
          <Text style={styles.navLabelInactive}>Settings</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.statusCard} activeOpacity={0.85} onPress={onStatusPress} testID="sidebar-club-royale-status">
        <Text style={styles.statusBrand}>Club Royale</Text>
        <Text style={styles.statusTier}>{clubRoyaleTier || 'Choice'}</Text>
        <Text style={styles.statusPoints}>{clubRoyalePoints.toLocaleString()} pts</Text>
        <Text style={styles.statusSubLabel}>{tierProgressLabel}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, Math.min(100, tierProgressPct))}%` }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const SIDEBAR_WIDTH = 220;

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: CASINO_DASHBOARD_COLORS.border,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  navList: {
    paddingHorizontal: 12,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#006BFF',
  },
  navLabelActive: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  navLabelInactive: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: CASINO_DASHBOARD_COLORS.darkText,
  },
  statusCard: {
    marginHorizontal: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: CASINO_DASHBOARD_COLORS.deepNavy,
  },
  statusBrand: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statusTier: {
    fontSize: 17,
    fontWeight: '700' as const,
    fontStyle: 'italic' as const,
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusPoints: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginTop: 6,
  },
  statusSubLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#0074FF',
  },
});

export { SIDEBAR_WIDTH };
