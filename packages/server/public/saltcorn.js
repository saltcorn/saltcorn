function sortby(k, desc, viewIdentifier, e) {
  set_state_fields(
    {
      [viewIdentifier ? `_${viewIdentifier}_sortby` : "_sortby"]: k,
      [viewIdentifier ? `_${viewIdentifier}_sortdesc` : "_sortdesc"]: desc
        ? "on"
        : { unset: true },
    },
    false,
    e
  );
}
function gopage(n, pagesize, viewIdentifier, extra = {}, e) {
  const cfg = {
    ...extra,
    [viewIdentifier ? `_${viewIdentifier}_page` : "_page"]: n,
    [viewIdentifier ? `_${viewIdentifier}_pagesize` : "_pagesize"]: pagesize,
  };
  set_state_fields(cfg, false, e);
}

if (localStorage.getItem("reload_on_init")) {
  localStorage.removeItem("reload_on_init");
  location.reload();
}

//https://stackoverflow.com/a/6021027
function updateQueryStringParameter(uri1, key, value) {
  let hash = "";
  let uri = uri1;
  if (uri && uri.includes("#")) {
    let uris = uri1.split("#");
    hash = "#" + uris[1];
    uri = uris[0];
  }

  var re = new RegExp("([?&])" + escapeRegExp(key) + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (value === "") {
    return removeQueryStringParameter(uri, key);
  } else if (uri.match(re)) {
    if (Array.isArray(value)) {
      var rmuri = removeQueryStringParameter(uri, key);
      return updateQueryStringParameter(rmuri, key, value);
    } else
      return (
        uri.replace(re, "$1" + key + "=" + encodeURIComponent(value) + "$2") +
        hash
      );
  } else {
    if (Array.isArray(value))
      return (
        uri +
        separator +
        value.map((val) => key + "=" + encodeURIComponent(val)).join("&") +
        hash
      );
    else return uri + separator + key + "=" + encodeURIComponent(value) + hash;
  }
}

function updateQueryStringParameters(uri1, kvs) {
  let uri = uri1;
  Object.entries(kvs).forEach((kv) => {
    uri = updateQueryStringParameter(uri, kv[0], kv[1]);
  });
  return uri;
}

function removeQueryStringParameter(uri1, key, value) {
  let hash = "";
  let uri = uri1;
  if (uri && uri.includes("#")) {
    let uris = uri1.split("#");
    hash = "#" + uris[1];
    uri = uris[0];
  }
  let re;
  if (value) {
    re = new RegExp(
      "([?&])" + escapeRegExp(key) + "=" + encodeURIComponent(value) + "?(&|$)",
      "gi"
    );
  } else {
    re = new RegExp("([?&])" + escapeRegExp(key) + "=.*?(&|$)", "gi");
  }
  if (uri.match(re)) {
    uri = uri.replace(re, "$1" + "$2");
  }
  if (uri[uri.length - 1] === "?" || uri[uri.length - 1] === "&")
    uri = uri.substring(0, uri.length - 1);
  if (uri.match(re)) return removeQueryStringParameter(uri + hash, key);
  return uri + hash;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addQueryStringParameter(uri1, key, value) {
  let hash = "";
  let uri = uri1;
  if (uri && uri.includes("#")) {
    let uris = uri1.split("#");
    hash = "#" + uris[1];
    uri = uris[0];
  }
  var re = new RegExp(
    "([?&])" + escapeRegExp(key) + "=" + value + "?(&|$)",
    "gi"
  );
  if (uri.match(re)) return uri1;

  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (Array.isArray(value))
    return (
      uri +
      separator +
      value.map((val) => key + "=" + encodeURIComponent(val)).join("&") +
      hash
    );
  else return uri + separator + key + "=" + encodeURIComponent(value) + hash;
}

function select_id(id, e) {
  pjax_to(updateQueryStringParameter(get_current_state_url(e), "id", id), e);
}

function set_state_field(key, value, e) {
  pjax_to(updateQueryStringParameter(get_current_state_url(e), key, value), e);
}

function check_state_field(that, e) {
  const checked = that.checked;
  const name = that.name;
  const value = that.value;
  let dest;
  if (checked)
    dest = addQueryStringParameter(get_current_state_url(e), name, value);
  else dest = removeQueryStringParameter(get_current_state_url(e), name, value);
  console.log({ dest, name, value, tvalue: that.value });

  pjax_to(dest.replace("&&", "&").replace("?&", "?"), e);
}

function invalidate_pagings(href) {
  let newhref = href;
  const prev = new URL(window.location.href);
  const queryObj = Object.fromEntries(
    new URL(newhref, prev.origin).searchParams.entries()
  );
  const toRemove = Object.keys(queryObj).filter((val) => is_paging_param(val));
  for (const k of toRemove) {
    newhref = removeQueryStringParameter(newhref, k);
  }
  return newhref;
}

function set_state_fields(kvs, disable_pjax, e) {
  let newhref = get_current_state_url(e);
  const oldhref = newhref;
  if (Object.keys(kvs).some((k) => !is_paging_param(k))) {
    newhref = invalidate_pagings(newhref);
  }
  Object.entries(kvs).forEach((kv) => {
    if (kv[1]?.unset && kv[1]?.unset === true)
      newhref = removeQueryStringParameter(newhref, kv[0]);
    else newhref = updateQueryStringParameter(newhref, kv[0], kv[1]);
  });
  if (newhref === oldhref) return;
  if (disable_pjax) href_to(newhref.replace("&&", "&").replace("?&", "?"));
  else pjax_to(newhref.replace("&&", "&").replace("?&", "?"), e);
}
function unset_state_field(key, e) {
  pjax_to(removeQueryStringParameter(get_current_state_url(e), key), e);
}

let loadPage = true;
$(function () {
  $(window).bind("popstate", function (event) {
    const ensure_no_final_hash = (s) => (s.endsWith("#") ? s.slice(0, -1) : s);
    const newUrl = ensure_no_final_hash(window.location.href);
    if (loadPage && newUrl !== window.location.href)
      window.location.assign(newUrl);
  });
});

function pjax_to(href, e) {
  let $modal = $("#scmodal");
  const inModal = $modal.length && $modal.hasClass("show");
  const localizer = e ? $(e).closest("[data-sc-local-state]") : [];
  let $dest = localizer.length
    ? localizer
    : inModal
      ? $("#scmodal .modal-body")
      : $("#page-inner-content");
  if (!$dest.length) window.location.href = href;
  else {
    loadPage = false;
    const headers = {
      pjaxpageload: "true",
    };
    if (localizer.length) headers.localizedstate = "true";
    $.ajax(href, {
      headers,
      success: function (res, textStatus, request) {
        if (!inModal && !localizer.length)
          window.history.pushState({ url: href }, "", href);
        if (inModal && !localizer.length)
          $(".sc-modal-linkout").attr("href", href);
        setTimeout(() => {
          loadPage = true;
        }, 0);
        if (!inModal && !localizer.length && res.includes("<!--SCPT:")) {
          const start = res.indexOf("<!--SCPT:");
          const end = res.indexOf("-->", start);
          document.title = res.substring(start + 9, end);
        }
        $dest.html(res);
        if (localizer.length) localizer.attr("data-sc-local-state", href);
        let $modal = $("#scmodal");
        if ($modal.length && $modal.hasClass("show"))
          $modal.prop("data-modal-state", href);
        initialize_page();
        document.dispatchEvent(new Event("pjax-loaded"));
      },
      error: function (res) {
        if (!checkNetworkError(res))
          notifyAlert({ type: "danger", text: res.responseText });
      },
    });
  }
}

function href_to(href) {
  window.location.href = href;
}
function clear_state(omit_fields_str, e) {
  let newUrl = get_current_state_url(e).split("?")[0];
  const hash = get_current_state_url(e).split("#")[1];
  if (omit_fields_str) {
    const omit_fields = omit_fields_str.split(",").map((s) => s.trim());
    let qs = (get_current_state_url(e).split("?")[1] || "").split("#")[0];
    let params = new URLSearchParams(qs);
    newUrl = newUrl + "?";
    omit_fields.forEach((f) => {
      if (params.get(f))
        newUrl = updateQueryStringParameter(newUrl, f, params.get(f));
    });
  }
  if (hash) newUrl += "#" + hash;

  pjax_to(newUrl, e);
}

function ajax_done(res, viewname) {
  common_done(res, viewname);
}

function spin_action_link(e) {
  const $e = $(e);
  const width = $e.width();
  const height = $e.height();

  $e.attr("data-innerhtml-prespin", $e.html());
  $e.attr("data-previous-onclick", $e.attr("onclick"));
  $e.attr("onclick", "void(0)");
  $e.html('<i class="fas fa-spinner fa-spin"></i>').width(width).height(height);
  $(document).trigger("activate-spinner", $e);
  //null onclick
  $e.trigger("spin");
}

function reset_spinners() {
  $("[data-innerhtml-prespin]").each(function () {
    $e = $(this);
    $e.html($e.attr("data-innerhtml-prespin"));
    $e.removeAttr("data-innerhtml-prespin");
    const prevOnclick = $e.attr("data-previous-onclick");
    if (prevOnclick && prevOnclick !== "void(0)") {
      $e.attr("onclick", prevOnclick);
      $e.removeAttr("data-previous-onclick");
    }

    //reset onclick
  });
}

let last_route_viewname;

function view_post(viewnameOrElem, route, data, onDoneOrObj, sendState) {
  let onDone,
    sendState1,
    runAsync = false;
  if (onDoneOrObj && typeof onDoneOrObj === "object") {
    onDone = onDoneOrObj.onDone;
    sendState1 = onDoneOrObj.sendState;
    runAsync = onDoneOrObj.runAsync;
  } else {
    onDone = onDoneOrObj;
    sendState1 = sendState;
  }
  const viewname =
    typeof viewnameOrElem === "string"
      ? viewnameOrElem
      : $(viewnameOrElem)
          .closest("[data-sc-embed-viewname]")
          .attr("data-sc-embed-viewname");
  last_route_viewname = viewname;
  const query = sendState1
    ? `?${new URL(get_current_state_url()).searchParams.toString()}`
    : "";
  const isFormData = data instanceof FormData;
  $.ajax("/view/" + viewname + "/" + route + query, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    ...(!isFormData
      ? {
          dataType: "json",
          contentType:
            typeof data === "string"
              ? "application/x-www-form-urlencoded"
              : "application/json",
          data: typeof data === "string" ? data : JSON.stringify(data),
        }
      : { contentType: false, processData: false, data: data }),
  })
    .done(function (res) {
      if (onDone) onDone(res);
      ajax_done(res, viewnameOrElem);
      if (!runAsync) reset_spinners();
    })
    .fail(function (res) {
      if (!checkNetworkError(res))
        notifyAlert({ type: "danger", text: res.responseText });
      reset_spinners();
    });
}
let logged_errors = [];
let error_catcher_enabled = false;
function enable_error_catcher() {
  if (error_catcher_enabled) return;
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      window.onerror = globalErrorCatcher;
    },
    false
  );
  error_catcher_enabled = true;
}

