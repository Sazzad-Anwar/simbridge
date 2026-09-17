/**
 * Sender — SIM & Routing (multi-SIM): list SIM subscriptions from the native
 * SubscriptionManager, push them to the backend registry, pick a default SIM.
 */
import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Card, Empty, Muted, Row, Screen, Title } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useDeviceStore } from "@/stores/device-store";
import { storage } from "@/lib/storage";
import { smsBridge, smsBridgeAvailable } from "@/native/sms-bridge";
import type { SimInfo } from "@simbridge/shared";

export default function SimsScreen() {
  const sims = useDeviceStore((s) => s.sims);
  const refreshSims = useDeviceStore((s) => s.refreshSims);
  const [routing, setRouting] = useState<Record<string, number>>({});
  const [defaultSim, setDefaultSim] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await refreshSims();
    const r = await storage.getRouting();
    setRouting(r);
    setDefaultSim(r["__default"] ?? null);
  }, [refreshSims]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickDefault = (sim: SimInfo) => {
    const next = defaultSim === sim.subscriptionId ? null : sim.subscriptionId;
    setDefaultSim(next);
    void storage.setRouting({ ...routing, __default: next ?? -1 });
  };

  const resync = async () => {
    setBusy(true);
    try {
      const nativeSims = await smsBridge.listSims();
      await refreshSims(nativeSims);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Row>
          <Title>Active SIM subscriptions</Title>
        </Row>
        <Muted>
          {smsBridgeAvailable
            ? "Read from the Android SubscriptionManager. Changes are pushed to the backend registry automatically."
            : "Native SIM access requires a development build (expo run:android). Expo Go shows cached data only."}
        </Muted>
        <Button label="Resync SIMs" variant="ghost" onPress={() => void resync()} busy={busy} />
      </Card>

      {sims.length === 0 ? (
        <Empty icon="💳" text="No SIMs registered yet. Resync or grant phone-state permissions in a dev build." />
      ) : (
        sims.map((sim) => (
          <Pressable key={sim.subscriptionId} onPress={() => pickDefault(sim)}>
            <Card
              style={{
                borderColor: defaultSim === sim.subscriptionId ? colors.accent : colors.border,
                borderWidth: defaultSim === sim.subscriptionId ? 2 : 1,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Row>
                  <View
                    style={{
                      width: 34,
                      height: 24,
                      borderRadius: 5,
                      backgroundColor: sim.isActive ? colors.accent : colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TextDefault>{sim.slotIndex + 1}</TextDefault>
                  </View>
                  <View>
                    <Title style={{ fontSize: 15 }}>{sim.displayName || sim.carrierName}</Title>
                    <Muted>
                      {sim.carrierName} · slot {sim.slotIndex} · id {sim.subscriptionId}
                    </Muted>
                  </View>
                </Row>
                {defaultSim === sim.subscriptionId ? (
                  <Muted style={{ color: colors.accentSoft }}>DEFAULT</Muted>
                ) : null}
              </Row>
              {sim.phoneNumber ? <Muted style={{ fontSize: 11 }}>{sim.phoneNumber}</Muted> : null}
            </Card>
          </Pressable>
        ))
      )}

      <Card>
        <Title style={{ fontSize: 14 }}>Routing rule</Title>
        <Muted>
          Incoming SMS are forwarded through the paired receiver regardless of
          which SIM received them. The DEFAULT pick above only controls which
          subscription id is attached as routing metadata when both could apply.
        </Muted>
      </Card>
    </ScrollView>
  );
}

function TextDefault({ children }: { children: ReactNode }) {
  return <Muted style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{children}</Muted>;
}
