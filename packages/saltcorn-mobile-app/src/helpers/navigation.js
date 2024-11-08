/*global saltcorn*/
import i18next from "i18next";

import { router } from "../routing/index";
import { startOfflineMode } from "./offline_mode";
import { showAlerts } from "./common";

export let routingHistory = [];

export function currentLocation() {
  if (routingHistory.length == 0) return undefined;
  let index = routingHistory.length - 1;
  while (index > 0 && routingHistory[index].route.startsWith("post/")) {
    index--;
  }
  return routingHistory[index].route;
}

export function currentQuery(skipPosts = false) {
  if (routingHistory.length == 0) return undefined;
  let index = routingHistory.length - 1;
  if (skipPosts)
    while (index > 0 && routingHistory[index].route.startsWith("post/")) {
      index--;
    }
  return routingHistory[index].query;
}

export function addQueryParam(key, value) {
  let query = currentQuery();
  if (!query) {
    routingHistory[routingHistory.length - 1].query = `${key}=${value}`;
  } else {
    const parsed = new URLSearchParams(query);
    parsed.set(key, value);
    routingHistory[routingHistory.length - 1].query = parsed.toString();
  }
}

export function addRoute(routeEntry) {
  routingHistory.push(routeEntry);
}

export function clearHistory() {
  routingHistory = [];
}

export function popRoute() {
  routingHistory.pop();
}

export async function goBack(steps = 1, exitOnFirstPage = false) {
  const { inLoadState } = saltcorn.data.state.getState().mobileConfig;
  if (inLoadState) return;
  const iframe = document.getElementById("content-iframe");
  if (
    routingHistory.length === 0 ||
    (exitOnFirstPage && routingHistory.length === 1)
  ) {
    navigator.app.exitApp();
  } else if (routingHistory.length <= steps) {
    try {
      if (iframe?.contentWindow?.showLoadSpinner)
        iframe.contentWindow.showLoadSpinner();
      routingHistory = [];
      await handleRoute("/");
    } finally {
      if (iframe?.contentWindow?.removeLoadSpinner)
        iframe.contentWindow.removeLoadSpinner();
    }
  } else {
    try {
      if (iframe?.contentWindow?.showLoadSpinner)
        iframe.contentWindow.showLoadSpinner();
      routingHistory = routingHistory.slice(0, routingHistory.length - steps);
      // don't repeat a post
      if (routingHistory[routingHistory.length - 1].route.startsWith("post/")) {
        routingHistory.pop();
      }
      const newCurrent = routingHistory.pop();
      await handleRoute(newCurrent.route, newCurrent.query);
    } finally {
      if (iframe?.contentWindow?.removeLoadSpinner)
        iframe.contentWindow.removeLoadSpinner();
    }
  }
}
function clearContentDiv() {
  const iframe = document.getElementById("content-iframe");
  if (iframe) {
    const iframeDocument = iframe.contentWindow.document;
    const innerContentDiv = iframeDocument.getElementById("page-inner-content");
    if (innerContentDiv) innerContentDiv.innerHTML = "";
  }
}

export async function handleRoute(route, query, files, data) {
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  let routeAdded = false;
  try {
    clearContentDiv();
    if (
      mobileConfig.networkState === "none" &&
      mobileConfig.allowOfflineMode &&
      !mobileConfig.isOfflineMode
    ) {
      await startOfflineMode();
      clearHistory();
      await gotoEntryView();
    } else {
      if (route === "/" || route === "get" || route === "get/")
        return await gotoEntryView();
      const safeRoute = route ? route : currentLocation();
      addRoute({ route: safeRoute, query });
      routeAdded = true;
      const page = await router.resolve({
        pathname: safeRoute,
        query: query,
        files: files,
        data: data,
        alerts: [],
        fullWrap: isHtmlFile(), // fullWrap when it's currently a fixed-html-file
      });
      if (page.redirect) {
        const { moddalWasOpen, noSubmitReload } = handleOpenModal();
        if (moddalWasOpen) {
          if (noSubmitReload) return;
          else return await reload();
        }
        if (
          page.redirect.startsWith("http://localhost") ||
          page.redirect === "undefined"
        ) {
          await gotoEntryView();
        } else {
          const { path, query } = splitPathQuery(page.redirect);
          await handleRoute(
            path.startsWith("/") && path.length > 1 ? `get${path}` : path,
            query
          );
        }
      } else if (page.content) {
        if (!page.replaceIframe) await replaceIframeInnerContent(page.content);
        else await replaceIframe(page.content, page.isFile);
      } else {
        showAlerts([
          {
            type: "warning",
            msg: i18next.t("%s finished without a result", {
              postProcess: "sprintf",
              sprintf: [safeRoute],
            }),
          },
        ]);
      }
    }
  } catch (error) {
    if (routeAdded) popRoute();
    showAlerts([
      {
        type: "error",
        msg: `${i18next.t("In %s", {
          postProcess: "sprintf",
          sprintf: [route],
        })}: ${error.message ? error.message : i18next.t("An error occurred")}`,
      },
    ]);
  }
}

