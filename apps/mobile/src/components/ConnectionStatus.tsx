import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";

const STATES: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: colors.green },
  connecting: { label: "Connecting…", color: colors.yellow },
  offline: { label: "Offline", color: colors.red },
  none: { label: "Not connected", color: colors.textFaint },
};

export function ConnectionStatus() {
  const connection = useDeviceStore((s) => s.connection);
  const s = STATES[connection] ?? STATES.none;
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (connection === "connecting") {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [connection, pulse]);

  return (
    <View
      style={[styles.pill, { borderColor: s.color }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Connection status: ${s.label}`}
    >
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Animated.View style={{ opacity: pulse }}>
        <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 4,
    marginRight: 16,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});