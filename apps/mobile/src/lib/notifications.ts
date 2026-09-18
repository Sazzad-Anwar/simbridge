/**
 * Notifications (Push + In-App): local notifications for new messages and
 * pairing requests, plus a push-token hook for FCM/APNs relays.
 *
 * Expo Go safety (SDK 53+): Android push functionality was removed from Expo
 * Go, and `expo-notifications` THROWS AT IMPORT TIME there — its server
 * auto-registration side effect (`DevicePushTokenAutoRegistration.fx`) calls
 * `addPushTokenListener()` on module scope, which throws on Android in Expo
 * Go. A static import would therefore break module evaluation for every
 * route in the graph ("missing default export" warnings + router
 * `ErrorBoundary` crash). The library is loaded lazily instead and skipped
 * entirely on Android Expo Go; dev builds / standalone get full behavior.
 */
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

type NotificationsModule = typeof import("expo-notifications");

let cachedModule: Promise<NotificationsModule | null> | null = null;

function isExpoGoAndroid(): boolean {
  return (
    Platform.OS === "android" &&
    (Constants.appOwnership === "expo" ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
  );
}

/**
 * Lazily loads expo-notifications (Metro defers module evaluation until the
 * first dynamic import resolves). Returns null where it cannot run —
 * Android Expo Go, or any environment without the native module — so the
 * rest of the app never breaks because of notifications.
 */
function loadNotifications(): Promise<NotificationsModule | null> {
  cachedModule ??= (async () => {
    if (isExpoGoAndroid()) return null;
    try {
      const Notifications = await import("expo-notifications");
      // The handler decides how notifications are presented while the app
      // is in the foreground. Set it once, as soon as the module loads.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      return Notifications;
    } catch {
      return null; // native module unavailable — degrade gracefully
    }
  })();
  return cachedModule;
}

export async function initNotifications(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (!settings.granted && Platform.OS === "android") {
      await Notifications.requestPermissionsAsync();
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "New messages",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#7C5CFF",
      });
      await Notifications.setNotificationChannelAsync("pairing", {
        name: "Pairing",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#7C5CFF",
      });
    }
  } catch {
    // Channels/permissions are best-effort — never block app startup.
  }
}

export async function notify(title: string, body: string, channel = "messages"): Promise<void> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: channel,
      },
    });
  } catch {
    // Notifications are best-effort; never break the message flow.
  }
}

/** Push token for background notifications via an FCM/APNs relay (optional). */
export async function getPushToken(): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data ? String(token.data) : null;
  } catch {
    return null;
  }
}
