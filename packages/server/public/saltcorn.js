//https://stackoverflow.com/a/698386
jQuery.fn.swapWith = function (to) {
  return this.each(function () {
    var copy_to = $(to).clone(true);
    var copy_from = $(this).clone(true);
    $(to).replaceWith(copy_from);
    $(this).replaceWith(copy_to);
  });
};

//avoids hiding in overflow:hidden
function init_bs5_dropdowns() {
  $("body").on(
    "show.bs.dropdown",
    "table [data-bs-toggle=dropdown]",
    function () {
      let target;
      if (!$("#page-inner-content").length) target = $("body");
      else target = $("#page-inner-content");
      let dropdown = bootstrap.Dropdown.getInstance(this);
      $(dropdown._menu).insertAfter(target);
    }
  );
}
function sortby(k, desc) {
  set_state_fields({ _sortby: k, _sortdesc: desc ? "on" : { unset: true } });
}
function gopage(n, pagesize, extra = {}) {
  set_state_fields({ ...extra, _page: n, _pagesize: pagesize });
}
function add_repeater(nm) {
  var es = $("div.form-repeat.repeat-" + nm);
  var e = es.first();
  var newix = es.length;
  var newe = $(e).clone();
  newe.find("[name]").each(function (ix, element) {
    var newnm = (element.name || "").replace("_0", "_" + newix);
    var newid = (element.id || "").replace("_0", "_" + newix);
    $(element).attr("name", newnm).attr("id", newid);
  });
  newe.appendTo($("div.repeats-" + nm));
}
// "e.closest('.form-namespace').find('.coltype').val()==='Field';"
function apply_showif() {
  $("[data-show-if]").each(function (ix, element) {
    var e = $(element);
    try {
      var to_show = new Function(
        "e",
        "return " + decodeURIComponent(e.attr("data-show-if"))
      );
      if (to_show(e))
        e.show()
          .find("input, textarea, button, select")
          .prop("disabled", e.attr("data-disabled") || false);
      else
        e.hide().find("input, textarea, button, select").prop("disabled", true);
    } catch (e) {
      console.error(e);
    }
  });
  $("[data-calc-options]").each(function (ix, element) {
    var e = $(element);
    var data = JSON.parse(decodeURIComponent(e.attr("data-calc-options")));

    var val = e
      .closest(".form-namespace")
      .find(`[data-fieldname=${data[0]}]`)
      .val();

    var options = data[1][val];
    var current = e.attr("data-selected");
    //console.log(val, options, current,data)
    e.empty();
    (options || []).forEach((o) => {
      if (!(o && o.label && o.value)) {
        if (`${current}` === `${o}`)
          e.append($("<option selected>" + o + "</option>"));
        else e.append($("<option>" + o + "</option>"));
      } else {
        e.append(
          $(
            `<option ${
              `${current}` === `${o.value}` ? "selected" : ""
            } value="${o.value}">${o.label}</option>`
          )
        );
      }
    });
    e.change(function (ec) {
      e.attr("data-selected", ec.target.value);
    });
  });
  $("[data-source-url]").each(function (ix, element) {
    const e = $(element);
    const rec = get_form_record(e);
    ajax_post_json(e.attr("data-source-url"), rec, {
      success: (data) => {
        e.html(data);
      },
      error: (err) => {
        console.error(err);
        e.html("");
      },
    });
  });
}
function get_form_record(e, select_labels) {
  const rec = {};
  e.closest("form")
    .find("input[name],select[name]")
    .each(function () {
      if (select_labels && $(this).prop("tagName").toLowerCase() === "select")
        rec[$(this).attr("name")] = $(this).find("option:selected").text();
      else if ($(this).prop("type") === "checkbox")
        rec[$(this).attr("name")] = $(this).prop("checked");
      else rec[$(this).attr("name")] = $(this).val();
    });
  return rec;
}
function showIfFormulaInputs(e, fml) {
  const rec = get_form_record(e);
  return new Function(`{${Object.keys(rec).join(",")}}`, "return " + fml)(rec);
}

function rep_del(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  parent.children().each(function (childix, element) {
    if (childix > ix) {
      reindex(element, childix, childix - 1);
    }
  });
  myrep.remove();
}

function reindex(element, oldix, newix) {
  $(element).html(
    $(element)
      .html()
      .split("_" + oldix)
      .join("_" + newix)
  );
}

function get_form_subset_record(e) {
  const rec = {};
  e.find("input[name],select[name]").each(function () {
    rec[$(this).attr("name")] = $(this).val();
  });
  return rec;
}

function apply_form_subset_record(e, vals) {
  e.find("input[name],select[name]").each(function () {
    var name = $(this).attr("name");
    if (vals[name]) $(this).val(vals[name]);
  });
}

function reindex_form_record(vals, oldix, newix) {
  const rec = {};
  Object.keys(vals).forEach((k) => {
    const newkey = k.split("_" + oldix).join("_" + newix);
    rec[newkey] = vals[k];
  });
  return rec;
}

