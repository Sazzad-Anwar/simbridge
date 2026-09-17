/**
 * Receiver — Pairing: accept incoming pairing requests by entering the
 * 6-digit code the sender shared (step 3 of the flow).
 */
import React, { useState } from "react";
import { FlatList, RefreshControl } from "react-native";
import { Button, Card, Empty, Input, Muted, Row, Screen, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { api } from "@/lib/api";

export default function ReceiverPairing() {
  const pairs = useDeviceStore((s) => s.pairs);
  const refreshPairs = useDeviceStore((s) => s.refreshPairs);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const accept = async () => {
    if (code.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await api.acceptPair(code.trim());
      setCode("");
      await refreshPairs();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <FlatList
        data={pairs}
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
              style={{ letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: "700" }}
            />
            {error ? <Muted style={{ color: colors.red, fontSize: 12 }}>{error}</Muted> : null}
            <Button label="Accept pairing" onPress={() => void accept()} busy={busy} disabled={code.length < 4} />
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
  );
}
