/**
 * Root layout: hydration, notifications, realtime wiring, sender SMS pipeline.
 */
// App-wide safety net: randomness polyfill for tweetnacl — must run before any
// module that pulls in @simbridge/crypto (stores, screens) is evaluated.
import "../lib/random-polyfill";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useDeviceStore } from "@/stores/device-store";
import { useMessageStore } from "@/stores/message-store";
import { initNotifications } from "@/lib/notifications";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  const hydrate = useDeviceStore((s) => s.hydrate);
  const registered = useDeviceStore((s) => s.registered);
  const role = useDeviceStore((s) => s.profile?.role);

  useEffect(() => {
    void hydrate();
    void initNotifications();
  }, [hydrate]);

  // Realtime wiring once the device is registered.
  useEffect(() => {
    if (!registered) return;
    const messages = useMessageStore.getState();
    void messages.loadLocal();
    void messages.wireRealtime().catch(() => undefined);
    const timer = setInterval(() => {
      // Safety net: periodic flush + sync (also covers missed connectivity events).
      void useMessageStore.getState().flushOutbox();
      void useMessageStore.getState().syncAll();
    }, 30_000);
    return () => {
      clearInterval(timer);
      useMessageStore.getState().unwrapRealtime();
    };
  }, [registered]);

  // Sender: native SMS pipeline — detect SMS in background, encrypt, forward.
  useEffect(() => {
    if (!registered || role !== "sender") return;
    let unsub: (() => void) | undefined;
    void (async () => {
      const { smsBridge } = await import("@/native/sms-bridge");
      const device = useDeviceStore.getState();
      await device.refreshSims().catch(() => undefined);
      await smsBridge.startService().catch(() => undefined);

      unsub = smsBridge.onSmsReceived((sms) => {
        void (async () => {
          const { pairs } = useDeviceStore.getState();
          const active = pairs.find((p) => p.status === "active" && p.receiverPublicKey);
          if (!active?.receiverPublicKey) return; // no paired receiver yet -> drop silently
          const routing = (await import("@/lib/storage")).storage;
          const routes = await routing.getRouting();
          const sim =
            useDeviceStore.getState().sims.find((s) => s.subscriptionId === sms.subscriptionId) ??
            useDeviceStore.getState().sims[0] ??
            { subscriptionId: sms.subscriptionId, carrierName: sms.simDisplayName ?? "SIM", slotIndex: sms.simSlotIndex ?? 0 };

          await useMessageStore.getState().enqueueSms({
            smsBody: sms.body,
            receiverNumber: sms.originatingAddress,
            pairId: active.pairId,
            receiverPublicKey: active.receiverPublicKey,
            sim: {
              subscriptionId: sim.subscriptionId,
              carrierName: sim.carrierName,
              slotIndex: sim.slotIndex,
              displayName: sim.displayName,
            },
          });
          void routes;
        })();
      });
    })().catch(() => undefined);
    return () => {
      unsub?.();
    };
  }, [registered, role]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: "Welcome", headerShown: false }} />
        <Stack.Screen name="role" options={{ title: "Choose your role", headerShown: false }} />
        <Stack.Screen name="(sender)" options={{ headerShown: false }} />
        <Stack.Screen name="(receiver)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
