import { Stack } from "expo-router";
import React from "react";
import { COLORS } from "@/constants/theme";

export default function OverviewLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.navyDeep,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="cruise-details"
        options={{
          title: "Cruise Details",
          presentation: "card",
        }}
      />
    </Stack>
  );
}
