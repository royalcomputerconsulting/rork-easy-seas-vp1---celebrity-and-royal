import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Compass, Gamepad2, Settings, Ship, Spade, Tag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_ITEMS = [
  { key: 'offers', label: 'Offers', route: '/(tabs)/(overview)', Icon: Tag },
  { key: 'cruises', label: 'Cruises', route: '/(tabs)/scheduling', Icon: Compass },
  { key: 'booked', label: 'Booked', route: '/(tabs)/booked', Icon: Ship },
  { key: 'calendar', label: 'Calendar', route: '/(tabs)/events', Icon: CalendarDays },
  { key: 'casino', label: 'Casino', route: '/(tabs)/analytics', Icon: Spade },
  { key: 'slots', label: 'Slots', route: '/(tabs)/machines', Icon: Gamepad2 },
  { key: 'settings', label: 'Settings', route: '/(tabs)/settings', Icon: Settings },
] as const;

export type StandaloneTabKey = typeof NAV_ITEMS[number]['key'];

export function StandaloneBottomNavigation({ activeTab }: { activeTab: StandaloneTabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(6, insets.bottom) }]} accessibilityRole="tablist">
      {NAV_ITEMS.map(({ key, label, route, Icon }) => {
        const active = key === activeTab;
        const color = active ? '#0E7FA7' : '#1C2F7A';
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => router.replace(route as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
          >
            <View style={[styles.icon, active && styles.iconActive]}>
              <Icon size={21} color={color} strokeWidth={active ? 2.5 : 2} />
            </View>
            <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>
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
    backgroundColor: '#FFFCF7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5D5D0',
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
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  iconActive: {
    borderTopColor: '#167C80',
    backgroundColor: '#E2F2EF',
  },
  label: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
