/**
 * Modal shown on launch when a newer SIMBridge APK is available on GitHub.
 * Offers each release once per installed build: dismissing it (Later, Download,
 * or back) persists the offer so it does not nag again on every launch.
 */
import React, { useEffect, useState } from "react";
import { Linking, Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  checkForAppUpdate,
  markAppUpdateOffered,
  type AppUpdate,
} from "@/lib/update";

export default function UpdateBanner() {
  const [appUpdate, setAppUpdate] = useState<AppUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkForAppUpdate().then((upd) => {
      if (!cancelled) setAppUpdate(upd);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissUpdate = (upd: AppUpdate) => {
    setAppUpdate(null);
    void markAppUpdateOffered(upd);
  };

  return (
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
            SIMBridge {appUpdate?.tagName} is out. Download the APK and install
            it over this version to get the latest fixes and features — your
            data is kept.
          </Text>
          <View style={styles.actions}>
            <Button
              label="Download"
              onPress={() => {
                const url = appUpdate?.downloadUrl;
                if (appUpdate) dismissUpdate(appUpdate);
                if (url) void Linking.openURL(url);
              }}
            />
            <Button label="Later" variant="ghost" onPress={() => {
              if (appUpdate) dismissUpdate(appUpdate);
            }} />
          </View>
        </View>
      </View>
    </Modal>
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