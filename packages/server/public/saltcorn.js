function sortby(k, desc, viewIdentifier) {
  set_state_fields({
    [viewIdentifier ? `_${viewIdentifier}_sortby` : "_sortby"]: k,
    [viewIdentifier ? `_${viewIdentifier}_sortdesc` : "_sortdesc"]: desc
      ? "on"
      : { unset: true },
  });
}
function gopage(n, pagesize, viewIdentifier, extra = {}) {
  const cfg = {
    ...extra,
    [viewIdentifier ? `_${viewIdentifier}_page` : "_page"]: n,
    [viewIdentifier ? `_${viewIdentifier}_pagesize` : "_pagesize"]: pagesize,
  };
  set_state_fields(cfg);
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
    return (
      uri.replace(re, "$1" + key + "=" + encodeURIComponent(value) + "$2") +
      hash
    );
  } else {
    return uri + separator + key + "=" + encodeURIComponent(value) + hash;
  }
}

function removeQueryStringParameter(uri1, key) {
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
    uri = uri.replace(re, "$1" + "$2");
  }
  if (uri[uri.length - 1] === "?" || uri[uri.length - 1] === "&")
    uri = uri.substring(0, uri.length - 1);
  return uri + hash;
}

function get_current_state_url() {
  let $modal = $("#scmodal");
  if ($modal.length === 0 || !$modal.hasClass("show"))
    return window.location.href;
  else return $modal.prop("data-modal-state");
}

function select_id(id) {
  pjax_to(updateQueryStringParameter(get_current_state_url(), "id", id));
}

function set_state_field(key, value) {
  pjax_to(updateQueryStringParameter(get_current_state_url(), key, value));
}

function check_state_field(that) {
  const checked = that.checked;
  const name = that.name;
  const value = that.value;
  var separator = window.location.href.indexOf("?") !== -1 ? "&" : "?";
  let dest;
  if (checked) dest = get_current_state_url() + `${separator}${name}=${value}`;
  else dest = get_current_state_url().replace(`${name}=${value}`, "");
  pjax_to(dest.replace("&&", "&").replace("?&", "?"));
}

function invalidate_pagings(href) {
  let newhref = href;
  const queryObj = Object.fromEntries(new URL(newhref).searchParams.entries());
  const toRemove = Object.keys(queryObj).filter((val) => is_paging_param(val));
  for (const k of toRemove) {
    newhref = removeQueryStringParameter(newhref, k);
  }
  return newhref;
}

