import React from "react";
import { Tabs } from "expo-router";
import { colors } from "@/constants/theme";
import { tabIcon } from "@/components/Icon";
import { ConnectionStatus } from "@/components/ConnectionStatus";

export default function ReceiverLayout() {
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
          title: "Inbox",
          tabBarLabel: "Inbox",
          tabBarIcon: tabIcon("inbox"),
          tabBarAccessibilityLabel: "Inbox",
        }}
      />
      <Tabs.Screen
        name="pairing"
        options={{
          title: "Pairing",
          tabBarLabel: "Pairing",
          tabBarIcon: tabIcon("key"),
          tabBarAccessibilityLabel: "Pairing",
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
        name="settings"
        options={{
          title: "Settings & Security",
          tabBarLabel: "Settings",
          tabBarIcon: tabIcon("settings"),
          tabBarAccessibilityLabel: "Settings",
        }}
      />
      <Tabs.Screen name="message/[id]/index" options={{ href: null }} />
    </Tabs>
  );
}