/**
 * SIMBridge theme — matches the architecture spec (dark premium + violet accent).
 */
export const colors = {
  bg: "#0D0D17",
  surface: "#16162A",
  surfaceAlt: "#1B1B30",
  border: "#26264A",
  text: "#E7E7F2",
  textMuted: "#9A9AB8",
  textFaint: "#6D6D90",
  accent: "#7C5CFF",
  accentSoft: "#B7A8FF",
  green: "#7EF0B2",
  yellow: "#F0C67E",
  red: "#FF7E8A",
  blue: "#4F8CFF",
  orange: "#FFA94F",
  cyan: "#4FD8EB",
} as const;

export const statusColor: Record<string, string> = {
  pending: colors.yellow,
  sent: colors.blue,
  delivered: colors.green,
  failed: colors.red,
  revoked: colors.red,
  active: colors.green,
  online: colors.green,
  offline: colors.textFaint,
};
