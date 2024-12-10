/*eslint-env browser*/
/*global $, KTDrawer, submitWithEmptyAction, is_paging_param, bootstrap, common_done, unique_field_from_rows, inline_submit_success, get_current_state_url, initialize_page */

function combineFormAndQuery(form, query) {
  let paramsList = [];
  const formData = new FormData(form[0]);
  for (const [k, v] of formData.entries()) {
    paramsList.push(`${k}=${v}`);
  }
  let sp = new URLSearchParams(query);
  for (let [k, v] of sp.entries()) {
    if (k === "redirect") v = `get${v}`;
    paramsList.push(`${k}=${v}`);
  }
  return paramsList.length > 0 ? `?${paramsList.join("&")}` : undefined;
}

/**
 * Pass View or Page source into the app internal router,
 * links with an URL source are opened in the system browser.
 * @param {string} url
 * @param {string} linkSrc - URL, View or Page
 */
async function execLink(url, linkSrc) {
  if (linkSrc === "URL") {
    parent.cordova.InAppBrowser.open(url, "_system");
  } else
    try {
      if (document.getElementById("scspinner")) return;
      showLoadSpinner();
      if (url.startsWith("javascript:")) eval(url.substring(11));
      else {
        const { path, query } =
          parent.saltcorn.mobileApp.navigation.splitPathQuery(url);
        const safePath = path.startsWith("http")
          ? new URL(path).pathname
          : path;
        await parent.saltcorn.mobileApp.navigation.handleRoute(
          `get${safePath}`,
          query
        );
      }
    } finally {
      removeLoadSpinner();
    }
}

async function runUrl(url, method = "get") {
  const { path, query } =
    parent.saltcorn.mobileApp.navigation.splitPathQuery(url);
  const page = await parent.saltcorn.mobileApp.navigation.router.resolve({
    pathname: `${method}${path}`,
    query: query,
  });
  return page.content;
}

async function execNavbarLink(url) {
  if (document.getElementById("scspinner")) return;
  $(".navbar-toggler").click();
  if (typeof KTDrawer === "function") {
    const aside = $("#kt_aside")[0];
    if (aside) {
      const kAside = KTDrawer.getInstance(aside);
      kAside.hide();
    }
  }
  execLink(url);
}

/**
 *
 * @param {*} e
 * @param {*} urlSuffix
 * @returns
 */
async function formSubmit(e, urlSuffix, viewname, noSubmitCb, matchingState) {
  try {
    showLoadSpinner();
    if (!noSubmitCb) e.submit();
    const files = {};
    const urlParams = new URLSearchParams();
    const data = matchingState ? {} : null;
    for (const entry of new FormData(e).entries()) {
      if (entry[1] instanceof File) files[entry[0]] = entry[1];
      else {
        // is there a hidden input with a filename?
        const domEl = $(e).find(
          `[name='${entry[0]}'][mobile-camera-input='true']`
        );
        if (domEl.length > 0) {
          const tokens = entry[1].split("/");
          const fileName = tokens[tokens.length - 1];
          const directory = tokens.splice(0, tokens.length - 1).join("/");
          const { buffer, file } =
            await parent.saltcorn.mobileApp.fileSystem.readBinaryCordova(
              fileName,
              directory
            );
          files[entry[0]] = {
            blob: new Blob([buffer], { type: file.type }),
            fileObj: file,
          };
        } else if (!matchingState) urlParams.append(entry[0], entry[1]);
        else data[entry[0]] = entry[1];
      }
    }
    const queryStr = !matchingState
      ? urlParams.toString()
      : parent.saltcorn.mobileApp.navigation.currentQuery() || "";
    await parent.saltcorn.mobileApp.navigation.handleRoute(
      `post${urlSuffix}${viewname}`,
      queryStr,
      files,
      data
    );
  } finally {
    removeLoadSpinner();
  }
}

async function inline_local_submit(e, opts1) {
  try {
    e.preventDefault();
    showLoadSpinner();
    const opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
    const form = $(e.target).closest("form");
    const urlParams = new URLSearchParams();
    for (const entry of new FormData(form[0]).entries()) {
      urlParams.append(entry[0], entry[1]);
    }
    const url = form.attr("action");
    await parent.saltcorn.mobileApp.navigation.router.resolve({
      pathname: `post${url}`,
      query: urlParams.toString(),
    });
    inline_submit_success(e, form, opts);
  } catch (error) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  } finally {
    removeLoadSpinner();
  }
}

