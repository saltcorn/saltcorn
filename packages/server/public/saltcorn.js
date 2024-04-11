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

  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (uri.match(re)) {
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

function removeQueryStringParameter(uri1, key) {
  let hash = "";
  let uri = uri1;
  if (uri && uri.includes("#")) {
    let uris = uri1.split("#");
    hash = "#" + uris[1];
    uri = uris[0];
  }

  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "gi");
  if (uri.match(re)) {
    uri = uri.replace(re, "$1" + "$2");
  }
  if (uri[uri.length - 1] === "?" || uri[uri.length - 1] === "&")
    uri = uri.substring(0, uri.length - 1);
  if (uri.match(re)) return removeQueryStringParameter(uri + hash, key);
  return uri + hash;
}

function get_current_state_url(e) {
  const localizer = e ? $(e).closest("[data-sc-local-state]") : [];
  let $modal = $("#scmodal");
  if (localizer.length) {
    const localState = localizer.attr("data-sc-local-state") || "";
    return localState;
  } else if ($modal.length === 0 || !$modal.hasClass("show"))
    return window.location.href;
  else return $modal.prop("data-modal-state");
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
  const value = encodeURIComponent(that.value);
  var separator = get_current_state_url(e).indexOf("?") !== -1 ? "&" : "?";
  let dest;
  if (checked) dest = get_current_state_url(e) + `${separator}${name}=${value}`;
  else dest = get_current_state_url(e).replace(`${name}=${value}`, "");
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
  if (Object.keys(kvs).some((k) => !is_paging_param(k))) {
    newhref = invalidate_pagings(newhref);
  }
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true)
      newhref = removeQueryStringParameter(newhref, kv[0]);
    else newhref = updateQueryStringParameter(newhref, kv[0], kv[1]);
  });
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

function reload_embedded_view(viewname, new_query_string) {
  if (window._sc_loglevel > 4)
    console.log(
      "reload_embedded_view",
      viewname,
      "found",
      $(`[data-sc-embed-viewname="${viewname}"]`).length
    );
  $(`[data-sc-embed-viewname="${viewname}"]`).each(function () {
    const $e = $(this);
    let url = $e.attr("data-sc-local-state") || $e.attr("data-sc-view-source");
    if (!url) return;
    if (new_query_string) {
      url = url.split("?")[0] + "?" + new_query_string;
    }
    $.ajax(url, {
      headers: {
        pjaxpageload: "true",
        localizedstate: "true", //no admin bar
      },
      success: function (res, textStatus, request) {
        $e.html(res);
        initialize_page();
      },
      error: function (res) {
        notifyAlert({ type: "danger", text: res.responseText });
      },
    });
  });
}

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
        initialize_page();
      },
      error: function (res) {
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
  $e.attr("data-innerhtml-prespin", $e.html());
  $e.html('<i class="fas fa-spinner fa-spin"></i>').width(width);
}

function reset_spinners() {
  $("[data-innerhtml-prespin]").each(function () {
    $e = $(this);
    $e.html($e.attr("data-innerhtml-prespin"));
    $e.removeAttr("data-innerhtml-prespin");
  });
}

