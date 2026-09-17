/**
 * Sender — Message Logs & Status: local outbox with PENDING / SENT /
 * DELIVERED states, mirroring the offline-to-online recovery flow.
 */
import React, { useEffect } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Button, Card, Empty, Muted, Row, Screen, StatusPill, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useMessageStore } from "@/stores/message-store";
import type { OutboxEntry } from "@/lib/storage";

export default function LogsScreen() {
  const outbox = useMessageStore((s) => s.outbox);
  const flushOutbox = useMessageStore((s) => s.flushOutbox);
  const syncAll = useMessageStore((s) => s.syncAll);

  useEffect(() => {
    void syncAll();
  }, [syncAll]);

  const pending = outbox.filter((e) => e.status === "pending" || e.status === "failed").length;

  return (
    <Screen>
      <FlatList<OutboxEntry>
        data={outbox}
        keyExtractor={(e) => e.clientMsgId}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void Promise.all([flushOutbox(), syncAll()])}
            tintColor={colors.accentSoft}
          />
        }
        ListHeaderComponent={
          <Card style={{ marginBottom: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Title>Outbox</Title>
                <Muted>
                  Messages are encrypted before leaving the device. PENDING items
                  retry automatically when connectivity returns.
                </Muted>
              </View>
              {pending > 0 ? (
                <Button label={`Retry ${pending}`} variant="ghost" onPress={() => void flushOutbox()} />
              ) : null}
            </Row>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Title style={{ fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
                {item.smsBody}
              </Title>
              <StatusPill status={item.status} />
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Muted style={{ fontSize: 11 }}>
                {item.sim?.displayName ?? "SIM"} → {item.receiverNumber}
              </Muted>
              <Muted style={{ fontSize: 11 }}>{new Date(item.createdAt).toLocaleTimeString()}</Muted>
            </Row>
            {item.error ? <Muted style={{ fontSize: 11, color: colors.red }}>{item.error}</Muted> : null}
          </Card>
        )}
        ListEmptyComponent={
          <Empty icon="📋" text="No messages yet. Forwarded SMS will appear here with their delivery status." />
        }
      />
    </Screen>
  );
}
