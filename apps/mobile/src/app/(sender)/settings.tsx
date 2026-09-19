/**
 * Sender — Settings & Diagnostics: server info, permissions, foreground
 * service control, device identity, danger zone.
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Badge, Button, Card, Muted, Row, Title } from "@/components/ui";
import { DeviceIdentity } from "@/components/DeviceIdentity";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { useMessageStore } from "@/stores/message-store";
import { smsBridge, smsBridgeAvailable } from "@/native/sms-bridge";
import { getServerUrl } from "@/lib/api";
import { secrets } from "@/lib/storage";

export default function SenderSettings() {
  const device = useDeviceStore((s) => s.device);
  const connection = useDeviceStore((s) => s.connection);
  const reset = useDeviceStore((s) => s.reset);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [permissions, setPermissions] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("…");

  useEffect(() => {
    let active = true;
    void (async () => {
      const id = await secrets.get("deviceId");
      if (!active) return;
      setServiceRunning(smsBridge.isServiceRunning());
      setPermissions(smsBridge.hasSmsPermissions());
      setDeviceId(id ?? "unknown");
    })();
    return () => {
      active = false;
    };
  }, []);

  const grantPermissions = async () => {
    setPermBusy(true);
    try {
      const ok = await smsBridge.requestSmsPermissions();
      setPermissions(ok);
      if (ok) {
        await smsBridge.startService().catch(() => undefined);
        setServiceRunning(true);
        await useDeviceStore.getState().refreshPairs().catch(() => undefined);
        await useMessageStore.getState().drainNativeOutbox().catch(() => undefined);
        await useMessageStore.getState().reconcileInbox().catch(() => undefined);
        Alert.alert("Permissions granted", "SMS relay is now active on this device.");
      } else {
        Alert.alert("Permissions required", "SMS/phone permissions are needed to detect and relay SMS.");
      }
    } finally {
      setPermBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Title>Connection</Title>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge label={connection.toUpperCase()} tone={connection === "online" ? "green" : "yellow"} />
          <Badge label={`v${device?.platform ?? "android"}`} />
        </Row>
        <Muted>Server: {getServerUrl()}</Muted>
      </Card>

      <DeviceIdentity deviceId={deviceId} deviceName={device?.name} title="Device identity" />

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
          {!permissions ? (
            <Button label="Grant SMS permissions" onPress={() => void grantPermissions()} busy={permBusy} />
          ) : null}
          {!serviceRunning && permissions ? (
            <Button label="Start service" onPress={() => void smsBridge.startService().then(() => setServiceRunning(true))} />
          ) : serviceRunning && permissions ? (
            <Button label="Stop service" variant="danger" onPress={() => void smsBridge.stopService().then(() => setServiceRunning(false))} />
          ) : null}
        </Row>
        {!smsBridgeAvailable ? (
          <Muted style={{ color: colors.yellow, fontSize: 11 }}>
            Native module unavailable in Expo Go — build with `expo run:android`.
          </Muted>
        ) : null}
      </Card>

      <Card>
        <Title>Background relay on MIUI</Title>
        <Muted>
          Xiaomi can stop the background service after the app is swiped from
          recents and drop incoming SMS broadcasts entirely. For reliable relay,
          enable Autostart and remove the battery restriction:
        </Muted>
        <Muted style={{ fontSize: 12 }}>
          Settings → Apps → Manage apps → SIMBridge → Autostart ON, and add it to
          Settings → Battery → No restrictions.
        </Muted>
        <Muted style={{ fontSize: 11, color: colors.yellow }}>
          Note: messages missed while the app was not running are recovered from
          the SMS inbox on the next open or Resync, so nothing is lost.
        </Muted>
      </Card>

      <Card>
        <Title>Privacy</Title>
        <Muted>
          Your identity keys live in the device Keystore (SecureStore). Outgoing
          SMS are encrypted with the receiver public key before leaving this
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
