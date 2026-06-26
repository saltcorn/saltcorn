/*global saltcorn*/

import { Capacitor } from "@capacitor/core";
import { apiCall } from "./api.js";
import { sync } from "./offline_mode.js";

/**
 * Perform one background sync pass.
 */
export async function performSync() {
  console.log("Background sync starting:", new Date().toISOString());
  await sync(true);
  console.log("Background sync finished:", new Date().toISOString());
}

/**
 * Re-register the push sync subscription with the server.
 */
export async function performHeartbeat() {
  const config = saltcorn.data.state.getState().mobileConfig;
  if (!config?.pushSync || !config?.pushConfiguration) {
    console.log("Push sync heartbeat: skipping (push sync not active)");
    return;
  }
  const { token, deviceId } = config.pushConfiguration;
  const platform = Capacitor.getPlatform();
  console.log("Push sync heartbeat: re-registering subscription");
  try {
    const response = await apiCall({
      method: "POST",
      path: "/sync/push_subscribe",
      body: {
        token,
        deviceId,
        platform,
        synchedTables: config.synchedTables,
        apnsEnvironment: config.apnsEnvironment,
      },
    });
    const data = response.data;
    if (data.success === "ok")
      console.log("Push sync heartbeat: subscription refreshed");
    else console.error("Push sync heartbeat: server error", data);
  } catch (e) {
    console.error("Push sync heartbeat error:", e);
  }
}
