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
    if ($(element).hasClass("omit-repeater-clone")) $(element).remove();
    var newnm = (element.name || "").replace("_0", "_" + newix);
    var newid = (element.id || "").replace("_0", "_" + newix);
    $(element).attr("name", newnm).attr("id", newid);
  });
  newe.appendTo($("div.repeats-" + nm));
}

const _apply_showif_plugins = [];

const add_apply_showif_plugin = (p) => {
  _apply_showif_plugins.push(p);
};
function apply_showif() {
  $("[data-show-if]").each(function (ix, element) {
    var e = $(element);
    try {
      let to_show = e.data("data-show-if-fun");
      if (!to_show) {
        to_show = new Function(
          "e",
          "return " + decodeURIComponent(e.attr("data-show-if"))
        );
        e.data("data-show-if-fun", to_show);
      }
      if (!e.data("data-closest-form-ns"))
        e.data("data-closest-form-ns", e.closest(".form-namespace"));
      if (to_show(e))
        e.show()
          .find("input, textarea, button, select")
          .prop("disabled", e.attr("data-disabled") || false);
      else
        e.hide()
          .find(
            "input:enabled, textarea:enabled, button:enabled, select:enabled"
          )
          .prop("disabled", true);
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
    var current = e.attr("data-selected") || e.val();
    //console.log({ field: e.attr("name"), target: data[0], val, current });
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
  $("[data-fetch-options]").each(function (ix, element) {
    const e = $(element);
    const rec = get_form_record(e);
    const dynwhere = JSON.parse(
      decodeURIComponent(e.attr("data-fetch-options"))
    );
    //console.log(dynwhere);
    const qs = Object.entries(dynwhere.whereParsed)
      .map(([k, v]) => `${k}=${v[0] === "$" ? rec[v.substring(1)] : v}`)
      .join("&");
    var current = e.attr("data-selected");
    e.change(function (ec) {
      e.attr("data-selected", ec.target.value);
    });

    const currentOptionsSet = e.prop("data-fetch-options-current-set");
    if (currentOptionsSet === qs) return;

    const activate = (success, qs) => {
      e.empty();
      e.prop("data-fetch-options-current-set", qs);
      if (!dynwhere.required) e.append($(`<option></option>`));
      let currentDataOption = undefined;
      const dataOptions = [];
      success.forEach((r) => {
        const label = dynwhere.label_formula
          ? new Function(
              `{${Object.keys(r).join(",")}}`,
              "return " + dynwhere.label_formula
            )(r)
          : r[dynwhere.summary_field];
        const value = r[dynwhere.refname];
        const selected = `${current}` === `${r[dynwhere.refname]}`;
        dataOptions.push({ text: label, value });
        if (selected) currentDataOption = value;
        const html = `<option ${
          selected ? "selected" : ""
        } value="${value}">${label}</option>`;
        e.append($(html));
      });
      //TODO: also sort inserted HTML options
      dataOptions.sort((a, b) =>
        (a.text?.toLowerCase?.() || a.text) >
        (b.text?.toLowerCase?.() || b.text)
          ? 1
          : -1
      );
      element.dispatchEvent(new Event("RefreshSelectOptions"));
      if (e.hasClass("selectized") && $().selectize) {
        e.selectize()[0].selectize.clearOptions(true);
        e.selectize()[0].selectize.addOption(dataOptions);
        if (typeof currentDataOption !== "undefined")
          e.selectize()[0].selectize.setValue(currentDataOption);
      }
    };

    const cache = e.prop("data-fetch-options-cache") || {};
    if (cache[qs] === "fetching") {
      // do nothing, this will be activated by someone else
    } else if (cache[qs]) {
      activate(cache[qs], qs);
    } else {
      e.prop("data-fetch-options-cache", {
        ...cache,
        [qs]: "fetching",
      });
      $.ajax(`/api/${dynwhere.table}?${qs}`).then((resp) => {
        if (resp.success) {
          activate(resp.success, qs);
          const cacheNow = e.prop("data-fetch-options-cache") || {};
          e.prop("data-fetch-options-cache", {
            ...cacheNow,
            [qs]: resp.success,
          });
        } else {
          const cacheNow = e.prop("data-fetch-options-cache") || {};
          e.prop("data-fetch-options-cache", {
            ...cacheNow,
            [qs]: undefined,
          });
        }
      });
    }
  });
  $("[data-filter-table]").each(function (ix, element) {
    const e = $(element);
    const target = $(e.attr("data-filter-table"));
    $(e).on("keyup", function () {
      const value = $(this).val().toLowerCase();
      target.find("tr").filter(function () {
        $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
      });
    });
  });
  $("[data-source-url]").each(function (ix, element) {
    const e = $(element);
    const rec0 = get_form_record(e);

    const relevantFieldsStr = e.attr("data-relevant-fields");
    let rec;
    if (relevantFieldsStr) {
      rec = {};
      relevantFieldsStr.split(",").forEach((k) => {
        rec[k] = rec0[k];
      });
    } else rec = rec0;
    const recS = JSON.stringify(rec);

    const shown = e.prop("data-source-url-current");
    if (shown === recS) return;

    const cache = e.prop("data-source-url-cache") || {};

    const activate_onchange_coldef = () => {
      e.closest(".form-namespace")
        .find("input,select, textarea")
        .on("change", (ec) => {
          const $ec = $(ec.target);
          const k = $ec.attr("name");
          if (!k || k === "_columndef") return;
          const v = ec.target.value;
          const $def = e
            .closest(".form-namespace")
            .find("input[name=_columndef]");
          try {
            const def = JSON.parse($def.val());
            def[k] = v;
            $def.val(JSON.stringify(def));
          } catch (e) {
            console.error("Invalid json", e);
          }
        });
    };

    if (typeof cache[recS] !== "undefined") {
      e.html(cache[recS]);
      activate_onchange_coldef();
      return;
    }
    ajax_post_json(e.attr("data-source-url"), rec, {
      success: (data) => {
        e.html(data);
        const cacheNow = e.prop("data-source-url-cache") || {};
        e.prop("data-source-url-cache", {
          ...cacheNow,
          [recS]: data,
        });
        e.prop("data-source-url-current", recS);
        activate_onchange_coldef();
      },
      error: (err) => {
        console.error(err);
        const cacheNow = e.prop("data-source-url-cache") || {};
        e.prop("data-source-url-cache", {
          ...cacheNow,
          [recS]: "",
        });
        e.html("");
      },
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
  $("time[locale-date-format]").each(function () {
    var el = $(this);
    var date = el.attr("datetime");
    const format = parse(el.attr("locale-date-format"));
    el.text(dayjs(date).format(format));
  });

  _apply_showif_plugins.forEach((p) => p());
}

function splitTargetMatch(elemValue, target, keySpec) {
  if (!elemValue) return false;
  const [fld, keySpec1] = keySpec.split("|_");
  const [sep, pos] = keySpec1.split("_");
  const elemValueShort = elemValue.split(sep)[pos];
  return elemValueShort === target;
}

function get_form_record(e, select_labels) {
  const rec = {};
  e.closest(".form-namespace")
    .find("input[name],select[name]")
    .each(function () {
      const name = $(this).attr("data-fieldname") || $(this).attr("name");
      if (select_labels && $(this).prop("tagName").toLowerCase() === "select")
        rec[name] = $(this).find("option:selected").text();
      else if ($(this).prop("type") === "checkbox")
        rec[name] = $(this).prop("checked");
      else rec[name] = $(this).val();
    });
  return rec;
}
function showIfFormulaInputs(e, fml) {
  const rec = get_form_record(e);
  try {
    return new Function(`{${Object.keys(rec).join(",")}}`, "return " + fml)(
      rec
    );
  } catch (e) {
    throw new Error(`Error in evaluating showIf formula ${fml}: ${e.message}`);
  }
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
//https://stackoverflow.com/a/4835406
function escapeHtml(text) {
  var map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

function reload_on_init() {
  localStorage.setItem("reload_on_init", true);
}
function initialize_page() {
  const isNode = typeof parent?.saltcorn?.data?.state === "undefined";
  //console.log("init page");
  $(".blur-on-enter-keypress").bind("keyup", function (e) {
    if (e.keyCode === 13) e.target.blur();
  });

  const validate_expression_elem = (target) => {
    const next = target.next();
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
  };
  $(".validate-expression").bind("input", function (e) {
    const target = $(e.target);
    validate_expression_elem(target);
  });
  $(".validate-expression-conditional").each(function () {
    const theInput = $(this);
    theInput
      .closest(".form-namespace")
      .find(`[name="${theInput.attr("name")}_formula"]`)
      .bind("change", function (e) {
        validate_expression_elem(theInput);
      });
  });

  $("form").change(apply_showif);
  apply_showif();
  apply_showif();
  $("[data-inline-edit-dest-url]").each(function () {
    if ($(this).find(".editicon").length === 0) {
      var current = $(this).html();
      $(this).html(
        `<span class="current">${current}</span><i class="editicon ${
          !isNode ? "visible" : ""
        } fas fa-edit ms-1"></i>`
      );
    }
  });
  $("[data-inline-edit-dest-url]").click(function () {
    var url = $(this).attr("data-inline-edit-dest-url");
    var current =
      $(this).attr("data-inline-edit-current") ||
      $(this).children("span.current").html();
    var key = $(this).attr("data-inline-edit-field") || "value";
    var ajax = !!$(this).attr("data-inline-edit-ajax");
    var type = $(this).attr("data-inline-edit-type");
    var schema = $(this).attr("data-inline-edit-schema");
    if (schema) {
      schema = JSON.parse(decodeURIComponent(schema));
    }
    var is_key = type?.startsWith("Key:");
    const opts = encodeURIComponent(
      JSON.stringify({
        url,
        key,
        ajax,
        current,
        current_label: $(this).attr("data-inline-edit-current-label"),
        type,
        is_key,
        schema,
      })
    );
    const doAjaxOptionsFetch = (tblName, target) => {
      $.ajax(`/api/${tblName}`).then((resp) => {
        if (resp.success) {
          resp.success.sort((a, b) =>
            a[target]?.toLowerCase?.() > b[target]?.toLowerCase?.() ? 1 : -1
          );

          const selopts = resp.success.map(
            (r) =>
              `<option ${current == r.id ? `selected ` : ``}value="${
                r.id
              }">${escapeHtml(r[target])}</option>`
          );
          $(this).replaceWith(
            `<form method="post" action="${url}" ${
              ajax ? `onsubmit="inline_ajax_submit(event, '${opts}')"` : ""
            }>
          <input type="hidden" name="_csrf" value="${_sc_globalCsrf}">
          <select name="${key}" value="${current}">${selopts}
          </select>
          <button type="submit" class="btn btn-sm btn-primary">OK</button>
          <button onclick="cancel_inline_edit(event, '${opts}')" type="button" class="btn btn-sm btn-danger"><i class="fas fa-times"></i></button>
          </form>`
          );
        }
      });
    };
    if (type === "JSON" && schema && schema.type.startsWith("Key to ")) {
      const tblName = schema.type.replace("Key to ", "");
      const target = schema.summary_field || "id";
      doAjaxOptionsFetch(tblName, target);
    } else if (is_key) {
      const [tblName, target] = type.replace("Key:", "").split(".");
      doAjaxOptionsFetch(tblName, target);
    } else
      $(this).replaceWith(
        `<form method="post" action="${url}" ${
          ajax
            ? `onsubmit="inline_${
                isNode ? "ajax" : "local"
              }_submit(event, '${opts}')"`
            : ""
        }>
        ${
          isNode
            ? `<input type="hidden" name="_csrf" value="${_sc_globalCsrf}"></input>`
            : ""
        }
        <input type="${
          type === "Integer" || type === "Float" ? "number" : "text"
        }" name="${key}" value="${escapeHtml(current)}">
      <button type="submit" class="btn btn-sm btn-primary">OK</button>
      <button onclick="cancel_inline_edit(event, '${opts}')" type="button" class="btn btn-sm btn-danger"><i class="fas fa-times"></i></button>
      </form>`
      );
  });
  $("[mobile-img-path]").each(async function () {
    if (parent.loadEncodedFile) {
      const fileId = $(this).attr("mobile-img-path");
      const base64Encoded = await parent.loadEncodedFile(fileId);
      this.src = base64Encoded;
    }
  });
  $("[mobile-bg-img-path]").each(async function () {
    if (parent.loadEncodedFile) {
      const fileId = $(this).attr("mobile-bg-img-path");
      if (fileId) {
        const base64Encoded = await parent.loadEncodedFile(fileId);
        this.style.backgroundImage = `url("${base64Encoded}")`;
      }
    }
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
          const cm = CodeMirror.fromTextArea(el, {
            lineNumbers: true,
            mode: $(el).attr("mode"),
          });
          cm.on(
            "change",
            $.debounce(() => {
              $(el).closest("form").trigger("change");
            }),
            500,
            null,
            true
          );
        });
      }, 100);
    });

  if ($.fn.historyTabs && $.fn.tab)
    $('a[data-bs-toggle="tab"].deeplink').historyTabs();
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

function cancel_inline_edit(e, opts1) {
  const isNode = typeof parent?.saltcorn?.data?.state === "undefined";
  var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
  var form = $(e.target).closest("form");
  var json_fk_opt;
  if (opts.schema) {
    json_fk_opt = form.find(`option[value="${opts.current}"]`).text();
  }
  form.replaceWith(`<div 
  data-inline-edit-field="${opts.key}" 
  ${opts.ajax ? `data-inline-edit-ajax="true"` : ""}
  ${opts.type ? `data-inline-edit-type="${opts.type}"` : ""}
  ${opts.current ? `data-inline-edit-current="${opts.current}"` : ""}
  ${
    opts.current_label
      ? `data-inline-edit-current-label="${opts.current_label}"`
      : ""
  }
  ${
    opts.schema
      ? `data-inline-edit-schema="${encodeURIComponent(
          JSON.stringify(opts.schema)
        )}"`
      : ""
  }
  data-inline-edit-dest-url="${opts.url}">
    <span class="current">${
      json_fk_opt || opts.current_label || opts.current
    }</span>
    <i class="editicon ${!isNode ? "visible" : ""} fas fa-edit ms-1"></i>
  </div>`);
  initialize_page();
}

function inline_submit_success(e, form, opts) {
  const isNode = typeof parent?.saltcorn?.data?.state === "undefined";
  const formDataArray = form.serializeArray();
  if (opts) {
    let rawVal = formDataArray.find((f) => f.name == opts.key).value;
    let val =
      opts.is_key || (opts.schema && opts.schema.type.startsWith("Key to "))
        ? form.find("select").find("option:selected").text()
        : rawVal;

    $(e.target).replaceWith(`<div 
  data-inline-edit-field="${opts.key}" 
  ${opts.ajax ? `data-inline-edit-ajax="true"` : ""}
  ${opts.type ? `data-inline-edit-type="${opts.type}"` : ""}
  ${opts.current ? `data-inline-edit-current="${rawVal}"` : ""}
  ${
    opts.schema
      ? `data-inline-edit-schema="${encodeURIComponent(
          JSON.stringify(opts.schema)
        )}"`
      : ""
  }
  ${opts.current_label ? `data-inline-edit-current-label="${val}"` : ""}
  data-inline-edit-dest-url="${opts.url}">
    <span class="current">${val}</span>
    <i class="editicon ${!isNode ? "visible" : ""} fas fa-edit ms-1"></i>
  </div>`);
    initialize_page();
  } else location.reload();
}

function inline_ajax_submit(e, opts1) {
  var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
  e.preventDefault();
  var form = $(e.target).closest("form");
  var form_data = form.serialize();
  var url = form.attr("action");
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function (res) {
      inline_submit_success(e, form, opts);
    },
    error: function (e) {
      ajax_done(
        e.responseJSON || { error: "Unknown error: " + e.responseText }
      );
    },
  });
}

function ajax_indicator(show, e) {
  const $ind = e
    ? $(e).closest(".card,.modal").find(".sc-ajax-indicator")
    : $(".sc-ajax-indicator");
  $ind.find("svg").attr("data-icon", "save");
  $ind.find("i").removeClass("fa-exclamation-triangle").addClass("fa-save");
  $ind.css("color", "");
  $ind.removeAttr("title");
  if (show) $ind.show();
  else $ind.fadeOut();
}

function ajax_indicate_error(e, resp) {
  //console.error("ind error", resp);
  const $ind = e
    ? $(e).closest(".card,.modal").find(".sc-ajax-indicator")
    : $(".sc-ajax-indicator");
  $ind.css("color", "#e74a3b");
  $ind.find("svg").attr("data-icon", "exclamation-triangle");
  $ind.find("i").removeClass("fa-save").addClass("fa-exclamation-triangle");
  $ind.attr(
    "title",
    "Save error: " + (resp ? resp.responseText || resp.statusText : "unknown")
  );
  $ind.show();
}

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

function emptyAlerts() {
  $("#alerts-area").html("");
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
    else {
      const prev = new URL(window.location.href);
      const next = new URL(res.goto, prev.origin);
      window.location.href = res.goto;
      if (
        prev.origin === next.origin &&
        prev.pathname === next.pathname &&
        next.hash !== prev.hash
      )
        location.reload();
    }
  }
  if (res.popup) {
    ajax_modal(res.popup);
  }
}

const repeaterCopyValuesToForm = (form, editor, noTriggerChange) => {
  const vs = JSON.parse(editor.getString());

  const setVal = (k, ix, v) => {
    const $e = form.find(`input[name="${k}_${ix}"]`);
    if ($e.length) $e.val(v);
    else {
      const $ne = $(
        `<input type="hidden" data-repeater-ix="${ix}" name="${k}_${ix}"></input>`
      );
      $ne.val(v);
      form.append($ne);
    }
  };
  vs.forEach((v, ix) => {
    Object.entries(v).forEach(([k, v]) => {
      //console.log(ix, k, typeof v, v)
      if (typeof v === "boolean") setVal(k, ix, v ? "on" : "");
      else setVal(k, ix, v);
    });
  });
  //delete
  //for (let ix = vs.length; ix < vs.length + 5; ix++) {
  //  $(`input[data-repeater-ix="${ix}"]`).remove();
  //}
  $(`input[type=hidden]`).each(function () {
    const name = $(this).attr("name");
    if (!name) return;
    const m = name.match(/_(\d+)$/);
    if (!m || !m[1]) return;
    const ix = parseInt(m[1], 10);
    if (typeof ix !== "number" || isNaN(ix)) return;
    if (ix >= vs.length) $(this).remove();
  });
  !noTriggerChange && form.trigger("change");
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
    case "FormulaValue":
      return `Formula ${col.formula}`;
    case "JoinField":
      return `Join ${col.join_field}`;
    case "ViewLink":
      return `View link ${col.view_label || col.view.split(":")[1] || ""}`;
    case "Action":
      return `Action ${col.action_label || col.action_name}`;
    case "Aggregation":
      return `${col.stat} ${col.agg_field.split("@")[0]} ${col.agg_relation}`;
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
  const char_to_i = (s) => {
    switch (char_type) {
      case "Lowercase Letters":
        return s.charCodeAt(0) - "a".charCodeAt(0);
      case "Uppercase Letters":
        return s.charCodeAt(0) - "A".charCodeAt(0);
      default:
        return +s;
    }
  };
  const value_wspace = `${value}${space ? " " : ""}`;
  const vals = rows
    .map((o) => o[field_name])
    .filter((s) => s.startsWith(value));
  const numtype =
    char_type !== "Lowercase Letters" && char_type !== "Uppercase Letters";
  if (vals.includes(value) || always_append) {
    let newname;
    const stripped = vals
      .filter((v) => v !== value)
      .map((s) => s.replace(value_wspace, ""))
      .map((s) => (numtype ? +s : s))
      .sort(numtype ? (a, b) => a - b : undefined);
    if (stripped.length === 0) newname = `${value_wspace}${gen_char(start)}`;
    else {
      const i = char_to_i(stripped[stripped.length - 1]);
      const last_i = numtype ? Math.max(i, start - 1) : i;

      newname = `${value_wspace}${gen_char(last_i + 1)}`;
    }
    $("#" + id).val(newname);
  }
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

function init_room(viewname, room_id) {
  let socket = null;
  if (parent?.saltcorn?.data?.state) {
    const { server_path, jwt } =
      parent.saltcorn.data.state.getState().mobileConfig;
    socket = io(server_path, {
      query: `jwt=${jwt}`,
      transports: ["websocket"],
    });
  } else socket = io({ transports: ["websocket"] });

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

function cancel_form(form) {
  if (!form) return;
  $(form).trigger("reset");
  $(form).trigger("change");
  $(form).append(`<input type="hidden" name="_cancel" value="on">`);
  $(form).submit();
}

function split_paste_handler(e) {
  let clipboardData =
    e.clipboardData || window.clipboardData || e.originalEvent.clipboardData;

  const lines = clipboardData.getData("text").split(/\r\n/g);

  // do normal thing if not multiline - do not interfere with ordinary copy paste
  if (lines.length < 2) return;
  e.preventDefault();
  const form = $(e.target).closest("form");

  let matched = false;

  form
    .find("input:not(:disabled):not([readonly]):not(:hidden)")
    .each(function (ix, element) {
      if (!matched && element === e.target) matched = true;
      if (matched && lines.length > 0) {
        const $elem = $(element);
        if (ix === 0 && $elem.attr("type") !== "number") {
          //const existing = $elem.val()
          //const pasted =
          $elem.val(lines.shift());
        } else $elem.val(lines.shift());
        $elem.trigger("change");
      }
    });
}

function is_paging_param(key) {
  return key.endsWith("_page") || key.endsWith("_pagesize");
}
function check_saltcorn_notifications() {
  $.ajax(`/notifications/count-unread`).then((resp) => {
    if (resp.success) {
      const n = resp.success;
      const menu_item = $(`a.notify-menu-item`);

      menu_item.html(
        `<i class="fa-fw mr-05 fas fa-bell"></i>Notifications (${n})`
      );
      $(".user-nav-section").html(
        `<i class="fa-fw mr-05 fas fa-user"></i>User (${n})`
      );
      $(".user-nav-section-with-span").html(
        `<i class="fa-fw mr-05 fas fa-user"></i><span>User (${n})</span>`
      );
      window.update_theme_notification_count &&
        window.update_theme_notification_count(n);
    }
  });
}
