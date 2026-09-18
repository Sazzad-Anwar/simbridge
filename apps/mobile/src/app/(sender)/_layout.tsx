import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { tabIcon } from "@/components/Icon";
import { ConnectionStatus } from "@/components/ConnectionStatus";

export default function SenderLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accentSoft,
        tabBarInactiveTintColor: colors.textFaint,
        headerRight: () => <ConnectionStatus />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pairing",
          tabBarLabel: "Pairing",
          tabBarIcon: tabIcon("link"),
          tabBarAccessibilityLabel: "Pairing",
        }}
      />
      <Tabs.Screen
        name="sims"
        options={{
          title: "SIM & Routing",
          tabBarLabel: "SIMs",
          tabBarIcon: tabIcon("card"),
          tabBarAccessibilityLabel: "SIM and routing",
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan QR",
          tabBarLabel: "Scan",
          tabBarIcon: tabIcon("qr"),
          tabBarAccessibilityLabel: "Scan QR code",
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Message Logs",
          tabBarLabel: "Logs",
          tabBarIcon: tabIcon("logs"),
          tabBarAccessibilityLabel: "Message logs",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings & Diagnostics",
          tabBarLabel: "Settings",
          tabBarIcon: tabIcon("settings"),
          tabBarAccessibilityLabel: "Settings",
        }}
      />
    </Tabs>
  );
}