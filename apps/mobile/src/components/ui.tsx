/**
 * Compact dark-premium UI kit for SIMBridge.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, statusColor } from "../constants/theme";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: TextProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Muted({ children, style }: TextProps) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Badge({ label, tone = "accent" }: { label: string; tone?: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    accent: { bg: "#2A2244", fg: colors.accentSoft },
    green: { bg: "#173226", fg: colors.green },
    yellow: { bg: "#37301B", fg: colors.yellow },
    red: { bg: "#3A1E23", fg: colors.red },
  };
  const p = palette[tone] ?? palette.accent;
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const color = statusColor[status] ?? colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
}) {
  const bg =
    variant === "primary"
      ? colors.accent
      : variant === "danger"
        ? "#3A1E23"
        : "transparent";
  const fg = variant === "ghost" ? colors.accentSoft : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === "ghost" ? colors.border : "transparent" },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} size="small" /> : <Text style={{ color: fg, fontWeight: "600" }}>{label}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Muted style={{ textAlign: "center", marginTop: 8 }}>{text}</Muted>
    </View>
  );
}

export function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.accentSoft} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
});
