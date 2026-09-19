/**
 * Typed wrapper for the local Expo module `expo-sms-bridge`
 * (native Kotlin: SMS detection, SIM registry, encrypted outbox, foreground service).
 *
 * The module is only available in dev-client / production builds
 * (not in Expo Go) — every call degrades gracefully.
 */
import { requireNativeModule } from "expo";
import { PermissionsAndroid, Platform } from "react-native";
import type { SimInfo } from "@simbridge/shared";

export interface SmsReceivedEvent {
  body: string;
  originatingAddress: string;
  timestamp: number;
  subscriptionId: number;
  simDisplayName?: string;
  simSlotIndex?: number;
  contactName?: string;
}

/** An entry from the native encrypted outbox (SmsReceiver persists here first). */
export interface NativeOutboxEntry {
  body?: string;
  originatingAddress?: string;
  timestamp?: number;
  subscriptionId?: number;
  simDisplayName?: string;
  contactName?: string;
  status?: string;
  queuedAt?: number;
}

/** An entry from the OS SMS inbox (InboxReader recovery scan). */
export interface InboxSmsEntry {
  id: number;
  originatingAddress?: string;
  body?: string;
  timestamp?: number;
  subscriptionId?: number;
}

/** Stable multiplatform-safe non-cryptographic hash (FNV-1a 32-bit as hex). */
export function hashString(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Deterministic client message id for an incoming SMS. Both the live
 * onSmsReceived path and the native-outbox drain must use the SAME id so the
 * backend (idempotent per pairId+clientMsgId) never delivers a duplicate to
 * the receiver.
 */
export function smsClientMsgId(input: {
  pairId: string;
  body: string;
  sender: string;
  timestamp: number;
  subscriptionId?: number;
}): string {
  const h = hashString(
    `${input.pairId}:${input.sender}:${input.body}:${input.timestamp}:${input.subscriptionId ?? 0}`,
  );
  return `sms-${h}`;
}

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
  getOutbox(): NativeOutboxEntry[];
  clearOutbox(): void;
  readRecentInbox(afterTimestamp: number, limit: number): Promise<InboxSmsEntry[]>;
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

  getOutbox(): NativeOutboxEntry[] {
    return native?.getOutbox() ?? [];
  },
  clearOutbox(): void {
    native?.clearOutbox();
  },

  /** Scan the OS SMS inbox for messages newer than `afterTimestamp` (recovery). */
  async readRecentInbox(afterTimestamp: number, limit = 200): Promise<InboxSmsEntry[]> {
    const entries = (await native?.readRecentInbox(afterTimestamp, limit)) ?? [];
    return entries.filter((e) => Boolean(e.body?.trim()) && Boolean(e.originatingAddress?.trim()));
  },

  /**
   * Request the runtime permissions the SMS relay needs (RECEIVE_SMS,
   * READ_SMS, READ_PHONE_STATE) plus READ_CONTACTS for sender-name lookup.
   * On Android 6+ these are NOT granted at install time — without them
   * SmsReceiver never fires and listSims() returns an empty array.
   * Contacts is best-effort: it does not gate the result.
   */
  async requestSmsPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return false;
    const perms = [
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ];
    try {
      const results = await PermissionsAndroid.requestMultiple(perms);
      const smsOk = ["RECEIVE_SMS", "READ_SMS", "READ_PHONE_STATE"].every(
        (p) => results[p as keyof typeof results] === PermissionsAndroid.RESULTS.GRANTED,
      );
      return smsOk;
    } catch {
      return false;
    }
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
