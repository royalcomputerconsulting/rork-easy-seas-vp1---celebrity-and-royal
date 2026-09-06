import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Compass, House, Plus, Settings, Ship, Spade } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASY_SEAS_UX } from '@/constants/theme';

const C = EASY_SEAS_UX.color;

const NAV_ITEMS = [
  { key: 'offers', label: 'Home', accessibilityLabel: 'Home', route: '/(tabs)/(overview)', Icon: House },
  { key: 'cruises', label: 'Explore', accessibilityLabel: 'Explore cruises', route: '/(tabs)/scheduling', Icon: Compass },
  { key: 'booked', label: 'My Voyages', accessibilityLabel: 'My Voyages', route: '/(tabs)/booked', Icon: Ship },
  { key: 'calendar', label: 'Calendar', accessibilityLabel: 'Calendar', route: '/(tabs)/events', Icon: CalendarDays },
  { key: 'casino', label: 'Casino', accessibilityLabel: 'Casino', route: '/(tabs)/analytics', Icon: Spade },
  { key: 'settings', label: 'Settings', accessibilityLabel: 'Settings', route: '/(tabs)/settings', Icon: Settings },
  { key: 'add', label: '+', accessibilityLabel: 'Quick Actions', route: '/(tabs)/quick-actions', Icon: Plus },
] as const;

export type StandaloneTabKey = typeof NAV_ITEMS[number]['key'];

export function StandaloneBottomNavigation({ activeTab }: { activeTab: StandaloneTabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(6, insets.bottom) }]} accessibilityRole="tablist">
      {NAV_ITEMS.map(({ key, label, accessibilityLabel, route, Icon }) => {
        const active = key === activeTab;
        const color = active ? C.brandNavy : C.textMuted;
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => router.replace(route as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={accessibilityLabel}
          >
            <View style={[styles.icon, active && styles.iconActive]}>
              <Icon size={21} color={color} strokeWidth={active ? 2.5 : 2} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 62,
    paddingTop: 6,
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  icon: {
    width: 38,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  iconActive: {
    borderTopColor: C.brandNavy,
    backgroundColor: 'transparent',
  },
  label: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
