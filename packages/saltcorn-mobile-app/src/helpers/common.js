/*global saltcorn, $*/

import { apiCall } from "./api";

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
    const area = iframe.contentWindow.document.getElementById(
      toast ? "toasts-area" : "top-alert"
    );
    if (!area) return false;
    const successIds = [];
    area.innerHTML = "";
    for (const { type, msg } of alerts) {
      if (toast) {
        const rndid = `tab${Math.floor(Math.random() * 16777215).toString(16)}`;
        area.innerHTML += saltcorn.markup.toast(type, msg, rndid);
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
  showAlerts([
    {
      type: "error",
      msg: error.message ? error.message : "An error occured.",
    },
  ]);
  console.error(error);
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
