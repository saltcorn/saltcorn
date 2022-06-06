let routingHistory = [];

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
  const serverPath = config.server_path;
  const token = localStorage.getItem("auth_jwt");
  const url = `${serverPath}${path}`;
  try {
    return await axios({
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
  } catch (error) {
    console.log(`error while calling: ${method} ${url}`);
    console.log(JSON.stringify(error));
    throw error;
  }
}

async function loadEncodedFile(fileId) {
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

function replaceIframe(content) {
  let iframe = document.getElementById("content-iframe");
  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(content);
  iframe.contentWindow.document.close();
}

function replaceIframeInnerContent(content) {
  const iframe = document.getElementById("content-iframe");
  const iframeDocument = iframe.contentWindow.document;
  let innerContentDiv = iframeDocument.getElementById("page-inner-content");
  innerContentDiv.innerHTML = content;
  let scripts = innerContentDiv.getElementsByTagName("script");
  for (let script of scripts) {
    iframe.contentWindow.eval(script.innerHTML);
  }
  const scmodal = iframe.contentWindow.$("#scmodal");
  if (scmodal) {
    scmodal.modal("hide");
  }
  iframe.contentWindow.initialize_page();
}

async function gotoEntryView() {
  const entryPath = config.entry_view;
  const page = await router.resolve({
    pathname: entryPath,
  });
  addRoute({ entryPath, query: undefined });
  replaceIframeInnerContent(page.content);
}

async function handleRoute(route, query, files) {
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
    replaceIframeInnerContent(page.content);
  }
}

async function goBack(steps = 1, exitOnFirstPage = false) {
  if (exitOnFirstPage && routingHistory.length === 1) {
    navigator.app.exitApp();
  } else if (routingHistory.length <= steps) {
    routingHistory = [];
    await gotoEntryView();
  } else {
    routingHistory = routingHistory.slice(0, routingHistory.length - steps);
    const newCurrent = routingHistory.pop();
    await handleRoute(newCurrent.route, newCurrent.query);
  }
}
