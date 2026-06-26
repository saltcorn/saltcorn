import { BackgroundFetch } from "@transistorsoft/capacitor-background-fetch";
import { performSync, performHeartbeat } from "./background_tasks.js";

const SYNC_TASK_ID = "com.saltcorn.background_sync";
const HEARTBEAT_TASK_ID = "com.saltcorn.push_sync_heartbeat";

let isConfigured = false;

/**
 * Call BackgroundFetch.configure() with a task-routing callback.
 * Sets isConfigured on success.
 * @param {number} minimumFetchInterval hint to the OS in minutes
 */
async function configure(minimumFetchInterval) {
  const status = await BackgroundFetch.configure(
    { minimumFetchInterval },
    async (taskId) => {
      switch (taskId) {
        case SYNC_TASK_ID:
          try {
            await performSync();
          } catch (e) {
            console.error("Background sync error:", e);
          }
          break;
        case HEARTBEAT_TASK_ID:
          try {
            await performHeartbeat();
          } catch (e) {
            console.error("Heartbeat error:", e);
          }
          break;
        default:
          console.log("[BackgroundFetch] unknown task:", taskId);
      }
      BackgroundFetch.finish(taskId);
    },
    async (taskId) => {
      console.log("[BackgroundFetch] TIMEOUT:", taskId);
      BackgroundFetch.finish(taskId);
    }
  );

  if (status === BackgroundFetch.STATUS_AVAILABLE) {
    isConfigured = true;
    console.log("BackgroundFetch configured successfully");
  } else if (status === BackgroundFetch.STATUS_DENIED) {
    console.log("BackgroundFetch: user denied background behavior");
  } else if (status === BackgroundFetch.STATUS_RESTRICTED) {
    console.log("BackgroundFetch: background updates restricted");
  }
}

/**
 * Schedule the configured named tasks via BackgroundFetch.scheduleTask.
 * @param {number|undefined} syncInterval background-sync interval in minutes
 * @param {number|undefined} heartbeatInterval push-sync heartbeat interval in minutes
 */
async function scheduleTasks(syncInterval, heartbeatInterval) {
  if (syncInterval > 0) {
    try {
      await BackgroundFetch.scheduleTask({
        taskId: SYNC_TASK_ID,
        delay: syncInterval * 60 * 1000,
        periodic: true,
        requiresNetworkConnectivity: true,
      });
      console.log(
        `Background sync scheduled, interval: ${syncInterval} minute(s)`
      );
    } catch (e) {
      console.error("Error scheduling sync task:", e);
    }
  }

  if (heartbeatInterval > 0) {
    try {
      await BackgroundFetch.scheduleTask({
        taskId: HEARTBEAT_TASK_ID,
        delay: heartbeatInterval * 60 * 1000,
        periodic: true,
        requiresNetworkConnectivity: true,
      });
      console.log(
        `Push sync heartbeat scheduled, interval: ${heartbeatInterval} minute(s)`
      );
    } catch (e) {
      console.error("Error scheduling heartbeat task:", e);
    }
  }
}

/**
 * Init background tasks. Routes task IDs to performSync / performHeartbeat
 * from background_tasks.js. Only tasks with a configured interval are scheduled.
 * @param {number|undefined} syncInterval background-sync interval in minutes
 * @param {number|undefined} heartbeatInterval push-sync heartbeat interval in minutes
 * @returns {Promise<boolean>} true if BackgroundFetch was configured successfully
 */
export async function initBackground(syncInterval, heartbeatInterval) {
  const hasSyncInterval = syncInterval && syncInterval > 0;
  const hasHeartbeatInterval = heartbeatInterval && heartbeatInterval > 0;

  if (!hasSyncInterval && !hasHeartbeatInterval) {
    console.log("initBackground: no intervals configured, skipping");
    return false;
  }

  if (!isConfigured) {
    const minimumFetchInterval = Math.min(
      hasSyncInterval ? syncInterval : Infinity,
      hasHeartbeatInterval ? heartbeatInterval : Infinity
    );
    await configure(minimumFetchInterval);
  }

  if (isConfigured) await scheduleTasks(syncInterval, heartbeatInterval);

  return isConfigured;
}

/**
 * Stop all background tasks (sync + heartbeat). Call on logout.
 */
export async function stopBackground() {
  if (!isConfigured) return;
  try {
    await BackgroundFetch.stop();
    isConfigured = false;
    console.log("Background tasks stopped");
  } catch (e) {
    console.error("Error stopping background tasks:", e);
  }
}
