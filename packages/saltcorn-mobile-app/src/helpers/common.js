/*global saltcorn, $*/

import { apiCall } from "./api";
import { Camera, CameraResultType } from "@capacitor/camera";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { SendIntent } from "send-intent";
import { addPushSyncHandler } from "./offline_mode";

const orientationChangeListeners = new Set();

export function clearAlerts() {
  const iframe = document.getElementById("content-iframe");
  const alertsArea =
    iframe.contentWindow.document.getElementById("toasts-area");
  alertsArea.innerHTML = "";
}

export function showAlerts(alerts, toast = true) {
  if (typeof saltcorn === "undefined") {
    console.log("Not yet initalized.");
    console.log(alerts);
  } else {
    const iframe = document.getElementById("content-iframe");
    let area = iframe.contentWindow.document.getElementById(
      toast ? "toasts-area" : "top-alert"
    );
    if (!area) {
      const areaHtml = `<div class="container">
  <div 
    id="toasts-area" 
    class="toast-container position-fixed bottom-0 start-50 p-0" 
    style="z-index: 9999;" 
    aria-live="polite" 
    aria-atomic="true">
  </div>
</div>`;
      iframe.contentWindow.document
        .getElementById("page-inner-content")
        .insertAdjacentHTML("beforeend", areaHtml);
      area = iframe.contentWindow.document.getElementById(
        toast ? "toasts-area" : "top-alert"
      );
    }
    const successIds = [];
    area.innerHTML = "";
    for (const { type, msg, title } of alerts) {
      if (toast) {
        const rndid = `tab${Math.floor(Math.random() * 16777215).toString(16)}`;
        area.innerHTML += saltcorn.markup.toast(type, msg, rndid, title);
        if (type === "success") successIds.push(rndid);
      } else area.innerHTML += saltcorn.markup.alert(type, msg);
    }
    if (successIds.length > 0) {
      setTimeout(() => {
        for (const id of successIds) {
          const toastEl = iframe.contentWindow.document.getElementById(id);
          if (toastEl) $(toastEl).removeClass("show");
        }
      }, 5000);
    }
  }
  return true;
}

export function showLoadSpinner() {
  const iframe = document.getElementById("content-iframe");
  if (iframe) iframe.contentWindow.showLoadSpinner();
}

export function removeLoadSpinner() {
  const iframe = document.getElementById("content-iframe");
  if (iframe) iframe.contentWindow.removeLoadSpinner();
}

export function clearTopAlerts() {
  const iframe = document.getElementById("content-iframe");
  const area = iframe.contentWindow.document.getElementById("alerts-area");
  if (area) area.innerHTML = "";
  const topAlert = iframe.contentWindow.document.getElementById("top-alert");
  if (topAlert) topAlert.innerHTML = "";
}

export function errorAlert(error) {
  console.error(error);
  showAlerts([
    {
      type: "error",
      msg: error.message ? error.message : "An error occured.",
    },
  ]);
}

// TODO combine with loadEncodedFile
export async function loadFileAsText(fileId) {
  try {
    const response = await apiCall({
      method: "GET",
      path: `/files/download/${fileId}`,
      responseType: "blob",
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        return resolve(reader.result);
      };
      reader.onerror = (error) => {
        return reject(error);
      };
      reader.readAsText(response.data);
    });
  } catch (error) {
    if (
      !showAlerts([
        {
          type: "error",
          msg: error.message ? error.message : "An error occured.",
        },
      ])
    );
    throw error;
  }
}

export async function loadEncodedFile(fileId) {
  try {
    const response = await apiCall({
      method: "GET",
      path: `/files/download/${fileId}`,
      responseType: "blob",
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        return resolve(reader.result);
      };
      reader.onerror = (error) => {
        return reject(error);
      };
      reader.readAsDataURL(response.data);
    });
  } catch (error) {
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

export async function takePhoto() {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
    });
    return image.path;
  } catch (error) {
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
    return null;
  }
}

export function registerScreenOrientationListener(name, listener) {
  if (!orientationChangeListeners.has(name)) {
    orientationChangeListeners.add(name, listener);
    ScreenOrientation.addListener("screenOrientationChange", listener);
  } else console.warn(`Listener with name ${name} already registered.`);
}

export async function getScreenOrientation() {
  return await ScreenOrientation.orientation();
}

export async function finishShareIntent() {
  SendIntent.finish();
}

export async function checkSendIntentReceived() {
  try {
    return await SendIntent.checkSendIntentReceived();
  } catch (error) {
    console.log("Error in checkSendIntentReceived: ", error);
    return null;
  }
}

/**
 * init the push system, if available
 */
export async function tryInitPush(config) {
  try {
    const { initPushNotifications, addPusNotifyHandler } = await import(
      "../helpers/notifications.js"
    );
    try {
      await initPushNotifications();
      if (saltcorn.data.utils.isPushEnabled(config.user)) addPusNotifyHandler();
      if (config.pushSync) addPushSyncHandler();
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  } catch (error) {
    console.log("Push notifications module not available:", error);
  }
}

/**
 * init background sync, if available
 */
export async function tryInitBackgroundSync(config) {
  try {
    const { startPeriodicBackgroundSync } = await import(
      "../helpers/background_sync.js"
    );
    try {
      if (config.syncInterval && config.syncInterval > 0)
        await startPeriodicBackgroundSync(config.syncInterval);
    } catch (error) {
      console.error("Error initializing background sync:", error);
    }
  } catch (error) {
    console.log("Background sync module not available:", error);
  }
}

/**
 * end the push system, if available
 */
export async function tryUnregisterPush() {
  try {
    const { unregisterPushNotifications } = await import(
      "../helpers/notifications.js"
    );
    try {
      await unregisterPushNotifications();
    } catch (error) {
      console.error("Error unregistering push notifications:", error);
    }
  } catch (error) {
    console.log("Push notifications module not available:", error);
  }
}

/**
 * stop background sync, if available
 */
export async function tryStopBackgroundSync() {
  try {
    const { stopPeriodicBackgroundSync } = await import(
      "../helpers/background_sync.js"
    );
    try {
      await stopPeriodicBackgroundSync();
    } catch (error) {
      console.error("Error stopping periodic background sync:", error);
    }
  } catch (error) {
    console.error("Push notifications module not available:", error);
  }
}
