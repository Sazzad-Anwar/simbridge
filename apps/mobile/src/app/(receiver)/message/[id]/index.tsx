/**
 * Receiver — Message Detail: decrypt locally, view / copy content,
 * one-tap OTP copy.
 */
import React, { useEffect, useState } from "react";
import { Alert, Clipboard as RNClipboard, ScrollView, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Badge, Button, Card, Muted, Row, Screen, Spinner, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useMessageStore } from "@/stores/message-store";

export default function MessageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useMessageStore((s) => s.inbox.find((m) => m.messageId === id));
  const decryptEntry = useMessageStore((s) => s.decryptEntry);
  const [text, setText] = useState<string | null>(entry?.decrypted ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (entry && !text) {
      void decryptEntry(entry).then(setText);
    }
  }, [entry, text, decryptEntry]);

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
    RNClipboard.setString(value);
    setCopied(true);
    Alert.alert("Copied", `${what} copied to clipboard.`);
    setTimeout(() => setCopied(false), 1500);
  };

  const otpMatch = text?.match(/\b(\d{4,8})\b/);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Title>Message</Title>
          <StatusPill status={entry.status} />
        </Row>
        {text ? (
          <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>{text}</Text>
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
  );
}
