/**
 * Single source of truth for links and copy used across the landing page.
 */

/** Replace this with the real hosted APK location when one is published. */
export const APK_DOWNLOAD_URL =
  "https://github.com/Sazzad-Anwar/simbridge/releases/download/v1.0.0/SIMBridge.apk";

export const GITHUB_URL = "https://github.com/Sazzad-Anwar/simbridge";

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
] as const;

export const TRUST_ITEMS = [
  { label: "Secure by design" },
  { label: "End-to-end encrypted" },
  { label: "Background relay" },
  { label: "Offline resilient" },
  { label: "Multi-SIM support" },
] as const;