function saveAndContinueAsync(e, action) {
  return new Promise((resolve, reject) => {
    saveAndContinue(e, action, (x) => resolve(x));
  });
}

async function saveAndContinue(e, action, k) {
  try {
    showLoadSpinner();
    const form = $(e).closest("form");
    submitWithEmptyAction(form[0]);
    const queryStr = new URLSearchParams(new FormData(form[0])).toString();
    const res = await parent.saltcorn.mobileApp.navigation.router.resolve({
      pathname: `post${action}`,
      query: queryStr,
      xhr: true,
    });
    if (res.id && form.find("input[name=id")) {
      form.append(
        `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
      );
    }
    if (k) await k();
    // TODO ch error (request.responseText?)
  } finally {
    removeLoadSpinner();
  }
}

async function login(e, entryPoint, isSignup) {
  try {
    showLoadSpinner();
    const formData = new FormData(e);
    await parent.saltcorn.mobileApp.auth.login({
      email: formData.get("email"),
      password: formData.get("password"),
      isSignup,
      entryPoint,
    });
  } finally {
    removeLoadSpinner();
  }
}

async function publicLogin(entryPoint) {
  try {
    showLoadSpinner();
    await parent.saltcorn.mobileApp.auth.publicLogin(entryPoint);
  } finally {
    removeLoadSpinner();
  }
}

async function logout() {
  try {
    showLoadSpinner();
    await parent.saltcorn.mobileApp.auth.logout();
  } finally {
    removeLoadSpinner();
  }
}

async function signupFormSubmit(e, entryView) {
  try {
    await login(e, entryView, true);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  }
}

async function loginFormSubmit(e, entryView) {
  try {
    let safeEntryView = entryView;
    if (!safeEntryView) {
      const config = parent.saltcorn.data.state.getState().mobileConfig;
      if (!config.entry_point) throw new Error("Unable to find an entry-point");
      safeEntryView = config.entry_point;
    }
    await login(e, safeEntryView, false);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  }
}

async function local_post_btn(e) {
  try {
    showLoadSpinner();
    const form = $(e).closest("form");
    const url = form.attr("action");
    const method = form.attr("method");
    const { path, query } =
      parent.saltcorn.mobileApp.navigation.splitPathQuery(url);
    await parent.saltcorn.mobileApp.navigation.handleRoute(
      `${method}${path}`,
      combineFormAndQuery(form, query)
    );
  } finally {
    removeLoadSpinner();
  }
}

/**
 *
 * @param {*} e
 * @param {*} path
 */
async function stateFormSubmit(e, path) {
  try {
    showLoadSpinner();
    const formQuery = new URLSearchParams(new FormData(e)).toString();
    await parent.saltcorn.mobileApp.navigation.handleRoute(path, formQuery);
  } finally {
    removeLoadSpinner();
  }
}

function removeQueryStringParameter(queryStr, key) {
  let params = [];
  for (const [k, v] of new URLSearchParams(queryStr).entries()) {
    if (k !== key) {
      params.push(`${k}=${v}`);
    }
  }
  return params.join("&");
}

function updateQueryStringParameter(queryStr, key, value) {
  if (!queryStr) {
    return `${key}=${value}`;
  }
  let params = [];
  let updated = false;
  for (const [k, v] of new URLSearchParams(queryStr).entries()) {
    if (k === key) {
      params.push(`${key}=${value}`);
      updated = true;
    } else {
      params.push(`${k}=${v}`);
    }
  }
  if (!updated) {
    params.push(`${key}=${value}`);
  }
  return params.join("&");
}

function invalidate_pagings(currentQuery) {
  let newQuery = currentQuery;
  const queryObj = Object.fromEntries(new URLSearchParams(newQuery).entries());
  const toRemove = Object.keys(queryObj).filter((val) => is_paging_param(val));
  for (const k of toRemove) {
    newQuery = removeQueryStringParameter(newQuery, k);
  }
  return newQuery;
}

async function set_state_fields(kvs, disablePjax, e) {
  try {
    showLoadSpinner();
    let newhref = get_current_state_url(e);
    let queryParams = [];
    const { path, query } =
      parent.saltcorn.mobileApp.navigation.splitPathQuery(newhref);
    let currentQuery = query || {};
    if (Object.keys(kvs).some((k) => !is_paging_param(k))) {
      currentQuery = invalidate_pagings(currentQuery);
    }
    Object.entries(kvs).forEach((kv) => {
      if (kv[1].unset && kv[1].unset === true) {
        currentQuery = removeQueryStringParameter(currentQuery, kv[0]);
      } else {
        currentQuery = updateQueryStringParameter(currentQuery, kv[0], kv[1]);
      }
    });
    for (const [k, v] of new URLSearchParams(currentQuery).entries()) {
      queryParams.push(`${k}=${v}`);
    }
    const queryStr = queryParams.join("&");
    if (disablePjax)
      await parent.saltcorn.mobileApp.navigation.handleRoute(path, queryStr);
    else await pjax_to(path, queryStr, e);
  } finally {
    removeLoadSpinner();
  }
}

async function pjax_to(href, query, e) {
  const safeHref = href.startsWith("get") ? href.substring(3) : href;
  const path = `${safeHref}?${query}`;
  let $modal = $("#scmodal");
  const inModal = $modal.length && $modal.hasClass("show");
  const localizer = e ? $(e).closest("[data-sc-local-state]") : [];
  let $dest = localizer.length
    ? localizer
    : inModal
    ? $("#scmodal .modal-body")
    : $("#page-inner-content");
  if (!$dest.length)
    await parent.saltcorn.mobileApp.navigation.handleRoute(safeHref, query);
  else
    try {
      const headers = {
        pjaxpageload: "true",
      };
      if (localizer.length) headers.localizedstate = "true";
      const result = await parent.saltcorn.mobileApp.api.apiCall({
        path: path,
        method: "GET",
        additionalHeaders: headers,
      });
      if (!inModal && !localizer.length) {
        // not sure for mobile
        // window.history.pushState({ url: href }, "", href);
      }
      if (inModal && !localizer.length)
        $(".sc-modal-linkout").attr("href", path);
      $dest.html(result.data);
      if (localizer.length) localizer.attr("data-sc-local-state", path);
      initialize_page();
    } catch (error) {
      parent.saltcorn.mobileApp.common.errorAlert(error);
    }
}

async function set_state_field(key, value) {
  try {
    showLoadSpinner();
    const query = updateQueryStringParameter(
      parent.saltcorn.mobileApp.navigation.currentQuery(),
      key,
      value
    );
    await parent.saltcorn.mobileApp.navigation.handleRoute(
      parent.saltcorn.mobileApp.navigation.currentLocation(),
      query
    );
  } finally {
    removeLoadSpinner();
  }
}

async function unset_state_field(key) {
  try {
    showLoadSpinner();
    const href = parent.saltcorn.mobileApp.navigation.currentLocation();
    const query = removeQueryStringParameter(
      parent.saltcorn.mobileApp.navigation.currentLocation(),
      key
    );
    await parent.saltcorn.mobileApp.navigation.handleRoute(href, query);
  } finally {
    removeLoadSpinner();
  }
}

async function sortby(k, desc, viewIdentifier, e) {
  await set_state_fields(
    {
      [`_${viewIdentifier}_sortby`]: k,
      [`_${viewIdentifier}_sortdesc`]: desc ? "on" : { unset: true },
    },
    false,
    e
  );
}

async function gopage(n, pagesize, viewIdentifier, extra, e) {
  await set_state_fields(
    {
      ...extra,
      [`_${viewIdentifier}_page`]: n,
      [`_${viewIdentifier}_pagesize`]: pagesize,
    },
    false,
    e
  );
}

function ajax_modal(url, opts = {}) {
  mobile_modal(url, opts);
}

async function mobile_modal(url, opts = {}) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal" class="modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">            
          </button>
          <div
            id="modal-toasts-area"
            class="toast-container position-fixed top-0 start-50 p-0"
            style: "z-index: 7000;"
            aria-live="polite"
            aria-atomic="true">
          </div>
        </div>
        <div class="modal-body">
          <p>Modal body text goes here.</p>
        </div>
      </div>
    </div>
  </div>`);
  } else if ($("#scmodal").hasClass("show")) {
    var myModalEl = document.getElementById("scmodal");
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.dispose();
  }
  if (opts.submitReload === false) $("#scmodal").addClass("no-submit-reload");
  else $("#scmodal").removeClass("no-submit-reload");
  try {
    const { path, query } =
      parent.saltcorn.mobileApp.navigation.splitPathQuery(url);
    const mobileConfig = parent.saltcorn.data.state.getState().mobileConfig;
    if (
      mobileConfig.networkState === "none" &&
      mobileConfig.allowOfflineMode &&
      !mobileConfig.isOfflineMode
    ) {
      await parent.saltcorn.mobileApp.offlineMode.startOfflineMode();
      parent.saltcorn.mobileApp.navigation.clearHistory();
      await parent.saltcorn.mobileApp.navigation.gotoEntryView();
    } else {
      const page = await parent.saltcorn.mobileApp.navigation.router.resolve({
        pathname: `get${path}`,
        query: query,
        alerts: [],
      });
      const modalContent = page.content;
      const title = page.title;
      if (title) $("#scmodal .modal-title").html(title);
      $("#scmodal .modal-body").html(modalContent);
      new bootstrap.Modal($("#scmodal")).show();
      // onOpen onClose initialize_page?
    }
  } catch (error) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

function closeModal() {
  $("#scmodal").modal("toggle");
}

async function local_post(url, args) {
  try {
    showLoadSpinner();
    const result = await parent.saltcorn.mobileApp.navigation.router.resolve({
      pathname: `post${url}`,
      data: args,
    });
    if (result.redirect)
      await parent.saltcorn.mobileApp.navigation.handleRoute(result.redirect);
    else await common_done(result, "", false);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  } finally {
    removeLoadSpinner();
  }
}

async function local_post_json(url, data, cb) {
  try {
    showLoadSpinner();
    const result = await parent.saltcorn.mobileApp.navigation.router.resolve({
      pathname: `post${url}`,
      data: data,
      query: parent.saltcorn.mobileApp.navigation.currentQuery(),
    });
    if (result.server_eval) await evalServerCode(url);
    if (result.redirect)
      await parent.saltcorn.mobileApp.navigation.handleRoute(result.redirect);
    else await common_done(result, "", false);
    if (cb?.success) cb.success(result);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
    if (cb?.error) cb.error(error);
  } finally {
    removeLoadSpinner();
  }
}

async function evalServerCode(url) {
  await parent.saltcorn.mobileApp.api.apiCall({
    method: "POST",
    path: url,
  });
}

async function make_unique_field(
  id,
  table_id,
  field_name,
  elem,
  space,
  start,
  always_append,
  char_type
) {
  const value = $(elem).val();
  if (!value) return;
  const path = `/api/${table_id}?approximate=true&${encodeURIComponent(
    field_name
  )}=${encodeURIComponent(value)}&fields=${encodeURIComponent(field_name)}`;
  try {
    // TODO ch support local tables
    const response = await parent.saltcorn.mobileApp.api.apiCall({
      method: "GET",
      path,
    });
    if (response.data.success) {
      unique_field_from_rows(
        response.data.success,
        id,
        field_name,
        space,
        start,
        always_append,
        char_type,
        value
      );
    }
  } catch (error) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: "unable to 'make_unique_field'",
      },
    ]);
    console.error(error);
  }
}

