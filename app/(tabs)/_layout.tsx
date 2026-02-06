import { Tabs, useRouter } from "expo-router";
import { 
  Tag, 
  CalendarClock, 
  Ship, 
  PartyPopper, 
  TrendingUp, 
  Settings,
  Gamepad2
} from "lucide-react-native";
import React, { useCallback } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { COLORS } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useEntitlement } from '@/state/EntitlementProvider';

export default function TabLayout() {
  const router = useRouter();
  const { tier } = useEntitlement();

  const handleTabPress = useCallback((e: any) => {
    const routeName = e?.target?.split('-')[0];
    
    if (routeName === 'machines' && tier !== 'pro') {
      e.preventDefault();
      console.log('[TabLayout] Blocked Slots tab access. Tier:', tier);
      router.push('/paywall');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [tier, router]);

  return (
    <Tabs
      initialRouteName="(overview)"
      screenListeners={{
        tabPress: handleTabPress,
      }}
      screenOptions={{
        tabBarActiveTintColor: COLORS.navyDeep,
        tabBarInactiveTintColor: COLORS.textDarkGrey,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.borderLight,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600' as const,
          marginTop: 2,
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
          letterSpacing: 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          minWidth: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="(overview)"
        options={{
          title: "Offers",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Tag color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scheduling"
        options={{
          title: "Cruises",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <CalendarClock color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="booked"
        options={{
          title: "Booked",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Ship color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <PartyPopper color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Casino",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <TrendingUp color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: "Slots",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Gamepad2 color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Settings color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
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
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  activeIconContainer: {
    backgroundColor: COLORS.gold,
  },
});
