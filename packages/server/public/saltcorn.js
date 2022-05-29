function sortby(k, desc) {
  set_state_fields({ _sortby: k, _sortdesc: desc ? "on" : { unset: true } });
}
function gopage(n, pagesize, extra = {}) {
  set_state_fields({ ...extra, _page: n, _pagesize: pagesize });
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

function select_id(id) {
  pjax_to(updateQueryStringParameter(window.location.href, "id", id));
}

function set_state_field(key, value) {
  pjax_to(updateQueryStringParameter(window.location.href, key, value));
}

function check_state_field(that) {
  const checked = that.checked;
  const name = that.name;
  const value = that.value;
  var separator = window.location.href.indexOf("?") !== -1 ? "&" : "?";
  let dest;
  if (checked) dest = window.location.href + `${separator}${name}=${value}`;
  else dest = window.location.href.replace(`${name}=${value}`, "");
  pjax_to(dest.replace("&&", "&").replace("?&", "?"));
}

function set_state_fields(kvs) {
  var newhref = window.location.href;
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true)
      newhref = removeQueryStringParameter(newhref, kv[0]);
    else newhref = updateQueryStringParameter(newhref, kv[0], kv[1]);
  });
  pjax_to(newhref.replace("&&", "&").replace("?&", "?"));
}
function unset_state_field(key) {
  pjax_to(removeQueryStringParameter(window.location.href, key));
}

let loadPage = true;
$(function () {
  $(window).bind("popstate", function (event) {
    const ensure_no_final_hash = (s) => (s.endsWith("#") ? s.slice(0, -1) : s);
    if (loadPage)
      window.location.assign(ensure_no_final_hash(window.location.href));
  });
});

function pjax_to(href) {
  if (!$("#page-inner-content").length) window.location.href = href;
  else {
    loadPage = false;
    $.ajax(href, {
      headers: {
        pjaxpageload: "true",
      },
      success: function (res, textStatus, request) {
        window.history.pushState({ url: href }, "", href);
        setTimeout(() => {
          loadPage = true;
        }, 0);
        if (res.includes("<!--SCPT:")) {
          const start = res.indexOf("<!--SCPT:");
          const end = res.indexOf("-->", start);
          document.title = res.substring(start + 9, end);
        }
        $("#page-inner-content").html(res);
        initialize_page();
      },
    });
  }
}

function href_to(href) {
  window.location.href = href;
}
function clear_state() {
  pjax_to(window.location.href.split("?")[0]);
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
  }).done(function (res) {
    if (onDone) onDone(res);
    ajax_done(res);
  });
}
var logged_errors = [];
function globalErrorCatcher(message, source, lineno, colno, error) {
  if (error && error.preventDefault) error.preventDefault();
  if (logged_errors.includes(message)) return;
  logged_errors.push(message);
  var data = { message, stack: (error && error.stack) || "" };
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

function ajax_modal(url, opts = {}) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal", class="modal">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
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
    var myModalEl = document.getElementById("scmodal");
    var modal = bootstrap.Modal.getInstance(myModalEl);
    modal.dispose();
  }
  if (opts.submitReload === false) $("#scmodal").addClass("no-submit-reload");
  else $("#scmodal").removeClass("no-submit-reload");
  $.ajax(url, {
    success: function (res, textStatus, request) {
      var title = request.getResponseHeader("Page-Title");
      if (title) $("#scmodal .modal-title").html(decodeURIComponent(title));
      $("#scmodal .modal-body").html(res);
      new bootstrap.Modal($("#scmodal")).show();
      initialize_page();
      (opts.onOpen || function () {})(res);
      $("#scmodal").on("hidden.bs.modal", function (e) {
        (opts.onClose || function () {})(res);
      });
    },
  });
}

function saveAndContinue(e, k) {
  var form = $(e).closest("form");
  submitWithEmptyAction(form[0]);
  var url = form.attr("action");
  var form_data = form.serialize();
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function (res) {
      if (res.id && form.find("input[name=id")) {
        form.append(
          `<input type="hidden" class="form-control  " name="id" value="${res.id}">`
        );
      }
    },
    error: function (request) {
      $("#page-inner-content").html(request.responseText);
      initialize_page();
    },
    complete: function () {
      if (k) k();
    },
  });

  return false;
}

function applyViewConfig(e, url) {
  var form = $(e).closest("form");
  var form_data = form.serializeArray();
  const cfg = {};
  form_data.forEach((item) => {
    cfg[item.name] = item.value;
  });
  $.ajax(url, {
    type: "POST",
    dataType: "json",
    contentType: "application/json",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: JSON.stringify(cfg),
    error: function (request) {},
  });

  return false;
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
    success: function () {
      var no_reload = $("#scmodal").hasClass("no-submit-reload");
      $("#scmodal").modal("hide");
      if (!no_reload) location.reload();
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
  }).done(ajax_done);
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

function init_room(viewname, room_id) {
  const socket = io({ transports: ["websocket"] });
  socket.emit("join_room", [viewname, room_id]);
  socket.on("message", (msg) => {
    if (msg.not_for_user_id) {
      const my_user_id = $(`.msglist-${room_id}`).attr("data-user-id");
      if (+my_user_id === +msg.not_for_user_id) return;
    }
    if (msg.append) $(`.msglist-${room_id}`).append(msg.append);
    if (msg.pls_ack_msg_id)
      view_post(viewname, "ack_read", { room_id, id: msg.pls_ack_msg_id });
  });

  $(`form.room-${room_id}`).submit((e) => {
    e.preventDefault();
    var form_data = $(`form.room-${room_id}`).serialize();
    view_post(viewname, "submit_msg_ajax", form_data, (vpres) => {
      if (vpres.append) $(`.msglist-${room_id}`).append(vpres.append);
      $(`form.room-${room_id}`).trigger("reset");
    });
  });
}
function room_older(viewname, room_id, btn) {
  view_post(
    viewname,
    "fetch_older_msg",
    { room_id, lt_msg_id: +$(btn).attr("data-lt-msg-id") },
    (res) => {
      if (res.prepend) $(`.msglist-${room_id}`).prepend(res.prepend);
      if (res.new_fetch_older_lt)
        $(btn).attr("data-lt-msg-id", res.new_fetch_older_lt);
      if (res.remove_fetch_older) $(btn).remove();
    }
  );
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
  const val = new Function(
    `{${Object.keys(rec).join(",")}}`,
    "return " + formula
  )(rec);
  $(btn).closest(".input-group").find("input").val(val);
  if (k) k();
}


/*
https://github.com/jeffdavidgreen/bootstrap-html5-history-tabs/blob/master/bootstrap-history-tabs.js
Copyright (c) 2015 Jeff Green
*/

+(function ($) {
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

        if (window.location.hash && stateObject.url !== window.location.hash) {
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
