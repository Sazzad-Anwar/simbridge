/**
 * Sender — Pairing Management (step 3): create a pairing request, share the
 * 6-digit code, manage active pairs.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { Badge, Button, Card, Empty, Input, Muted, Row, Screen, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { api } from "@/lib/api";
import type { CreatePairResult, PairDTO } from "@simbridge/shared";

export default function SenderPairing() {
  const pairs = useDeviceStore((s) => s.pairs);
  const refreshPairs = useDeviceStore((s) => s.refreshPairs);
  const connection = useDeviceStore((s) => s.connection);
  const [receiverId, setReceiverId] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRequest, setLastRequest] = useState<CreatePairResult | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPairs();
    setRefreshing(false);
  }, [refreshPairs]);

  useEffect(() => {
    void refreshPairs();
  }, [refreshPairs]);

  const createPair = async () => {
    if (!receiverId.trim()) return;
    setBusy(true);
    try {
      const result = await api.createPair({ receiverDeviceId: receiverId.trim() });
      setLastRequest(result);
      setReceiverId("");
      await refreshPairs();
      Alert.alert(
        "Pairing requested",
        `Give this code to the receiver:\n\n${result.code}\n\nValid for 10 minutes.`,
      );
    } catch (err) {
      Alert.alert("Pairing failed", String(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = (pair: PairDTO) =>
    Alert.alert("Revoke pair", "The receiver will stop receiving messages from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () => void api.revokePair(pair.pairId).then(refreshPairs),
      },
    ]);

  return (
    <Screen>
      <FlatList
        data={pairs}
        keyExtractor={(p) => p.pairId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accentSoft} />}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 16 }}>
            <Card>
              <Row>
                <Title>New pairing</Title>
                <Badge label={connection === "online" ? "Connected" : connection} tone={connection === "online" ? "green" : "yellow"} />
              </Row>
              <Muted>
                Enter the Receiver deviceId shown on the other device, then share
                the 6-digit code with it.
              </Muted>
              <Input
                value={receiverId}
                onChangeText={setReceiverId}
                placeholder="dev_xxxxxxxxxxxx"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label="Send pairing request" onPress={() => void createPair()} busy={busy} />
            </Card>

            {lastRequest?.code ? (
              <Card style={{ alignItems: "center" }}>
                <Muted>Pairing code</Muted>
                <Title style={{ fontSize: 40, letterSpacing: 8, color: colors.accentSoft }}>
                  {lastRequest.code}
                </Title>
                <Muted style={{ fontSize: 11 }}>
                  Receiver opens SIMBridge → Pairing → enter code. Expires in 10 min.
                </Muted>
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const other = item.senderDeviceId === useDeviceStore.getState().device?.deviceId ? item.receiverName ?? item.receiverDeviceId : item.senderName ?? item.senderDeviceId;
          return (
            <Card style={{ marginBottom: 10 }}>
              <Row>
                <Title style={{ fontSize: 15 }}>{other}</Title>
                <StatusPill status={item.status} />
              </Row>
              {item.status === "active" ? (
                <Muted>Paired · messages relay end-to-end encrypted</Muted>
              ) : (
                <Muted>Waiting for the receiver to accept the code</Muted>
              )}
              <Row style={{ justifyContent: "space-between" }}>
                <Muted style={{ fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Muted>
                <Button label="Revoke" variant="danger" onPress={() => revoke(item)} />
              </Row>
            </Card>
          );
        }}
        ListEmptyComponent={
          <Empty icon="🔗" text="No pairs yet. Create a pairing request and enter the code on your receiver device." />
        }
      />
    </Screen>
  );
}
