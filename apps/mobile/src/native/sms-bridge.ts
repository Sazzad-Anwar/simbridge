/**
 * Typed wrapper for the local Expo module `expo-sms-bridge`
 * (native Kotlin: SMS detection, SIM registry, encrypted outbox, foreground service).
 *
 * The module is only available in dev-client / production builds
 * (not in Expo Go) — every call degrades gracefully.
 */
import { requireNativeModule, Platform } from "expo-modules-core";
import type { SimInfo } from "@simbridge/shared";

export interface SmsReceivedEvent {
  body: string;
  originatingAddress: string;
  timestamp: number;
  subscriptionId: number;
  simDisplayName?: string;
  simSlotIndex?: number;
}

/** Events emitted by the native SmsBridge module. */
type SmsBridgeEvents = {
  onSmsReceived: (sms: SmsReceivedEvent) => void;
  onConnectivityChanged: (event: { online: boolean }) => void;
};

/** Minimal structural view of the native module's EventEmitter surface. */
interface NativeEventEmitterLike<TEventsMap extends Record<string, (...args: never[]) => void>> {
  addListener<EventName extends keyof TEventsMap & string>(
    eventName: EventName,
    listener: TEventsMap[EventName],
  ): { remove(): void };
}

interface SmsBridgeFunctions {
  listSims(): Promise<
    Array<{
      subscriptionId: number;
      carrierName: string;
      slotIndex: number;
      displayName: string;
      phoneNumber: string;
      isActive: boolean;
    }>
  >;
  startForegroundService(): Promise<void>;
  stopForegroundService(): Promise<void>;
  isServiceRunning(): boolean;
  hasSmsPermissions(): boolean;
}

type SmsBridgeNativeModule = SmsBridgeFunctions &
  NativeEventEmitterLike<{
    onSmsReceived: (sms: SmsReceivedEvent) => void;
    onConnectivityChanged: (event: { online: boolean }) => void;
  }>;

const native = (() => {
  if (Platform.OS !== "android") return null;
  try {
    return requireNativeModule<SmsBridgeNativeModule>("SmsBridge");
  } catch {
    return null; // Expo Go or iOS — native SMS features unavailable
  }
})();

export const smsBridgeAvailable = native !== null;

export const smsBridge = {
  /** List active SIM subscriptions (multi-SIM aware). */
  async listSims(): Promise<SimInfo[]> {
    if (!native) return [];
    return native.listSims();
  },

  /** Keep-alive foreground service (Android 14+: remoteMessaging type). */
  async startService(): Promise<void> {
    if (native) await native.startForegroundService();
  },
  async stopService(): Promise<void> {
    if (native) await native.stopForegroundService();
  },
  isServiceRunning(): boolean {
    return native?.isServiceRunning() ?? false;
  },
  hasSmsPermissions(): boolean {
    return native?.hasSmsPermissions() ?? false;
  },

  /**
   * Fired by SmsBroadcastReceiver when an SMS arrives while the app is alive.
   * The native layer ALSO persists to its own encrypted outbox, so nothing is
   * lost even if JS is dead — see OutboxStore.kt.
   */
  onSmsReceived(listener: (sms: SmsReceivedEvent) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onSmsReceived", listener);
    return () => sub.remove();
  },

  /** Fired by ConnectivityReceiver when the network comes back / drops. */
  onConnectivityChanged(listener: (event: { online: boolean }) => void): () => void {
    if (!native) return () => undefined;
    const sub = native.addListener("onConnectivityChanged", listener);
    return () => sub.remove();
  },
};
