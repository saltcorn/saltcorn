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

// Menu item keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (typeof _sc_menu_shortcuts === "undefined" || !_sc_menu_shortcuts.length)
    return;
  // Skip when typing in inputs/textareas/contenteditable
  var tag = e.target.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    e.target.isContentEditable
  )
    return;
  for (var i = 0; i < _sc_menu_shortcuts.length; i++) {
    const sc = _sc_menu_shortcuts[i];
    const parts = sc.shortcut.split("+");
    let needAlt = false,
      needCtrl = false,
      needShift = false,
      needMeta = false;
    let key = "";
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j].trim().toLowerCase();
      if (p === "alt") needAlt = true;
      else if (p === "ctrl") needCtrl = true;
      else if (p === "shift") needShift = true;
      else if (p === "meta") needMeta = true;
      else key = p;
    }
    if (
      e.altKey === needAlt &&
      e.ctrlKey === needCtrl &&
      e.shiftKey === needShift &&
      e.metaKey === needMeta &&
      (e.key === " " ? "space" : e.key.toLowerCase()) === key
    ) {
      e.preventDefault();
      const link = sc.link;
      if (link.startsWith("javascript:")) {
        new Function(link.substring(11))();
      } else {
        window.location.href = link;
      }
      return;
    }
  }
});

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
          .attr("data-sc-embed-viewname") ||
        $(viewnameOrElem).closest("form[data-viewname]").attr("data-viewname");
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
  const isAbsolute = /^(?:[a-z]+:)?\/\//i.test(img_id);
  const src = isAbsolute ? img_id : `/files/serve/${img_id}`;
  $("#scmodal .modal-body").html(`<img src="${src}" style="width: 100%">`);
  $("#scmodal .modal-title").html(decodeURIComponent(filename));
  new bootstrap.Modal($("#scmodal")).show();
}

