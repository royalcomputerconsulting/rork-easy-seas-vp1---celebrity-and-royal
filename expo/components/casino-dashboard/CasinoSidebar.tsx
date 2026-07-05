import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, DollarSign, Zap, LineChart, Settings as SettingsIcon, LayoutGrid, Anchor, Ship, ClipboardList, BookOpen, SlidersHorizontal, FileDown } from 'lucide-react-native';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS } from '@/constants/darkRoyalTheme';
import { resolveTierColor, withAlpha } from '@/constants/easySeasTheme';

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

const MORE_ROUTES: { key: string; label: string; icon: typeof Anchor; href: string }[] = [
  { key: 'loyalty-data', label: 'Loyalty Data', icon: Anchor, href: '/casino/loyalty-data' },
  { key: 'ship-performance', label: 'Ship Performance', icon: Ship, href: '/casino/ship-performance' },
  { key: 'completed-sailings', label: 'Completed Sailings', icon: ClipboardList, href: '/casino/completed-sailings' },
  { key: 'formula-reference', label: 'Formula Reference', icon: BookOpen, href: '/casino/formula-reference' },
  { key: 'casino-settings', label: 'Casino Settings', icon: SlidersHorizontal, href: '/casino/settings' },
  { key: 'export-report', label: 'Export Report', icon: FileDown, href: '/casino/export-report' },
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
  const router = useRouter();
  const tierColor = resolveTierColor('clubRoyale', clubRoyaleTier);
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
              <Icon size={18} color={active ? CASINO_DASHBOARD_COLORS.white : CASINO_DASHBOARD_COLORS.darkText} />
              <Text style={active ? styles.navLabelActive : styles.navLabelInactive}>{label}</Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.sectionDivider} />

        {MORE_ROUTES.map(({ key, label, icon: Icon, href }) => (
          <TouchableOpacity
            key={key}
            style={styles.navItem}
            activeOpacity={0.75}
            onPress={() => router.push(href as any)}
            testID={`sidebar-nav-${key}`}
          >
            <Icon size={18} color={CASINO_DASHBOARD_COLORS.darkText} />
            <Text style={styles.navLabelInactive}>{label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.navItem} activeOpacity={0.75} onPress={onSettingsPress} testID="sidebar-nav-settings">
          <SettingsIcon size={18} color={CASINO_DASHBOARD_COLORS.darkText} />
          <Text style={styles.navLabelInactive}>Settings</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[styles.statusCard, { borderColor: withAlpha(tierColor, 0.45) }]}
        activeOpacity={0.85}
        onPress={onStatusPress}
        testID="sidebar-club-royale-status"
      >
        <Text style={styles.statusBrand}>Club Royale</Text>
        <View style={[styles.tierChip, { backgroundColor: tierColor }]}>
          <Text style={styles.statusTier}>{clubRoyaleTier || 'Choice'}</Text>
        </View>
        <Text style={styles.statusPoints}>{clubRoyalePoints.toLocaleString()} pts</Text>
        <Text style={styles.statusSubLabel}>{tierProgressLabel}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, Math.min(100, tierProgressPct))}%`, backgroundColor: tierColor }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const SIDEBAR_WIDTH = 220;

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: CASINO_DASHBOARD_COLORS.sidebar,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: CASINO_DASHBOARD_COLORS.border,
    marginVertical: 8,
    marginHorizontal: 4,
  },
  navLabelActive: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.white,
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
    backgroundColor: CASINO_DASHBOARD_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.borderStrong,
  },
  statusBrand: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.goldText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tierChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  statusTier: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.white,
  },
  statusPoints: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: CASINO_DASHBOARD_COLORS.white,
    marginTop: 6,
  },
  statusSubLabel: {
    fontSize: 11,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: CASINO_DASHBOARD_COLORS.gold,
  },
});

export { SIDEBAR_WIDTH };