function globalErrorCatcher(message, source, lineno, colno, error) {
  if (error && error.preventDefault) error.preventDefault();
  if (logged_errors.includes(message)) return;
  logged_errors.push(message);
  const data = { message, stack: (error && error.stack) || "" };
  $.ajax("/crashlog/", {
    dataType: "json",
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    contentType: "application/json",
    data: JSON.stringify(data),
  });
}

function ensure_modal_exists_and_closed(opts) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal" class="modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <div class="">
            <span class="sc-ajax-indicator-wrapper">
              <span class="sc-ajax-indicator ms-2" style="display: none;"><i class="fas fa-save"></i></span>
            </span>
            <a class="sc-modal-linkout ms-2" onclick="close_saltcorn_modal()" href="" target="_blank"><i class="fas fa-expand-alt"></i></a>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">            
            </button>
          </div>
          <div 
            id="modal-toasts-area"
            class="toast-container position-fixed top-0 end-0 p-2 "
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
  } else if ($("#scmodal").hasClass("show") && !opts?.open) {
    // remove reload handler added by edit, for when we have popup link
    // in autosave edit in popup
    $("#scmodal").off("hidden.bs.modal");
    close_saltcorn_modal();
  }
  $("#modal-toasts-area").empty();
  $("#scmodal .modal-header button.btn-close").css("display", "");
}

