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
    //console.log({ val, options, current, data });
    e.empty();
    (options || []).forEach((o) => {
      if (
        !(o && typeof o.label !== "undefined" && typeof o.value !== "undefined")
      ) {
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
function initialize_page() {
  //console.log("init page");
  $(".blur-on-enter-keypress").bind("keyup", function (e) {
    if (e.keyCode === 13) e.target.blur();
  });
  $(".validate-expression").bind("input", function (e) {
    const target = $(e.target);
    const next = target.next();
    console.log(target[0]);
    if (next.hasClass("expr-error")) next.remove();
    const val = target.val();
    if (target.hasClass("validate-expression-conditional")) {
      const box = target
        .closest(".form-namespace")
        .find(`[name="${target.attr("name")}_formula"]`);
      if (!box.prop("checked")) return;
    }
    if (!val) return;
    try {
      Function("return " + val);
    } catch (error) {
      target.after(`<small class="text-danger font-monospace d-block expr-error">
      ${error.message}
    </small>`);
    }
  });

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
  if ($.fn.historyTabs) $('a[data-bs-toggle="tab"].deeplink').historyTabs();
  init_bs5_dropdowns();

  // Initialize Sliders - https://stackoverflow.com/a/31083391
  var sliderSections = document.getElementsByClassName("range-slider");
  for (var x = 0; x < sliderSections.length; x++) {
    var sliders = sliderSections[x].getElementsByTagName("input");
    for (var y = 0; y < sliders.length; y++) {
      if (sliders[y].type === "range") {
        sliders[y].oninput = function () {
          // Get slider values
          var parent = this.parentNode;
          var slides = parent.getElementsByTagName("input");
          var slide1 = parseFloat(slides[0].value);
          var slide2 = parseFloat(slides[1].value);
          // Neither slider will clip the other, so make sure we determine which is larger
          if (slide1 > slide2) {
            var tmp = slide2;
            slide2 = slide1;
            slide1 = tmp;
          }

          var displayElement = parent.getElementsByClassName("rangeValues")[0];
          displayElement.innerHTML = slide1 + " - " + slide2;
        };
        // Manually trigger event first time to display values
        sliders[y].oninput();
      }
    }
  }
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

function press_store_button(clicked) {
  const width = $(clicked).width();
  $(clicked).html('<i class="fas fa-spinner fa-spin"></i>').width(width);
}

function common_done(res, isWeb = true) {
  if (res.notify) notifyAlert(res.notify);
  if (res.error) notifyAlert({ type: "danger", text: res.error });
  if (res.eval_js) eval(res.eval_js);
  if (res.reload_page) {
    (isWeb ? location : parent.location).reload(); //TODO notify to cookie if reload or goto
  }
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
  if (res.goto && !isWeb)
    // TODO ch
    notifyAlert({
      type: "danger",
      text: "Goto is not supported in a mobile deployment.",
    });
  else if (res.goto) {
    if (res.target === "_blank") window.open(res.goto, "_blank").focus();
    else window.location.href = res.goto;
  }
}

const repeaterCopyValuesToForm = (form, editor) => {
  const vs = JSON.parse(editor.getString());
  const allNames = new Set([]);
  const setVal = (k, ix, v) => {
    const $e = form.find(`input[name="${k}_${ix}"]`);
    if ($e.length) $e.val(v);
    else
      form.append(
        `<input type="hidden" name="${k}_${ix}" value="${v}"></input>`
      );
  };
  vs.forEach((v, ix) => {
    Object.entries(v).forEach(([k, v]) => {
      //console.log(ix, k, typeof v, v)
      allNames.add(k);
      if (typeof v === "boolean") setVal(k, ix, v ? "on" : "");
      else setVal(k, ix, v);
    });
  });
  //delete
  [...allNames].forEach((k) => {
    for (let ix = vs.length; ix < vs.length + 20; ix++) {
      $(`input[name="${k}_${ix}"]`).remove();
    }
  });
};
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

const columnSummary = (col) => {
  if (!col) return "Unknown";
  switch (col.type) {
    case "Field":
      return `Field ${col.field_name} ${col.fieldview || ""}`;
    case "Link":
      return `Link ${col.link_text}`;
    case "JoinField":
      return `Join ${col.join_field}`;
    case "ViewLink":
      return `View link ${col.view_label || col.view.split(":")[1] || ""}`;
    case "Action":
      return `Action ${col.action_label || col.action_name}`;
    case "Aggregation":
      return `${col.stat} ${col.agg_field} ${col.agg_relation}`;
    default:
      return "Unknown";
  }
};

function submitWithEmptyAction(form) {
  var formAction = form.action;
  form.action = "javascript:void(0)";
  form.submit();
  form.action = formAction;
}

function unique_field_from_rows(
  rows,
  id,
  field_name,
  space,
  start,
  always_append,
  char_type,
  value
) {
  const gen_char = (i) => {
    switch (char_type) {
      case "Lowercase Letters":
        return String.fromCharCode("a".charCodeAt(0) + i);
      case "Uppercase Letters":
        return String.fromCharCode("A".charCodeAt(0) + i);
      default:
        return i;
    }
  };
  const vals = rows
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
