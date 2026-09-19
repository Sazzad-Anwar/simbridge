/**
 * Onboarding — initial setup: the device's phone number (its unique device
 * name), then generate the identity key pair and continue to role selection
 * (step 1 & 2 of the flow).
 *
 * The server URL is FIXED — auto-resolved from the Expo dev host (or
 * EXPO_PUBLIC_API_URL), see src/lib/api.ts. No user input needed.
 */
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Button, Card, Input, Muted, Row, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { api, getServerUrl } from "@/lib/api";
import { storage } from "@/lib/storage";
import { isValidPhoneNumber, normalizePhoneNumber } from "@simbridge/shared";

export default function Onboarding() {
  const registered = useDeviceStore((s) => s.registered);
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (registered) return <Redirect href="/role" />;

  const proceed = async () => {
    setBusy(true);
    setError(null);
    try {
      const phone = normalizePhoneNumber(name);
      if (!isValidPhoneNumber(phone)) {
        setError("Enter a valid phone number (e.g. +15551234567)");
        return;
      }
      await api.health(); // fail fast if the backend is unreachable (8s timeout)
      // Temporarily stash the profile so /role can read the phone number.
      const profile = { name: phone, role: "sender" as const };
      useDeviceStore.setState({ profile });
      await storage.setProfile(profile);
      await useDeviceStore.getState().hydrate();
      useDeviceStore.setState({ registered: false }); // still not registered
      // Move on to role selection — the health check passed, so proceed.
      router.replace("/role");
    } catch (err) {
      setError(`Could not reach the server (${getServerUrl()}): ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen style={{ justifyContent: "center", gap: 18 }}>
      <Row>
        <Image source={require("../../assets/images/logo.png")} style={styles.logo} />
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
          <Muted style={{ marginBottom: 6 }}>Server (auto-detected)</Muted>
          <Muted style={{ color: colors.accentSoft, fontWeight: "600" }}>{getServerUrl()}</Muted>
        </View>
        <View>
          <Muted style={{ marginBottom: 6 }}>Phone number (device name)</Muted>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="+1 555 123 4567"
            keyboardType="phone-pad"
            autoCorrect={false}
            autoCapitalize="none"
            textContentType="telephoneNumber"
          />
        </View>
        {error ? <Muted style={{ color: colors.red }}>{error}</Muted> : null}
        <Button label="Continue" onPress={() => void proceed()} busy={busy} />
        <Muted style={{ fontSize: 11 }}>
          Phone and computer running the backend must be on the same Wi-Fi
          network. Set EXPO_PUBLIC_API_URL to override.
        </Muted>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
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