function expand_thumbnail(img_id, filename) {
  ensure_modal_exists_and_closed();
  $("#scmodal .modal-body").html(
    `<img src="/files/serve/${img_id}" style="width: 100%">`
  );
  $("#scmodal .modal-title").html(decodeURIComponent(filename));
  new bootstrap.Modal($("#scmodal")).show();
}

function ajax_modal(url, opts = {}) {
  $.ajax(url, {
    headers: {
      SaltcornModalRequest: "true",
    },
    success: function (res, textStatus, request) {
      ensure_modal_exists_and_closed();
      $("#scmodal").removeClass("no-submit-reload");
      $("#scmodal").attr("data-on-close-reload-view", opts.reload_view || null);

      if (opts.submitReload === false)
        $("#scmodal").addClass("no-submit-reload");

      var title = request.getResponseHeader("Page-Title");
      var width = request.getResponseHeader("SaltcornModalWidth");
      var minwidth = request.getResponseHeader("SaltcornModalMinWidth");
      var saveIndicate = !!request.getResponseHeader(
        "SaltcornModalSaveIndicator"
      );
      if (saveIndicate) $(".sc-ajax-indicator-wrapper").show();
      else $(".sc-ajax-indicator-wrapper").hide();
      var linkOut = !!request.getResponseHeader("SaltcornModalLinkOut");
      if (linkOut) $(".sc-modal-linkout").show().attr("href", url);
      else $(".sc-modal-linkout").hide();
      if (width) $(".modal-dialog").css("max-width", width);
      else $(".modal-dialog").css("max-width", "");
      if (minwidth) $(".modal-dialog").css("min-width", minwidth);
      else $(".modal-dialog").css("min-width", "");
      if (title) $("#scmodal .modal-title").html(decodeURIComponent(title));
      $("#scmodal .modal-body").html(res);
      $("#scmodal").prop("data-modal-state", url);
      new bootstrap.Modal($("#scmodal"), {
        focus: false,
      }).show();
      $("#scmodal .modal-body").find("[autofocus]").first().focus();
      initialize_page();
      (opts.onOpen || function () {})(res);
      $("#scmodal").on("hidden.bs.modal", function (e) {
        (opts.onClose || function () {})(res);
        $("body").css("overflow", "");
      });
    },
    ...(opts.onError
      ? {
          error: opts.onError,
        }
      : { error: checkNetworkError }),
  });
}
function closeModal() {
  $("#scmodal").modal("toggle");
}

function selectVersionError(res, btnId) {
  notifyAlert({
    type: "danger",
    text: res.responseJSON?.error || "unknown error",
  });
  restore_old_button(btnId);
}

function submitWithAjax(e) {
  saveAndContinue(e, (res) => {
    if (res && res.responseJSON && res.responseJSON.url_when_done)
      window.location.href = res.responseJSON.url_when_done;
    if (res && res.responseJSON && res.responseJSON.error && res.status < 300)
      notifyAlert({ type: "danger", text: res.responseJSON.error });
  });
}
function saveAndContinueAsync(e) {
  return new Promise((resolve, reject) => {
    saveAndContinue(e, (x) => resolve(x));
  });
}

function saveAndContinueIfValid(e, k, event) {
  //wait for applyShowIf
  setTimeout(() => {
    if (
      event &&
      event.target &&
      event.target.classList &&
      event.target.classList.contains("no-form-change")
    )
      return;
    var form = $(e).closest("form");

    if (form[0].checkValidity?.() === false) {
      form[0].reportValidity();
      return;
    }

    saveAndContinue(e, k, event);
  });
}

function saveAndContinueDelayed(e, k, event, retries = 1) {
  //wait for applyShowIf
  setTimeout(() => {
    if (apply_showif_fetching_urls.size > 0 && retries < 5) {
      setTimeout(() => {
        saveAndContinueDelayed(e, k, event, retries + 1);
      }, 200);
    } else saveAndContinue(e, k, event);
  });
  return false;
}

