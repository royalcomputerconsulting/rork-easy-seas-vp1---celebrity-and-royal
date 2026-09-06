import { Tabs, useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import {
  House,
  Compass, 
  Ship, 
  CalendarDays, 
  Spade, 
  Settings,
  Plus
} from "lucide-react-native";
import React, { useCallback } from "react";
import { Platform, View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { EASY_SEAS_UX } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import { LARGE_SCREEN_BREAKPOINT, getResponsiveTabBarWidth } from '@/constants/layout';
import { useExperience } from '@/state/ExperienceProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark, minimumControlSize, preferences } = useExperience();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useGlobalSearchParams<{ source?: string | string[] }>();
  const routeSource = Array.isArray(searchParams.source) ? searchParams.source[0] : searchParams.source;
  const detailOrigin = pathname.includes('cruise-details')
    ? routeSource === 'booked' || routeSource === 'completed'
      ? 'booked'
      : routeSource === 'cruises' || routeSource === 'available'
        ? 'scheduling'
        : routeSource === 'calendar'
          ? 'events'
          : routeSource === 'casino'
            ? 'analytics'
            : 'overview'
    : null;
  const inactiveTint = isDark ? colors.muted : EASY_SEAS_UX.color.textMuted;
  const activeTint = isDark ? colors.accent : EASY_SEAS_UX.color.brandNavy;
  const visualFocus = useCallback((tab: string, focused: boolean) => {
    if (tab === 'analytics' && pathname.includes('/machines')) return true;
    return detailOrigin ? detailOrigin === tab : focused;
  }, [detailOrigin, pathname]);
  const tabLabel = useCallback((tab: string, label: string) => ({ focused }: { focused: boolean; color: string; position?: string; children?: string }) => {
    const active = visualFocus(tab, focused);
    return (
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[styles.tabLabel, { color: active ? activeTint : inactiveTint }]}
      >
        {label}
      </Text>
    );
  }, [activeTint, inactiveTint, visualFocus]);
  const handleTabPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  // Desktop web deliberately renders the app inside the 430-point phone
  // frame in app/_layout.tsx. Using the outer browser width here made the
  // seven-item bar 920 points wide, clipped four tabs, and intercepted tab
  // presses outside the visible phone. Let the bar fill the phone frame on
  // web; keep the wide centered treatment for native tablets only.
  const isLargeScreen = Platform.OS !== 'web' && width >= LARGE_SCREEN_BREAKPOINT;
  const tabBarWidth = getResponsiveTabBarWidth(width);
  const webPhoneTabBarWidth = Math.min(width, 430);

  return (
    <Tabs
      initialRouteName="(overview)"
      detachInactiveScreens={Platform.OS !== 'web'}
      screenListeners={{
        tabPress: handleTabPress,
      }}
      screenOptions={{
        // Keep each tab's navigation state, but freeze its React tree while it
        // is not visible. Large cruise/offer screens otherwise recompute their
        // full local datasets whenever any shared provider publishes an update.
        lazy: true,
        freezeOnBlur: Platform.OS !== 'web',
        animation: preferences.reducedMotion ? 'none' : 'fade',
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          // Keep the bar in normal layout flow so the last row, composer, and
          // floating actions can never be hidden behind an absolute overlay.
          minHeight: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(6, insets.bottom),
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.10,
          shadowRadius: 14,
          ...(isLargeScreen
            ? {
                width: tabBarWidth,
                alignSelf: 'center' as const,
                borderRadius: 22,
                marginBottom: 12,
              }
            : null),
          ...(Platform.OS === 'web'
            ? {
                width: webPhoneTabBarWidth,
                alignSelf: 'center' as const,
                paddingLeft: 0,
                paddingRight: 0,
              }
            : null),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '600' as const,
          marginTop: 1,
          letterSpacing: width < 430 ? -0.45 : 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          minWidth: 0,
          minHeight: 56,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(overview)"
        listeners={{
          tabPress: (event) => {
            if (detailOrigin && detailOrigin !== 'overview') {
              event.preventDefault();
              router.replace('/(tabs)/(overview)' as any);
            }
          },
        }}
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarLabel: tabLabel('overview', 'Home'),
          tabBarButtonTestID: "tab-offers",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('overview', focused);
            return (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <House color={active ? activeTint : inactiveTint} size={22} strokeWidth={active ? 2.5 : 2} />
            </View>
          )},
        }}
      />
      <Tabs.Screen
        name="scheduling"
        options={{
          title: "Explore",
          tabBarAccessibilityLabel: "Explore cruises",
          tabBarLabel: tabLabel('scheduling', 'Explore'),
          tabBarButtonTestID: "tab-cruises",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('scheduling', focused);
            return (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <Compass color={active ? activeTint : inactiveTint} size={22} strokeWidth={active ? 2.5 : 2} />
            </View>
          )},
        }}
      />
      <Tabs.Screen
        name="booked"
        options={{
          title: "My Voyages",
          tabBarAccessibilityLabel: "My Voyages",
          tabBarLabel: tabLabel('booked', 'My Voyages'),
          tabBarButtonTestID: "tab-booked",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('booked', focused);
            return (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <Ship color={active ? activeTint : inactiveTint} size={22} strokeWidth={active ? 2.5 : 2} />
            </View>
          )},
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Calendar",
          tabBarLabel: tabLabel('events', 'Calendar'),
          tabBarButtonTestID: "tab-calendar",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('events', focused);
            return (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <CalendarDays color={active ? activeTint : inactiveTint} size={22} strokeWidth={active ? 2.5 : 2} />
            </View>
          )},
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Casino",
          tabBarLabel: tabLabel('analytics', 'Casino'),
          tabBarButtonTestID: "tab-casino",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('analytics', focused);
            return (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <Spade color={active ? activeTint : inactiveTint} size={22} strokeWidth={active ? 2.5 : 2} />
            </View>
          )},
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: "Slots",
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: tabLabel('settings', 'Settings'),
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, { minWidth: minimumControlSize }, focused && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
              <Settings color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="quick-actions"
        options={{
          title: "Quick Actions",
          tabBarAccessibilityLabel: "Quick Actions",
          tabBarLabel: tabLabel('quick-actions', '+'),
          tabBarButtonTestID: "tab-quick-actions",
          tabBarIcon: ({ focused }) => {
            const active = visualFocus('quick-actions', focused);
            return (
              <View style={[styles.iconContainer, { minWidth: minimumControlSize }, active && [styles.activeIconContainer, { borderTopColor: activeTint }]]}>
                <Plus color={active ? activeTint : inactiveTint} size={24} strokeWidth={active ? 2.7 : 2.2} />
              </View>
            );
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  activeIconContainer: {
    borderTopWidth: 2,
    borderTopColor: EASY_SEAS_UX.color.brandNavy,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: -0.25,
  },
});
