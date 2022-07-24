const iframeStyle =  "position: fixed; top: 0; left: 0; bottom: 0; right: 0; "
 + "width: 100%; height: 100%; border: none; margin: 0; padding: 0; "
 + "overflow: hidden; z-index: 999999; "

const routingHistory = [];

function currentLocation() {
  if (routingHistory.length == 0) return undefined;
  return routingHistory[routingHistory.length - 1].route;
}

function currentQuery() {
  if (routingHistory.length == 0) return undefined;
  return routingHistory[routingHistory.length - 1].query;
}

function addRoute(routeEntry) {
  routingHistory.push(routeEntry);
}

async function apiCall({ method, path, params, body, responseType }) {
  const config = saltcorn.data.state.getState().mobileConfig;
  const serverPath = config.server_path;
  const token = localStorage.getItem("auth_jwt");
  const url = `${serverPath}${path}`;
  try {
    const result = await axios({
      url: url,
      method: method,
      params: params,
      headers: {
        Authorization: `jwt ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-Saltcorn-Client": "mobile-app",
      },
      responseType: responseType ? responseType : "json",
      data: body,
    });
    return result;
  }
  catch(error) {
    error.message = `Unable to call ${method} ${url}:\n${error.message}`;
    throw error;
  }
}

function showAlerts(alerts) {
  const iframe = document.getElementById("content-iframe");
  const alertsArea =
    iframe.contentWindow.document.getElementById("alerts-area");
  alertsArea.innerHTML = "";
  for (const { type, msg } of alerts) {
    alertsArea.innerHTML += saltcorn.markup.alert(type, msg);
  }
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

async function callLogout() {
  const config = saltcorn.data.state.getState().mobileConfig;
  try {
    const page = await router.resolve({
      pathname: "get/auth/logout",
      entryView: config.entry_point,
      versionTag: config.version_tag,
    });
    replaceIframe(page.content);
  } catch (error) {
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

function replaceIframe(content) {
  const iframe = document.getElementById("content-iframe");
  iframe.remove();
  const newIframe = document.createElement("iframe");
  document.body.appendChild(newIframe);
  const config = saltcorn.data.state.getState().mobileConfig;
  newIframe.contentWindow._sc_version_tag = config.version_tag;
  newIframe.setAttribute("style", iframeStyle)
  newIframe.id = "content-iframe";
  newIframe.contentWindow.document.open();
  newIframe.contentWindow.document.write(content);
  newIframe.contentWindow.document.close();
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
  const config = saltcorn.data.state.getState().mobileConfig;
  const entryPath = config.entry_point;
  const page = await router.resolve({
    pathname: entryPath,
  });
  addRoute({ entryPath, query: undefined });
  await replaceIframeInnerContent(page.content);
}

async function handleRoute(route, query, files) {
  try {
    if (route === "/") return await gotoEntryView();
    addRoute({ route, query });
    const page = await router.resolve({
      pathname: route,
      query: query,
      files: files,
    });
    if (page.redirect) {
      const { path, query } = splitPathQuery(page.redirect);
      await handleRoute(path, query);
    } else if (page.content) {
      if (!page.replaceIframe) await replaceIframeInnerContent(page.content);
      else await replaceIframe(page.content);
    }
  } catch (error) {
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
    console.error(error);
  }
}

async function goBack(steps = 1, exitOnFirstPage = false) {
  if (exitOnFirstPage && routingHistory.length === 1) {
    navigator.app.exitApp();
  } else if (routingHistory.length <= steps) {
    routingHistory = [];
    await handleRoute("/");
  } else {
    routingHistory = routingHistory.slice(0, routingHistory.length - steps);
    const newCurrent = routingHistory.pop();
    await handleRoute(newCurrent.route, newCurrent.query);
  }
}
