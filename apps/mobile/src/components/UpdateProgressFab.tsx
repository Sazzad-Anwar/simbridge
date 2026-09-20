/**
 * Floating round update button pinned to the bottom-right corner.
 *
 * While the APK downloads / installs it shows a circular progress ring with
 * the percentage in the middle; on other states it morphs into an action
 * button (install / grant permission / retry / dismiss), color-coded by phase.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";

export type UpdatePhase =
  | "downloading"
  | "installing"
  | "ready"
  | "needsPermission"
  | "error"
  | "done";

interface Props {
  phase: UpdatePhase;
  progress: number;
  onPress: () => void;
}

const SIZE = 64;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function phaseColor(phase: UpdatePhase): string {
  switch (phase) {
    case "done":
    case "ready":
      return colors.green;
    case "error":
      return colors.red;
    case "needsPermission":
      return colors.yellow;
    default:
      return colors.accent;
  }
}

function glyph(phase: UpdatePhase, progress: number): string {
  switch (phase) {
    case "downloading":
    case "installing":
      return `${Math.round(progress)}%`;
    case "ready":
    case "done":
      return "✓";
    case "needsPermission":
      return "⚙";
    case "error":
      return "!";
  }
}

export default function UpdateProgressFab({ phase, progress, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const showRing = phase === "downloading" || phase === "installing";
  const color = phaseColor(phase);
  const progresses = Math.min(100, Math.max(0, progress));
  const dashedOffset = CIRCUMFERENCE * (1 - progresses / 100);

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Update progress"
        testID="update-progress-fab"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {showRing ? (
          <Svg width={SIZE} height={SIZE} style={styles.ring}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={dashedOffset}
              fill="none"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
        ) : (
          <View style={[styles.ring, { borderColor: color }]} />
        )}
        <Text style={[styles.glyph, { color }]} allowFontScaling={false}>
          {glyph(phase, progress)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 20,
    zIndex: 100,
    elevation: 10,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  ring: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: STROKE,
  },
  glyph: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
});