function openFile(fileId) {
  const config = parent.saltcorn.data.state.getState().mobileConfig;
  const serverPath = config.server_path;
  const token = config.jwt;
  const url = `${serverPath}/files/serve/${encodeURIComponent(
    fileId
  )}?jwt=${token}`;
  parent.cordova.InAppBrowser.open(
    url,
    "_blank",
    "clearcache=yes,clearsessioncache=yes,location=no,toolbar=yes,toolbarposition=top"
  );
}

function openInAppBrowser(url, domId) {
  try {
    $(`#${domId}`).find(".spinner-border").removeClass("d-none");
    const ref = parent.cordova.InAppBrowser.open(
      url,
      "_blank",
      "clearcache=yes,clearsessioncache=yes,location=no,toolbar=yes,toolbarposition=top"
    );
    ref.addEventListener("exit", function () {
      $(`#${domId}`).find(".spinner-border").addClass("d-none");
    });
  } catch (error) {
    $(`#${domId}`).find(".spinner-border").addClass("d-none");
    parent.errorAlert(error);
  }
}

async function select_id(id) {
  try {
    showLoadSpinner();
    const newQuery = updateQueryStringParameter(
      parent.saltcorn.mobileApp.navigation.currentQuery(),
      "id",
      id
    );
    await parent.handleRoute(
      parent.saltcorn.mobileApp.navigation.currentLocation(),
      newQuery
    );
  } finally {
    removeLoadSpinner();
  }
}

