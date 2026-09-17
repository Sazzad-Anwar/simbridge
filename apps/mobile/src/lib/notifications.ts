/**
 * Notifications (Push + In-App): local notifications for new messages and
 * pairing requests, plus a push-token hook for FCM/APNs relays.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications(): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted && Platform.OS === "android") {
    await Notifications.requestPermissionsAsync().catch(() => undefined);
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
}

export async function notify(title: string, body: string, channel = "messages"): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: channel },
    });
  } catch {
    // Notifications are best-effort; never break the message flow.
  }
}

/** Push token for background notifications via an FCM/APNs relay (optional). */
export async function getPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data ? String(token.data) : null;
  } catch {
    return null;
  }
}