function saveAndContinue(e, k, event) {
  if (
    event &&
    event.target &&
    event.target.classList &&
    event.target.classList.contains("no-form-change")
  )
    return;
  var form = $(e).closest("form");

  let focusedEl = null;
  if (!event || !event.srcElement) {
    const el = form.find("select[sc-received-focus]")[0];
    if (el) {
      el.removeAttribute("sc-received-focus");
      if (el.getAttribute("previous-val") === el.value) return;
    }
  } else if (
    event.srcElement.tagName === "SELECT" &&
    event.srcElement.getAttribute("previous-val") !== undefined
  ) {
    focusedEl = event.srcElement;
  }

  const valres = form[0].reportValidity();
  if (!valres) return;
  submitWithEmptyAction(form[0]);
  var url = form.attr("action");
  var form_data = form.serialize();

  if (form.prop("data-last-save-success") === form_data) {
    if (k) k(valres);
    return;
  }

  ajax_indicator(true, e);
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    data: form_data,
    success: function (res) {
      ajax_indicator(false);
      form.removeAttr("data-unsaved-changes");
      form.parent().find(".full-form-error").text("");
      form.prop("data-last-save-success", form_data);
      if (res.id && form.find("input[name=id")) {
        form.append(
          `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
        );
        apply_showif();
      }
      common_done(res, form.attr("data-viewname"));
      if (focusedEl) focusedEl.setAttribute("previous-val", focusedEl.value);
    },
    error: function (request) {
      var ct = request.getResponseHeader("content-type") || "";
      if (checkNetworkError(request)) {
      } else if (ct.startsWith && ct.startsWith("application/json")) {
        notifyAlert({ type: "danger", text: request.responseJSON.error });
      } else {
        $("#page-inner-content").html(request.responseText);
        initialize_page();
      }
      ajax_indicate_error(e, request);
    },
    complete: function (res) {
      if (k) k(res);
    },
  });

  return false;
}

function updateMatchingRows(e, viewname) {
  const form = $(e).closest("form");
  try {
    const sp = `${new URL(get_current_state_url()).searchParams.toString()}`;
    form.attr(
      "action",
      `/view/${viewname}/update_matching_rows${sp ? `?${sp}` : ""}`
    );
    form[0].submit();
  } finally {
    form.attr("action", `/view/${viewname}`);
  }
}

function applyViewConfig(e, url, k, event) {
  if (event && event.target && event.target.id === "myEditor_icon") return;
  var form = $(e).closest("form");
  var form_data = form.serializeArray();
  const cfg = {};
  form_data.forEach((item) => {
    cfg[item.name] = item.value;
  });
  ajax_indicator(true, e);
  window.savingViewConfig = true;
  $.ajax(url, {
    type: "POST",
    dataType: "json",
    contentType: "application/json",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: JSON.stringify(cfg),
    error: function (request) {
      checkNetworkError(request);
      window.savingViewConfig = false;
      ajax_indicate_error(e, request);
    },
    success: function (res) {
      window.savingViewConfig = false;
      ajax_indicator(false);
      k && k(res);
      !k && updateViewPreview();
    },
    complete: () => {},
  });

  //return false;
}

function updateViewPreview() {
  const $preview = $("#viewcfg-preview[data-preview-url]");
  if ($preview.length > 0) {
    const url = $preview.attr("data-preview-url");
    $preview.css({ opacity: 0.5 });
    $.ajax(url, {
      type: "POST",
      headers: {
        "CSRF-Token": _sc_globalCsrf,
      },

      error: function (resp) {
        $("#viewcfg-preview-error")
          .show()
          .html(resp.responseText || resp.statusText);
      },
      success: function (res) {
        $("#viewcfg-preview-error").hide().html("");
        $preview.css({ opacity: 1.0 });

        //disable functions preview migght try to call
        set_state_field = () => {};
        set_state_fields = () => {};

        //disable elements in preview
        $preview.html(res);
        $preview.find("a").attr("href", "#");
        $preview
          .find("[onclick], button, a, input, select")
          .attr("onclick", "return false");

        $preview.find("textarea").attr("disabled", true);
        $preview.find("input").attr("readonly", true);
      },
    });
  }
}

function ajaxSubmitForm(e, force_no_reload, event) {
  var form = $(e).closest("form");
  var url = form.attr("action");
  if (event) event.preventDefault();
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    data: new FormData(form[0]),
    processData: false,
    contentType: false,
    success: function (res) {
      var no_reload = $("#scmodal").hasClass("no-submit-reload");
      const on_close_reload_view = $("#scmodal").attr(
        "data-on-close-reload-view"
      );
      $("#scmodal").modal("hide");
      if (on_close_reload_view) {
        const viewE = $(`[data-sc-embed-viewname="${on_close_reload_view}"]`);
        if (viewE.length) reload_embedded_view(on_close_reload_view);
        else if (!force_no_reload) location.reload();
      } else if (!force_no_reload && !no_reload) location.reload();
      else common_done(res, form.attr("data-viewname"));
    },
    error: function (request) {
      checkNetworkError(request);
      var title = request.getResponseHeader("Page-Title");
      if (title) $("#scmodal .modal-title").html(decodeURIComponent(title));
      var body = request.responseText;
      if (body) $("#scmodal .modal-body").html(body);
    },
  });

  return false;
}

function page_post_action(url) {
  ajax_post_json(
    url,
    {},
    {
      success: () => {
        if (window.reset_spinners) reset_spinners();
      },
    }
  );
}

function ajax_post_json(url, data, args = {}) {
  ajax_post(url, {
    data: JSON.stringify(data),
    contentType: "application/json;charset=UTF-8",
    ...args,
  });
}

let scNetworkErrorSignaled = false;

function ajax_post(url, args) {
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    ...(args || {}),
  })
    .done((res) => ajax_done(res))
    .fail((e, ...more) => {
      if (!checkNetworkError(e))
        return ajax_done(
          e.responseJSON || { error: "Unknown error: " + e.responseText }
        );
    });
}

function checkNetworkError(e) {
  if (e.readyState == 0 && !e.responseText && !e.responseJSON) {
    //network error
    if (scNetworkErrorSignaled) return true;
    scNetworkErrorSignaled = true;
    setTimeout(() => {
      scNetworkErrorSignaled = false;
    }, 1000);
    console.error("Network error", e);
    notifyAlert({
      type: "danger",
      text: "Network connection error",
    });
    return true;
  }
}

function ajax_post_btn(e, reload_on_done, reload_delay) {
  let form_data = "";
  let url;
  if (typeof e === "string") url = e;
  else if (e) {
    var form = $(e).closest("form");
    url = form.attr("action");
    form_data = form.serialize();
  }

  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    data: form_data,
    success: function (res) {
      common_done(res);
      if (reload_on_done) location.reload();
    },
    error: checkNetworkError,
    complete: function () {
      if (reload_delay)
        setTimeout(function () {
          location.reload();
        }, reload_delay);
    },
  });

  return false;
}

function api_action_call(name, body) {
  $.ajax(`/api/action/${name}`, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
      "Page-Load-Tag": _sc_pageloadtag,
    },
    data: body,
    success: function (res) {
      common_done(res.data);
    },
    error: checkNetworkError,
  });
}

function make_unique_field(
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
  $.ajax(
    `/api/${table_id}?approximate=true&${encodeURIComponent(
      field_name
    )}=${encodeURIComponent(value)}&fields=${encodeURIComponent(field_name)}`,
    {
      type: "GET",
      success: function (res) {
        if (res.success) {
          unique_field_from_rows(
            res.success,
            id,
            field_name,
            space,
            start,
            always_append,
            char_type,
            value
          );
        }
      },
    }
  );
}
function test_formula(tablename, stored) {
  var formula = $("input[name=expression],textarea[name=expression]").val();
  ajax_post(`/field/test-formula`, {
    data: { formula, tablename, stored },
    success: (data) => {
      $("#test_formula_output").html(data);
    },
  });
}

function create_new_folder(folder) {
  const name = window.prompt("Name of the new folder");
  if (name)
    ajax_post(`/files/new-folder`, {
      data: { name, folder },
      success: (data) => {
        location.reload();
      },
    });
}

function handle_upload_file_change(form) {
  const url = new URL(window.location);
  const dir = url.searchParams.get("dir");
  if (dir !== null) $("#uploadFolderInpId").val(dir);
  const jqForm = $(form);
  const sortBy = url.searchParams.get("sortBy");
  if (sortBy) {
    jqForm.append(`<input type="hidden" name="sortBy" value="${sortBy}" />`);
  }
  const sortDesc = url.searchParams.get("sortDesc");
  if (sortDesc === "on") {
    jqForm.append('<input type="hidden" name="sortDesc" value="on" />');
  }
  form.submit();
}

async function fill_formula_btn_click(btn, k) {
  const formula = decodeURIComponent($(btn).attr("data-formula"));
  const free_vars = JSON.parse(
    decodeURIComponent($(btn).attr("data-formula-free-vars"))
  );
  const table = JSON.parse(
    decodeURIComponent($(btn).attr("data-formula-table"))
  );
  const rec = get_form_record($(btn), true);
  const rec_ids = get_form_record($(btn));

  for (const fv of free_vars) {
    if (fv.includes(".")) {
      const kpath = fv.split(".");
      const [refNm, targetNm] = kpath;
      const reffield = table.fields.find((f) => f.name === refNm);
      if (reffield && reffield.reftable_name) {
        const resp = await $.ajax(
          `/api/${reffield.reftable_name}?id=${rec_ids[refNm]}`
        );
        rec[refNm] = resp.success[0];
      }
    }
  }
  try {
    const val = new Function(
      `{${Object.keys(rec).join(",")}}`,
      "return " + formula
    )(rec);
    $(btn).closest(".input-group").find("input").val(val);
    if (k) k();
  } catch (e) {
    notifyAlert({
      type: "danger",
      text: `Error evaluating fill formula: ${e.message}`,
    });
    console.error(e);
  }
}

function removeSpinner(elementId, orginalHtml) {
  $(`#${elementId}`).html(orginalHtml);
}

function builderMenuChanged(e) {
  const form = $(e);
  const params = {};
  form.serializeArray().forEach((item) => {
    params[item.name] = item.value;
  });
  params.synchedTables = Array.from($("#synched-tbls-select-id")[0].options)
    .filter((option) => !option.hidden)
    .map((option) => option.value);
  const pluginsSelect = $("#included-plugins-select-id")[0];
  params.includedPlugins = Array.from(pluginsSelect.options || []).map(
    (option) => option.value
  );
  const indicator = $(".sc-ajax-indicator");
  indicator.attr("title", "Saving the configuration");
  indicator.attr("style", "display: inline-block;");
  const icon = $(".fa-save, .fa-exclamation-triangle");
  icon.attr("class", "fas fa-save");
  const setErrorIcon = () => {
    icon.attr("class", "fas fa-exclamation-triangle");
    icon.attr("style", "color: #ff0033!important;");
    indicator.attr("title", "Unable to save the configuration");
  };
  $.ajax("/admin/mobile-app/save-config", {
    type: "POST",
    data: params,
    success: function (res) {
      if (res.success) indicator.attr("style", "display: none;");
      else setErrorIcon();
    },
    error: function (res) {
      setErrorIcon();
    },
  });
}

function poll_mobile_build_finished(
  outDirName,
  buildDir,
  mode,
  pollCount,
  orginalBtnHtml
) {
  $.ajax("/admin/build-mobile-app/finished", {
    type: "GET",
    data: { out_dir_name: outDirName, mode: mode },
    success: function (res) {
      if (!res.finished) {
        if (pollCount >= 150) {
          removeSpinner("buildMobileAppBtnId", orginalBtnHtml);
          notifyAlert({
            type: "danger",
            text: "Unable to get the build results",
          });
        } else {
          setTimeout(() => {
            poll_mobile_build_finished(
              outDirName,
              buildDir,
              mode,
              ++pollCount,
              orginalBtnHtml
            );
          }, 5000);
        }
      } else {
        href_to(
          `/admin/build-mobile-app/result?out_dir_name=${encodeURIComponent(
            outDirName
          )}&build_dir=${encodeURIComponent(buildDir)}&mode=${mode}`
        );
      }
    },
  });
}

function finish_mobile_app(button, outDirName, buildDir) {
  $.ajax("/admin/build-mobile-app/finish", {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: { out_dir_name: outDirName, build_dir: buildDir },
    success: function (data) {
      if (data.success) {
        notifyAlert("Finishing the app, please wait.", true);
        for (const msg of data.msgs || []) notifyAlert(msg);
        const orginalBtnHtml = $("#finishMobileAppBtnId").html();
        press_store_button(button);
        poll_mobile_build_finished(
          outDirName,
          buildDir,
          "finish",
          0,
          orginalBtnHtml
        );
      }
    },
  });
}

function build_mobile_app(button) {
  const form = $(button).closest("form");
  const params = {};
  form.serializeArray().forEach((item) => {
    params[item.name] = item.value;
  });
  params.synchedTables = Array.from($("#synched-tbls-select-id")[0].options)
    .filter((option) => !option.hidden)
    .map((option) => option.value);
  const pluginsSelect = $("#included-plugins-select-id")[0];
  params.includedPlugins = Array.from(pluginsSelect.options || []).map(
    (option) => option.value
  );

  if (
    params.useDocker &&
    !window.capacitorBuilderAvailable &&
    !confirm(
      "Docker is selected but the Capacitor builder seems not to be installed. " +
        "Do you really want to continue?"
    )
  ) {
    return;
  }
  if (
    isSbadmin2 &&
    !confirm(
      "It seems you are using the standard sbadmin2 layout. " +
        "This layout is not optimized for mobile, consider using any-bootstrap-theme. " +
        "Do you really want to continue?"
    )
  ) {
    return;
  }
  const notSupportedPlugins = params.includedPlugins.filter(
    (plugin) => !window.pluginsReadyForMobile.includes(plugin)
  );
  if (
    notSupportedPlugins.length > 0 &&
    !confirm(
      `It seems that the plugins '${notSupportedPlugins.join(
        ", "
      )}' are not ready for mobile. Do you really want to continue?`
    )
  ) {
    return;
  }

  ajax_post("/admin/build-mobile-app", {
    data: params,
    success: (data) => {
      if (data.out_dir_name && data.build_dir) {
        notifyAlert("Building the app, please wait.", true);
        for (const msg of data.msgs || []) notifyAlert(msg);
        const orginalBtnHtml = $("#buildMobileAppBtnId").html();
        press_store_button(button);
        poll_mobile_build_finished(
          data.out_dir_name,
          data.build_dir,
          data.mode,
          0,
          orginalBtnHtml
        );
      }
    },
  });
}

function pull_capacitor_builder() {
  ajax_post("/admin/mobile-app/pull-capacitor-builder", {
    success: () => {
      notifyAlert(
        "Pulling the the capacitor-builder. " +
          "To see the progress, open the logs viewer with the System logging verbosity set to 'All'."
      );
    },
  });
}

function check_xcodebuild() {
  const handleVersion = (version) => {
    const tokens = version.split(".");
    const majVers = parseInt(tokens[0]);
    const marker = $("#versionMarkerId");
    if (majVers >= 11) {
      marker.removeClass("text-danger");
      marker.addClass("text-success");
      marker.removeClass("fa-times");
      marker.addClass("fa-check");
    } else {
      marker.removeClass("text-success");
      marker.addClass("text-danger");
      marker.removeClass("fa-check");
      marker.addClass("fa-times");
    }
  };
  $.ajax("/admin/mobile-app/check-xcodebuild", {
    type: "GET",
    success: function (res) {
      if (res.installed) {
        $("#xcodebuildStatusId").html(
          `<span>
            installed<i class="ps-2 fas fa-check text-success"></i>
          </span>
          `
        );
        $("#xcodebuildVersionBoxId").removeClass("d-none");
        $("#xcodebuildVersionId").html(` ${res.version}`);
        handleVersion(res.version || "0");
      } else {
        $("#xcodebuildStatusId").html(
          `<span>
            not available<i class="ps-2 fas fa-times text-danger"></i>
          </span>
          `
        );
        $("#xcodebuildVersionBoxId").addClass("d-none");
      }
    },
  });
}

function check_capacitor_builder() {
  $.ajax("/admin/mobile-app/check-capacitor-builder", {
    type: "GET",
    success: function (res) {
      window.capacitorBuilderAvailable = !!res.installed;
      if (window.capacitorBuilderAvailable) {
        if (res.version !== res.sc_version) {
          $("#dockerBuilderStatusId").html(`
    <div
      id="mismatchBoxId" class="mt-3 p-3 border rounded bg-light"
    >
      <div
        class="d-flex align-items-center mb-2"
      >
        installed<i title="Information" class="ps-2 fas fa-info-circle text-warning"></i>
      </div>
      <div
        class="fw-bold text-danger mb-1"
      >
        Version Mismatch:
      </div>
      <ul
        class="list-unstyled mb-0"
      >
        <li>
          <span class="fw-semibold text-muted">Docker tag:</span>1.3.1-beta.0
        </li>
        <li>
          <span class="fw-semibold text-muted">SC version:</span>1.3.1-beta.10
        </li>
      </ul>
    </div>`);
          $("#dockerBuilderVersionBoxId").removeClass("d-none");
          $("#dockerBuilderVersionId").html(` ${res.version}`);
        } else {
          $("#dockerBuilderStatusId").html(
            `<span>
              installed<i class="ps-2 fas fa-check text-success"></i>
            </span>
            `
          );
        }
      } else {
        $("#dockerBuilderStatusId").html(
          `<span>
            not available<i class="ps-2 fas fa-times text-danger"></i>
          </span>
          `
        );
      }
    },
  });
}

function move_to_synched() {
  const opts = $("#unsynched-tbls-select-id");
  $("#synched-tbls-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    $(`[id='${selected}_unsynched_opt']`).remove();
    $("#synched-tbls-select-id").append(
      $("<option>", {
        value: selected,
        label: selected,
        id: `${selected}_synched_opt`,
      })
    );
  }
  $("#buildMobileAppForm").trigger("change");
}

function move_to_unsynched() {
  const opts = $("#synched-tbls-select-id");
  $("#unsynched-tbls-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    $(`[id='${selected}_synched_opt']`).remove();
    $("#unsynched-tbls-select-id").append(
      $("<option>", {
        value: selected,
        label: selected,
        id: `${selected}_unsynched_opt`,
      })
    );
  }
  $("#buildMobileAppForm").trigger("change");
}

function move_plugin_to_included() {
  const opts = $("#excluded-plugins-select-id");
  $("#included-plugins-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    $(`[id='${selected}_excluded_opt']`).remove();
    $("#included-plugins-select-id").append(
      $("<option>", {
        value: selected,
        label: selected,
        id: `${selected}_included_opt`,
      })
    );
  }
  $("#buildMobileAppForm").trigger("change");
}

function move_plugin_to_excluded() {
  const opts = $("#included-plugins-select-id");
  $("#excluded-plugins-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    $(`[id='${selected}_included_opt']`).remove();
    $("#excluded-plugins-select-id").append(
      $("<option>", {
        value: selected,
        label: selected,
        id: `${selected}_excluded_opt`,
      })
    );
  }
  $("#buildMobileAppForm").trigger("change");
}

function toggle_tbl_sync() {
  if ($("#offlineModeBoxId")[0].checked === true) {
    $("#tblSyncSelectorId").attr("hidden", false);
  } else {
    $("#tblSyncSelectorId").attr("hidden", true);
  }
}

function toggle_android_platform() {
  if ($("#androidCheckboxId")[0].checked === true) {
    $("#dockerCheckboxId").attr("hidden", false);
    $("#dockerCheckboxId").attr("checked", window.capacitorBuilderAvailable);
    $("#dockerLabelId").removeClass("d-none");
  } else {
    $("#dockerCheckboxId").attr("hidden", true);
    $("#dockerCheckboxId").attr("checked", false);
    $("#dockerLabelId").addClass("d-none");
  }
}

function cancelMemberEdit(groupName) {
  const url = new URL(location.href);
  location.href = `${url.origin}/page_groupedit/${groupName}`;
}

function join_field_clicked(e, fieldPath) {
  $("#inputjoin_field").val(fieldPath);
  apply_showif();
}

function execLink(path) {
  window.location.href = `${location.origin}${path}`;
}

let defferedPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  defferedPrompt = e;
});

window.addEventListener("appinstalled", async (event) => {
  console.log("App was installed.", event);
  await initPushNotify();
});

document.addEventListener("DOMContentLoaded", async () => {
  await initPushNotify();
});

function isAndroidMobile() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return /android/i.test(ua) && /mobile/i.test(ua);
}