async function check_state_field(that) {
  try {
    showLoadSpinner();
    const name = that.name;
    const newQuery = that.checked
      ? updateQueryStringParameter(
          parent.saltcorn.mobileApp.navigation.currentQuery(),
          name,
          that.value
        )
      : removeQueryStringParameter(name);
    await parent.saltcorn.mobileApp.navigation.handleRoute(
      parent.saltcorn.mobileApp.navigation.currentLocation(),
      newQuery
    );
  } finally {
    removeLoadSpinner();
  }
}

async function clear_state() {
  try {
    showLoadSpinner();
    await parent.saltcorn.mobileApp.navigation.handleRoute(
      parent.saltcorn.mobileApp.navigation.currentLocation(),
      undefined
    );
  } finally {
    removeLoadSpinner();
  }
}

async function view_post(viewnameOrElem, route, data, onDone, sendState) {
  const viewname =
    typeof viewnameOrElem === "string"
      ? viewnameOrElem
      : $(viewnameOrElem)
          .closest("[data-sc-embed-viewname]")
          .attr("data-sc-embed-viewname");
  const buildQuery = () => {
    const query = parent.saltcorn.mobileApp.navigation.currentQuery();
    return query ? `?${query}` : "";
  };
  const mobileConfig = parent.saltcorn.data.state.getState().mobileConfig;
  const view = parent.saltcorn.data.models.View.findOne({ name: viewname });
  try {
    showLoadSpinner();
    let respData = undefined;
    const query = sendState ? buildQuery() : "";
    if (
      mobileConfig.isOfflineMode ||
      (view?.table_id && mobileConfig.localTableIds.indexOf(view.table_id) >= 0)
    ) {
      respData = await parent.saltcorn.mobileApp.navigation.router.resolve({
        pathname: `post/view/${viewname}/${route}`,
        data,
        query,
      });
    } else {
      const response = await parent.saltcorn.mobileApp.api.apiCall({
        method: "POST",
        path: "/view/" + viewname + "/" + route + query,
        body: data,
      });
      if (response) respData = response.data;
    }

    if (!respData)
      throw new Error(`The response of '${viewname}/${route}' is ${respData}`);
    if (onDone) await onDone(respData);
    await common_done(respData, viewname, false);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  } finally {
    removeLoadSpinner();
  }
}

