/**
 * Receiver — Settings & Security: identity, encryption keys status, retention.
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Badge, Button, Card, Muted, Row, Title } from "@/components/ui";
import { DeviceIdentity } from "@/components/DeviceIdentity";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { getServerUrl } from "@/lib/api";
import { secrets } from "@/lib/storage";
// Polyfill before @simbridge/crypto (tweetnacl captures its PRNG at module load).
import "@/lib/random-polyfill";
import { publicKeyFromSecret } from "@simbridge/crypto";

export default function ReceiverSettings() {
  const device = useDeviceStore((s) => s.device);
  const connection = useDeviceStore((s) => s.connection);
  const reset = useDeviceStore((s) => s.reset);
  const [keyOk, setKeyOk] = useState<boolean | null>(null);
  const [deviceId, setDeviceId] = useState<string>("…");

  useEffect(() => {
    void (async () => {
      const [secret, pub] = await Promise.all([secrets.get("secretKey"), secrets.get("publicKey")]);
      if (!secret || !pub) {
        setKeyOk(false);
        return;
      }
      try {
        setKeyOk(publicKeyFromSecret(secret) === pub);
      } catch {
        setKeyOk(false);
      }
    })();
  }, []);

  useEffect(() => {
    void secrets.get("deviceId").then((id) => setDeviceId(id ?? "unknown"));
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Title>Connection</Title>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge label={connection.toUpperCase()} tone={connection === "online" ? "green" : "yellow"} />
        </Row>
        <Muted>Server: {getServerUrl()}</Muted>
        <Muted>Device: {device?.name ?? "unknown"}</Muted>
      </Card>

      <DeviceIdentity deviceId={deviceId} deviceName={device?.name} title="Device identity" />

      <Card>
        <Title>Encryption keys</Title>
        <Row style={{ flexWrap: "wrap" }}>
          <Badge
            label={keyOk === null ? "Checking…" : keyOk ? "Key pair verified" : "Key pair missing/invalid"}
            tone={keyOk ? "green" : "red"}
          />
          <Badge label="Keystore (SecureStore)" />
        </Row>
        <Muted style={{ fontSize: 12 }}>
          Messages can only be decrypted on this device. The private key never
          leaves the Keystore; the backend stores ciphertext exclusively.
        </Muted>
      </Card>

      <Card>
        <Title>Sync behaviour</Title>
        <Muted style={{ fontSize: 12 }}>
          On app start and on every reconnect, missed messages are fetched from
          the backend using your last-synced sequence cursor, decrypted locally
          and acknowledged. Nothing is lost when you are offline.
        </Muted>
      </Card>

      <Card style={{ borderColor: "#3A1E23" }}>
        <Title style={{ fontSize: 14, color: colors.red }}>Danger zone</Title>
        <Muted>Wipes keys, inbox cache and pairing state on this device.</Muted>
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
