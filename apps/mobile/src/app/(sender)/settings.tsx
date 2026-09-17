/**
 * Sender — Settings & Diagnostics: server info, permissions, foreground
 * service control, device identity, danger zone.
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Badge, Button, Card, Muted, Row, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { smsBridge, smsBridgeAvailable } from "@/native/sms-bridge";
import { secrets } from "@/lib/storage";

export default function SenderSettings() {
  const device = useDeviceStore((s) => s.device);
  const profile = useDeviceStore((s) => s.profile);
  const connection = useDeviceStore((s) => s.connection);
  const reset = useDeviceStore((s) => s.reset);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [permissions, setPermissions] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("…");

  useEffect(() => {
    setServiceRunning(smsBridge.isServiceRunning());
    setPermissions(smsBridge.hasSmsPermissions());
    void secrets.get("deviceId").then((id) => setDeviceId(id ?? "unknown"));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Title>Connection</Title>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge label={connection.toUpperCase()} tone={connection === "online" ? "green" : "yellow"} />
          <Badge label={`v${device?.platform ?? "android"}`} />
        </Row>
        <Muted>Server: {profile?.serverUrl}</Muted>
        <Muted>Device: {device?.name} ({deviceId})</Muted>
      </Card>

      <Card>
        <Title>Background service</Title>
        <Muted>
          The foreground service (remoteMessaging) keeps the SMS receiver alive so
          messages are detected even when the app is closed or the phone is locked.
        </Muted>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge label={serviceRunning ? "Service running" : "Service stopped"} tone={serviceRunning ? "green" : "yellow"} />
          <Badge label={permissions ? "SMS permissions granted" : "SMS permissions missing"} tone={permissions ? "green" : "red"} />
        </Row>
        <Row style={{ flexWrap: "wrap" }}>
          {!serviceRunning ? (
            <Button label="Start service" onPress={() => void smsBridge.startService().then(() => setServiceRunning(true))} />
          ) : (
            <Button label="Stop service" variant="danger" onPress={() => void smsBridge.stopService().then(() => setServiceRunning(false))} />
          )}
        </Row>
        {!smsBridgeAvailable ? (
          <Muted style={{ color: colors.yellow, fontSize: 11 }}>
            Native module unavailable in Expo Go — build with `expo run:android`.
          </Muted>
        ) : null}
      </Card>

      <Card>
        <Title>Privacy</Title>
        <Muted>
          Your identity keys live in the device Keystore (SecureStore). Outgoing
          SMS are encrypted with the receiver's public key before leaving this
          phone. The backend never sees plaintext.
        </Muted>
      </Card>

      <Card style={{ borderColor: "#3A1E23" }}>
        <Title style={{ fontSize: 14, color: colors.red }}>Danger zone</Title>
        <Muted>Wipes keys, outbox, message cache and pairing state on this device.</Muted>
        <Button
          label="Reset device"
          variant="danger"
          onPress={() =>
            Alert.alert("Reset device", "This cannot be undone. Continue?", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset", style: "destructive", onPress: () => void reset() },
            ])
          }
        />
      </Card>
    </ScrollView>
  );
}
