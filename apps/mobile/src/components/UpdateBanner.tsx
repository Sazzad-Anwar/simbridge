/**
 * Modal shown on launch when a newer SIMBridge APK is available on GitHub.
 */
import React, { useEffect, useState } from "react";
import { Linking, Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import { checkForAppUpdate, type AppUpdate } from "@/lib/update";

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

  return (
    <Modal
      visible={appUpdate !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setAppUpdate(null)}
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
                setAppUpdate(null);
                if (url) void Linking.openURL(url);
              }}
            />
            <Button label="Later" variant="ghost" onPress={() => setAppUpdate(null)} />
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