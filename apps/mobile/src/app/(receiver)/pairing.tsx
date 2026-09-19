import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { Button, Card, Empty, Input, Muted, Row, Screen, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { api } from "@/lib/api";

export default function ReceiverPairing() {
  const pairs = useDeviceStore((s) => s.pairs);
  const refreshPairs = useDeviceStore((s) => s.refreshPairs);
  const visiblePairs = pairs.filter((p) => p.status !== "revoked");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const accept = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.acceptPair(trimmed);
      setCode("");
      await refreshPairs();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, [code, busy, refreshPairs]);

  const acceptRef = useRef(accept);
  useEffect(() => {
    acceptRef.current = accept;
  });

  useEffect(() => {
    if (code.length === 6) void acceptRef.current();
  }, [code]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <FlatList
          data={visiblePairs}
          keyExtractor={(p) => p.pairId}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void refreshPairs().finally(() => setRefreshing(false));
              }}
              tintColor={colors.accentSoft}
            />
          }
          ListHeaderComponent={
            <Card style={{ marginBottom: 6 }}>
              <Title>Accept a pairing request</Title>
              <Muted>
                Ask the sender for the 6-digit code shown in their Pairing tab.
                Requests arrive here instantly if the sender created them while
                you are online.
              </Muted>
              <Input
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                accessibilityLabel="Pairing code"
                style={{ letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: "700" }}
              />
              {error ? <Muted style={{ color: colors.red, fontSize: 12 }}>{error}</Muted> : null}
              <Button label="Accept pairing" onPress={() => void accept()} busy={busy} disabled={code.length < 4} />
              {code.length === 6 && !busy ? (
                <Muted style={{ fontSize: 11 }}>Code complete — pairing automatically…</Muted>
              ) : null}
            </Card>
          }
          renderItem={({ item }) => (
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Title style={{ fontSize: 15 }}>
                  {item.senderName ?? item.senderDeviceId}
                </Title>
                <StatusPill status={item.status} />
              </Row>
              <Muted>
                {item.status === "active"
                  ? "Receiving this sender's SMS, encrypted end-to-end."
                  : item.status === "pending"
                    ? "Waiting for you to accept — enter the code above."
                    : "Revoked."}
              </Muted>
              <Muted style={{ fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Muted>
            </Card>
          )}
          ListEmptyComponent={
            <Empty icon="🤝" text="No pairs yet. Enter the code from your sender device to pair." />
          }
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
