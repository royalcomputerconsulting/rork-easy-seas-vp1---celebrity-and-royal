import { Tabs } from "expo-router";
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
import { COLORS } from '../../constants/theme';
import * as Haptics from 'expo-haptics';

const TAB_BG = 'rgba(8, 16, 34, 0.97)';
const ACTIVE_COLOR = '#FFE28F';
const INACTIVE_COLOR = 'rgba(200,215,255,0.55)';

export default function TabLayout() {
  const handleTabPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  return (
    <Tabs
      initialRouteName="(overview)"
      screenListeners={{
        tabPress: handleTabPress,
      }}
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700' as const,
          marginTop: 1,
          letterSpacing: 0.3,
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
    height: 30,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255,226,143,0.14)',
    borderRadius: 8,
  },
});