function handleOpenModal() {
  const result = { moddalWasOpen: false, noSubmitReload: false };
  const iframe = document.getElementById("content-iframe");
  if (!iframe) return result;
  const openModal = iframe.contentWindow.$("#scmodal.modal.show");
  if (openModal.length === 0) return result;
  result.moddalWasOpen = true;
  iframe.contentWindow.bootstrap.Modal.getInstance(openModal[0]).hide();
  result.noSubmitReload = openModal[0].classList.contains("no-submit-reload");
  return result;
}

export function isHtmlFile() {
  const iframe = document.getElementById("content-iframe");
  return iframe.getAttribute("is-html-file") === "true";
}

async function reload() {
  const currentRoute = currentLocation();
  if (!currentRoute) await gotoEntryView();
  await handleRoute(currentRoute, currentQuery(true));
}

export async function gotoEntryView() {
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  try {
    if (mobileConfig.inErrorState) window.location.reload(true);
    else if (
      mobileConfig.networkState === "none" &&
      mobileConfig.allowOfflineMode &&
      !mobileConfig.isOfflineMode
    ) {
      await startOfflineMode();
      clearHistory();
    }
    const page = await router.resolve({
      pathname: mobileConfig.entry_point,
      alerts: [],
    });
    addRoute({ route: mobileConfig.entry_point, query: undefined });
    await replaceIframeInnerContent(page.content);
  } catch (error) {
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

export async function replaceIframe(content, isFile = false) {
  const iframe = document.getElementById("content-iframe");
  iframe.srcdoc = content;
  if (isFile) {
    iframe.setAttribute("is-html-file", true);
    await new Promise((resolve, reject) => {
      iframe.onload = () => {
        try {
          const _iframe = document.getElementById("content-iframe");
          const iframeDoc = _iframe.contentWindow.document;
          const baseEl = iframeDoc.createElement("base");
          iframeDoc.head.appendChild(baseEl);
          baseEl.href = "http://localhost";
          const scriptEl = iframeDoc.createElement("script");
          iframeDoc.body.appendChild(scriptEl);
          scriptEl.onload = () => {
            resolve();
          };
          scriptEl.src = "js/iframe_view_utils.js";
        } catch (e) {
          reject(e);
        }
      };
      iframe.onerror = () => {
        reject();
      };
    });
  } else iframe.setAttribute("is-html-file", false);
}

export function addScriptToIframeHead(iframeDoc, script) {
  return new Promise((resolve /*reject*/) => {
    const srcAttr = script.attributes.getNamedItem("src").value;
    const existingScripts = iframeDoc.head.getElementsByTagName("script");
    for (const existing of existingScripts) {
      const existingSrc = existing.attributes.getNamedItem("src");
      if (existingSrc && existingSrc.value === srcAttr) return resolve(); // already there
    }
    const scriptEl = iframeDoc.createElement("script");
    iframeDoc.head.appendChild(scriptEl);
    scriptEl.onload = () => {
      resolve();
    };
    scriptEl.src = srcAttr;
  });
}

export async function replaceIframeInnerContent(content) {
  const iframe = document.getElementById("content-iframe");
  const iframeDocument = iframe.contentWindow.document;
  const modal = iframeDocument.getElementById("scmodal");
  if (modal) modal.remove();
  const innerContentDiv = iframeDocument.getElementById("page-inner-content");
  innerContentDiv.innerHTML = content;
  const scripts = innerContentDiv.getElementsByTagName("script");
  for (const script of scripts) {
    if (script.attributes.getNamedItem("src")) {
      await addScriptToIframeHead(iframe.contentWindow.document, script);
    } else {
      iframe.contentWindow.eval(script.innerHTML);
    }
  }
  const scmodal = iframe.contentWindow.$("#scmodal");
  if (scmodal) {
    scmodal.modal("hide");
  }
  iframe.contentWindow.scrollTo(0, 0);
  iframe.contentWindow.initialize_page();
}

export function splitPathQuery(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  return { path, query };
}
