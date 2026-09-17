/**
 * Onboarding — initial setup: server URL + device name, then generate the
 * identity key pair and continue to role selection (step 1 & 2 of the flow).
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Button, Card, Input, Muted, Row, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { api, initServerUrl } from "@/lib/api";

export default function Onboarding() {
  const registered = useDeviceStore((s) => s.registered);
  const [serverUrl, setServerUrl] = useState("http://10.0.2.2:3000");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (registered) return <Redirect href="/role" />;

  const proceed = async () => {
    setBusy(true);
    setError(null);
    try {
      initServerUrl(serverUrl.trim());
      await api.health(); // fail fast if the server URL is wrong
      useDeviceStore.setState({ profile: { name: name.trim() || "My device", role: "sender", serverUrl: serverUrl.trim() } });
      // Temporarily stash the profile so /role can read the server URL + name.
      await (await import("@/lib/storage")).storage.setProfile({
        name: name.trim() || "My device",
        role: "sender",
        serverUrl: serverUrl.trim(),
      });
      await useDeviceStore.getState().hydrate();
      useDeviceStore.setState({ registered: false }); // still not registered
    } catch (err) {
      setError(`Could not reach the server: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ justifyContent: "center", gap: 18 }}>
      <Row>
        <View style={styles.logo}>
          <Text style={{ fontSize: 26 }}>🔗</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>SIMBridge</Text>
          <Muted>Your SIM. Your messages. Anywhere.</Muted>
        </View>
      </Row>

      <Card style={{ gap: 14 }}>
        <Title>Initial setup</Title>
        <Muted>
          Connect to your SIMBridge backend. Messages are end-to-end encrypted on
          this device — the server only relays ciphertext.
        </Muted>
        <View>
          <Muted style={{ marginBottom: 6 }}>Server URL</Muted>
          <Input
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.20:3000"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View>
          <Muted style={{ marginBottom: 6 }}>Device name</Muted>
          <Input value={name} onChangeText={setName} placeholder="e.g. My old phone" />
        </View>
        {error ? <Muted style={{ color: colors.red }}>{error}</Muted> : null}
        <Button label="Continue" onPress={() => void proceed()} busy={busy} />
        <Pressable onPress={() => setServerUrl("http://10.0.2.2:3000")}>
          <Muted style={{ fontSize: 11 }}>Android emulator? 10.0.2.2 maps to your host machine.</Muted>
        </Pressable>
      </Card>

      <Card>
        <Row style={{ flexWrap: "wrap", gap: 6 }}>
          {["End-to-End Encrypted", "Runs in Background", "Offline Resilient", "Private & Secure"].map((b) => (
            <View key={b} style={styles.chip}>
              <Text style={{ color: colors.accentSoft, fontSize: 11 }}>✓ {b}</Text>
            </View>
          ))}
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#2A2244",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  chip: {
    backgroundColor: "#1B1B30",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
