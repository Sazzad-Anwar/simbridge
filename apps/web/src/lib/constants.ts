/**
 * Single source of truth for links and copy used across the landing page.
 */

export const GITHUB_URL = "https://github.com/Sazzad-Anwar/simbridge";

/** Releases listing on GitHub. */
export const RELEASES_URL = `${GITHUB_URL}/releases`;

/** Currently published app version shown across the site. */
export const APP_VERSION = "v1.0.1";

/** APK release asset — always resolves to the newest published release. */
export const APK_DOWNLOAD_URL = `${GITHUB_URL}/releases/latest/download/SIMBridge.apk`;

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