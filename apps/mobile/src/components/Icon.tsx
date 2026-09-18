import { Circle, Path, Svg } from "react-native-svg";
import type { ColorValue } from "react-native";
import { colors } from "@/constants/theme";

export type IconName = "inbox" | "link" | "key" | "card" | "logs" | "settings" | "qr";

type Glyph =
  | { p: string }
  | { c: { cx: number; cy: number; r: number } };

const spokesPath = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const x1 = 12 + 5 * Math.cos(a);
  const y1 = 12 + 5 * Math.sin(a);
  const x2 = 12 + 8 * Math.cos(a);
  const y2 = 12 + 8 * Math.sin(a);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}).join("");

const GLYPHS: Record<IconName, Glyph[]> = {
  inbox: [
    { p: "M6 5v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5" },
    { p: "M4 5h16" },
    { p: "M12 9v3M10 12l2 2 2-2" },
  ],
  link: [
    { p: "M8 16H7a4 4 0 0 1 0-8h1" },
    { p: "M16 16h1a4 4 0 0 0 0-8h-1" },
    { p: "M9 12h6" },
  ],
  key: [
    { c: { cx: 8.5, cy: 8.5, r: 4 } },
    { p: "M11.5 11.5L17.5 17.5" },
    { p: "M15.3 15.3v2.2" },
    { p: "M17.8 17.8v2.2" },
  ],
  card: [
    {
      p: "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM4 10h16M7 14h4",
    },
  ],
  logs: [{ p: "M4 6h16M4 12h12M4 18h9" }],
  settings: [{ c: { cx: 12, cy: 12, r: 3 } }, { p: spokesPath }],
  qr: [
    { p: "M3 3h5v5H3zM4.5 4.5h2v2h-2z" },
    { p: "M16 3h5v5h-5zM17.5 4.5h2v2h-2z" },
    { p: "M3 16h5v5H3zM4.5 17.5h2v2h-2z" },
    { p: "M12 12h1.5v1.5H12zM14.5 12h1.5v1.5h-1.5zM12 14.5h1.5v1.5H12zM16 16h2v2h-2z" },
  ],
};

export function Icon({
  name,
  color = colors.text,
  size = 22,
  strokeWidth = 2,
}: {
  name: IconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {GLYPHS[name].map((g, i) =>
        "c" in g ? (
          <Circle
            key={i}
            cx={g.c.cx}
            cy={g.c.cy}
            r={g.c.r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        ) : (
          <Path
            key={i}
            d={g.p}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}

export function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} color={typeof color === "string" ? color : colors.text} />;
  };
}