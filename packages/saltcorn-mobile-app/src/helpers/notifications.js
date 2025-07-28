import { Capacitor } from "@capacitor/core";
import { apiCall } from "./api";
import { showAlerts } from "./common";

async function loadNotificationsPlugin() {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return PushNotifications;
  } catch (error) {
    console.warn("Error loading PushNotifications plugin:", error);
    return null;
  }
}

async function loadDevicePlugin() {
  try {
    const { Device } = await import("@capacitor/device");
    return Device;
  } catch (error) {
    console.warn("Error loading Device plugin:", error);
    return null;
  }
}

async function uploadFcmToken(token, deviceId) {
  try {
    const response = await apiCall({
      method: "POST",
      path: "/notifications/fcm-token",
      body: { token, deviceId },
    });
    const data = response.data;
    if (data.success.success === "ok")
      console.log("Token uploaded successfully:", data);
    else console.error("Unable to upload token:", data);
  } catch (error) {
    console.error("Error uploading token:", error);
  }
}

export async function initPushNotifications() {
  const PushNotifications = await loadNotificationsPlugin();
  if (Capacitor.getPlatform() !== "web" && PushNotifications) {
    const { Device } = await loadDevicePlugin();
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === "granted") {
      await PushNotifications.register();
      PushNotifications.addListener("registration", async (token) => {
        const { identifier } = await Device.getId();
        await uploadFcmToken(token.value, identifier);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("Push registration error:", err);
      });

      PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          console.log("Push received in foreground:", notification);
          showAlerts([
            {
              type: "info",
              msg: notification.body,
              title: notification.title,
            },
          ]);
        }
      );
    } else {
      console.warn("Push notification permission not granted");
    }
  }
}

export async function unregisterPushNotifications() {
  const PushNotifications = await loadNotificationsPlugin();
  if (Capacitor.getPlatform() !== "web" && PushNotifications) {
    try {
      await PushNotifications.unregister();
      console.log("Push notifications unregistered successfully");
    } catch (error) {
      console.error("Error unregistering push notifications:", error);
    }
  }
}