function validatePWAManifest(manifest) {
  const errors = [];
  if (!manifest) errors.push("The manifest.json file is missing. ");
  else {
    if (!manifest.icons || manifest.icons.length === 0)
      errors.push("At least one icon is required");
    else if (
      manifest.icons.length > 0 &&
      !manifest.icons.some((icon) => {
        const sizes = icon.sizes.split("x");
        const x = parseInt(sizes[0]);
        const y = parseInt(sizes[1]);
        return x === y && x >= 144;
      })
    ) {
      errors.push(
        "At least one square icon of size 144x144 or larger is required"
      );
    }
    if (isAndroidMobile() && manifest.display === "browser") {
      errors.push(
        "The display property 'browser' may not work on mobile devices"
      );
    }
  }
  return errors;
}

function supportsBeforeInstallPrompt() {
  return "onbeforeinstallprompt" in window;
}

function installPWA() {
  if (defferedPrompt) defferedPrompt.prompt();
  else if (!supportsBeforeInstallPrompt()) {
    notifyAlert({
      type: "danger",
      text:
        "It looks like your browser doesn’t support this feature. " +
        "Please try the standard installation method provided by your browser, or switch to a different browser.",
    });
  } else {
    const manifestUrl = `${window.location.origin}/notifications/manifest.json`;
    notifyAlert({
      type: "danger",
      text:
        "Unable to install the app. " +
        "Please check if the app is already installed or " +
        `inspect your manifest.json <a href="${manifestUrl}?pretty=true" target="_blank">here</a>`,
    });
    $.ajax(manifestUrl, {
      success: (res) => {
        const errors = validatePWAManifest(res);
        if (errors.length > 0)
          notifyAlert({
            type: "warning",
            text: `${errors.join(", ")}`,
          });
      },
      error: (res) => {
        console.log("Error fetching manifest.json");
        console.log(res);
      },
    });
  }
}

