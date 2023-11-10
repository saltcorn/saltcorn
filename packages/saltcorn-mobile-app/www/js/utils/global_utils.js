/*global window, $, offlineHelper, axios, write, cordova, router, getDirEntry, saltcorn, document, FileReader, navigator, splashConfig, i18next*/

let routingHistory = [];

function currentLocation() {
  if (routingHistory.length == 0) return undefined;
  let index = routingHistory.length - 1;
  while (index > 0 && routingHistory[index].route.startsWith("post/")) {
    index--;
  }
  return routingHistory[index].route;
}

function currentQuery() {
  if (routingHistory.length == 0) return undefined;
  return routingHistory[routingHistory.length - 1].query;
}

function addRoute(routeEntry) {
  routingHistory.push(routeEntry);
}

function clearHistory() {
  routingHistory = [];
}

function popRoute() {
  routingHistory.pop();
}

async function apiCall({ method, path, params, body, responseType, timeout }) {
  const config =
    typeof saltcorn !== "undefined"
      ? saltcorn.data.state.getState().mobileConfig
      : splashConfig;
  const serverPath = config.server_path;
  const url = `${serverPath}${path}`;
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Saltcorn-Client": "mobile-app",
  };
  if (config.tenantAppName) headers["X-Saltcorn-App"] = config.tenantAppName;
  const token = config.jwt;
  if (token) headers.Authorization = `jwt ${token}`;
  try {
    const result = await axios({
      url: url,
      method,
      params,
      headers,
      responseType: responseType ? responseType : "json",
      data: body,
      timeout: timeout ? timeout : 0,
    });
    return result;
  } catch (error) {
    error.message = `Unable to call ${method} ${url}:\n${error.message}`;
    throw error;
  }
}

function clearAlerts() {
  const iframe = document.getElementById("content-iframe");
  const alertsArea =
    iframe.contentWindow.document.getElementById("toasts-area");
  alertsArea.innerHTML = "";
}

function showAlerts(alerts, toast = true) {
  if (typeof saltcorn === "undefined") {
    console.log("Not yet initalized.");
    console.log(alerts);
  } else {
    const iframe = document.getElementById("content-iframe");
    const area = iframe.contentWindow.document.getElementById(
      toast ? "toasts-area" : "top-alert"
    );
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
}

function clearTopAlerts() {
  const iframe = document.getElementById("content-iframe");
  const area = iframe.contentWindow.document.getElementById("alerts-area");
  if (area) area.innerHTML = "";
  const topAlert = iframe.contentWindow.document.getElementById("top-alert");
  if (topAlert) topAlert.innerHTML = "";
}

async function loadEncodedFile(fileId) {
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

function splitPathQuery(url) {
  let path = url;
  let query = undefined;
  const queryStart = url.indexOf("?");
  if (queryStart > 0) {
    path = url.substring(0, queryStart);
    query = url.substring(queryStart);
  }
  return { path, query };
}

async function replaceIframe(content) {
  await write("content.html", `${cordova.file.dataDirectory}`, content);
  const url = await getDirEntry(`${cordova.file.dataDirectory}content.html`);
  const iframe = document.getElementById("content-iframe");
  iframe.src = url.toURL();
}

function addScriptToIframeHead(iframeDoc, script) {
  return new Promise((resolve, reject) => {
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

async function replaceIframeInnerContent(content) {
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
  iframe.contentWindow.initialize_page();
}

async function gotoEntryView() {
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  try {
    if (mobileConfig.inErrorState) window.location.reload(true);
    else if (
      mobileConfig.networkState === "none" &&
      mobileConfig.allowOfflineMode &&
      !mobileConfig.isOfflineMode
    ) {
      await offlineHelper.startOfflineMode();
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

async function handleRoute(route, query, files, data) {
  const mobileConfig = saltcorn.data.state.getState().mobileConfig;
  try {
    if (
      mobileConfig.networkState === "none" &&
      mobileConfig.allowOfflineMode &&
      !mobileConfig.isOfflineMode
    ) {
      await offlineHelper.startOfflineMode();
      clearHistory();
      await gotoEntryView();
    } else {
      if (route === "/" || route === "get" || route === "get/")
        return await gotoEntryView();
      const safeRoute = route ? route : currentLocation();
      addRoute({ route: safeRoute, query });
      const page = await router.resolve({
        pathname: safeRoute,
        query: query,
        files: files,
        data: data,
        alerts: [],
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
        else await replaceIframe(page.content);
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

async function reload() {
  const currentRoute = currentLocation();
  if (!currentRoute) await gotoEntryView();
  await handleRoute(currentRoute, currentQuery());
}

async function goBack(steps = 1, exitOnFirstPage = false) {
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

function errorAlert(error) {
  showAlerts([
    {
      type: "error",
      msg: error.message ? error.message : "An error occured.",
    },
  ]);
  console.error(error);
}

async function checkJWT(jwt) {
  if (jwt && jwt !== "undefined") {
    const response = await apiCall({
      method: "GET",
      path: "/auth/authenticated",
      timeout: 10000,
    });
    return response.data.authenticated;
  } else return false;
}
