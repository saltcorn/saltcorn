//https://stackoverflow.com/a/698386
jQuery.fn.swapWith = function (to) {
  return this.each(function () {
    var copy_to = $(to).clone(true);
    var copy_from = $(this).clone(true);
    $(to).replaceWith(copy_from);
    $(this).replaceWith(copy_to);
  });
};

function monospace_block_click(e) {
  let e1 = $(e).next("pre");
  let mine = $(e).html();
  $(e).html($(e1).html());
  $(e1).html(mine);
}

function copy_monospace_block(e) {
  let e1 = $(e).next("pre");
  let e2 = $(e1).next("pre");
  if (!e2.length) return navigator.clipboard.writeText($(e1).text());
  const e1t = e1.text();
  const e2t = e2.text();
  if (e1t.length > e2t.length) return navigator.clipboard.writeText(e1t);
  else return navigator.clipboard.writeText(e2t);
}

function setScreenInfoCookie() {
  document.cookie = `_sc_screen_info_=${JSON.stringify({
    width: window.screen.width,
    height: window.screen.height,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  })}; expires=Thu, 01 Jan 2100 00:00:00 GMT; path=/; domain=.${
    window.location.hostname
  }; samesite=strict`;
}
setScreenInfoCookie();
$(window).resize(() => {
  setScreenInfoCookie();
});

function get_current_state_url(e) {
  const localizer = e ? $(e).closest("[data-sc-local-state]") : [];
  let $modal = $("#scmodal");
  if (localizer.length) {
    const localState = localizer.attr("data-sc-local-state") || "";
    return localState;
  } else if ($modal.length === 0 || !$modal.hasClass("show"))
    return getIsNode()
      ? window.location.href
      : parent.saltcorn.mobileApp.navigation.currentUrl();
  else return $modal.prop("data-modal-state");
}

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

function reset_nearest_form(that) {
  const form = $(that).closest("form");
  form.trigger("reset");
  form.find("select").trigger("change");
}

function add_repeater(nm) {
  var es = $("div.form-repeat.repeat-" + nm);
  const ncopy = es.length - 1;
  var e = es.last();
  var newix = es.length;
  var newe = $(e).clone();
  newe.find("[name]").each(function (ix, element) {
    if ($(element).hasClass("omit-repeater-clone")) $(element).remove();
    const oldnm = element.name || "";
    var newnm = (element.name || "").replace("_" + ncopy, "_" + newix);
    var newid = (element.id || "").replace("_" + ncopy, "_" + newix);
    $(element).attr("name", newnm).attr("id", newid);
    if (element.tagName === "SELECT") {
      const original = document.getElementsByName(oldnm)[0];
      if (original) element.selectedIndex = original.selectedIndex;
    }
  });
  newe.appendTo($("div.repeats-" + nm));
  newe.find("[data-on-cloned]").each(function (ix, element) {
    (function (str) {
      return eval(str);
    }).call(element, $(element).attr("data-on-cloned"));
  });
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
  $(element)
    .find("input,textarea")
    .each(function () {
      $(this).attr("value", $(this).val());
    });
  $(element)
    .find("select")
    .each(function () {
      $(this).find(":selected").attr("selected", "selected");
    });

  $(element).html(
    $(element)
      .html()
      .split("_" + oldix + '"')
      .join("_" + newix + '"')
  );
}

const _apply_showif_plugins = [];

const add_apply_showif_plugin = (p) => {
  _apply_showif_plugins.push(p);
};

const nubBy = (prop, xs) => {
  const vs = new Set();
  return xs.filter((x) => {
    if (vs.has(x[prop])) return false;
    vs.add(x[prop]);
    return true;
  });
};

function valid_js_var_name(s) {
  if (!s) return false;
  return !!s.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/);
}

const apply_showif_fetching_urls = new Set();

