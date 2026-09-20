/**
 * Typed wrapper for the local Expo module `expo-app-installer`
 * (native Kotlin: fully in-app APK update install via PackageInstaller).
 *
 * Only available in dev-client / production builds (not in Expo Go) —
 * every call degrades gracefully to the browser-based fallback.
 */
import { requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface InstallErrorEvent {
  code: string;
  message: string;
}

/** Minimal structural view of the native module's EventEmitter surface. */
interface NativeEventEmitterLike<TEventsMap extends Record<string, (...args: never[]) => void>> {
  addListener<EventName extends keyof TEventsMap & string>(
    eventName: EventName,
    listener: TEventsMap[EventName],
  ): { remove(): void };
}

interface AppInstallerFunctions {
  canRequestPackageInstalls(): boolean;
  openInstallPermissionSettings(): void;
  install(apkPath: string, expectedSha256: string | null): Promise<void>;
}

type AppInstallerNativeModule = AppInstallerFunctions &
  NativeEventEmitterLike<{
    onInstallPermissionRequired: () => void;
    onInstallProgress: (event: { progress: number }) => void;
    onInstallFinished: (event: { packageName: string | null }) => void;
    onInstallError: (event: InstallErrorEvent) => void;
  }>;

const native = (() => {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<AppInstallerNativeModule>("AppInstaller");
  } catch {
    return null; // Expo Go or iOS — in-app installer unavailable
  }
})();

export const appInstallerAvailable = native !== null;

export const appInstaller = {
  /** True once the OS allows this app to install unknown-app APKs. */
  canInstall(): boolean {
    return native?.canRequestPackageInstalls() ?? false;
  },

  /** Opens Android's "Allow from this source" screen for the app. */
  requestInstallPermission(): void {
    native?.openInstallPermissionSettings();
  },

  /**
   * Streams `apkPath` through a PackageInstaller session. Resolves when the
   * session is committed; the actual result arrives via onInstallFinished /
   * onInstallError. Rejects only on checksum mismatch / invalid file /
   * permission missing (handled instead via onInstallPermissionRequired).
   */
  async install(apkPath: string, expectedSha256?: string): Promise<void> {
    if (!native) throw new Error("In-app installer unavailable");
    await native.install(apkPath, expectedSha256 ?? null);
  },

  onPermissionRequired(listener: () => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onInstallPermissionRequired", listener);
    return () => sub.remove();
  },

  onProgress(listener: (percent: number) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onInstallProgress", (e) => listener(e.progress));
    return () => sub.remove();
  },

  onFinished(listener: () => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onInstallFinished", listener);
    return () => sub.remove();
  },

  onError(listener: (err: InstallErrorEvent) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onInstallError", listener);
    return () => sub.remove();
  },
};