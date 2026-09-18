import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Button, Card, Muted, Row, Screen, Spinner, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { parseQrPayload } from "@/lib/qr";
import { useScanStore } from "@/lib/scan-store";

export default function SenderScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const setReceiverDeviceId = useScanStore((s) => s.setReceiverDeviceId);

  if (!permission) return <Screen><Spinner /></Screen>;

  if (!permission.granted) {
    return (
      <Screen>
        <Card>
          <Title>Camera access needed</Title>
          <Muted>Allow camera access to scan the receiver device QR code.</Muted>
          <Button label="Grant camera access" onPress={() => void requestPermission()} />
        </Card>
      </Screen>
    );
  }

  const onScan = ({ data }: { data: string }) => {
    if (handled) return;
    const payload = parseQrPayload(data);
    if (payload.kind === "device") {
      setHandled(true);
      setReceiverDeviceId(payload.deviceId);
      Alert.alert("Receiver found", payload.deviceId, [
        { text: "Use this device", onPress: () => router.back() },
      ]);
      return;
    }
    setHandled(true);
    Alert.alert(
      payload.kind === "pairing" ? "Pairing code scanned" : "Unsupported QR",
      payload.kind === "pairing"
        ? `Code ${payload.code}. Create the request from the Pairing tab.`
        : "This is not a SIMBridge device QR code.",
      [{ text: "OK", onPress: () => setHandled(false) }],
    );
  };

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handled ? undefined : onScan}
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