function apply_showif() {
  const isNode = getIsNode();
  $("[data-show-if]").each(function (ix, element) {
    var e = $(element);
    try {
      if (e.prop("disabled")) return;
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
      if (to_show(e)) {
        e.find("input, textarea, button, select, [data-show-if]").prop(
          "disabled",
          e.attr("data-disabled") || false
        );
        element.style.display = "";
      } else {
        e.find(
          "input:enabled, textarea:enabled, button:enabled, select:enabled, [data-show-if]:not([disabled])"
        ).prop("disabled", true);
        element.style.setProperty("display", "none", "important");
      }
    } catch (e) {
      console.error(e);
    }
  });
  $("[data-dyn-href]").each(function (ix, element) {
    try {
      const e = $(element);
      const rec = get_form_record(e);
      const href = new Function(
        `{${Object.keys(rec).filter(valid_js_var_name).join(",")}}`,
        "return " + e.attr("data-dyn-href")
      )(rec);
      e.attr("href", href);
    } catch (e) {
      if (window._sc_loglevel > 4) console.error(e);
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
    //TODO clean repetition in following cose
    (options || []).forEach((o) => {
      if (o && o.optgroup) {
        const opts = o.options
          .map(
            (innero) =>
              `<option ${
                `${current}` === `${innero.value || innero}` ? "selected " : ""
              }value="${innero.value || innero}">${
                innero.label || innero
              }</option>`
          )
          .join("");
        e.append($(`<optgroup label="${o.label}">` + opts + "</optgroup>"));
      } else if (
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
    if (window._sc_loglevel > 4) console.log("dynwhere", dynwhere);
    const kvToQs = ([k, v], is_or) => {
      return k === "or" && Array.isArray(v)
        ? v
            .map((v1) =>
              Object.entries(v1)
                .map((kv) => kvToQs(kv, true))
                .join("&")
            )
            .join("&")
        : `${k}=${v[0] === "$" ? rec[v.substring(1)] : v}${
            is_or ? "&_or_field=" + k : ""
          }`;
    };
    const qss = Object.entries(dynwhere.whereParsed).map((kv) => kvToQs(kv));
    if (dynwhere.existingValue) {
      qss.push(`id=${dynwhere.existingValue}`);
      qss.push(`_or_field=id`);
    }
    if (dynwhere.dereference) {
      if (Array.isArray(dynwhere.dereference))
        qss.push(...dynwhere.dereference.map((d) => `dereference=${d}`));
      else qss.push(`dereference=${dynwhere.dereference}`);
    }
    const qs = qss.join("&");
    let current = e.attr("data-selected");
    if (current === "null") current = null;
    e.change(function (ec) {
      e.attr("data-selected", ec.target.value);
    });

    const currentOptionsSet = e.prop("data-fetch-options-current-set");
    if (currentOptionsSet === qs) return;

    const activate = (success, qs) => {
      //re-fetch current, because it may have changed
      let current = e.attr("data-selected");
      if (current === "null") current = null;
      if (e.prop("data-fetch-options-current-set") === qs) return;
      e.empty();
      e.prop("data-fetch-options-current-set", qs);
      const toAppend = [];

      let currentDataOption = undefined;
      const dataOptions = [];
      //console.log(success);
      const success1 = dynwhere.nubBy
        ? nubBy(dynwhere.nubBy, success)
        : success;
      success1.forEach((r) => {
        const label = dynwhere.label_formula
          ? new Function(
              `{${Object.keys(r).join(",")}}`,
              "return " + dynwhere.label_formula
            )(r)
          : r[dynwhere.summary_field];
        const value = r[dynwhere.refname];
        //console.log("lv", label, value, r, dynwhere.summary_field);
        const selected = `${current}` === `${r[dynwhere.refname]}`;
        dataOptions.push({ text: label, value });
        if (selected) currentDataOption = value;
        toAppend.push({ selected, value, label });
      });
      toAppend.sort((a, b) =>
        a.label === dynwhere.neutral_label
          ? -1
          : b.label === dynwhere.neutral_label
            ? 1
            : (a.label?.toLowerCase?.() || a.label) >
                (b.label?.toLowerCase?.() || b.label)
              ? 1
              : -1
      );
      if (!dynwhere.required)
        toAppend.unshift({ label: dynwhere.neutral_label || "", value: "" });
      if (dynwhere.required && dynwhere.placeholder)
        toAppend.unshift({
          disabled: true,
          label: dynwhere.placeholder,
          value: "",
          selected: !current,
        });
      e.html(
        toAppend
          .map(
            ({ label, value, selected, disabled }) =>
              `<option${selected ? ` selected` : ""}${
                disabled ? ` disabled` : ""
              }${typeof value !== "undefined" ? ` value="${value}"` : ""}>${
                label || ""
              }</option>`
          )
          .join("")
      );

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
      apply_showif_fetching_urls.add(`/api/${dynwhere.table}?${qs}`);
      $.ajax(`/api/${dynwhere.table}?${qs}`)
        .then((resp) => {
          if (resp.success) {
            if (window._sc_loglevel > 4)
              console.log("dynwhere fetch", qs, resp.success);

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
        })
        .fail(checkNetworkError)
        .always(() => {
          apply_showif_fetching_urls.delete(`/api/${dynwhere.table}?${qs}`);
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
            const defval = $def.val();
            const def =
              typeof defval === "undefined" ? undefined : JSON.parse(defval);
            if (def) {
              def[k] = v;
              $def.val(JSON.stringify(def));
            }
          } catch (e) {
            console.error("Invalid json", e);
          }
        });
    };

    if (typeof cache[recS] !== "undefined") {
      e.html(cache[recS]);
      e.prop("data-source-url-current", recS);
      activate_onchange_coldef();
      return;
    }

    const cb = {
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
    };
    if (isNode) ajax_post_json(e.attr("data-source-url"), rec, cb);
    else {
      local_post_json(e.attr("data-source-url"), rec, cb);
    }
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
  const parse = (s, def = {}) => {
    try {
      return JSON.parse(decodeURIComponent(s));
    } catch (e) {
      console.error("failed to parse time format", e);
      return def;
    }
  };
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
    options.timeZone = "UTC";
    el.text(date.toLocaleDateString(locale, options));
  });
  $("time[locale-date-format]").each(function () {
    var el = $(this);
    var date = el.attr("datetime");
    const format = parse(el.attr("locale-date-format"), "");
    if (format) el.text(dayjs(date).format(format));
    else el.text(dayjs(date));
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

function get_form_record(e_in, select_labels) {
  const rec = {};

  const e = e_in.viewname
    ? $(`form[data-viewname="${e_in.viewname}"]`)
    : $(e_in).closest(".form-namespace");

  const form = $(e).closest("form");

  const rowVals = form.attr("data-row-values");
  if (rowVals)
    try {
      const initRow = JSON.parse(decodeURIComponent(rowVals));
      Object.assign(rec, initRow);
    } catch (error) {
      console.error(error);
    }

  e.find("input[name],select[name],textarea[name]").each(function () {
    const $this = $(this);
    if ($this.prop("disabled")) return;
    const name = $this.attr("data-fieldname") || $this.attr("name");
    if (select_labels && $this.prop("tagName").toLowerCase() === "select")
      rec[name] = $this.find("option:selected").text();
    else if ($this.prop("type") === "checkbox")
      rec[name] = $this.prop("checked");
    else if ($this.prop("type") === "radio" && !$this.prop("checked")) {
      //do nothing
    } else rec[name] = $this.val();
    //postprocess
    if ($this.attr("data-postprocess")) {
      const f = new Function(
        "it",
        "$e",
        "return " + $this.attr("data-postprocess")
      );
      rec[name] = f(rec[name], $this);
    }
  });

  const joinFieldsStr =
    typeof e_in !== "string" && $(e_in).attr("data-show-if-joinfields");
  if (joinFieldsStr) {
    const joinFields = JSON.parse(decodeURIComponent(joinFieldsStr));

    const joinVals = $(e_in).prop("data-join-values");
    const kvals = $(e_in).prop("data-join-key-values") || {};
    let differentKeys = false;
    for (const { ref } of joinFields) {
      if (rec[ref] != kvals[ref]) differentKeys = true;
    }
    if (!joinVals || differentKeys) {
      $(e_in).prop("data-join-values", {});
      const keyVals = {};
      for (const { ref, target, refTable } of joinFields) {
        if (!rec[ref]) continue;
        keyVals[ref] = rec[ref];
        $.ajax(`/api/${refTable}?id=${rec[ref]}`, {
          success: (val) => {
            const jvs = $(e_in).prop("data-join-values") || {};

            jvs[ref] = val.success[0];
            $(e_in).prop("data-join-values", jvs);
            apply_showif();
          },
          error: checkNetworkError,
        });
      }
      $(e_in).prop("data-join-key-values", keyVals);
    } else if (joinFieldsStr) {
      Object.assign(rec, joinVals);
    }
  }
  return rec;
}
function showIfFormulaInputs(e, fml) {
  const rec = get_form_record(e);
  if (window._sc_loglevel > 4)
    console.log(`show if fml ${fml} form_record`, rec);
  try {
    return new Function(
      "row",
      `{${Object.keys(rec).join(",")}}`,
      "return " + fml
    )(rec, rec);
  } catch (e) {
    throw new Error(
      `Error in evaluating showIf formula ${fml} with values ${JSON.stringify(
        rec
      )}: ${e.message}`
    );
  }
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

function doMobileTransforms() {
  const replaceAttr = (el, attr, web, mobile) => {
    const jThis = $(el);
    const skip = jThis.attr("skip-mobile-adjust");
    if (!skip) {
      const attrVal = jThis.attr(attr);
      if (attrVal?.includes(web)) {
        jThis.attr(attr, attrVal.replace(web, mobile));
      }
    }
  };

  const replacers = {
    href: [
      {
        web: "javascript:history.back()",
        mobile: "javascript:parent.saltcorn.mobileApp.navigation.goBack()",
      },
      {
        web: "javascript:ajax_modal",
        mobile: "javascript:mobile_modal",
      },
    ],
    onclick: [
      {
        web: "history.back()",
        mobile: "parent.saltcorn.mobileApp.navigation.goBack()",
      },
      {
        web: "ajax_modal",
        mobile: "mobile_modal",
      },
      {
        web: "ajax_post_",
        mobile: "local_post_",
      },
    ],
  };

  // change /plugins or plugins to sc_plugins
  // capacitor reserves the plugins prefix for cordova plugins
  const normalisePluginsPrefix = (path) => {
    if (path.startsWith("/plugins/") || path.startsWith("plugins/"))
      return path.replace(/\/?plugins\//, "sc_plugins/");
    return null;
  };
  $("link").each(function () {
    const path = $(this).attr("href");
    if (path) {
      const newPath = normalisePluginsPrefix(path);
      if (newPath) {
        $(this).attr("href", newPath);
        console.log("transformed link", path, newPath);
      }
    }
  });
  $("script").each(function () {
    const path = $(this).attr("src");
    if (path) {
      const newPath = normalisePluginsPrefix(path);
      if (newPath) {
        $(this).attr("src", newPath);
        console.log("transformed script", path, newPath);
      }
    }
  });

  $("a").each(function () {
    let path = $(this).attr("href") || "";
    if (path.startsWith("http")) {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    }
    if (path.startsWith("/view/") || path.startsWith("/page/")) {
      const jThis = $(this);
      const skip = jThis.attr("skip-mobile-adjust");
      if (!skip) {
        jThis.removeAttr("href");
        jThis.attr("onclick", `execLink('${path}')`);
        if (jThis.find("i,img").length === 0 && !jThis.css("color")) {
          jThis.css(
            "color",
            "rgba(var(--bs-link-color-rgb),var(--bs-link-opacity,1))"
          );
        }
      }
    } else if (path.includes("/files/serve/")) {
      const tokens = path.split("/files/serve/");
      if (tokens.length > 1)
        $(this).attr("href", `javascript:openFile('${tokens[1]}')`);
    } else if (path.includes("/files/download/")) {
      const tokens = path.split("/files/download/");
      if (tokens.length > 1)
        $(this).attr(
          "href",
          `javascript:notifyAlert('File donwloads are not supported.')`
        );
    } else {
      for (const [k, v] of Object.entries(replacers)) {
        for ({ web, mobile } of v) replaceAttr(this, k, web, mobile);
      }
    }
  });

  $("[mobile-youtube-video]").each(function () {
    const jThis = $(this);
    const src = jThis.attr("src");
    if (src) {
      const rndid = `m-video-${Math.floor(Math.random() * 16777215).toString(
        16
      )}`;
      const url = new URL(src);
      const path = url.pathname;
      const imageId = path.split("/").pop();
      const thumbnailContainer = document.createElement("div");
      thumbnailContainer.className = "mobile-thumbnail-container";
      thumbnailContainer.id = rndid;
      const img = document.createElement("img");
      img.src = `https://img.youtube.com/vi/${imageId}/0.jpg`;
      img.style = "width: 100%; max-width: 600px;";
      img.id = rndid;
      img.setAttribute(
        "onclick",
        `openInAppBrowser('${src.replace(
          "com/embed",
          "com/watch"
        )}', '${rndid}')`
      );
      thumbnailContainer.appendChild(img);
      const spinner = document.createElement("div");
      spinner.className = "mobile-thumbnail-spinner-overlay";
      const spinnerInner = document.createElement("div");
      spinnerInner.className = "d-none spinner-border text-light";
      spinnerInner.setAttribute("role", "status");
      spinner.appendChild(spinnerInner);
      thumbnailContainer.appendChild(spinner);
      jThis.replaceWith(thumbnailContainer);
    }
  });

  $("button").each(function () {
    for (const [k, v] of Object.entries({ onclick: replacers.onclick })) {
      for ({ web, mobile } of v) replaceAttr(this, k, v.web, v.mobile);
    }
  });

  $("[mobile-img-path]").each(async function () {
    const fileId = $(this).attr("mobile-img-path");
    const base64Encoded =
      await parent.saltcorn.mobileApp.common.loadEncodedFile(fileId);
    this.src = base64Encoded;
  });

  $("[mobile-bg-img-path]").each(async function () {
    const fileId = $(this).attr("mobile-bg-img-path");
    if (fileId) {
      const base64Encoded =
        await parent.saltcorn.mobileApp.common.loadEncodedFile(fileId);
      this.style.backgroundImage = `url("${base64Encoded}")`;
    }
  });

  $("img:not([mobile-img-path]):not([mobile-bg-img-path])").each(
    async function () {
      const jThis = $(this);
      const src = jThis.attr("src");
      if (src?.includes("/files/serve/")) {
        const tokens = src.split("/files/serve/");
        if (tokens.length > 1) {
          const fileId = tokens[1];
          const base64Encoded =
            await parent.saltcorn.mobileApp.common.loadEncodedFile(fileId);
          this.src = base64Encoded;
        }
      } else if (src?.includes("/files/resize/")) {
        const tokens = src.split("/files/resize/");
        if (tokens.length > 1) {
          const idAndDims = tokens[1].split("/");
          const width = idAndDims[0];
          const height = idAndDims.length > 2 ? idAndDims[1] : undefined;
          const fileId = idAndDims[idAndDims.length - 1];
          const style = { width: `${width || 50}px` };
          if (height > 0) style.height = `${height}px`;
          const base64Encoded =
            await parent.saltcorn.mobileApp.common.loadEncodedFile(fileId);
          this.src = base64Encoded;
          jThis.css(style);
        }
      }
    }
  );
}

function initialize_page() {
  if (window._sc_locale && window.dayjs) dayjs.locale(window._sc_locale);
  const isNode = getIsNode();
  //console.log("init page");
  $(".blur-on-enter-keypress").bind("keyup", function (e) {
    if (e.keyCode === 13) e.target.blur();
  });

  const validate_identifier_elem = (target) => {
    const next = target.next();
    if (next.hasClass("expr-error")) next.remove();
    const val = target.val();
    if (!val) return;
    try {
      Function(val, "return 1");
    } catch (error) {
      target.after(`<small class="text-danger font-monospace d-block expr-error">
      Invalid identifier
    </small>`);
    }
  };
  $(".validate-identifier").attr("spellcheck", false);
  $(".validate-expression").attr("spellcheck", false);

  $(".validate-identifier").bind("input", function (e) {
    const target = $(e.target);
    validate_identifier_elem(target);
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
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      AsyncFunction("return " + val);
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
  // also change if we select same
  $("form select").on("blur", (e) => {
    if (!e || !e.target) return;
    $(e.target).closest("form").trigger("change");
  });
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
    const resetHtml = this.outerHTML;

    let fielddata = $(this).attr("data-inline-edit-fielddata");
    if (fielddata) {
      //fetch edit
      $.ajax(`/field/edit-get-fieldview`, {
        type: "POST",
        headers: {
          "CSRF-Token": _sc_globalCsrf,
        },
        contentType: "application/json",
        data: decodeURIComponent(fielddata),
      }).then((resp) => {
        const opts = encodeURIComponent(
          JSON.stringify({
            resetHtml,
          })
        );
        $(this).replaceWith(
          `<form method="post" action="/field/save-click-edit" onsubmit="inline_ajax_submit_with_fielddata(event, '${opts}')"        
      <input type="hidden" name="_csrf" value="${_sc_globalCsrf}">
      <input type="hidden" name="_fielddata" value="${fielddata}">
      <div class="input-group">
      ${resp}
      <button type="submit" class="btn btn-sm btn-primary">OK</button>
      <button onclick="cancel_inline_edit(event, '${opts}')" type="button" class="btn btn-sm btn-danger"><i class="fas fa-times"></i></button>
      </div>
      </form>`
        );
      });
      return;
    }
    var key = $(this).attr("data-inline-edit-field") || "value";
    var ajax = !!$(this).attr("data-inline-edit-ajax");
    var type = $(this).attr("data-inline-edit-type");
    var schema = $(this).attr("data-inline-edit-schema");
    var decimalPlaces = $(this).attr("data-inline-edit-decimal-places");
    if (schema) {
      schema = JSON.parse(decodeURIComponent(schema));
    }
    if (type === "Date") {
      //console.log("timeelsems", $(this).find("span.current time"));
      current =
        $(this).attr("data-inline-edit-current") ||
        $(this).find("span.current time").attr("datetime"); // ||
      //$(this).children("span.current").html();
    }
    if (type === "Bool") {
      current = current === "true";
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
        resetHtml,
        ...(decimalPlaces ? { decimalPlaces } : {}),
      })
    );
    const doAjaxOptionsFetch = (tblName, target) => {
      $.ajax(`/api/${tblName}`)
        .then((resp) => {
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
        })
        .fail(checkNetworkError);
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
          type === "Integer" || type === "Float"
            ? "number"
            : type === "Bool"
              ? "checkbox"
              : "text"
        }" ${
          type === "Float"
            ? `step="${
                decimalPlaces
                  ? Math.round(
                      Math.pow(10, -decimalPlaces) * Math.pow(10, decimalPlaces)
                    ) / Math.pow(10, decimalPlaces)
                  : "any"
              }"`
            : ""
        } name="${key}" ${
          type === "Bool"
            ? current
              ? "checked"
              : ""
            : `value="${escapeHtml(current)}"`
        }>
      <button type="submit" class="btn btn-sm btn-primary">OK</button>
      <button onclick="cancel_inline_edit(event, '${opts}')" type="button" class="btn btn-sm btn-danger"><i class="fas fa-times"></i></button>
      </form>`
      );
  });
  if (!isNode) {
    doMobileTransforms();
    const anchor = parent.saltcorn.mobileApp.navigation.getAnchor();
    if (anchor) $(`[href="#${anchor}"][data-bs-toggle="tab"]`).tab("show");
  }
  function setExplainer(that) {
    var id = $(that).attr("id") + "_explainer";

    var explainers = JSON.parse(
      decodeURIComponent($(that).attr("data-explainers"))
    );
    var currentVal = explainers[$(that).val()];
    $("#" + id).html(
      `<strong>${
        $(that).find("option:selected").text() || $(that).val()
      }</strong>: ${currentVal}`
    );
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
          if ($(el).hasClass("codemirror-enabled")) return;
          const cmOpts = {
            lineNumbers: true,
            mode: $(el).attr("mode"),
          };
          if (_sc_lightmode === "dark") cmOpts.theme = "blackboard";
          const cm = CodeMirror.fromTextArea(el, cmOpts);
          $(el).addClass("codemirror-enabled");
          if ($(el).hasClass("enlarge-in-card")) enlarge_in_code($(el), cm);
          cm.on(
            "change",
            $.debounce(
              (cm1) => {
                cm1.save();
                if ($(el).hasClass("validate-statements")) {
                  try {
                    let AsyncFunction = Object.getPrototypeOf(
                      async function () {}
                    ).constructor;
                    AsyncFunction(cm.getValue());
                    $(el).closest("form").trigger("change");
                  } catch (e) {
                    const form = $(el).closest("form");
                    const errorArea = form.parent().find(".full-form-error");
                    if (errorArea.length) errorArea.text(e.message);
                    else
                      form
                        .parent()
                        .append(
                          `<p class="text-danger full-form-error">${e.message}</p>`
                        );
                    return;
                  }
                } else {
                  cm1.save();
                  $(el).closest("form").trigger("change");
                }
              },
              500,
              null,
              true
            )
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

  setTimeout(() => {
    $("#toasts-area")
      .find(".show[rendered='server-side'][type='success']")
      .removeClass("show");
  }, 5000);

  $(".lazy-accoordion").on("show.bs.collapse", function (e) {
    const $e = $(e.target).find("[data-sc-view-source]");
    if ($.trim($e.html()) == "") {
      const url = $e.attr("data-sc-view-source");
      $e.html("Loading...");
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
          if (!checkNetworkError(res))
            notifyAlert({ type: "danger", text: res.responseText });
          if ($e.html() === "Loading...") $e.html("");
        },
      });
    }
  });
}

$(initialize_page);

function enlarge_in_code($textarea, cm) {
  const $card = $textarea.closest("div.card");
  if (!$card.length) return;
  const cardTop = $card.position().top;
  const cardHeight = $card.height();
  const vh = $(window).height();
  const cmHeight = cm.getWrapperElement().offsetHeight;
  const newCardHeight = vh - cardTop - 35;
  if (newCardHeight > cardHeight) {
    const extending = newCardHeight - cardHeight;
    cm.setSize("100%", `${cmHeight + extending}px`);
    cm.refresh();
    $card.css("min-height", newCardHeight + "px");
  }
}

function cancel_inline_edit(e, opts1) {
  var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
  var form = $(e.target).closest("form");
  form.replaceWith(opts.resetHtml);
  initialize_page();
}

function inline_submit_success(e, form, opts) {
  const isNode = getIsNode();
  const formDataArray = form.serializeArray();
  if (opts) {
    let fdEntry = formDataArray.find((f) => f.name == opts.key);
    let rawVal = opts.type === "Bool" ? !!fdEntry : fdEntry.value;
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
  ${
    opts.decimalPlaces
      ? `data-inline-edit-decimal-places="${opts.decimalPlaces}"`
      : ""
  }
  data-inline-edit-dest-url="${opts.url}">
    <span class="current">${val}</span>
    <i class="editicon ${!isNode ? "visible" : ""} fas fa-edit ms-1"></i>
  </div>`);
    initialize_page();
  } else location.reload();
}

function inline_ajax_submit_with_fielddata(e, opts1) {
  var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
  e.preventDefault();

  var form = $(e.target).closest("form");
  var form_data = form.serialize();
  var url = form.attr("action");
  if (opts.type === "Bool" && !form_data.includes(`${opts.key}=on`)) {
    form_data += `&${opts.key}=off`;
  }
  $.ajax(url, {
    type: "POST",
    headers: {
      "CSRF-Token": _sc_globalCsrf,
    },
    data: form_data,
    success: function (res) {
      var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
      var form = $(e.target).closest("form");
      form.replaceWith(res);
      initialize_page();
    },
    error: function (e) {
      if (!checkNetworkError(e))
        ajax_done(
          e.responseJSON || { error: "Unknown error: " + e.responseText }
        );
    },
  });
}

function inline_ajax_submit(e, opts1) {
  var opts = JSON.parse(decodeURIComponent(opts1 || "") || "{}");
  e.preventDefault();

  var form = $(e.target).closest("form");
  var form_data = form.serialize();
  var url = form.attr("action");
  if (opts.type === "Bool" && !form_data.includes(`${opts.key}=on`)) {
    form_data += `&${opts.key}=off`;
  }
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
      if (!checkNetworkError(e))
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
    error: checkNetworkError,
  });
}
function tristateClick(e, required) {
  const btn = $(e);
  const input = btn.prev();
  var current = input.val();
  switch (current) {
    case "?":
      btn
        .html(btn.attr("data-true-label") || "T")
        .removeClass(["btn-danger", "btn-secondary"])
        .addClass("btn-success");
      input.val("on").trigger("change");
      break;
    case "on":
      btn
        .html(btn.attr("data-false-label") || "F")
        .removeClass(["btn-success", "btn-secondary"])
        .addClass("btn-danger");
      input.val("off").trigger("change");
      break;
    default:
      if (required) {
        btn
          .html(btn.attr("data-true-label") || "T")
          .removeClass(["btn-danger", "btn-secondary"])
          .addClass("btn-success");
        input.val("on").trigger("change");
      } else {
        btn
          .html(btn.attr("data-null-label") || "?")
          .removeClass(["btn-success", "btn-danger"])
          .addClass("btn-secondary");
        input.val("?").trigger("change");
      }
      break;
  }
}

function getIsNode() {
  try {
    return typeof parent?.saltcorn?.data?.state === "undefined";
  } catch (e) {
    //probably in an iframe
    return true;
  }
}

function buildToast(txt, type, spin, title) {
  const realtype = type === "error" ? "danger" : type;
  const icon =
    realtype === "success"
      ? "fa-check-circle"
      : realtype === "danger"
        ? "fa-times-circle"
        : realtype === "warning"
          ? "fa-exclamation-triangle"
          : "";
  const isNode = getIsNode();
  const rndid = `tab${Math.floor(Math.random() * 16777215).toString(16)}`;
  return {
    id: rndid,
    html: `
    <div 
      class="toast show"
      id="${rndid}"
      rendered="client-side",
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style="min-width: 350px; max-width: 50vw; width: auto; z-index: 9999; ${
        !isNode ? "transform: translateX(-50%);" : ""
      }" 
    >
      <div class="toast-header bg-${realtype} text-white py-1 ">
        <i class="fas ${icon} me-2"></i>
        <strong class="me-auto" >
          ${title || type}
        </strong>
        ${
          spin
            ? ""
            : `<button 
                type="button" 
                class="btn-close btn-close-white" 
                data-bs-dismiss="toast" 
                aria-label="Close"
                style="font-size: 12px;"
                ></button>`
        }
      </div>
      <div 
        class="toast-body py-2 fs-6 fw-bold d-flex align-items-center"
      >
        <strong>${txt}</strong>
        ${
          spin
            ? `<span 
                class="spinner-border ms-auto" 
                role="status" 
                aria-hidden="true" 
                style="width: 1.5rem; height: 1.5rem"></span>`
            : ""
        }
      </div>
    </div>
  `,
  };
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
  } else if (note.text) {
    txt = note.text;
    type = note.type || "info";
  } else {
    type = "info";
    txt = JSON.stringify(note, null, 2);
  }

  const { id, html } = buildToast(txt, type, spin, note.toast_title);
  let $modal = $("#scmodal");
  if ($modal.length && $modal.hasClass("show"))
    $("#modal-toasts-area").append(html);
  else $("#toasts-area").append(html);
  if (type === "success") {
    setTimeout(() => {
      $(`#${id}`).removeClass("show");
    }, 5000);
  }
}

function emptyAlerts() {
  $("#toasts-area").html("");
}

function press_store_button(clicked, keepOld, disable) {
  let btn = clicked;
  if ($(clicked).is("form")) btn = $(clicked).find("button[type=submit]");
  if (keepOld) {
    const oldText = $(btn).html();
    $(btn).data("old-text", oldText);
  }
  const width = $(btn).width();
  const height = $(btn).height();
  $(btn)
    .html('<i class="fas fa-spinner fa-spin"></i>')
    .width(width)
    .height(height);
  setTimeout(() => {
    $(btn).prop("disabled", true);
  }, 50);
}

function restore_old_button(btnId) {
  const btn = btnId instanceof jQuery ? btnId : $(`#${btnId}`);
  const oldText = $(btn).data("old-text");
  btn.html(oldText);
  btn.css({ width: "", height: "" }).prop("disabled", false);
  btn.removeData("old-text");
}

async function common_done(res, viewnameOrElem0, isWeb = true) {
  const viewnameOrElem =
    viewnameOrElem0 === "undefined"
      ? last_route_viewname
      : viewnameOrElem0 || last_route_viewname;
  const viewname =
    typeof viewnameOrElem === "string"
      ? viewnameOrElem
      : $(viewnameOrElem)
          .closest("[data-sc-embed-viewname]")
          .attr("data-sc-embed-viewname");
  if (window._sc_loglevel > 4)
    console.log("ajax result directives", viewname, res);
  const handle = async (element, fn) => {
    if (Array.isArray(element))
      for (const current of element) await fn(current);
    else await fn(element);
  };
  const eval_it = async (s) => {
    if (res.row && res.field_names) {
      const f = new Function(`viewname, row, {${res.field_names}}`, s);
      const evalres = await f(viewname, res.row, res.row);
      if (evalres) await common_done(evalres, viewnameOrElem, isWeb);
    } else if (res.row) {
      const f = new Function(`viewname, row`, s);
      const evalres = await f(viewname, res.row);
      if (evalres) await common_done(evalres, viewnameOrElem, isWeb);
    } else {
      const f = new Function(`viewname`, s);
      const evalres = await f(viewname);
      if (evalres) await common_done(evalres, viewnameOrElem, isWeb);
    }
  };
  if (res.notify)
    await handle(res.notify, (text) =>
      notifyAlert({ type: "info", text, toast_title: res.toast_title })
    );
  if (res.error) {
    if (window._sc_loglevel > 4) console.trace("error response", res.error);
    await handle(res.error, (text) =>
      notifyAlert({ type: "danger", text, toast_title: res.toast_title })
    );
  }
  if (res.notify_success)
    await handle(res.notify_success, (text) =>
      notifyAlert({ type: "success", text, toast_title: res.toast_title })
    );
  if (res.set_fields && (viewname || res.set_fields._viewname)) {
    const form =
      typeof viewnameOrElem === "string" || res.set_fields._viewname
        ? $(`form[data-viewname="${res.set_fields._viewname || viewname}"]`)
        : $(viewnameOrElem).closest("form[data-viewname]");
    if (form.length === 0 && set_state_fields) {
      // assume this is a filter
      set_state_fields(
        res.set_fields,
        false
        // $(`[data-sc-embed-viewname="${viewname}"]`)
      );
    } else {
      Object.keys(res.set_fields).forEach((k) => {
        if (k === "_viewname") return;
        const input = form.find(
          `input[name=${k}], textarea[name=${k}], select[name=${k}]`
        );
        if (k === "id" && input.length === 0) {
          //TODO table.pk_name instead of id
          form.append(
            `<input type="hidden" name="id" value="${res.set_fields[k]}">`
          );
          reloadEmbeddedEditOwnViews(form, res.set_fields[k]);
          return;
        }
        if (input.attr("type") === "checkbox")
          input.prop("checked", res.set_fields[k]);
        else input.val(res.set_fields[k]);
        if (input.attr("data-selected")) {
          input.attr("data-selected", res.set_fields[k]);
        }

        input.trigger("set_form_field");
      });
    }
    form.trigger("change");
  }

  if (res.download) {
    await handle(res.download, (download) => {
      const dataurl = `data:${
        download.mimetype || "application/octet-stream"
      };base64,${download.blob}`;
      fetch(dataurl)
        .then((res) => res.blob())
        .then((blob) => {
          const link = document.createElement("a");
          link.href = window.URL.createObjectURL(blob);
          if (download.filename) link.download = download.filename;
          else link.target = "_blank";
          link.click();
        });
    });
  }

  if (res.popup) {
    ajax_modal(res.popup);
  }
  if (res.suppressed) {
    notifyAlert({
      type: "warning",
      text: res.suppressed,
    });
  }
  if (res.eval_js) await handle(res.eval_js, eval_it);
  /// TODO got and resume_workflow - use localStorage
  if (res.goto) {
    if (!isWeb) {
      const next = new URL(res.goto, "http://localhost");
      const pathname = next.pathname;
      if (pathname.startsWith("/view/") || pathname.startsWith("/page/")) {
        const route = `get${pathname}${next.search ? "?" + next.search : ""}`;
        await parent.saltcorn.mobileApp.navigation.handleRoute(route);
      } else parent.cordova.InAppBrowser.open(res.goto, "_system"); // TODO
    } else if (res.target === "_blank") window.open(res.goto, "_blank").focus();
    else {
      const prev = new URL(window.location.href);
      const next = new URL(res.goto, prev.origin);
      window.location.href = res.goto;
      if (
        prev.origin === next.origin &&
        prev.pathname === next.pathname &&
        prev.searchParams.toString() === next.searchParams.toString() &&
        next.hash !== prev.hash
      )
        location.reload();
    }
  }
  if (res.resume_workflow) {
    ajax_post_json(`/actions/resume-workflow/${res.resume_workflow}`, {});
  }
  if (res.reload_page) {
    (isWeb ? location : parent).reload(); //TODO notify to cookie if reload or goto
  }
}

function reloadEmbeddedEditOwnViews(form, id) {
  form.find("div[sc-load-on-assign-id]").each(function () {
    const $e = $(this);
    const viewname = $e.attr("sc-load-on-assign-id");
    const newUrl = `/view/${viewname}?id=${id}`;
    $.ajax(newUrl, {
      headers: {
        pjaxpageload: "true",
        localizedstate: "true", //no admin bar
      },
      success: function (res, textStatus, request) {
        const newE = `<div class="d-inline" data-sc-embed-viewname="${viewname}" data-sc-view-source="${newUrl}">${res}</div>`;
        $e.replaceWith(newE);
        initialize_page();
      },
      error: function (res) {
        if (!checkNetworkError(res))
          notifyAlert({ type: "danger", text: res.responseText });
      },
    });
  });
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
  var formAction = form.getAttribute("action");
  form.setAttribute("action", "javascript:void(0)");
  form.submit();
  form.setAttribute("action", formAction);
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
  $.ajax(`/notifications/count-unread`)
    .then((resp) => {
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
    })
    .fail(checkNetworkError);
}

function disable_inactive_tab_inputs(id) {
  setTimeout(() => {
    const isAccordion = $(`#${id}`).hasClass("accordion");
    const iterElem = isAccordion
      ? `#${id} div.accordion-item .accordion-button`
      : `#${id} li a`;
    $(iterElem).each(function () {
      const isActive = isAccordion
        ? !$(this).hasClass("collapsed")
        : $(this).hasClass("active");
      const target = isAccordion
        ? $(this).attr("data-bs-target")
        : $(this).attr("href");
      if (isActive) {
        //activate previously disabled
        $(target)
          .find("[disabled-by-tab]")
          .prop("disabled", false)
          .removeAttr("disabled-by-tab");
      } else {
        //disable all input
        $(target)
          .find(
            "input:not(:disabled), textarea:not(:disabled), button:not(:disabled), select:not(:disabled)"
          )
          .prop("disabled", true)
          .attr("disabled-by-tab", "1");
      }
    });
  }, 100);
}

function set_readonly_select(e) {
  if (!e.target) return;
  const $e = $(e.target);
  if ($e.attr("type") !== "hidden") return;
  const $disp = $e.prev();
  const optionsS = decodeURIComponent(
    $disp.attr("data-readonly-select-options")
  );
  if (!optionsS) return;
  const options = JSON.parse(optionsS);
  const option = options.find((o) => o.value == e.target.value);
  if (option) $disp.val(option.label);
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

let _sc_currently_reloading;

function reload_embedded_view(viewname, new_query_string) {
  const isNode = getIsNode();
  const updater = ($e, res) => {
    const localState = $e.attr("data-sc-local-state");
    const parent = $e.parent();
    $e.replaceWith(res);
    if (localState && !new_query_string) {
      const newE = parent.find(`[data-sc-embed-viewname="${viewname}"]`);
      newE.attr("data-sc-local-state", localState);
    }
    initialize_page();
  };
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
    if (isNode) {
      if (url === _sc_currently_reloading) return;
      _sc_currently_reloading = url;
      $.ajax(url, {
        headers: {
          pjaxpageload: "true",
          localizedstate: "true", //no admin bar
        },
        success: function (res, textStatus, request) {
          _sc_currently_reloading = null;
          updater($e, res);
        },
        error: function (res) {
          _sc_currently_reloading = null;
          if (!checkNetworkError(res))
            notifyAlert({ type: "danger", text: res.responseText });
        },
      });
    } else {
      runUrl(url).then((html) => {
        updater($e, html);
      });
    }
  });
}

function update_time_of_week(nm) {
  return function () {
    const day = $(`#input${nm}__day`).val();
    const flat = document.querySelector(`#input${nm}__time`)._flatpickr;

    const time = flat.selectedDates?.[0];
    let s;
    if (time) {
      const m = time.getMinutes();

      s = `${day} ${time.getHours()} ${m < 10 ? `0${m}` : m}`;
    } else s = day;
    $(`#inputh${nm}`).val(s).trigger("change");
  };
}

function select_by_view_click(element, event, required, multiple) {
  const isAlreadySelected = $(element).hasClass("selected");
  $(element)
    .closest(".select-by-view-container")
    .find(".select-by-view-option")
    .removeClass("selected");
  if (!required && isAlreadySelected) {
    $(element)
      .closest(".select-by-view-container")
      .find("input[type=hidden]")
      .val("")
      .trigger("change");
  } else {
    $(element).addClass("selected");
    $(element)
      .closest(".select-by-view-container")
      .find("input[type=hidden]")
      .val($(element).attr("data-id"))
      .trigger("change");
  }
}

function restrict_options(selector, restriction) {
  $(selector)
    .find("option")
    .each(function () {
      const $o = $(this);
      const val = $o.val();
      if (Array.isArray(restriction))
        if (val && !restriction.find((rid) => rid == val)) $o.remove();
    });
}

function handle_identical_fields(event) {
  let form = null;
  if (event.currentTarget.tagName === "FORM") form = event.currentTarget;
  else form = $(event.currentTarget).closest("form")[0];
  if (!form) {
    console.warn("No form found");
  } else {
    const name = event.target.name;
    const newValue = event.target.value;
    const tagName = event.target.tagName;
    const isRadio = event.target.type === "radio";
    if (tagName === "SELECT" || isRadio) {
      form.querySelectorAll(`select[name="${name}"]`).forEach((select) => {
        $(select).val(newValue); //.trigger("change");
      });
      form
        .querySelectorAll(`input[type="radio"][name="${name}"]`)
        .forEach((input) => {
          input.checked = input.value === newValue;
        });
    } else if (tagName === "INPUT") {
      form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
        input.value = newValue;
      });
    }
  }
}

const observer = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = entry.target.getAttribute("data-animate-delay"); // delay is optional
        const duration = entry.target.getAttribute("data-animate-duration"); // delay is optional
        const animationClass = entry.target.getAttribute("data-animate");
        if (animationClass) {
          if (delay) entry.target.style.animationDelay = delay + "s";
          if (duration) entry.target.style.animationDuration = duration + "s";
          entry.target.style.animationName = animationClass;
          entry.target.style.animationFillMode = "both";
        }

        if (entry.target.getAttribute("data-animate-initial-hide") === "")
          entry.target.removeAttribute("data-animate-initial-hide");

        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
  }
);

document.querySelectorAll("[data-animate]").forEach((element) => {
  observer.observe(element);
});