function rep_up(e) {
  var myrep = $(e).closest(".form-repeat");
  var theform = $(e).closest("form");
  var ix = myrep.index();
  var parent = myrep.parent();
  if (ix > 0) {
    var swap_with = parent.children(".form-repeat").eq(ix - 1);
    var vals1 = reindex_form_record(get_form_subset_record(myrep), ix, ix - 1);
    var vals2 = reindex_form_record(
      get_form_subset_record(swap_with),
      ix - 1,
      ix
    );
    reindex(myrep, ix, ix - 1);
    reindex(swap_with, ix - 1, ix);
    $(myrep).swapWith(swap_with);
    apply_form_subset_record(theform, vals2);
    apply_form_subset_record(theform, vals1);
  }
}

function rep_down(e) {
  var myrep = $(e).closest(".form-repeat");
  var theform = $(e).closest("form");
  var ix = myrep.index();
  var parent = myrep.parent();
  var nchildren = parent.children(".form-repeat").length;
  if (ix < nchildren - 1) {
    var swap_with = parent.children(".form-repeat").eq(ix + 1);
    var vals1 = reindex_form_record(get_form_subset_record(myrep), ix, ix + 1);
    var vals2 = reindex_form_record(
      get_form_subset_record(swap_with),
      ix + 1,
      ix
    );
    reindex(myrep, ix, ix + 1);
    reindex(swap_with, ix + 1, ix);
    $(myrep).swapWith(swap_with);
    apply_form_subset_record(theform, vals2);
    apply_form_subset_record(theform, vals1);
  }
}

function reload_on_init() {
  localStorage.setItem("reload_on_init", true);
}
if (localStorage.getItem("reload_on_init")) {
  localStorage.removeItem("reload_on_init");
  location.reload();
}
function initialize_page() {
  $("form").change(apply_showif);
  apply_showif();
  apply_showif();
  $("[data-inline-edit-dest-url]").each(function () {
    if ($(this).find(".editicon").length === 0) {
      var current = $(this).html();
      $(this).html(
        `<span class="current">${current}</span><i class="editicon fas fa-edit ms-1"></i>`
      );
    }
  });
  $("[data-inline-edit-dest-url]").click(function () {
    var url = $(this).attr("data-inline-edit-dest-url");
    var current = $(this).children("span.current").html();
    $(this).replaceWith(
      `<form method="post" action="${url}" >
      <input type="hidden" name="_csrf" value="${_sc_globalCsrf}">
      <input type="text" name="value" value="${current}">
      <button type="submit" class="btn btn-sm btn-primary">OK</button>
      </form>`
    );
  });
  function setExplainer(that) {
    var id = $(that).attr("id") + "_explainer";

    var explainers = JSON.parse(
      decodeURIComponent($(that).attr("data-explainers"))
    );
    var currentVal = explainers[$(that).val()];
    $("#" + id).html(`<strong>${$(that).val()}</strong>: ${currentVal}`);
    if (currentVal) $("#" + id).show();
    else $("#" + id).hide();
  }
  $("[data-explainers]").each(function () {
    var id = $(this).attr("id") + "_explainer";
    if ($("#" + id).length === 0) {
      $(this).after(`<div class="alert alert-info my-2" id="${id}"></div>`);
      setExplainer(this);
    }
  });
  $("[data-explainers]").change(function () {
    setExplainer(this);
  });

  const codes = [];
  $("textarea.to-code").each(function () {
    codes.push(this);
  });
  if (codes.length > 0)
    enable_codemirror(() => {
      setTimeout(() => {
        codes.forEach((el) => {
          //console.log($(el).attr("mode"), el);
          CodeMirror.fromTextArea(el, {
            lineNumbers: true,
            mode: $(el).attr("mode"),
          });
        });
      }, 100);
    });
  const locale =
    navigator.userLanguage ||
    (navigator.languages &&
      navigator.languages.length &&
      navigator.languages[0]) ||
    navigator.language ||
    navigator.browserLanguage ||
    navigator.systemLanguage ||
    "en";
  window.detected_locale = locale;
  const parse = (s) => JSON.parse(decodeURIComponent(s));
  $("time[locale-time-options]").each(function () {
    var el = $(this);
    var date = new Date(el.attr("datetime"));
    const options = parse(el.attr("locale-time-options"));
    el.text(date.toLocaleTimeString(locale, options));
  });
  $("time[locale-options]").each(function () {
    var el = $(this);
    var date = new Date(el.attr("datetime"));
    const options = parse(el.attr("locale-options"));
    el.text(date.toLocaleString(locale, options));
  });
  $("time[locale-date-options]").each(function () {
    var el = $(this);
    var date = new Date(el.attr("datetime"));
    const options = parse(el.attr("locale-date-options"));
    el.text(date.toLocaleDateString(locale, options));
  });
  $('a[data-bs-toggle="tab"].deeplink').historyTabs();
  init_bs5_dropdowns();
}

$(initialize_page);

