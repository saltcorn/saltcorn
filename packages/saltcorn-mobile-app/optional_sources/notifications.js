/*global saltcorn*/

import { Capacitor } from "@capacitor/core";
import { apiCall } from "./api";
import { showAlerts } from "./common";
import { PushNotifications } from "@capacitor/push-notifications";
import { Device } from "@capacitor/device";

/**
 * internal helper to subscribe or unsubscribe to push notifications (server side)
 */
async function notifyTokenApi(config, isSubscribe) {
  console.log("notifyTokenApi subscribe:", isSubscribe);
  const { token, deviceId } = config.pushConfiguration;
  try {
    const response = await apiCall({
      method: "POST",
      path: `/notifications/mobile-${isSubscribe ? "subscribe" : "remove-subscription"}`,
      body: { token, deviceId },
    });
    const data = response.data;
    if (data.success === "ok")
      console.log(
        `successfully ${isSubscribe ? "subscribed" : "unsubscribed"} to push notifications`,
        data
      );
    else
      console.error(
        `unable to ${isSubscribe ? "subscribe" : "unsubscribe"} to push notifications`,
        data
      );
  } catch (error) {
    console.error(
      `unable to ${isSubscribe ? "subscribe" : "unsubscribe"} to push notifications`,
      error
    );
  }
}

/**
 * internal helper to subscribe or unsubscribe to push sync (server side)
 * @param {*} config
 * @param {*} isSubscribe
 */
async function syncTokenApi(config, isSubscribe) {
  console.log("syncTokenApi subscribe:", isSubscribe);
  const { token, deviceId } = config.pushConfiguration;
  try {
    const response = await apiCall({
      method: "POST",
      path: `/sync/push_${isSubscribe ? "subscribe" : "unsubscribe"}`,
      body: { token, deviceId, synchedTables: config.synchedTables },
    });
    const data = response.data;
    if (data.success === "ok")
      console.log(
        `successfully ${isSubscribe ? "subscribed" : "unsubscribed"} to push sync`,
        data
      );
    else
      console.error(
        `unable to ${isSubscribe ? "subscribe" : "unsubscribe"} to push sync`,
        data
      );
  } catch (error) {
    console.error(
      `unable to ${isSubscribe ? "subscribe" : "unsubscribe"} to push sync`,
      error
    );
  }
}

async function messageHandler(notification) {
  console.log("Push received:", notification);
  const state = saltcorn.data.state.getState();
  const type = notification.data?.type;
  if (type && state.mobile_push_handler?.[type]) {
    try {
      await state.mobile_push_handler[type](notification);
    } catch (error) {
      console.error(`Error handling '${type}' push notification:`, error);
    }
  }
}

let registrationListener = null;
let registrationErrorListener = null;
let pushReceivedListener = null;

export async function initPushNotifications() {
  if (Capacitor.getPlatform() !== "web" && PushNotifications) {
    await removePushListeners();
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === "granted") {
      await PushNotifications.register();
      registrationListener = PushNotifications.addListener(
        "registration",
        async (token) => {
          console.log("Push registration success, token:", token.value);
          const { identifier } = await Device.getId();
          const config = saltcorn.data.state.getState().mobileConfig;
          config.pushConfiguration = {
            token: token.value,
            deviceId: identifier,
          };
          await notifyTokenApi(config, true);
          if (config.allowOfflineMode && config.pushSync)
            await syncTokenApi(config, true);
        }
      );

      registrationErrorListener = PushNotifications.addListener(
        "registrationError",
        (err) => {
          console.error("Push registration error:", err);
        }
      );

      pushReceivedListener = PushNotifications.addListener(
        "pushNotificationReceived",
        messageHandler
      );
    } else {
      console.warn("Push notification permission not granted");
    }
  }
}

export async function unregisterPushNotifications() {
  if (Capacitor.getPlatform() !== "web" && PushNotifications) {
    try {
      await PushNotifications.unregister();
      const config = saltcorn.data.state.getState().mobileConfig;
      await notifyTokenApi(config, false);
      if (config.allowOfflineMode && config.pushSync)
        await syncTokenApi(config, false);
      await removePushListeners();
      console.log("Push notifications unregistered successfully");
    } catch (error) {
      console.error("Error unregistering push notifications:", error);
    }
  }
}

export function addPusNotifyHandler() {
  const state = saltcorn.data.state.getState();
  state.mobile_push_handler["push_notification"] = (notification) => {
    console.log("Push notification received:", notification);
    showAlerts([
      {
        type: "info",
        msg: notification.body,
        title: notification.title,
      },
    ]);
  };
}

async function removePushListeners() {
  await registrationListener?.remove();
  await registrationErrorListener?.remove();
  await pushReceivedListener?.remove();

  registrationListener = null;
  registrationErrorListener = null;
  pushReceivedListener = null;
}

