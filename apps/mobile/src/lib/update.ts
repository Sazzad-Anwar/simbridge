/**
 * In-app update notifications.
 *
 * SIMBridge is distributed as a sideloaded APK via GitHub Releases
 * (https://github.com/Sazzad-Anwar/simbridge/releases). On launch the app
 * checks the latest published release and — if it is newer than the installed
 * build — surfaces a prompt so users can download/install the update.
 *
 * The repo is public, so the GitHub Releases API works without a token.
 *
 * A release is only offered ONCE per installed build: after the user sees the
 * prompt (and taps Download/Later), the offer is remembered so the same
 * release does not nag again on every launch. The prompt resurfaces only for a
 * newer release, or after the installed build is actually upgraded (in which
 * case the release is no longer newer than what is installed).
 */
import Constants from "expo-constants";
import { storage } from "@/lib/storage";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/Sazzad-Anwar/simbridge/releases/latest";

export interface AppUpdate {
  tagName: string;
  version: string;
  downloadUrl: string;
}

/** True when `a` is a higher semver than `b` (optional leading "v" tolerated). */
export function semverGt(a: string, b: string): boolean {
  const pa = (a || "").replace(/^[vV]/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = (b || "").replace(/^[vV]/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export function installedVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/**
 * Returns the latest published GitHub release when it is newer than the
 * currently installed version AND has not already been offered for this build,
 * otherwise null. Failures (offline, rate limited, malformed release) resolve
 * to null — never throw.
 */
export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(LATEST_RELEASE_URL, {
        headers: { accept: "application/vnd.github+json" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const release = (await res.json()) as {
        tag_name?: string;
        assets?: { browser_download_url?: string }[];
      };
      const tagName = release.tag_name;
      const asset = release.assets?.find((a) => a.browser_download_url?.endsWith(".apk"));
      const downloadUrl = asset?.browser_download_url;
      if (!tagName || !downloadUrl) return null;
      const version = tagName.replace(/^v/i, "");
      if (!semverGt(version, installedVersion())) return null;
      if (await wasOfferedForInstalledBuild(tagName)) return null;
      return { tagName, version, downloadUrl };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Remembers that the user was shown the given release so it is not prompted
 * again while the installed build is unchanged.
 */
export async function markAppUpdateOffered(update: AppUpdate): Promise<void> {
  await storage.setLastUpdatePrompt({
    tagName: update.tagName,
    installedVersion: installedVersion(),
  });
}

async function wasOfferedForInstalledBuild(tagName: string): Promise<boolean> {
  const offered = await storage.getLastUpdatePrompt();
  return offered?.tagName === tagName && offered.installedVersion === installedVersion();
}