function setNetworSwitcherOn() {
  $("#networkModeSwitcherId").prop("checked", true);
  $("#onlineDescId").prop("class", "d-block");
  $("#offlineDescId").prop("class", "d-none");
}

function setNetworkSwitcherOff() {
  $("#networkModeSwitcherId").prop("checked", false);
  $("#onlineDescId").prop("class", "d-none");
  $("#offlineDescId").prop("class", "d-block");
}

async function switchNetworkMode() {
  try {
    const state = parent.saltcorn.data.state.getState();
    const { isOfflineMode, networkState } = state.mobileConfig;
    if (!isOfflineMode) {
      await parent.saltcorn.mobileApp.offlineMode.startOfflineMode();
      parent.saltcorn.mobileApp.navigation.clearHistory();
      parent.saltcorn.mobileApp.navigation.addRoute({ route: "/" });
      parent.saltcorn.mobileApp.navigation.addRoute({
        route: "get/sync/sync_settings",
      });
      parent.saltcorn.mobileApp.common.showAlerts(
        [
          {
            type: "info",
            msg: parent.saltcorn.mobileApp.offlineMode.getOfflineMsg(),
          },
        ],
        false
      );
      parent.saltcorn.mobileApp.common.clearAlerts();
    } else {
      if (networkState === "none")
        throw new Error("No internet connection is available.");
      await parent.saltcorn.mobileApp.offlineMode.endOfflineMode();
      parent.saltcorn.mobileApp.navigation.clearHistory();
      parent.saltcorn.mobileApp.navigation.addRoute({ route: "/" });
      parent.saltcorn.mobileApp.navigation.addRoute({
        route: "get/sync/sync_settings",
      });
      parent.saltcorn.mobileApp.common.showAlerts([
        {
          type: "info",
          msg: "You are online again.",
        },
      ]);
      parent.saltcorn.mobileApp.common.clearTopAlerts();
    }
  } catch (error) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: `Unable to change the network mode: ${
          error.message ? error.message : "Unknown error"
        }`,
      },
    ]);
  } finally {
    const { isOfflineMode } =
      parent.saltcorn.data.state.getState().mobileConfig;
    if (isOfflineMode) setNetworkSwitcherOff();
    else setNetworSwitcherOn();
  }
}