function enable_codemirror(f) {
  $("<link/>", {
    rel: "stylesheet",
    type: "text/css",
    href: `/static_assets/${_sc_version_tag}/codemirror.css`,
  }).appendTo("head");
  $.ajax({
    url: `/static_assets/${_sc_version_tag}/codemirror.min.js`,
    dataType: "script",
    cache: true,
    success: f,
  });
}

//https://stackoverflow.com/a/6021027
function updateQueryStringParameter(uri, key, value) {
  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (uri.match(re)) {
    return uri.replace(re, "$1" + key + "=" + encodeURIComponent(value) + "$2");
  } else {
    return uri + separator + key + "=" + encodeURIComponent(value);
  }
}

function removeQueryStringParameter(uri, key) {
  var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  var separator = uri.indexOf("?") !== -1 ? "&" : "?";
  if (uri.match(re)) {
    uri = uri.replace(re, "$1" + "$2");
  }
  if (uri[uri.length - 1] === "?" || uri[uri.length - 1] === "&")
    uri = uri.substring(0, uri.length - 1);
  return uri;
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
function tristateClick(nm) {
  var current = $(`button#trib${nm}`).html();
  switch (current) {
    case "?":
      $(`button#trib${nm}`).html("T");
      $(`input#input${nm}`).val("on");
      break;
    case "T":
      $(`button#trib${nm}`).html("F");
      $(`input#input${nm}`).val("off");
      break;
    default:
      $(`button#trib${nm}`).html("?");
      $(`input#input${nm}`).val("?");
      break;
  }
}

function notifyAlert(note, spin) {
  if (Array.isArray(note)) {
    note.forEach(notifyAlert);
    return;
  }
  var txt, type;
  if (typeof note == "string") {
    txt = note;
    type = "info";
  } else {
    txt = note.text;
    type = note.type;
  }

  $("#alerts-area")
    .append(`<div class="alert alert-${type} alert-dismissible fade show ${
    spin ? "d-flex align-items-center" : ""
  }" role="alert">
  ${txt}
  ${
    spin
      ? `<div class="spinner-border ms-auto" role="status" aria-hidden="true"></div>`
      : `<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">
  </button>`
  }
</div>`);
}

function ajax_done(res) {
  if (res.notify) notifyAlert(res.notify);
  if (res.error) notifyAlert({ type: "danger", text: res.error });
  if (res.eval_js) eval(res.eval_js);
  if (res.reload_page) location.reload(); //TODO notify to cookie if reload or goto
  if (res.download) {
    const dataurl = `data:${
      res.download.mimetype || "application/octet-stream"
    };base64,${res.download.blob}`;
    fetch(dataurl)
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        if (res.download.filename) link.download = res.download.filename;
        else link.target = "_blank";
        link.click();
      });
  }
  if (res.goto) {
    if (res.target === "_blank") window.open(res.goto, "_blank").focus();
    else window.location.href = res.goto;
  }
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

function press_store_button(clicked) {
  const width = $(clicked).width();
  $(clicked).html('<i class="fas fa-spinner fa-spin"></i>').width(width);
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

function ajaxSubmitForm(e) {
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
          const gen_char = (i) => {
            switch (char_type) {
              case "Lowercase Letters":
                return String.fromCharCode("a".charCodeAt(0) + i);
                break;
              case "Uppercase Letters":
                return String.fromCharCode("A".charCodeAt(0) + i);
                break;
              default:
                return i;
                break;
            }
          };
          const vals = res.success
            .map((o) => o[field_name])
            .filter((s) => s.startsWith(value));
          if (vals.includes(value) || always_append) {
            for (let i = start || 0; i < vals.length + (start || 0) + 2; i++) {
              const newname = `${value}${space ? " " : ""}${gen_char(i)}`;
              if (!vals.includes(newname)) {
                $("#" + id).val(newname);
                return;
              }
            }
          }
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
function align_dropdown(id) {
  setTimeout(() => {
    if ($("#dm" + id).hasClass("show")) {
      var inputWidth = $("#search-input-group-" + id).outerWidth();
      $("#dm" + id).css("width", inputWidth);
      var d0pos = $("#search-input-group-" + id).offset();
      $("#dm" + id).offset({ left: d0pos.left });
      $(document).on("click", "#dm" + id, function (e) {
        e.stopPropagation();
      });
    }
  }, 0);
}

function remove_outline(form) {
  $(form)
    .find("button[type=submit]")
    .removeClass("btn-outline-primary")
    .addClass("btn-primary");
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

const columnSummary = (col) => {
  if (!col) return "Unknown";
  switch (col.type) {
    case "Field":
      return `Field ${col.field_name} ${col.fieldview}`;
    case "Link":
      return `Link ${col.link_text}`;
    case "JoinField":
      return `Join ${col.join_field}`;
    case "ViewLink":
      return `View ${col.view_label || col.view.split(":")[1] || ""}`;
    case "Action":
      return `Action ${col.action_label || col.action_name}`;
    case "Aggregation":
      return `${col.stat} ${col.agg_field} ${col.agg_relation}`;
    default:
      return "Unknown";
  }
};

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
