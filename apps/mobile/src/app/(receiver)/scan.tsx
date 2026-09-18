import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Button, Card, Muted, Row, Screen, Spinner, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { parseQrPayload } from "@/lib/qr";
import { useDeviceStore } from "@/stores/device-store";
import { api } from "@/lib/api";

export default function ReceiverScan() {
  const router = useRouter();
  const refreshPairs = useDeviceStore((s) => s.refreshPairs);
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  if (!permission) return <Screen><Spinner /></Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <Card>
          <Title>Camera access needed</Title>
          <Muted>Allow camera access to scan the sender pairing QR code.</Muted>
          <Button label="Grant camera access" onPress={() => void requestPermission()} />
        </Card>
      </Screen>
    );
  }

  const onScan = async ({ data }: { data: string }) => {
    if (handled || busy) return;
    setHandled(true);
    const payload = parseQrPayload(data);

    if (payload.kind !== "pairing") {
      Alert.alert(
        payload.kind === "device" ? "Sender device found" : "Unsupported QR",
        payload.kind === "device"
          ? `Sender ${payload.deviceId}. Ask them to show their pairing QR code.`
          : "This is not a SIMBridge pairing QR code.",
        [{ text: "OK", onPress: () => setHandled(false) }],
      );
      return;
    }

    setBusy(true);
    try {
      await api.acceptPair(payload.code);
      await refreshPairs();
      Alert.alert("Paired", "You are now receiving this sender's SMS.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Pairing failed", String(err), [
        { text: "OK", onPress: () => setHandled(false) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handled ? undefined : (e) => void onScan(e)}
      />
      <View pointerEvents="none" style={styles.finder}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
      </View>
      <View style={styles.footer}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Button label={torchOn ? "Torch off" : "Flashlight"} variant="ghost" onPress={() => setTorchOn((v) => !v)} />
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          </Row>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  finder: {
    position: "absolute",
    top: Platform.OS === "android" ? "28%" : "36%",
    left: "50%",
    width: 260,
    height: 260,
    marginLeft: -130,
  },
  corner: {
    position: "absolute",
    width: 44,
    height: 44,
    borderColor: colors.accentSoft,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  footer: { position: "absolute", left: 16, right: 16, bottom: 32 },
});