function check_unsaved_form(event, script_tag) {
  const form = $(script_tag).parent().find("form");
  if (form.attr("data-unsaved-changes")) {
    event.preventDefault();
    event.returnValue = true;
  }
}
function check_delete_unsaved(tablename, script_tag) {
  const form = $(script_tag).parent().find("form");
  if (form.length && !form.attr("data-form-changed")) {
    //delete row
    const rec = get_form_record(form);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`/api/${tablename}/delete/${rec.id}`);
    } else
      $.ajax({
        url: `/api/${tablename}/${rec.id}`,
        type: "DELETE",
        headers: {
          "CSRF-Token": _sc_globalCsrf,
          "Page-Load-Tag": _sc_pageloadtag,
        },
      });
  }
}

function delprevwfroomrun(viewname, e, runid) {
  e.preventDefault();
  e.stopPropagation();
  view_post(viewname, "delprevrun", { run_id: runid });
  $(e.target).closest(".prevwfroomrun").remove();
  return false;
}

function cfu_translate(that) {
  const locale = that.value;
  const translations = window.cfu_translations[locale];
  if (translations) {
    $("button[type=submit]").text(translations.submitLabel);
    $("h1").text(translations.header);
    $('form[action="/auth/create_first_user"]')
      .parent()
      .find("p")
      .text(translations.blurb);
    $("label[for=upload_to_restore] span").text(translations.restore);
    $("label[for=inputdefault_language]").text(translations.language);
    $("label[for=inputemail]").text(translations.email);
    $("label[for=inputpassword]").text(translations.password);
  }
}

