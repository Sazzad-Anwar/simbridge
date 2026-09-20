/**
 * Modal shown on launch when a newer SIMBridge APK is available on GitHub.
 * Offers each release once per installed build: dismissing it (Later,
 * Download, or back) persists the offer so it does not nag on every launch.
 *
 * Tapping Download starts a fully in-app update: the APK is fetched to the
 * app cache (progress shown on a floating round button at the bottom-right),
 * verified against the release checksum, then installed via the native
 * PackageInstaller session — the app relaunches on the new build. On devices
 * or builds without the native installer (Expo Go / iOS), it falls back to
 * opening the GitHub asset in the browser.
 */
import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import UpdateProgressFab, { type UpdatePhase } from "@/components/UpdateProgressFab";
import { colors } from "@/constants/theme";
import { appInstaller, appInstallerAvailable } from "@/native/app-installer";
import {
  checkForAppUpdate,
  fetchExpectedSha256,
  markAppUpdateOffered,
  startAppUpdateDownload,
  type AppUpdate,
} from "@/lib/update";

interface UiState {
  phase: UpdatePhase | "idle";
  progress: number;
  message: string;
}

const IDLE: UiState = { phase: "idle", progress: 0, message: "" };

interface InstallTarget {
  update: AppUpdate;
  path: string;
  expectedSha256: string | null;
}

export default function UpdateBanner() {
  const [appUpdate, setAppUpdate] = useState<AppUpdate | null>(null);
  const [ui, setUi] = useState<UiState>(IDLE);

  const phaseRef = useRef<UiState["phase"]>("idle");
  const installTargetRef = useRef<InstallTarget | null>(null);
  const cancelDownloadRef = useRef<(() => Promise<void>) | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    phaseRef.current = ui.phase;
  }, [ui.phase]);

  // Kick off the launch update check (once).
  useEffect(() => {
    let cancelled = false;
    void checkForAppUpdate().then((upd) => {
      if (!cancelled) setAppUpdate(upd);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startInstall = () => {
    const target = installTargetRef.current;
    if (!target || inFlightRef.current) return;

    if (!appInstallerAvailable) {
      // No native installer (Expo Go / iOS) — keep the browser fallback.
      void Linking.openURL(target.update.downloadUrl);
      setUi(IDLE);
      return;
    }

    if (!appInstaller.canInstall()) {
      setUi({ phase: "needsPermission", progress: 100, message: "Install permission needed" });
      appInstaller.requestInstallPermission();
      return;
    }

    inFlightRef.current = true;
    setUi({ phase: "installing", progress: 100, message: "Installing update…" });
    void appInstaller
      .install(target.path, target.expectedSha256 ?? undefined)
      .catch(() => {
        // Failures surface via the onInstallError event; nothing to do here.
      });
  };

  // Native installer events + AppState resume after the consent settings screen.
  useEffect(() => {
    if (!appInstallerAvailable) return;
    const offs = [
      appInstaller.onPermissionRequired(() => {
        setUi({ phase: "needsPermission", progress: 100, message: "Install permission needed" });
        appInstaller.requestInstallPermission();
      }),
      appInstaller.onProgress((p) =>
        setUi((s) => (s.phase === "installing" ? { ...s, progress: p } : s)),
      ),
      appInstaller.onFinished(() =>
        setUi({ phase: "done", progress: 100, message: "Installed — restarting…" }),
      ),
      appInstaller.onError((err) =>
        setUi({ phase: "error", progress: 0, message: err.message || "Install failed" }),
      ),
    ];
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (phaseRef.current === "needsPermission" && appInstaller.canInstall()) {
        setUi({ phase: "ready", progress: 100, message: "Ready to install" });
      }
    });
    return () => {
      offs.forEach((off) => off());
      appStateSub.remove();
    };
  }, []);

  const dismissUpdate = (upd: AppUpdate) => {
    setAppUpdate(null);
    void markAppUpdateOffered(upd);
  };

  const startDownload = async (upd: AppUpdate) => {
    setAppUpdate(null);
    setUi({ phase: "downloading", progress: 0, message: "Downloading update…" });

    const expectedSha256 = upd.sha256Url ? await fetchExpectedSha256(upd.sha256Url) : null;

    let download: ReturnType<typeof startAppUpdateDownload>;
    try {
      download = startAppUpdateDownload(upd, (p) =>
        setUi((s) => (s.phase === "downloading" ? { ...s, progress: p } : s)),
      );
    } catch {
      setUi({ phase: "error", progress: 0, message: "Could not start download" });
      return;
    }
    cancelDownloadRef.current = download.cancel;

    try {
      const path = await download.complete;
      installTargetRef.current = { update: upd, path, expectedSha256 };
      setUi({ phase: "ready", progress: 100, message: "Ready to install" });
    } catch {
      // Cancelled via FAB or network failure.
      void markAppUpdateOffered(upd);
      setUi(IDLE);
    }
  };

  const onFabPress = () => {
    switch (ui.phase) {
      case "downloading": {
        void (cancelDownloadRef.current?.() ?? Promise.resolve());
        cancelDownloadRef.current = null;
        installTargetRef.current = null;
        setUi(IDLE);
        break;
      }
      case "ready":
      case "needsPermission":
        startInstall();
        break;
      case "error":
      case "done":
        installTargetRef.current = null;
        inFlightRef.current = false;
        setUi(IDLE);
        break;
    }
  };

  return (
    <>
      <Modal
        visible={appUpdate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (appUpdate) dismissUpdate(appUpdate);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Update available</Text>
            <Text style={styles.body}>
              SIMBridge {appUpdate?.tagName} is out. Download and install it
              right here — your data is kept.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Download"
                onPress={() => {
                  const upd = appUpdate;
                  if (upd) void startDownload(upd);
                }}
              />
              <Button
                label="Later"
                variant="ghost"
                onPress={() => {
                  if (appUpdate) dismissUpdate(appUpdate);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {ui.phase !== "idle" && (
        <UpdateProgressFab phase={ui.phase} progress={ui.progress} onPress={onFabPress} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    width: "100%",
    maxWidth: 380,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});