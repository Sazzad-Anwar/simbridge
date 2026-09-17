/**
 * Entry gate: routes to onboarding (first launch) or the role-specific tabs.
 */
import React, { useEffect } from "react";
import { Redirect } from "expo-router";
import { Spinner } from "@/components/ui";
import { useDeviceStore } from "@/stores/device-store";

export default function Index() {
  const hydrated = useDeviceStore((s) => s.hydrated);
  const registered = useDeviceStore((s) => s.registered);
  const role = useDeviceStore((s) => s.profile?.role);

  if (!hydrated) return <Spinner />;
  if (!registered) return <Redirect href="/onboarding" />;
  if (role === "sender") return <Redirect href="/(sender)" />;
  if (role === "receiver") return <Redirect href="/(receiver)" />;
  return <Redirect href="/onboarding" />;
}