function set_state_fields(kvs, disable_pjax) {
  let newhref = get_current_state_url();
  if (Object.keys(kvs).some((k) => !is_paging_param(k))) {
    newhref = invalidate_pagings(newhref);
  }
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true)
      newhref = removeQueryStringParameter(newhref, kv[0]);
    else newhref = updateQueryStringParameter(newhref, kv[0], kv[1]);
  });
  if (disable_pjax) href_to(newhref.replace("&&", "&").replace("?&", "?"));
  else pjax_to(newhref.replace("&&", "&").replace("?&", "?"));
}
function unset_state_field(key) {
  pjax_to(removeQueryStringParameter(get_current_state_url(), key));
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

function pjax_to(href) {
  let $modal = $("#scmodal");
  const inModal = $modal.length && $modal.hasClass("show");
  let $dest = inModal ? $("#scmodal .modal-body") : $("#page-inner-content");

  if (!$dest.length) window.location.href = href;
  else {
    loadPage = false;
    $.ajax(href, {
      headers: {
        pjaxpageload: "true",
      },
      success: function (res, textStatus, request) {
        if (!inModal) window.history.pushState({ url: href }, "", href);
        setTimeout(() => {
          loadPage = true;
        }, 0);
        if (!inModal && res.includes("<!--SCPT:")) {
          const start = res.indexOf("<!--SCPT:");
          const end = res.indexOf("-->", start);
          document.title = res.substring(start + 9, end);
        }
        $dest.html(res);
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
function clear_state(omit_fields_str) {
  let newUrl = get_current_state_url().split("?")[0];
  const hash = get_current_state_url().split("#")[1];
  if (omit_fields_str) {
    const omit_fields = omit_fields_str.split(",").map((s) => s.trim());
    let qs = (get_current_state_url().split("?")[1] || "").split("#")[0];
    let params = new URLSearchParams(qs);
    newUrl = newUrl + "?";
    omit_fields.forEach((f) => {
      if (params.get(f))
        newUrl = updateQueryStringParameter(newUrl, f, params.get(f));
    });
  }
  if (hash) newUrl += "#" + hash;

  pjax_to(newUrl);
}

function ajax_done(res) {
  common_done(res);
}

function view_post(viewname, route, data, onDone) {
  $.ajax("/view/" + viewname + "/" + route, {
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
      ajax_done(res);
    })
    .fail(function (res) {
      notifyAlert({ type: "danger", text: res.responseText });
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
  var myModalEl = document.getElementById("scmodal");
  if (!myModalEl) return;
  var modal = bootstrap.Modal.getInstance(myModalEl);
  if (modal) modal.dispose();
}

function ensure_modal_exists_and_closed() {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal", class="modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <span class="sc-ajax-indicator-wrapper">
            <span class="sc-ajax-indicator ms-2" style="display: none;"><i class="fas fa-save"></i></span>
          </span>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">            
          </button>
        </div>
        <div class="modal-body">
          <p>Modal body text goes here.</p>
        </div>
      </div>
    </div>
  </div>`);
  } else if ($("#scmodal").hasClass("show")) {
    close_saltcorn_modal();
  }
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
  if (opts.submitReload === false) $("#scmodal").addClass("no-submit-reload");
  else $("#scmodal").removeClass("no-submit-reload");
  $.ajax(url, {
    headers: {
      SaltcornModalRequest: "true",
    },
    success: function (res, textStatus, request) {
      var title = request.getResponseHeader("Page-Title");
      var width = request.getResponseHeader("SaltcornModalWidth");
      var saveIndicate = !!request.getResponseHeader(
        "SaltcornModalSaveIndicator"
      );
      if (saveIndicate) $(".sc-ajax-indicator-wrapper").show();
      else $(".sc-ajax-indicator-wrapper").hide();
      if (width) $(".modal-dialog").css("max-width", width);
      else $(".modal-dialog").css("max-width", "");
      if (title) $("#scmodal .modal-title").html(decodeURIComponent(title));
      $("#scmodal .modal-body").html(res);
      $("#scmodal").prop("data-modal-state", url);
      new bootstrap.Modal($("#scmodal")).show();
      initialize_page();
      (opts.onOpen || function () {})(res);
      $("#scmodal").on("hidden.bs.modal", function (e) {
        (opts.onClose || function () {})(res);
        $("body").css("overflow", "");
      });
    },
  });
}

function saveAndContinue(e, k) {
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
      if (res.id && form.find("input[name=id")) {
        form.append(
          `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
        );
      }
    },
    error: function (request) {
      $("#page-inner-content").html(request.responseText);
      ajax_indicate_error(e, request);
      initialize_page();
    },
    complete: function () {
      if (k) k();
    },
  });

  return false;
}

function applyViewConfig(e, url, k) {
  var form = $(e).closest("form");
  var form_data = form.serializeArray();
  const cfg = {};
  form_data.forEach((item) => {
    cfg[item.name] = item.value;
  });
  ajax_indicator(true, e);
  $.ajax(url, {
    type: "POST",
    dataType: "json",
    contentType: "application/json",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: JSON.stringify(cfg),
    error: function (request) {
      ajax_indicate_error(e, request);
    },
    success: function (res) {
      ajax_indicator(false);
      k && k(res);
      !k && updateViewPreview();
    },
    complete: () => {},
  });

  return false;
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

      error: function (request) {},
      success: function (res) {
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
      $("#scmodal").modal("hide");
      if (!no_reload) location.reload();
      else common_done(res);
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
  var formula = $("input[name=expression]").val();
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
        if (pollCount >= 50) {
          removeSpinner("buildMobileAppBtnId", orginalBtnHtml);
          notifyAlert({
            type: "danger",
            text: "unable to get the build results",
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

function join_field_clicked(e, fieldPath) {
  $("#inputjoin_field").val(fieldPath);
  apply_showif();
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
