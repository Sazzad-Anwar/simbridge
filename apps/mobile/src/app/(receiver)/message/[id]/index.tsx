/**
 * Receiver — Message Detail: decrypt locally, view / copy content,
 * one-tap OTP copy.
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Tabs, useLocalSearchParams } from "expo-router";
import { Badge, Button, Card, Muted, Row, Screen, Spinner, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useMessageStore } from "@/stores/message-store";

export default function MessageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useMessageStore((s) => s.inbox.find((m) => m.messageId === id));
  const decryptEntry = useMessageStore((s) => s.decryptEntry);
  const clearDecryptError = useMessageStore((s) => s.clearDecryptError);
  const [copied, setCopied] = useState(false);
  const text = entry?.decrypted;

  useEffect(() => {
    if (entry && entry.decrypted === undefined && !entry.decryptError) {
      void decryptEntry(entry);
    }
  }, [entry, decryptEntry]);

  const retry = () => {
    if (entry) clearDecryptError(entry.messageId);
  };

  if (!entry) {
    return (
      <Screen>
        <Card>
          <Muted>Message not found in the local cache.</Muted>
        </Card>
      </Screen>
    );
  }

  const copy = (value: string, what: string) => {
    void Clipboard.setStringAsync(value);
    setCopied(true);
    Alert.alert("Copied", `${what} copied to clipboard.`);
    setTimeout(() => setCopied(false), 1500);
  };

  const senderName = entry.fromName ?? entry.from;
  const isSenderId = !!entry.from && /[a-zA-Z]/.test(entry.from);
  const otpMatch = text?.match(/\b(\d{4,8})\b/);

  return (
    <>
      <Tabs.Screen options={{ title: senderName ?? "Message" }} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Title numberOfLines={1} style={{ flexShrink: 1 }}>
              {senderName ?? "Message"}
            </Title>
            <StatusPill status={entry.status} />
          </Row>
          {entry.from && entry.from !== senderName ? (
            <Muted style={{ fontSize: 13 }}>{entry.from}</Muted>
          ) : null}
          {text ? (
          <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>{text}</Text>
        ) : entry.decryptError ? (
          <Card style={{ borderColor: colors.red, gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: "600" }}>
              {entry.decryptError === "no-key"
                ? "No decryption key on this device"
                : entry.decryptError === "unverified"
                  ? "Sender not verified yet"
                  : "Couldn't decrypt this message"}
            </Text>
            <Muted style={{ fontSize: 13 }}>
              {entry.decryptError === "no-key"
                ? "This device has no private key stored, so the message can't be decrypted locally. Finish setup and try again."
                : entry.decryptError === "unverified"
                  ? "This message arrived as a signed envelope, but you haven't verified the sender's fingerprint yet. Open Pairing, compare the sender's fingerprint (shown on their device), and confirm it — the message will then be decrypted against that verified identity."
                  : "The message was encrypted with a key this device no longer has (for example, it was sent before this account last re-registered its key). Retry after the paired sender refreshes may help."}
            </Muted>
            <Button label="Retry decrypt" onPress={retry} />
          </Card>
        ) : (
          <Spinner />
        )}
        <Row style={{ flexWrap: "wrap" }}>
          {otpMatch ? (
            <Button label={`Copy OTP ${otpMatch[1]}`} onPress={() => copy(otpMatch[1], "OTP")} />
          ) : null}
          <Button
            label={copied ? "Copied ✓" : "Copy content"}
            variant="ghost"
            onPress={() => text && copy(text, "Content")}
          />
        </Row>
      </Card>

      <Card>
        <Title style={{ fontSize: 14 }}>Metadata</Title>
        <Muted>Message ID: {entry.messageId}</Muted>
        <Muted>Received: {new Date(entry.createdAt).toLocaleString()}</Muted>
        {entry.deliveredAt ? <Muted>Delivered: {new Date(entry.deliveredAt).toLocaleString()}</Muted> : null}
        <Row style={{ flexWrap: "wrap" }}>
          {entry.sim?.displayName ? <Badge label={entry.sim.displayName} /> : null}
          {entry.sim?.carrierName ? <Badge label={entry.sim.carrierName} tone="green" /> : null}
          {isSenderId ? <Badge label="Sender ID" tone="yellow" /> : null}
          <Badge label={`seq ${entry.seq}`} />
        </Row>
      </Card>

      <Card>
        <Title style={{ fontSize: 14 }}>Security</Title>
        <Muted style={{ fontSize: 12 }}>
          This message was encrypted by the sender with YOUR public key
          (X25519 + XSalsa20-Poly1305) and decrypted locally with the private key
          stored in the Keystore on this device. The backend only ever handled ciphertext.
        </Muted>
      </Card>
    </ScrollView>
    </>
  );
}