function ensure_script_loaded(src, callback) {
  //https://stackoverflow.com/questions/26331600/load-js-script-only-when-it-has-not-been-loaded-already-and-then-only-once
  let scripts = Array.from(document.querySelectorAll("script")).map(
    (scr) => scr.src
  );

  if (!scripts.some((s) => s.endsWith(src))) {
    var tag = document.createElement("script");
    tag.src = src;
    tag.onload = () => {
      if (typeof callback === "function") callback();
    };
    document.getElementsByTagName("body")[0].appendChild(tag);
  } else if (typeof callback === "function") callback();
}

function ensure_css_loaded(src) {
  let links = Array.from(document.querySelectorAll("link[rel=stylesheet]")).map(
    (scr) => scr.href
  );

  if (!links.includes(src)) {
    var fileref = document.createElement("link");
    fileref.rel = "stylesheet";
    fileref.type = "text/css";
    fileref.href = src;
    document.getElementsByTagName("head")[0].appendChild(fileref);
  }
}

(() => {
  const e = document.querySelector("[data-sidebar-toggler]");
  let closed = localStorage.getItem("sidebarClosed") === "true";
  if (e) {
    if (closed) {
      e.dispatchEvent(new Event("click"));
    }
    e.addEventListener("click", () => {
      closed = !closed;
      localStorage.setItem("sidebarClosed", `${closed}`);
    });
  }
})() +
  /*
  https://github.com/jeffdavidgreen/bootstrap-html5-history-tabs/blob/master/bootstrap-history-tabs.js
  Copyright (c) 2015 Jeff Green
  */

  (function ($) {
    "use strict";
    $.fn.historyTabs = function () {
      var that = this;
      window.addEventListener("popstate", function (event) {
        if (event.state) {
          $(that)
            .filter('[href="' + event.state.url + '"]')
            .tab("show");
        }
      });
      return this.each(function (index, element) {
        $(element).on("show.bs.tab", function () {
          var stateObject = { url: $(this).attr("href") };

          if (
            window.location.hash &&
            stateObject.url !== window.location.hash
          ) {
            window.history.pushState(
              stateObject,
              document.title,
              window.location.pathname +
                window.location.search +
                $(this).attr("href")
            );
          } else {
            window.history.replaceState(
              stateObject,
              document.title,
              window.location.pathname +
                window.location.search +
                $(this).attr("href")
            );
          }
        });
        if (!window.location.hash && $(element).is(".active")) {
          // Shows the first element if there are no query parameters.
          $(element).tab("show");
        } else if ($(this).attr("href") === window.location.hash) {
          $(element).tab("show");
        }
      });
    };
  })(jQuery);

// Copyright (c) 2011 Marcus Ekwall, http://writeless.se/
// https://github.com/mekwall/jquery-throttle
(function (a) {
  var b = a.jQuery || a.me || (a.me = {}),
    i = function (e, f, g, h, c, a) {
      f || (f = 100);
      var d = !1,
        j = !1,
        i = typeof g === "function",
        l = function (a, b) {
          d = setTimeout(function () {
            d = !1;
            if (h || c) (e.apply(a, b), c && (j = +new Date()));
            i && g.apply(a, b);
          }, f);
        },
        k = function () {
          if (!d || a) {
            if (!d && !h && (!c || +new Date() - j > f))
              (e.apply(this, arguments), c && (j = +new Date()));
            (a || !c) && clearTimeout(d);
            l(this, arguments);
          }
        };
      if (b.guid) k.guid = e.guid = e.guid || b.guid++;
      return k;
    };
  b.throttle = i;
  b.debounce = function (a, b, g, h, c) {
    return i(a, b, g, h, c, !0);
  };
})(this);