async function callSync() {
  try {
    const mobileConfig = parent.saltcorn.data.state.getState().mobileConfig;
    if (mobileConfig.networkState === "none") {
      parent.saltcorn.mobileApp.common.showAlerts([
        {
          type: "error",
          msg: "You don't have an internet connection.",
        },
      ]);
    } else {
      const wasOffline = mobileConfig.isOfflineMode;
      showLoadSpinner();
      await parent.saltcorn.mobileApp.offlineMode.sync();
      parent.saltcorn.mobileApp.common.clearAlerts();
      if (!wasOffline) {
        parent.saltcorn.mobileApp.common.showAlerts([
          {
            type: "info",
            msg: "Synchronized your offline data.",
          },
        ]);
      } else {
        setNetworSwitcherOn();
        parent.saltcorn.mobileApp.navigation.clearHistory();
        parent.saltcorn.mobileApp.navigation.addRoute({ route: "/" });
        parent.saltcorn.mobileApp.navigation.addRoute({
          route: "get/sync/sync_settings",
        });
        parent.saltcorn.mobileApp.common.showAlerts([
          {
            type: "info",
            msg: "Synchronized your offline data, you are online again.",
          },
        ]);
        parent.saltcorn.mobileApp.common.clearTopAlerts();
      }
    }
  } catch (error) {
    console.log(error);
    parent.saltcorn.mobileApp.common.errorAlert(error);
  } finally {
    removeLoadSpinner();
  }
}

async function deleteOfflineDataClicked() {
  const lastOfflineSession =
    await parent.saltcorn.mobileApp.offlineMode.getLastOfflineSession();
  const { user } = parent.saltcorn.data.state.getState().mobileConfig;
  if (!lastOfflineSession?.offlineUser) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: "You don't have any offline data.",
      },
    ]);
  } else if (lastOfflineSession.offlineUser !== user.email) {
    parent.saltcorn.mobileApp.common.showAlerts([
      {
        type: "error",
        msg: `The offline data is owned by '${lastOfflineSession.offlineUser}'.`,
      },
    ]);
  } else {
    mobile_modal("/sync/ask_delete_offline_data");
  }
}

function showLoadSpinner() {
  if (!parent.saltcorn.mobileApp.navigation.isHtmlFile()) {
    const spinner = $("#scspinner");
    if (spinner.length === 0) {
      $("body").append(`
      <div 
        id="scspinner" 
        style="position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999;"
        spinner-count="1"
      >
        <div 
          style="position: absolute;
            left: 50%;
            top: 50%;
            height: 60px;
            width: 250px;
            margin: 0px auto;"
        >
          <span 
            class="spinner-border d-block"
            role="status"
          >
            <span class="visually-hidden">Loading...</span>
          </span>
          <span 
            style="margin-left: -125px"
            id="scspinner-text-id"
            class="d-none fs-5 fw-bold bg-secondary text-white p-1 rounded"
          >
          </span>
        </div>
      </div>`);
    } else {
      const count = parseInt(spinner.attr("spinner-count")) + 1;
      spinner.attr("spinner-count", count);
    }
  }
}

function removeLoadSpinner() {
  if (!parent.saltcorn.mobileApp.navigation.isHtmlFile()) {
    const spinner = $("#scspinner");
    if (spinner.length > 0) {
      const count = parseInt(spinner.attr("spinner-count")) - 1;
      if (count === 0) spinner.remove();
      else spinner.attr("spinner-count", count);
    }
  }
}

/**
 * is called when an input with capture=camera is used
 * It takes a picture with the camera plugin, saves the file, and adds the filename as a hidden input.
 * @param {*} fieldName
 */
async function getPicture(fieldName) {
  try {
    const form = $(`#cptbtn${fieldName}`).closest("form");
    const onsubmit = form.attr("onsubmit");
    form.attr("onsubmit", "javascript:void(0)");
    const fileURI = await parent.saltcorn.mobileApp.common.takePhoto("uri");
    form.attr("onsubmit", onsubmit);
    const inputId = `input${fieldName}`;
    form.find(`#${inputId}`).remove();
    form.append(
      `<input class="d-none" id="${inputId}" name="${fieldName}" value="${fileURI}" mobile-camera-input="true" />`
    );
    const tokens = fileURI.split("/");
    $(`#cpt-file-name-${fieldName}`).text(tokens[tokens.length - 1]);
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  }
}

async function updateMatchingRows(e, viewname) {
  try {
    const form = $(e).closest("form");
    await formSubmit(
      form[0],
      "/view/",
      `${viewname}/update_matching_rows`,
      false,
      true
    );
  } catch (error) {
    parent.saltcorn.mobileApp.common.errorAlert(error);
  }
}

function reload_on_init() {
  console.log("not yet supported");
}
