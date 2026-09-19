/** Tiny class-name joiner (avoids extra deps like clsx/tailwind-merge). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}