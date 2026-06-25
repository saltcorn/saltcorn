/*global saltcorn*/

import { CapacitorSilentNotifications } from "capacitor-plugin-silent-notifications";

let silentNotificationListener = null;

export async function initIosSilentPushListener() {
  if (silentNotificationListener) {
    await silentNotificationListener.remove();
    silentNotificationListener = null;
  }
  silentNotificationListener = await CapacitorSilentNotifications.addListener(
    "silentNotificationReceived",
    async (notification) => {
      console.log("iOS silent push received:", notification);
      const state = saltcorn.data.state.getState();
      if (state.mobile_push_handler?.["push_sync"]) {
        try {
          await state.mobile_push_handler["push_sync"](notification);
        } catch (error) {
          console.error("Error handling push_sync silent notification:", error);
        }
      }
    }
  );
}

export async function removeIosSilentPushListener() {
  await silentNotificationListener?.remove();
  silentNotificationListener = null;
}
