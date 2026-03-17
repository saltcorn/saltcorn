import { BackgroundFetch } from "@transistorsoft/capacitor-background-fetch";
import { sync } from "./offline_mode.js";

let isConfigured = false;

/**
 * Init the periodic background sync with a min interval.
 * This runs the sync even if the app is in background or was swipe closed.
 * If no internet connection is available it fails silently.
 * @param {number} interval min time interval in minutes. The system decides when to actually do it
 * @returns {Promise<boolean>} True if configuration was successful, false otherwise.
 */
export async function startPeriodicBackgroundSync(interval = 15) {
  if (isConfigured) {
    console.log("Background sync is already configured. Skipping.");
    return true;
  }

  console.log("Configuring background sync with interval (minutes):", interval);

  const status = await BackgroundFetch.configure(
    {
      minimumFetchInterval: interval,
    },
    async (taskId) => {
      console.log(
        "Starting background sync:",
        taskId,
        new Date().toISOString()
      );
      await sync(true);
      console.log(
        "Background sync finished:",
        taskId,
        new Date().toISOString()
      );
      BackgroundFetch.finish(taskId);
    },
    async (taskId) => {
      console.log("[BackgroundFetch] TIMEOUT:", taskId);
      BackgroundFetch.finish(taskId);
    }
  );

  if (status === BackgroundFetch.STATUS_AVAILABLE) {
    console.log("Background sync successfully configured.");
    isConfigured = true; // Set the flag only on success
    return true;
  } else {
    // Handle error statuses
    if (status === BackgroundFetch.STATUS_DENIED) {
      console.log(
        "The user explicitly disabled background behavior for this app or for the whole system."
      );
    } else if (status === BackgroundFetch.STATUS_RESTRICTED) {
      console.log(
        "Background updates are unavailable and the user cannot enable them again."
      );
    }
    isConfigured = false;
    return false;
  }
}

/**
 * Stops/Unregisters the periodic background sync.
 * This should be called when the user logs out.
 */
export async function stopPeriodicBackgroundSync() {
  if (!isConfigured) {
    console.log("Background sync is not currently configured. Skipping stop.");
    return;
  }

  console.log("Stopping background sync");
  try {
    await BackgroundFetch.stop();
    console.log("Background sync successfully stopped.");
    isConfigured = false;
  } catch (error) {
    console.error("Error stopping background sync:", error);
  }
}

/**
 * Check if the background sync is currently configured/enabled.
 * @returns {boolean} True if the sync is configured, false otherwise.
 */
export function isBackgroundSyncActive() {
  return isConfigured;
}