function ajax_modal(url, opts = {}) {
  $.ajax(url, {
    ...(opts.method ? { method: opts.method } : {}),
    headers: {
      SaltcornModalRequest: "true",
      "Page-Load-Tag": _sc_pageloadtag,
      ...(opts.method === "POST" ? { "CSRF-Token": _sc_globalCsrf } : {}),
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
  removeVirtualMonacoPrefix(form);
  var form_data = form.serialize();
  restoreVirtualMonacoPrefix(form);

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
      $(`[toast-title="Save error"]`).removeClass("show");
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
        notifyAlert({
          type: "danger",
          text: request.responseJSON.error,
          toast_title: "Save error",
        });
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

/**
 * search textareas with is-expression="yes" and remove virtual monaco prefix
 * before the formdata is serialized
 * @param {Form} form
 */
function removeVirtualMonacoPrefix(form) {
  const textareas = form.find('textarea[is-expression="yes"]');
  const virtualMonacoPrefix = "const prefix: Row =";
  textareas.each(function () {
    const jThis = $(this);
    const val = jThis.val();
    if (
      new RegExp("^\\s*" + virtualMonacoPrefix).test(val) ||
      new RegExp("^\\s*//\\s*" + virtualMonacoPrefix).test(val)
    ) {
      jThis.data("original-value", val);
      const match = val.match(/\r?\n/);
      if (match) jThis.val(val.substring(match.index + match[0].length));
      else jThis.val("");
    }
  });
}

/**
 * search textareas with is-expression="yes" and restore virtual monaco prefix
 * after the formdata is serialized
 * @param {Form} form
 */
function restoreVirtualMonacoPrefix(form) {
  const textareas = form.find('textarea[is-expression="yes"]');
  textareas.each(function () {
    const jThis = $(this);
    const orginalVal = jThis.data("original-value");
    if (orginalVal !== undefined) {
      jThis.val(orginalVal);
      jThis.removeData("original-value");
    }
  });
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

let sc_form_submit_is_in_progress = false;

function sc_form_submit_in_progress() {
  sc_form_submit_is_in_progress = true;
}

function checkNetworkError(e) {
  if (e.readyState == 0 && !e.responseText && !e.responseJSON) {
    //network error
    if (sc_form_submit_is_in_progress) return true;
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

  ajax_post("/admin/build-mobile-app/validate-synced-tables", {
    data: { synchedTables: params.synchedTables },
    success: (data) => {
      if (
        data.warnings &&
        data.warnings.length > 0 &&
        !confirm(
          "Warning: some tables referenced by synced tables are not synced:\n\n" +
            data.warnings.join("\n") +
            "\n\nDo you really want to continue?"
        )
      ) {
        return;
      }
      _do_build_mobile_app(button, params);
    },
  });
}

function _do_build_mobile_app(button, params) {
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

function check_ios_build_deps() {
  $.ajax("/admin/mobile-app/check-ios-build-tools", {
    type: "GET",
    success: function (res) {
      const { xcodebuild, cocoapods, iosRuntime, isMac } = res;
      if (isMac) {
        // update xcodebuild status
        if (xcodebuild.installed) {
          $("#xcodebuildStatusId").html(
            `${xcodebuild.version}<i class="p-2 fas ${
              xcodebuild.fullfilled
                ? "fa-check text-success"
                : "fa-times text-danger"
            }"></i>`
          );
        } else {
          $("#xcodebuildStatusId").html(
            `not available<i class="p-2 fas fa-times text-danger"></i>`
          );
        }

        // update cocoapods status
        if (cocoapods.installed) {
          $("#cocoapodsStatusId").html(
            `${cocoapods.version}<i class="p-2 fas ${
              cocoapods.fullfilled
                ? "fa-check text-success"
                : "fa-times text-danger"
            }"></i>`
          );
        } else {
          $("#cocoapodsStatusId").html(
            `not available<i class="p-2 fas fa-times text-danger"></i>`
          );
        }

        // update iOS runtime status
        if (iosRuntime && iosRuntime.available) {
          $("#iosRuntimeStatusId").html(
            `${iosRuntime.version}<i class="p-2 fas fa-check text-success"></i>`
          );
        } else {
          $("#iosRuntimeStatusId").html(
            `not available<i class="p-2 fas fa-times text-danger"></i>`
          );
        }
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
      id="mismatchBoxId" class="mt-3 p-3 border rounded"
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
  const rtlLanguages = ["ar", "he", "fa", "ur", "yi"];
  const isRTL = rtlLanguages.includes(locale);
  $("html").attr("lang", locale);
  if (isRTL) $("html").attr("dir", "rtl");
  else $("html").attr("dir", "ltr");

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

$(document).on("click", "span.copy-to-clipboard", function () {
  var $el = $(this);
  var text = $el.text().trim();

  navigator.clipboard.writeText(text).then(function () {
    $el.addClass("copied");
    setTimeout(function () {
      $el.removeClass("copied");
    }, 1000);
  });
});

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
          $(element).trigger("show.bs.tab");
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

// Entities list page
function entitiesListInit(config) {
  const {
    LEGACY_LINK_META,
    TAGS_BY_ID,
    ROLES_BY_ID,
    TXT_SELECTED,
    TXT_DELETE_SELECTED_CONFIRM,
    TXT_DELETE_SELECTED_FALLBACK,
    TXT_DELETE_FAILED,
  } = config;

  // DOM refs
  const searchInput = document.getElementById("entity-search");
  const deepSearchToggle = document.getElementById("entity-deep-search");
  const entitiesList = document.getElementById("entities-list");
  const noResults = document.getElementById("no-results");
  const filterButtons = document.querySelectorAll(".entity-filter-btn");
  const filterButtonsByType = {};
  filterButtons.forEach((btn) => {
    const type = btn.dataset.entityType;
    if (type) filterButtonsByType[type] = btn;
  });
  const tagButtons = document.querySelectorAll(".tag-filter-btn");
  const filtersRow = document.getElementById("entity-filters-row");
  const selectionBar = document.getElementById("entity-selection-bar");
  const selectionCountEl = document.getElementById("entity-selection-count");
  const clearSelectionBtn = document.getElementById("entity-clear-selection");
  const bulkDeleteBtn = document.getElementById("entity-bulk-delete");
  const bulkTagSelect = document.getElementById("entity-bulk-tag-select");
  const bulkApplyTagBtn = document.getElementById("entity-bulk-apply-tag");
  const bulkDownloadPackBtn = document.getElementById(
    "entity-bulk-download-pack"
  );
  const bulkRoleReadSelect = document.getElementById(
    "entity-bulk-role-read-select"
  );
  const bulkApplyRoleReadBtn = document.getElementById(
    "entity-bulk-apply-role-read"
  );
  const bulkRoleWriteSelect = document.getElementById(
    "entity-bulk-role-write-select"
  );
  const bulkApplyRoleWriteBtn = document.getElementById(
    "entity-bulk-apply-role-write"
  );
  const bulkRoleReadGroup = document.getElementById(
    "entity-bulk-role-read-group"
  );
  const bulkRoleWriteGroup = document.getElementById(
    "entity-bulk-role-write-group"
  );
  const entitiesTbody = document.getElementById("entities-main-body");
  const recentTbody = document.getElementById("entities-recent-body");

  // Type constants
  const BASE_TYPES = ["table", "view", "page", "trigger"];
  const EXTENDED_TYPES = ["module", "user"];
  const ALL_TYPES = BASE_TYPES.concat(EXTENDED_TYPES);
  window.ENTITY_EXTENDED_TYPES = EXTENDED_TYPES;

  // Selection state
  const selectedKeys = new Set();
  let lastSelectedIndex = null;

  // Filter state
  const activeFilters = new Set([]);
  const activeTags = new Set([]);

  // Extended entity state
  let isExtendedExpanded = false;
  let hasLoadedAllModules = false;
  let isLoadingAllModules = false;

  // --- Row helpers ---

  const isRowSelectable = (row) => {
    if (!row) return false;
    const type = row.dataset.entityType;
    if (type === "module" && row.dataset.installed === "false") return false;
    return true;
  };

  const findRowByKey = (key) =>
    Array.from(document.querySelectorAll(".entity-row")).find(
      (row) => row.dataset.entityKey === key
    );

  const selectionPayloadFromRow = (row) => {
    if (!row) return null;
    return {
      key: row.dataset.entityKey,
      type: row.dataset.entityType,
      id: row.dataset.entityId || null,
      name: row.dataset.entityLabel || row.dataset.entityName || "",
      installed: row.dataset.installed,
      moduleKind: row.dataset.moduleKind,
    };
  };

  const getVisibleRows = () =>
    Array.from(document.querySelectorAll(".entity-row")).filter(
      (row) => row.style.display !== "none"
    );

  const getSelectableVisibleRows = () =>
    getVisibleRows().filter((row) => isRowSelectable(row));

  const isTypingTarget = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (!tag) return false;
    const tagName = tag.toUpperCase();
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT")
      return true;
    return !!el.closest('[contenteditable="true"]');
  };

  const refreshSelectionStyles = () => {
    document.querySelectorAll(".entity-row").forEach((row) => {
      const key = row.dataset.entityKey;
      if (!isRowSelectable(row) && selectedKeys.has(key))
        selectedKeys.delete(key);
      if (selectedKeys.has(key)) {
        row.classList.add("table-active", "entity-row-selected");
      } else {
        row.classList.remove("table-active", "entity-row-selected");
      }
    });
  };

  const syncSelectBorder = (el, varName) => {
    if (!el) return;
    const disabledBorder =
      "color-mix(in srgb, var(--bs-btn-disabled-color, var(--bs-secondary)) 70%, transparent)";
    const enabledBorder = "var(--bs-secondary)";
    el.style.setProperty(varName, el.disabled ? disabledBorder : enabledBorder);
  };

  const markSelectChangedByUser = (sel) => {
    if (sel) sel.dataset.userSelected = "true";
  };
  const resetSelectUserFlag = (sel) => {
    if (sel) sel.dataset.userSelected = "";
  };

  const isTaggableType = (type) =>
    ["table", "view", "page", "trigger"].includes(type);
  const isDownloadableEntity = (item) =>
    !!item && ["table", "view", "page", "trigger"].includes(item.type);

  const isModulesFilterExclusive = () =>
    activeFilters.size === 1 && activeFilters.has("module");
  window.isModulesFilterExclusive = isModulesFilterExclusive;

  const collectSelectionItems = () =>
    Array.from(selectedKeys)
      .map((key) => selectionPayloadFromRow(findRowByKey(key)))
      .filter(Boolean);

  const getRoleName = (rid) => {
    if (typeof rid === "undefined") return "";
    const key = String(rid);
    if (!ROLES_BY_ID) return "";
    return Object.prototype.hasOwnProperty.call(ROLES_BY_ID, key)
      ? ROLES_BY_ID[key]
      : "?";
  };

  const toNumberOrUndefined = (val) => {
    if (val === "" || typeof val === "undefined" || val === null)
      return undefined;
    const num = Number(val);
    return Number.isNaN(num) ? undefined : num;
  };

  const updateRowAccess = (row, payload) => {
    if (!row) return;
    if (typeof payload.min_role_read !== "undefined")
      row.dataset.minRoleRead = String(payload.min_role_read ?? "");
    if (typeof payload.min_role_write !== "undefined")
      row.dataset.minRoleWrite = String(payload.min_role_write ?? "");
    if (typeof payload.min_role !== "undefined")
      row.dataset.minRole = String(payload.min_role ?? "");
    const cell = row.querySelector("td:nth-child(5)");
    if (cell) {
      const label = (() => {
        if (payload.type === "table") {
          const ext = row.dataset.external === "true";
          const rr = toNumberOrUndefined(payload.min_role_read);
          const rw = toNumberOrUndefined(payload.min_role_write);
          if (ext) return getRoleName(rr) + " (read only)";
          if (typeof rr !== "undefined" && typeof rw !== "undefined")
            return getRoleName(rr) + "/" + getRoleName(rw);
          return "";
        }
        const mr = toNumberOrUndefined(payload.min_role);
        return typeof mr !== "undefined" ? getRoleName(mr) : "";
      })();
      cell.textContent = label;
    }
  };

  const updateSelectionUI = () => {
    refreshSelectionStyles();
    const count = selectedKeys.size ?? 0;
    if (selectionCountEl) {
      selectionCountEl.textContent = count + " " + (TXT_SELECTED || "selected");
    }
    if (filtersRow && selectionBar) {
      if (count > 0) {
        filtersRow.classList.add("d-none");
        selectionBar.classList.remove("d-none");
      } else {
        filtersRow.classList.remove("d-none");
        selectionBar.classList.add("d-none");
      }
    }
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
    if (clearSelectionBtn) clearSelectionBtn.disabled = count === 0;
    const items = collectSelectionItems();
    const hasTaggable = items.some((item) => isTaggableType(item.type));
    const hasAccessRoleEntities = items.some((item) =>
      ["table", "view", "page"].includes(item.type)
    );
    const hasWriteRoleEntities = items.some((item) => item.type === "table");
    if (items.length === 1) {
      const only = items[0];
      const row = findRowByKey(only.key);
      if (
        row &&
        bulkRoleReadSelect &&
        bulkRoleReadSelect.dataset.userSelected !== "true"
      ) {
        const initRead =
          only.type === "table"
            ? row.dataset.minRoleRead || ""
            : row.dataset.minRole || "";
        bulkRoleReadSelect.value = initRead || "";
      }
      if (
        row &&
        bulkRoleWriteSelect &&
        only.type === "table" &&
        bulkRoleWriteSelect.dataset.userSelected !== "true"
      ) {
        bulkRoleWriteSelect.value = row.dataset.minRoleWrite || "";
      }
    } else if (items.length === 0) {
      if (bulkRoleReadSelect) {
        bulkRoleReadSelect.value = "";
        resetSelectUserFlag(bulkRoleReadSelect);
      }
      if (bulkRoleWriteSelect) {
        bulkRoleWriteSelect.value = "";
        resetSelectUserFlag(bulkRoleWriteSelect);
      }
    }
    if (bulkTagSelect) {
      bulkTagSelect.disabled = !(count > 0 && hasTaggable);
      syncSelectBorder(bulkTagSelect, "--entity-bulk-tag-border");
    }
    if (bulkApplyTagBtn) {
      bulkApplyTagBtn.disabled = !(
        count > 0 &&
        hasTaggable &&
        bulkTagSelect &&
        bulkTagSelect.value
      );
    }
    if (bulkRoleReadSelect) {
      bulkRoleReadSelect.disabled = !(count > 0 && hasAccessRoleEntities);
      syncSelectBorder(bulkRoleReadSelect, "--entity-bulk-role-border");
    }
    if (bulkApplyRoleReadBtn) {
      bulkApplyRoleReadBtn.disabled = !(
        count > 0 &&
        hasAccessRoleEntities &&
        bulkRoleReadSelect &&
        bulkRoleReadSelect.value
      );
    }
    if (bulkRoleWriteSelect) {
      bulkRoleWriteSelect.disabled = !(count > 0 && hasWriteRoleEntities);
      syncSelectBorder(bulkRoleWriteSelect, "--entity-bulk-role-border");
    }
    if (bulkApplyRoleWriteBtn) {
      bulkApplyRoleWriteBtn.disabled = !(
        count > 0 &&
        hasWriteRoleEntities &&
        bulkRoleWriteSelect &&
        bulkRoleWriteSelect.value
      );
    }
    if (bulkRoleWriteGroup) {
      if (hasWriteRoleEntities) bulkRoleWriteGroup.classList.remove("d-none");
      else bulkRoleWriteGroup.classList.add("d-none");
    }
    if (bulkDownloadPackBtn) bulkDownloadPackBtn.disabled = !(count > 0);
  };

  const clearSelection = () => {
    selectedKeys.clear();
    lastSelectedIndex = null;
    updateSelectionUI();
  };

  const updateRowTags = (row, tagId, tagName, entityType) => {
    if (!row || !tagId) return;
    const tagsCell = row.querySelector("td:nth-child(6)");
    if (!tagsCell) return;
    const dropdown = tagsCell.querySelector(".dropdown");
    const currentTags = (row.dataset.tags || "").split(" ").filter(Boolean);
    if (!currentTags.includes(String(tagId))) currentTags.push(String(tagId));
    row.dataset.tags = currentTags.join(" ");
    tagsCell.innerHTML = "";
    const pluralMap = {
      table: "tables",
      view: "views",
      page: "pages",
      trigger: "triggers",
    };
    currentTags.forEach((tid) => {
      const name = TAGS_BY_ID[tid] || tagName || tid;
      const plural = pluralMap[entityType] || "tables";
      const badge = document.createElement("a");
      badge.className = "badge bg-secondary me-1";
      badge.setAttribute(
        "href",
        "/tag/" + encodeURIComponent(tid) + "?show_list=" + plural
      );
      badge.textContent = name;
      tagsCell.appendChild(badge);
    });
    if (dropdown) tagsCell.appendChild(dropdown);
  };

  // --- URL / on-done helpers ---

  const getCurrentOnDoneTarget = () => {
    const path = window.location.pathname.startsWith("/")
      ? window.location.pathname.slice(1)
      : window.location.pathname;
    return path + window.location.search;
  };

  const shouldSkipOnDoneHref = (raw) => {
    if (!raw) return true;
    const trimmed = raw.trim();
    return (
      trimmed === "#" ||
      trimmed === "" ||
      trimmed.toLowerCase().startsWith("javascript:")
    );
  };

  const toRelativeHrefWithOnDone = (raw) => {
    if (shouldSkipOnDoneHref(raw)) return null;
    try {
      const url = new URL(raw, window.location.origin);
      url.searchParams.set("on_done_redirect", getCurrentOnDoneTarget());
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return null;
    }
  };

  const updateElementOnDoneHref = (el, attr) => {
    const raw = el.getAttribute(attr) || el[attr];
    const updated = toRelativeHrefWithOnDone(raw);
    if (updated) el.setAttribute(attr, updated);
  };

  const ensureOnDoneHiddenInput = (form) => {
    if (form.querySelector('input[name="on_done_redirect"]')) return;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "on_done_redirect";
    hidden.value = getCurrentOnDoneTarget();
    form.appendChild(hidden);
  };

  const updateOnDoneRedirectTargets = () => {
    document
      .querySelectorAll('a[href*="on_done_redirect="]')
      .forEach((link) => updateElementOnDoneHref(link, "href"));
    document
      .querySelectorAll('form[action*="on_done_redirect="]')
      .forEach((form) => updateElementOnDoneHref(form, "action"));
  };

  const updateLegacyButton = () => {
    const legacyButton = document.getElementById("legacy-entity-link");
    const legacyLabel = legacyButton
      ? legacyButton.querySelector(".legacy-label")
      : null;
    if (!legacyButton) return;
    const activeTypes = Array.from(activeFilters);
    if (activeTypes.length === 1) {
      const meta = LEGACY_LINK_META[activeTypes[0]];
      if (meta) {
        legacyButton.classList.remove("d-none");
        legacyButton.setAttribute("href", meta.href);
        if (legacyLabel) legacyLabel.textContent = meta.label;
        return;
      }
    }
    legacyButton.classList.add("d-none");
  };

  const updateUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (searchInput.value) params.set("q", searchInput.value);
    else params.delete("q");
    if (deepSearchToggle && deepSearchToggle.checked) params.set("deep", "on");
    else params.delete("deep");
    ALL_TYPES.forEach((t) => {
      if (activeFilters.has(t)) params.set(t + "s", "on");
      else params.delete(t + "s");
    });
    if (isExtendedExpanded) params.set("extended", "on");
    else params.delete("extended");
    if (activeTags.size > 0)
      params.set("tags", Array.from(activeTags).join(","));
    else params.delete("tags");
    const newUrl =
      window.location.pathname +
      (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState(null, "", newUrl);
  };

  // --- Extended entity functions ---

  const clearExtendedTypeFilters = () => {
    EXTENDED_TYPES.forEach((type) => {
      if (activeFilters.has(type)) {
        activeFilters.delete(type);
        const btn = document.querySelector(
          '.entity-filter-btn[data-entity-type="' + type + '"]'
        );
        if (btn) {
          btn.classList.remove("btn-primary");
          btn.classList.add("btn-outline-primary");
        }
      }
    });
  };

  const loadExtendedEntities = async (includeAllModules = false) => {
    try {
      const query = includeAllModules ? "?include_all_modules=1" : "";
      const res = await fetch("/entities/extended" + query);
      const data = await res.json();
      return data.entities || [];
    } catch (e) {
      console.error("Failed to load extended entities:", e);
      return [];
    }
  };

  const renderExtendedEntityRows = (extendedEntities, tbody) => {
    document
      .querySelectorAll("[data-is-extended]")
      .forEach((row) => row.remove());
    extendedEntities.forEach((entity) =>
      tbody.appendChild(createExtendedEntityRow(entity))
    );
    updateSelectionUI();
  };

  const ensureAllModulesLoaded = async () => {
    if (hasLoadedAllModules || isLoadingAllModules || !isExtendedExpanded)
      return;
    isLoadingAllModules = true;
    let updated = false;
    try {
      const extendedEntities = await loadExtendedEntities(true);
      window.extendedEntities = extendedEntities;
      const tbody = entitiesTbody;
      renderExtendedEntityRows(extendedEntities, tbody);
      hasLoadedAllModules = true;
      updated = true;
    } catch (e) {
      console.error("Failed to load all modules:", e);
    } finally {
      isLoadingAllModules = false;
      if (updated) filterEntities();
    }
  };

  window.toggleEntityExpanded = async (expand) => {
    const moreBtn = document.getElementById("entity-more-btn");
    const lessBtn = document.getElementById("entity-less-btn");
    const extendedButtons = document.querySelectorAll(".entity-extended-btn");
    const tbody = entitiesTbody;

    if (expand) {
      if (isExtendedExpanded) return;
      extendedButtons.forEach((btn) => btn.classList.remove("d-none"));
      moreBtn.classList.add("d-none");
      lessBtn.classList.remove("d-none");
      isExtendedExpanded = true;
      const shouldLoadAll = isModulesFilterExclusive();
      const extendedEntities = await loadExtendedEntities(shouldLoadAll);
      window.extendedEntities = extendedEntities;
      renderExtendedEntityRows(extendedEntities, tbody);
      hasLoadedAllModules = shouldLoadAll;
      filterEntities();
    } else {
      if (!isExtendedExpanded) return;
      extendedButtons.forEach((btn) => btn.classList.add("d-none"));
      moreBtn.classList.remove("d-none");
      lessBtn.classList.add("d-none");
      isExtendedExpanded = false;
      hasLoadedAllModules = false;
      isLoadingAllModules = false;
      window.extendedEntities = [];
      renderExtendedEntityRows([], tbody);
      clearExtendedTypeFilters();
      filterEntities();
    }
  };

  const createExtendedEntityRow = (entity) => {
    const tr = document.createElement("tr");
    tr.className = "entity-row";
    tr.dataset.entityType = entity.type;
    tr.dataset.entityName = entity.name.toLowerCase();
    tr.dataset.entityId = entity.id ? entity.id : "";
    tr.dataset.entityLabel = entity.name;
    const key =
      entity.type + ":" + (entity.type === "module" ? entity.name : entity.id);
    tr.dataset.entityKey = key;
    let searchable = (
      (entity.name || "").toLowerCase() +
      " " +
      entity.type
    ).trim();
    if (entity.metadata) {
      Object.keys(entity.metadata).forEach((k) => {
        const val = entity.metadata[k];
        const skipDescription = entity.type === "module" && k === "description";
        const skipUsername = entity.type === "user" && k === "username";
        if (
          !skipDescription &&
          !skipUsername &&
          val &&
          typeof val === "string"
        ) {
          searchable += " " + val.toLowerCase();
        }
      });
    }
    tr.dataset.tags = "";
    tr.dataset.isExtended = "true";
    tr.dataset.installed =
      entity.metadata && entity.metadata.installed === false ? "false" : "true";
    tr.dataset.moduleKind =
      entity.metadata && entity.metadata.type ? entity.metadata.type : "";

    if (!isRowSelectable(tr)) {
      tr.classList.add("entity-row-selection-disabled");
      tr.setAttribute("aria-disabled", "true");
    }

    // Type badge
    const badges = {
      module: { class: "secondary", icon: "cube", label: "Module" },
      user: { class: "dark", icon: "user", label: "User" },
    };
    const badge = badges[entity.type];
    const typeBadge = document.createElement("td");
    typeBadge.innerHTML =
      '<span class="badge bg-' +
      badge.class +
      ' me-2"><i class="fas fa-' +
      badge.icon +
      ' me-1"></i>' +
      badge.label +
      "</span>";
    tr.appendChild(typeBadge);

    const hasConfig = entity.metadata && entity.metadata.hasConfig;
    const isInstalled = entity.metadata && entity.metadata.installed;

    // Name
    const nameTd = document.createElement("td");
    const isStaticModule = entity.type === "module" && !hasConfig;
    const nameLink = document.createElement(isStaticModule ? "span" : "a");
    if (!isStaticModule) {
      const baseHref = entity.editLink || "#";
      const updatedHref = toRelativeHrefWithOnDone(baseHref);
      nameLink.setAttribute("href", updatedHref || baseHref);
    }
    nameLink.className = "fw-bold";
    nameLink.textContent = entity.name;
    nameTd.appendChild(nameLink);
    tr.appendChild(nameTd);

    // Run / info cell
    const runTd = document.createElement("td");
    if (
      entity.type === "module" &&
      entity.metadata &&
      entity.metadata.type !== "pack" &&
      entity.viewLink &&
      isInstalled
    ) {
      const infoLink = document.createElement("a");
      infoLink.className = "link-primary text-decoration-none";
      infoLink.innerHTML = window.TXT_INFO || "Info";
      const updatedInfoHref = toRelativeHrefWithOnDone(entity.viewLink);
      infoLink.setAttribute("href", updatedInfoHref || entity.viewLink);
      runTd.appendChild(infoLink);
    }
    tr.appendChild(runTd);

    // Details cell
    const detailsTd = document.createElement("td");
    let detailsHtml = "";
    if (entity.type === "user") {
      const disabled = entity.metadata && entity.metadata.disabled;
      const roleId = entity.metadata && entity.metadata.role_id;
      if (Array.isArray(window.ENTITY_ROLES)) {
        const role = window.ENTITY_ROLES.find(
          (r) => String(r.id) === String(roleId)
        );
        if (role && role.role) {
          detailsHtml +=
            '<span class="text-muted small me-2">' + role.role + "</span>";
        }
      }
      if (disabled) {
        detailsHtml +=
          '<span class="badge bg-danger me-1">' +
          (window.TXT_DISABLED || "Disabled") +
          "</span>";
        searchable += " disabled";
      }
    } else if (entity.type === "module") {
      const version = entity.metadata && entity.metadata.version;
      const hasTheme = entity.metadata && entity.metadata.has_theme;
      const hasAuth = entity.metadata && entity.metadata.has_auth;
      const isReadyForMobile =
        entity.metadata && entity.metadata.ready_for_mobile;
      const isLocal = entity.metadata && entity.metadata.local;
      const isPack = entity.metadata && entity.metadata.type === "pack";
      if (version)
        detailsHtml +=
          '<span class="text-muted small me-2">v' + version + "</span>";
      if (isPack)
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_PACK || "Pack") +
          "</span>";
      if (hasTheme) {
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_THEME || "Theme") +
          "</span>";
        searchable += " theme";
      }
      if (isLocal) {
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_LOCAL || "Local") +
          "</span>";
        searchable += " local";
      }
      if (isInstalled) {
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_INSTALLED || "Installed") +
          "</span>";
        searchable += " installed";
      }
      if (hasAuth) {
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_AUTH || "Authentication") +
          "</span>";
        searchable += " authentication auth";
      }
      if (isReadyForMobile) {
        detailsHtml +=
          '<span class="badge bg-secondary me-1">' +
          (window.TXT_MOBILE || "Mobile") +
          "</span>";
        searchable += " mobile";
      }
    }
    if (detailsHtml) detailsTd.innerHTML = detailsHtml;
    tr.appendChild(detailsTd);

    tr.appendChild(document.createElement("td")); // access
    tr.appendChild(document.createElement("td")); // tags

    // Actions cell
    const actionsTd = document.createElement("td");
    if (entity.actionsHtml) {
      actionsTd.innerHTML = entity.actionsHtml;
      actionsTd.querySelectorAll("a").forEach((link) => {
        const updated = toRelativeHrefWithOnDone(link.getAttribute("href"));
        if (updated) link.setAttribute("href", updated);
      });
      actionsTd.querySelectorAll("form").forEach((form) => {
        const updated = toRelativeHrefWithOnDone(form.getAttribute("action"));
        if (updated) form.setAttribute("action", updated);
        if (entity.type === "user") ensureOnDoneHiddenInput(form);
      });
      const dropdownToggle = actionsTd.querySelector(
        '[data-bs-toggle="dropdown"]'
      );
      if (dropdownToggle && window.bootstrap && window.bootstrap.Dropdown) {
        window.bootstrap.Dropdown.getOrCreateInstance(dropdownToggle);
      }
    }
    tr.appendChild(actionsTd);

    tr.dataset.searchable = searchable.trim();
    let deepSearchable = (entity.deepSearchable || searchable).trim();
    if (entity.type === "module") {
      const description =
        entity.metadata && typeof entity.metadata.description === "string"
          ? entity.metadata.description.toLowerCase()
          : "";
      if (description && !deepSearchable.includes(description)) {
        deepSearchable = (deepSearchable + " " + description).trim();
      }
    } else if (
      entity.type === "user" &&
      entity.metadata &&
      typeof entity.metadata.username === "string"
    ) {
      const usernameLower = entity.metadata.username.toLowerCase();
      if (!deepSearchable.includes(usernameLower)) {
        deepSearchable = (deepSearchable + " " + usernameLower).trim();
      }
    }
    tr.dataset.deepSearchable = deepSearchable;
    if (window.ENTITY_DEEP_SEARCH) {
      window.ENTITY_DEEP_SEARCH[key] = deepSearchable;
    }
    return tr;
  };

  // Recently edited

  const relativeTime = (isoStr) => {
    if (!isoStr) return "";
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    if (d < 30) return d + "d ago";
    const mo = Math.floor(d / 30);
    return mo + "mo ago";
  };

  const RECENT_COUNT = 5;

  const updateRecentlyEdited = () => {
    if (!recentTbody) return;

    // Only show when there is no active search
    const hasSearch = searchInput && searchInput.value.trim().length > 0;

    // Collect visible main rows that have an updated_at timestamp
    const candidates = Array.from(
      entitiesTbody ? entitiesTbody.querySelectorAll(".entity-row") : []
    ).filter((r) => r.style.display !== "none" && r.dataset.updatedAt);

    if (hasSearch || candidates.length === 0) {
      Array.from(
        recentTbody.querySelectorAll(
          ".entity-row-clone, .entity-section-header-row"
        )
      ).forEach((r) => r.remove());
      recentTbody.classList.add("d-none");
      return;
    }

    // Sort by updated_at descending, take top N
    candidates.sort(
      (a, b) => new Date(b.dataset.updatedAt) - new Date(a.dataset.updatedAt)
    );
    const recent = candidates.slice(0, RECENT_COUNT);

    // Clear previous clones (keep the section header rows)
    Array.from(recentTbody.querySelectorAll(".entity-row-clone")).forEach((r) =>
      r.remove()
    );
    Array.from(
      recentTbody.querySelectorAll(".entity-section-header-row")
    ).forEach((r) => r.remove());

    // Build section header row for recent
    const recentHeaderTr = document.createElement("tr");
    recentHeaderTr.className = "entity-section-header-row";
    const recentHeaderTd = document.createElement("td");
    recentHeaderTd.colSpan = 7;
    recentHeaderTd.textContent = "Recently edited";
    recentHeaderTr.appendChild(recentHeaderTd);
    recentTbody.appendChild(recentHeaderTr);

    // Insert clones
    recent.forEach((originalRow) => {
      const clone = originalRow.cloneNode(true);
      clone.dataset.recentClone = "true";
      clone.classList.remove("entity-row");
      clone.classList.add("entity-row-clone", "entity-row-recent");

      const tds = clone.querySelectorAll("td");

      const detailsTd = tds[3];
      if (detailsTd) {
        const timeBadge = document.createElement("span");
        timeBadge.className =
          "badge bg-secondary-subtle text-secondary fw-normal me-1 ms-1";
        timeBadge.textContent = relativeTime(originalRow.dataset.updatedAt);
        // detailsContent wraps badges in a div; insert inside it so they stay inline
        const detailsDiv = detailsTd.querySelector("div");
        if (detailsDiv) {
          // detailsDiv.insertBefore(timeBadge, detailsDiv.firstChild);
          detailsDiv.lastChild.after(timeBadge);
        } else {
          // detailsTd.insertBefore(timeBadge, detailsTd.firstChild);
          detailsTd.appendChild(timeBadge);
        }
      }

      // Remove add-tag dropdown from tags cell to avoid duplicate IDs
      const tagsTd = tds[tds.length - 2];
      if (tagsTd) {
        const dropdown = tagsTd.querySelector(".dropdown");
        if (dropdown) dropdown.remove();
      }

      // On row click (not a link/button), scroll to + flash the original
      clone.addEventListener("click", (e) => {
        if (e.target.closest("a, button, input, select, textarea, label"))
          return;
        const original = entitiesTbody
          ? entitiesTbody.querySelector(
              '.entity-row[data-entity-key="' +
                originalRow.dataset.entityKey.replace(/"/g, '\\"') +
                '"]'
            )
          : null;
        if (original) {
          original.scrollIntoView({ behavior: "smooth", block: "center" });
          original.classList.remove("entity-row-flash");
          void original.offsetWidth; // reflow to restart animation
          original.classList.add("entity-row-flash");
          setTimeout(() => original.classList.remove("entity-row-flash"), 1500);
        }
      });

      recentTbody.appendChild(clone);
    });

    // Build "All entities" separator at bottom of recent section
    const allHeaderTr = document.createElement("tr");
    allHeaderTr.className = "entity-section-header-row";
    const allHeaderTd = document.createElement("td");
    allHeaderTd.colSpan = 7;
    allHeaderTd.textContent = "All entities";
    allHeaderTr.appendChild(allHeaderTd);
    recentTbody.appendChild(allHeaderTr);

    recentTbody.classList.remove("d-none");
  };

  // --- Main filter function ---

  function filterEntities() {
    const entityRows = document.querySelectorAll(".entity-row");
    const searchTerm = searchInput.value.toLowerCase();
    const useDeep = deepSearchToggle && deepSearchToggle.checked;
    let visibleCount = 0;
    const visibleKeys = new Set();
    const allowAllModules = isModulesFilterExclusive();
    const canShowAllModules = allowAllModules && isExtendedExpanded;
    if (canShowAllModules && !hasLoadedAllModules) {
      ensureAllModulesLoaded();
    }

    entityRows.forEach((row) => {
      const entityType = row.dataset.entityType;
      const key = row.dataset.entityKey;
      const deepText =
        useDeep && window.ENTITY_DEEP_SEARCH
          ? window.ENTITY_DEEP_SEARCH[key]
          : null;
      const searchableText = useDeep
        ? deepText || row.dataset.deepSearchable || ""
        : row.dataset.searchable || "";

      const rowTags = (row.dataset.tags || "").split(" ").filter(Boolean);
      const rowInstalled = row.dataset.installed !== "false";
      const typeMatch = activeFilters.has(entityType);
      const searchMatch = !searchTerm || searchableText.includes(searchTerm);
      const tagMatch =
        activeTags.size === 0 || rowTags.some((tid) => activeTags.has(tid));
      const moduleVisibilityOk =
        entityType !== "module" || rowInstalled || canShowAllModules;

      if (
        (activeFilters.size === 0 || typeMatch) &&
        searchMatch &&
        tagMatch &&
        moduleVisibilityOk
      ) {
        row.style.display = "";
        visibleKeys.add(key);
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    selectedKeys.forEach((key) => {
      if (!visibleKeys.has(key)) selectedKeys.delete(key);
    });

    if (visibleCount === 0) {
      entitiesList.parentElement.classList.add("d-none");
      noResults.classList.remove("d-none");
    } else {
      entitiesList.parentElement.classList.remove("d-none");
      noResults.classList.add("d-none");
    }

    updateUrl();
    updateOnDoneRedirectTargets();
    updateLegacyButton();
    updateSelectionUI();
    updateRecentlyEdited();
  }

  // --- Bulk action helpers ---

  const triggerDownload = (filename, content) => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDeleteError = (err) => {
    const displayType =
      err && err.isPack
        ? "Pack"
        : (() => {
            const t = ((err && err.type) || "").toString();
            if (!t) return "Item";
            return t.charAt(0).toUpperCase() + t.slice(1);
          })();
    const label = (err && (err.name || err.id || err.key)) || "(unknown)";
    const message =
      (err && err.message) ||
      TXT_DELETE_FAILED ||
      "Failed to delete selected items";
    return displayType + " (" + label + "): " + message;
  };

  const showBulkDeleteErrors = (errs) => {
    if (!errs || !errs.length) return;
    alert(errs.map((e) => formatDeleteError(e)).join("\n-----\n"));
  };

  const removeRowsByKeys = (keysToRemove) => {
    if (!keysToRemove || !keysToRemove.size) return;
    document.querySelectorAll(".entity-row").forEach((row) => {
      if (keysToRemove.has(row.dataset.entityKey)) row.remove();
    });
  };

  const refreshExtendedEntitiesAfterDelete = async () => {
    if (!isExtendedExpanded) return;
    const tbody = entitiesTbody;
    if (!tbody) return;
    try {
      const extendedEntities = await loadExtendedEntities(
        isModulesFilterExclusive()
      );
      window.extendedEntities = extendedEntities;
      renderExtendedEntityRows(extendedEntities, tbody);
    } catch (err) {
      console.error("Failed to refresh extended entities after delete:", err);
    }
  };

  const doBulkApplyTag = async () => {
    if (!bulkApplyTagBtn || !bulkTagSelect) return;
    const tagId = bulkTagSelect.value;
    if (!tagId) return;
    const items = collectSelectionItems().filter((item) =>
      isTaggableType(item.type)
    );
    if (!items.length) return;
    bulkApplyTagBtn.disabled = true;
    try {
      const res = await fetch("/entities/bulk-apply-tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": window._sc_globalCsrf || "",
        },
        body: JSON.stringify({ tag_id: tagId, items }),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      const tagName = TAGS_BY_ID[tagId] || "";
      items.forEach((item) => {
        const row = findRowByKey(item.key);
        if (row) updateRowTags(row, tagId, tagName, item.type);
      });
      filterEntities();
    } catch (e) {
      console.error("Failed to apply tag to selected items", e);
      alert("Failed to apply tag to selected items");
    }
    bulkApplyTagBtn.disabled = false;
  };

  const doBulkDownloadPack = async () => {
    if (!bulkDownloadPackBtn) return;
    const items = collectSelectionItems();
    if (!items.length) return;
    bulkDownloadPackBtn.disabled = true;
    try {
      const res = await fetch("/entities/download-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": window._sc_globalCsrf || "",
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      if (Array.isArray(payload && payload.packs)) {
        payload.packs.forEach((pack) => {
          if (pack && pack.name && pack.content) {
            const content =
              typeof pack.content === "string"
                ? pack.content
                : JSON.stringify(pack.content, null, 2);
            triggerDownload(pack.name + ".json", content);
          }
        });
      }
    } catch (e) {
      console.error("Failed to download pack(s)", e);
      alert("Failed to download pack for selected items");
    }
    bulkDownloadPackBtn.disabled = false;
  };

  const doBulkApplyRole = async (mode) => {
    const isWriteMode = mode === "write";
    const selectEl = isWriteMode ? bulkRoleWriteSelect : bulkRoleReadSelect;
    const buttonEl = isWriteMode ? bulkApplyRoleWriteBtn : bulkApplyRoleReadBtn;
    if (!selectEl || !buttonEl) return;
    const roleId = selectEl.value;
    if (!roleId) return;
    const items = collectSelectionItems().filter((item) =>
      isWriteMode
        ? item.type === "table"
        : ["table", "view", "page"].includes(item.type)
    );
    if (!items.length) return;
    buttonEl.disabled = true;
    try {
      const res = await fetch("/entities/bulk-set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": window._sc_globalCsrf || "",
        },
        body: JSON.stringify({ items, role_id: roleId, mode }),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await res.json();
      const updatedKeys = new Set((payload && payload.updatedKeys) || []);
      const errors = (payload && payload.errors) || [];
      if (errors.length) {
        console.error("Failed to set role for some items", errors);
        alert("Failed to set role for some selected items");
      }
      items.forEach((item) => {
        if (updatedKeys.size && !updatedKeys.has(item.key)) return;
        const row = findRowByKey(item.key);
        if (!row) return;
        if (isWriteMode && item.type === "table") {
          updateRowAccess(row, {
            type: "table",
            min_role_write: Number(roleId),
            min_role_read: toNumberOrUndefined(row.dataset.minRoleRead),
          });
        } else if (!isWriteMode) {
          if (item.type === "table") {
            updateRowAccess(row, {
              type: "table",
              min_role_read: Number(roleId),
              min_role_write: toNumberOrUndefined(row.dataset.minRoleWrite),
            });
          } else if (item.type === "view") {
            updateRowAccess(row, { type: "view", min_role: Number(roleId) });
          } else if (item.type === "page") {
            updateRowAccess(row, { type: "page", min_role: Number(roleId) });
          }
        }
      });
    } catch (e) {
      console.error("Failed to set role for selected items", e);
      alert("Failed to set role for selected items");
    }
    buttonEl.disabled = false;
    updateSelectionUI();
  };

  // --- URL state restore ---

  const initFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    if (q) searchInput.value = q;
    const deep = params.get("deep") === "on";
    if (deep && deepSearchToggle) {
      deepSearchToggle.checked = true;
      deepSearchToggle.dispatchEvent(new Event("change"));
    }
    const shouldExpandExtended =
      params.get("extended") === "on" ||
      EXTENDED_TYPES.some((t) => params.get(t + "s") === "on");
    ALL_TYPES.forEach((t) => {
      if (params.get(t + "s") === "on") activeFilters.add(t);
    });
    filterButtons.forEach((btn) => {
      const t = btn.dataset.entityType;
      if (activeFilters.has(t)) {
        btn.classList.add("btn-primary");
        btn.classList.remove("btn-outline-primary");
      }
    });
    const tagsParam = params.get("tags");
    if (tagsParam) {
      tagsParam
        .split(",")
        .filter(Boolean)
        .forEach((id) => activeTags.add(id));
    }
    tagButtons.forEach((btn) => {
      const id = btn.dataset.tagId;
      if (activeTags.has(id)) {
        btn.classList.add("active", "btn-secondary");
        btn.classList.remove("btn-outline-secondary");
      }
    });
    return { shouldExpandExtended };
  };

  // --- Event listeners ---

  searchInput.addEventListener("input", filterEntities);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      searchInput.blur();
    }
  });

  if (deepSearchToggle) {
    let deepSearchLoading = false;
    deepSearchToggle.addEventListener("change", function () {
      if (this.checked && !window.ENTITY_DEEP_SEARCH && !deepSearchLoading) {
        deepSearchLoading = true;
        fetch("/entities/deep-search-index")
          .then((r) => r.json())
          .then((data) => {
            window.ENTITY_DEEP_SEARCH = data;
            deepSearchLoading = false;
            filterEntities();
          })
          .catch(() => {
            deepSearchLoading = false;
          });
      } else {
        filterEntities();
      }
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const entityType = this.dataset.entityType;
      if (!activeFilters.has(entityType)) {
        activeFilters.add(entityType);
        this.classList.add("btn-primary");
        this.classList.remove("btn-outline-primary");
      } else {
        activeFilters.delete(entityType);
        this.classList.remove("btn-primary");
        this.classList.add("btn-outline-primary");
      }
      filterEntities();
      if (searchInput && typeof searchInput.focus === "function") {
        searchInput.focus({ preventScroll: true });
      }
    });
  });

  tagButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const tid = this.dataset.tagId;
      if (!activeTags.has(tid)) {
        activeTags.add(tid);
        this.classList.add("active", "btn-secondary");
        this.classList.remove("btn-outline-secondary");
      } else {
        activeTags.delete(tid);
        this.classList.remove("active", "btn-secondary");
        this.classList.add("btn-outline-secondary");
      }
      filterEntities();
    });
  });

  const keyboardShortcutTypeMap = {
    KeyT: "table",
    KeyV: "view",
    KeyP: "page",
    KeyR: "trigger",
    KeyM: "module",
    KeyU: "user",
  };

  document.addEventListener("keydown", async (e) => {
    const isFromSearchInput = e.target === searchInput;
    const typingTarget = isTypingTarget(e.target);

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const type = keyboardShortcutTypeMap[e.code];
      if (type) {
        e.preventDefault();
        if (EXTENDED_TYPES.includes(type) && !isExtendedExpanded) {
          await window.toggleEntityExpanded(true);
        }
        const btn = filterButtonsByType[type];
        if (btn) {
          btn.click();
          if (searchInput && typeof searchInput.focus === "function") {
            searchInput.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (deepSearchToggle && e.code === "KeyS") {
        e.preventDefault();
        deepSearchToggle.checked = !deepSearchToggle.checked;
        deepSearchToggle.dispatchEvent(new Event("change"));
        if (searchInput && typeof searchInput.focus === "function") {
          searchInput.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (typingTarget && !isFromSearchInput) return;

    if (
      (e.metaKey || e.ctrlKey) &&
      !e.altKey &&
      (e.key === "a" || e.key === "A")
    ) {
      const visibleRows = getSelectableVisibleRows();
      if (!visibleRows.length) return;
      e.preventDefault();
      visibleRows.forEach((row) => {
        if (row.dataset.entityKey) selectedKeys.add(row.dataset.entityKey);
      });
      lastSelectedIndex = visibleRows.length - 1;
      updateSelectionUI();
    }
  });

  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", () => {
      clearSelection();
      filterEntities();
    });
  }
  if (bulkTagSelect) {
    bulkTagSelect.addEventListener("change", () => updateSelectionUI());
  }
  if (bulkRoleReadSelect) {
    bulkRoleReadSelect.addEventListener("change", () => {
      markSelectChangedByUser(bulkRoleReadSelect);
      updateSelectionUI();
    });
  }
  if (bulkRoleWriteSelect) {
    bulkRoleWriteSelect.addEventListener("change", () => {
      markSelectChangedByUser(bulkRoleWriteSelect);
      updateSelectionUI();
    });
  }
  if (bulkApplyTagBtn)
    bulkApplyTagBtn.addEventListener("click", doBulkApplyTag);
  if (bulkDownloadPackBtn)
    bulkDownloadPackBtn.addEventListener("click", doBulkDownloadPack);
  if (bulkApplyRoleReadBtn) {
    bulkApplyRoleReadBtn.addEventListener("click", () =>
      doBulkApplyRole("read")
    );
  }
  if (bulkApplyRoleWriteBtn) {
    bulkApplyRoleWriteBtn.addEventListener("click", () =>
      doBulkApplyRole("write")
    );
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener("click", async () => {
      const items = collectSelectionItems();
      if (!items.length) return;
      const template =
        TXT_DELETE_SELECTED_CONFIRM || TXT_DELETE_SELECTED_FALLBACK;
      const msg = template.includes("%s")
        ? template.replace("%s", items.length)
        : template;
      if (!window.confirm(msg)) return;
      bulkDeleteBtn.disabled = true;
      try {
        const res = await fetch("/entities/bulk-delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CSRF-Token": window._sc_globalCsrf || "",
          },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();
        const keysToRemove = new Set(
          payload.deletedKeys && payload.deletedKeys.length
            ? payload.deletedKeys
            : items.map((i) => i.key)
        );
        removeRowsByKeys(keysToRemove);
        if (payload.errors && payload.errors.length) {
          console.error("Bulk delete errors", payload.errors);
          showBulkDeleteErrors(payload.errors);
        }
        clearSelection();
        await refreshExtendedEntitiesAfterDelete();
        filterEntities();
      } catch (e) {
        console.error(e);
        alert(TXT_DELETE_FAILED || "Failed to delete selected items");
      }
      bulkDeleteBtn.disabled = false;
    });
  }

  if (entitiesTbody) {
    entitiesTbody.addEventListener("click", (e) => {
      const row = e.target.closest(".entity-row");
      if (!row) return;
      if (e.target.closest("a, button, input, select, textarea, label")) return;
      if (!isRowSelectable(row)) {
        lastSelectedIndex = null;
        return;
      }
      const visibleRows = getSelectableVisibleRows();
      const index = visibleRows.indexOf(row);
      const key = row.dataset.entityKey;
      if (!key) return;

      if (
        e.shiftKey &&
        lastSelectedIndex !== null &&
        visibleRows[lastSelectedIndex]
      ) {
        selectedKeys.clear();
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          const rangeKey = visibleRows[i].dataset.entityKey;
          if (rangeKey) selectedKeys.add(rangeKey);
        }
      } else if (e.metaKey || e.ctrlKey) {
        if (selectedKeys.has(key)) selectedKeys.delete(key);
        else selectedKeys.add(key);
        lastSelectedIndex = index;
      } else {
        const onlyThisSelected =
          selectedKeys.size === 1 && selectedKeys.has(key);
        selectedKeys.clear();
        if (!onlyThisSelected) {
          selectedKeys.add(key);
          lastSelectedIndex = index;
        } else {
          lastSelectedIndex = null;
        }
      }
      updateSelectionUI();
    });
  }

  // --- Init ---

  const { shouldExpandExtended } = initFromUrl();
  if (shouldExpandExtended) {
    window.toggleEntityExpanded(true);
  } else {
    filterEntities();
  }
  searchInput.focus();
  updateSelectionUI();
  setTimeout(updateLegacyButton, 200);
}