function view_post(viewname, route, data, onDone, sendState) {
  const query = sendState
    ? `?${new URL(get_current_state_url()).searchParams.toString()}`
    : "";
  $.ajax("/view/" + viewname + "/" + route + query, {
    dataType: "json",
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    contentType:
      typeof data === "string"
        ? "application/x-www-form-urlencoded"
        : "application/json",
    data: typeof data === "string" ? data : JSON.stringify(data),
  })
    .done(function (res) {
      if (onDone) onDone(res);
      ajax_done(res, viewname);
      reset_spinners();
    })
    .fail(function (res) {
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

function close_saltcorn_modal() {
  $("#scmodal").off("hidden.bs.modal");
  var myModalEl = document.getElementById("scmodal");
  if (!myModalEl) return;
  var modal = bootstrap.Modal.getInstance(myModalEl);
  if (modal) {
    if (modal.hide) modal.hide();
    if (modal.dispose) modal.dispose();
  }
}

function ensure_modal_exists_and_closed() {
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
  } else if ($("#scmodal").hasClass("show")) {
    // remove reload handler added by edit, for when we have popup link
    // in autosave edit in popup
    $("#scmodal").off("hidden.bs.modal");
    close_saltcorn_modal();
  }
  $("#modal-toasts-area").empty();
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
  ensure_modal_exists_and_closed();
  $("#scmodal").removeClass("no-submit-reload");
  $("#scmodal").attr("data-on-close-reload-view", opts.reload_view || null);

  if (opts.submitReload === false) $("#scmodal").addClass("no-submit-reload");
  $.ajax(url, {
    headers: {
      SaltcornModalRequest: "true",
    },
    success: function (res, textStatus, request) {
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
      : {}),
  });
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

function saveAndContinue(e, k, event) {
  if (
    event &&
    event.target &&
    event.target.classList &&
    event.target.classList.contains("no-form-change")
  )
    return;
  var form = $(e).closest("form");
  const valres = form[0].reportValidity();
  if (!valres) return;
  submitWithEmptyAction(form[0]);
  var url = form.attr("action");
  var form_data = form.serialize();
  ajax_indicator(true, e);
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function (res) {
      ajax_indicator(false);
      form.parent().find(".full-form-error").text("");
      if (res.id && form.find("input[name=id")) {
        form.append(
          `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
        );
      }
      common_done(res, form.attr("data-viewname"));
    },
    error: function (request) {
      var ct = request.getResponseHeader("content-type") || "";
      if (ct.startsWith && ct.startsWith("application/json")) {
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

function ajaxSubmitForm(e) {
  var form = $(e).closest("form");
  var url = form.attr("action");
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
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
        else location.reload();
      } else if (!no_reload) location.reload();
      else common_done(res, form.attr("data-viewname"));
    },
    error: function (request) {
      var title = request.getResponseHeader("Page-Title");
      if (title) $("#scmodal .modal-title").html(decodeURIComponent(title));
      var body = request.responseText;
      if (body) $("#scmodal .modal-body").html(body);
    },
  });

  return false;
}
function ajax_post_json(url, data, args = {}) {
  ajax_post(url, {
    data: JSON.stringify(data),
    contentType: "application/json;charset=UTF-8",
    ...args,
  });
}
function ajax_post(url, args) {
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    ...(args || {}),
  })
    .done(ajax_done)
    .fail((e) =>
      ajax_done(e.responseJSON || { error: "Unknown error: " + e.responseText })
    );
}
function ajax_post_btn(e, reload_on_done, reload_delay) {
  var form = $(e).closest("form");
  var url = form.attr("action");
  var form_data = form.serialize();
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function () {
      if (reload_on_done) location.reload();
    },
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
    },
    data: body,
    success: function (res) {
      common_done(res.data);
    },
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

function poll_mobile_build_finished(outDirName, pollCount, orginalBtnHtml) {
  $.ajax("/admin/build-mobile-app/finished", {
    type: "GET",
    data: { build_dir: outDirName },
    success: function (res) {
      if (!res.finished) {
        if (pollCount >= 100) {
          removeSpinner("buildMobileAppBtnId", orginalBtnHtml);
          notifyAlert({
            type: "danger",
            text: "Unable to get the build results",
          });
        } else {
          setTimeout(() => {
            poll_mobile_build_finished(outDirName, ++pollCount, orginalBtnHtml);
          }, 5000);
        }
      } else {
        href_to(
          `build-mobile-app/result?build_dir_name=${encodeURIComponent(
            outDirName
          )}`
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
  params.includedPlugins = Array.from(pluginsSelect.options)
    .filter((option) => !option.hidden)
    .map((option) => option.value);

  if (
    params.useDocker &&
    !cordovaBuilderAvailable &&
    !confirm(
      "Docker is selected but the Cordova builder seems not to be installed. " +
        "Do you really want to continue?"
    )
  ) {
    return;
  }
  ajax_post("/admin/build-mobile-app", {
    data: params,
    success: (data) => {
      if (data.build_dir_name) {
        handleMessages();
        const orginalBtnHtml = $("#buildMobileAppBtnId").html();
        press_store_button(button);
        poll_mobile_build_finished(data.build_dir_name, 0, orginalBtnHtml);
      }
    },
  });
}

function pull_cordova_builder() {
  ajax_post("/admin/mobile-app/pull-cordova-builder", {
    success: () => {
      notifyAlert(
        "Pulling the the cordova-builder. " +
          "To see the progress, open the logs viewer with the System logging verbosity set to 'All'."
      );
    },
  });
}

function check_cordova_builder() {
  $.ajax("/admin/mobile-app/check-cordova-builder", {
    type: "GET",
    success: function (res) {
      cordovaBuilderAvailable = !!res.installed;
      if (cordovaBuilderAvailable) {
        $("#dockerBuilderStatusId").html(
          `<span>
            installed<i class="ps-2 fas fa-check text-success"></i>
          </span>
          `
        );
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
    const jUnsOpt = $(`[id='${selected}_unsynched_opt']`);
    jUnsOpt.attr("hidden", "true");
    jUnsOpt.removeAttr("selected");
    const jSynOpt = $(`[id='${selected}_synched_opt']`);
    jSynOpt.removeAttr("hidden");
    jSynOpt.removeAttr("selected");
  }
}

function move_to_unsynched() {
  const opts = $("#synched-tbls-select-id");
  $("#unsynched-tbls-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    const jSynOpt = $(`[id='${selected}_synched_opt']`);
    jSynOpt.attr("hidden", "true");
    jSynOpt.removeAttr("selected");
    const jUnsOpt = $(`[id='${selected}_unsynched_opt']`);
    jUnsOpt.removeAttr("hidden");
    jUnsOpt.removeAttr("selected");
  }
}

function move_plugin_to_included() {
  const opts = $("#excluded-plugins-select-id");
  $("#included-plugins-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    const jExclOpt = $(`[id='${selected}_excluded_opt']`);
    jExclOpt.attr("hidden", "true");
    jExclOpt.removeAttr("selected");
    const jInclOpt = $(`[id='${selected}_included_opt']`);
    jInclOpt.removeAttr("hidden");
    jInclOpt.removeAttr("selected");
  }
}

function move_plugin_to_excluded() {
  const opts = $("#included-plugins-select-id");
  $("#excluded-plugins-select-id").removeAttr("selected");
  for (const selected of opts.val()) {
    const jInclOpt = $(`[id='${selected}_included_opt']`);
    jInclOpt.attr("hidden", "true");
    jInclOpt.removeAttr("selected");
    const jExclOpt = $(`[id='${selected}_excluded_opt']`);
    jExclOpt.removeAttr("hidden");
    jExclOpt.removeAttr("selected");
  }
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
    $("#dockerCheckboxId").attr("checked", cordovaBuilderAvailable);
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
            if (h || c) e.apply(a, b), c && (j = +new Date());
            i && g.apply(a, b);
          }, f);
        },
        k = function () {
          if (!d || a) {
            if (!d && !h && (!c || +new Date() - j > f))
              e.apply(this, arguments), c && (j = +new Date());
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
