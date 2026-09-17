/**
 * Receiver tab navigator: Inbox / Pairing / Settings + message detail stack screen.
 */
import React from "react";
import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";

function ConnectionDot() {
  const connection = useDeviceStore((s) => s.connection);
  const map: Record<string, string> = {
    online: colors.green,
    connecting: colors.yellow,
    offline: colors.red,
    none: colors.textFaint,
  };
  return <Text style={{ color: map[connection] ?? colors.textFaint, fontSize: 18 }}>●</Text>;
}

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
  };

export default function ReceiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accentSoft,
        tabBarInactiveTintColor: colors.textFaint,
        headerRight: () => <ConnectionDot />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Inbox", tabBarLabel: "Inbox", tabBarIcon: icon("📥") }}
      />
      <Tabs.Screen
        name="pairing"
        options={{ title: "Pairing", tabBarLabel: "Pairing", tabBarIcon: icon("🤝") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings & Security", tabBarLabel: "Settings", tabBarIcon: icon("⚙️") }}
      />
    </Tabs>
  );
}
