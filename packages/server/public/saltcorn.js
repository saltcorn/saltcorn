//https://stackoverflow.com/a/698386
jQuery.fn.swapWith = function (to) {
  return this.each(function () {
    var copy_to = $(to).clone(true);
    var copy_from = $(this).clone(true);
    $(to).replaceWith(copy_from);
    $(this).replaceWith(copy_to);
  });
};

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
    var to_show = new Function("e", "return " + e.attr("data-show-if"));
    if (to_show(e))
      e.show().find("input, textarea, button, select").prop("disabled", false);
    else
      e.hide().find("input, textarea, button, select").prop("disabled", true);
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
      if (current === o) e.append($("<option selected>" + o + "</option>"));
      else e.append($("<option>" + o + "</option>"));
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
function get_form_record(e) {
  const rec = {};
  e.closest("form")
    .find("input[name],select[name]")
    .each(function () {
      rec[$(this).attr("name")] = $(this).val();
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

function rep_up(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  if (ix > 0) {
    var swap_with = parent.children(".form-repeat").eq(ix - 1);
    reindex(myrep, ix, ix - 1);
    reindex(swap_with, ix - 1, ix);
    $(myrep).swapWith(swap_with);
  }
}

function rep_down(e) {
  var myrep = $(e).closest(".form-repeat");
  var ix = myrep.index();
  var parent = myrep.parent();
  var nchildren = parent.children(".form-repeat").length;
  if (ix < nchildren - 1) {
    var swap_with = parent.children(".form-repeat").eq(ix + 1);
    reindex(myrep, ix, ix + 1);
    reindex(swap_with, ix + 1, ix);
    $(myrep).swapWith(swap_with);
  }
}
function initialize_page() {
  $("form").change(apply_showif);
  apply_showif();
  apply_showif();
  $("[data-inline-edit-dest-url]").each(function () {
    if ($(this).find(".editicon").length === 0) {
      var current = $(this).html();
      $(this).html(
        `<span class="current">${current}</span><i class="editicon fas fa-edit ml-1"></i>`
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
      codes.forEach((el) => {
        console.log($(el).attr("mode"), el);
        CodeMirror.fromTextArea(el, {
          lineNumbers: true,
          mode: $(el).attr("mode"),
        });
      });
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
function set_state_fields(kvs) {
  var newhref = window.location.href;
  Object.entries(kvs).forEach((kv) => {
    if (kv[1].unset && kv[1].unset === true)
      newhref = removeQueryStringParameter(newhref, kv[0]);
    else newhref = updateQueryStringParameter(newhref, kv[0], kv[1]);
  });
  pjax_to(newhref);
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

function notifyAlert(note) {
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
    .append(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
  ${txt}
  <button type="button" class="close" data-dismiss="alert" aria-label="Close">
    <span aria-hidden="true">&times;</span>
  </button>
</div>`);
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
    if (res.notify) notifyAlert(res.notify);
    if (res.error) notifyAlert({ type: "danger", text: res.error });
    if (res.reload_page) location.reload(); //TODO notify to cookie if reload or goto
    if (res.goto) window.location.href = res.goto;
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
  $(clicked).html('<i class="fas fa-spinner fa-spin"></i>');
}

function ajax_modal(url, opts = {}) {
  if ($("#scmodal").length === 0) {
    $("body").append(`<div id="scmodal", class="modal" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Modal title</h5>
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
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
      $("#scmodal").modal();
      (opts.onOpen || function () {})(res);
      $("#scmodal").on("hidden.bs.modal", function (e) {
        (opts.onClose || function () {})(res);
      });
    },
  });
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
  });
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
      var inputWidth = $(".input-group.search-bar").outerWidth();
      $(".dropdown-menu.search-bar").css("width", inputWidth);
      var d0pos = $(".input-group.search-bar").offset();
      $("#dm" + id).offset({ left: d0pos.left });
      $(document).on("click", ".dropdown-menu.search-bar", function (e) {
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

function init_room() {
  const input = document.querySelector("form.room input");

  $("form.room").submit((e) => {
    e.preventDefault();

    if (input.value) {
      console.log(value);
    }
  });
}
