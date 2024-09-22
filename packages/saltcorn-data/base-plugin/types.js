/**
 * Embedded Types definition.
 *
 * More types can be added by plugin store mechanism https://store.saltcorn.com/
 * @category saltcorn-data
 * @module base-plugin/types
 * @subcategory base-plugin
 */

const moment = require("moment");
const {
  input,
  select,
  option,
  text,
  div,
  h3,
  a,
  i,
  button,
  textarea,
  span,
  img,
  text_attr,
  label,
  script,
  optgroup,
  domReady,
  section,
  pre,
  code,
  style,
  time,
} = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");
const { radio_group, checkbox_group } = require("@saltcorn/markup/helpers");
const { getState } = require("../db/state");
const { localeDate, localeDateTime } = require("@saltcorn/markup");
const { freeVariables, eval_expression } = require("../models/expression");
const Table = require("../models/table");
const User = require("../models/user");
const _ = require("underscore");
const { interpolate } = require("../utils");
const { sqlFun, sqlBinOp } = require("@saltcorn/db-common/internal");

const isdef = (x) => (typeof x === "undefined" || x === null ? false : true);

const eqStr = (x, y) => `${x}` === `${y}`;

const or_if_undefined = (x, def) => (typeof x === "undefined" ? def : x);

const number_slider = (type) => ({
  configFields: (field) => [
    ...(!isdef(field.attributes.min)
      ? [{ name: "min", type, required: false }]
      : []),
    ...(!isdef(field.attributes.max)
      ? [{ name: "max", type, required: false }]
      : []),
  ],
  isEdit: true,
  description: "Input on a slider between defined maximum and minimum values",
  blockDisplay: true,
  run: (nm, v, attrs = {}, cls, required, field) =>
    input({
      type: "range",
      class: ["form-control", cls],
      name: text_attr(nm),
      "data-fieldname": text_attr(field.name),
      disabled: attrs.disabled,
      readonly: attrs.readonly,
      onChange: attrs.onChange,
      step:
        type === "Integer"
          ? 1
          : attrs.decimal_places
          ? Math.pow(10, -attrs.decimal_places)
          : "0.01",
      id: `input${text_attr(nm)}`,
      ...(isdef(attrs.max) && { max: attrs.max }),
      ...(isdef(attrs.min) && { min: attrs.min }),
      ...(isdef(v) && { value: text_attr(v) }),
    }),
});
const range_interval = (type) => ({
  configFields: (field) => [
    ...(!isdef(field.attributes.min)
      ? [{ name: "min", type, required: false }]
      : []),
    ...(!isdef(field.attributes.max)
      ? [{ name: "max", type, required: false }]
      : []),
  ],
  isEdit: false,
  isFilter: true,
  blockDisplay: true,
  description:
    "User can pick filtered interval by moving low and high controls on a slider.",
  /* https://stackoverflow.com/a/31083391 */
  run: (nm, v, attrs = {}, cls, required, field, state = {}) => {
    return section(
      { class: ["range-slider", cls] },
      span({ class: "rangeValues" }),
      input({
        ...(isdef(state[`_gte_${nm}`])
          ? {
              value: text_attr(state[`_gte_${nm}`]),
            }
          : isdef(attrs.min)
          ? { value: text_attr(attrs.min) }
          : {}),
        ...(isdef(attrs.max) && { max: attrs.max }),
        ...(isdef(attrs.min) && { min: attrs.min }),
        type: "range",
        disabled: attrs.disabled,
        readonly: attrs.readonly,
        onChange: `set_state_field('_gte_${nm}', this.value, this)`,
      }),
      input({
        ...(isdef(state[`_lte_${nm}`])
          ? {
              value: text_attr(state[`_lte_${nm}`]),
            }
          : isdef(attrs.max)
          ? { value: text_attr(attrs.max) }
          : {}),
        ...(isdef(attrs.max) && { max: attrs.max }),
        ...(isdef(attrs.min) && { min: attrs.min }),
        type: "range",
        disabled: attrs.disabled,
        readonly: attrs.readonly,
        onChange: `set_state_field('_lte_${nm}', this.value, this)`,
      })
    );
  },
});

const none_available = (required) =>
  required
    ? div(
        { class: "alert alert-danger", role: "alert" },
        i({ class: "fas fa-exclamation-triangle" }),
        "This input is required but there are no available options."
      )
    : i("None available");

const progress_bar = (type) => ({
  configFields: (field) => [
    { name: "max_min_formula", type: "Bool", label: "Max/min Formula" },
    ...(!isdef(field.attributes.min)
      ? [
          {
            name: "min",
            label: "Min",
            type,
            required: true,
            showIf: { max_min_formula: false },
          },
        ]
      : []),
    ...(!isdef(field.attributes.max)
      ? [
          {
            name: "max",
            label: "Max",
            type,
            required: true,
            showIf: { max_min_formula: false },
          },
        ]
      : []),
    {
      name: "min_formula",
      label: "Min formula",
      type: "String",
      class: "validate-expression",
      showIf: { max_min_formula: true },
    },
    {
      name: "max_formula",
      label: "Max formula",
      type: "String",
      class: "validate-expression",
      showIf: { max_min_formula: true },
    },

    { name: "bar_color", type: "Color", label: "Bar color" },
    { name: "bg_color", type: "Color", label: "Background color" },
    { name: "px_height", type: "Integer", label: "Height in px" },
    { name: "radial", type: "Bool", label: "Radial" },
    {
      name: "show_label",
      type: "Bool",
      label: "Show value",
      showif: { radial: true },
    },
  ],
  isEdit: false,
  description:
    "Show value as a percentage filled on a horizontal or radial progress bar",
  run: (v, req, attrs = {}) => {
    let max = attrs.max;
    let min = attrs.min;
    if (attrs.max_min_formula && attrs.min_formula && attrs.row)
      min = eval_expression(
        attrs.min_formula,
        attrs.row,
        req.user,
        "Progress bar min formula"
      );
    if (attrs.max_min_formula && attrs.max_formula && attrs.row)
      max = eval_expression(
        attrs.max_formula,
        attrs.row,
        req.user,
        "Progress bar max formula"
      );
    if (typeof v !== "number") return "";
    const pcnt = Math.round((100 * (v - min)) / (max - min));
    if (attrs?.radial) {
      const valShow =
        typeof v !== "number"
          ? ""
          : (attrs?.decimal_places
              ? v.toFixed(attrs?.decimal_places)
              : Math.round(v)) + (attrs.max == "100" ? `%` : "");
      return (
        div({
          class: [
            "progress-bar progress-bar-radial",
            `progress-bar-radial-${pcnt}`,
          ],
          style: {
            height: `${attrs.px_height || 100}px`,
            width: `${attrs.px_height || 100}px`,
            borderRadius: "50%",
            background:
              `radial-gradient(closest-side, white 79%, transparent 80% 100%),` +
              `conic-gradient(${attrs.bar_color || "#0000ff"} ${pcnt}%, ${
                attrs.bg_color || "#777777"
              } 0);`,
          },
        }) +
        (attrs.show_label === false
          ? ""
          : style(
              `.progress-bar-radial-${pcnt}::before { content: "${valShow}"; }`
            ))
      );
    } else
      return div(
        {
          class: "progress",
          role: "progress-bar",
          style: {
            height: `${attrs.px_height || 8}px`,
            backgroundColor: attrs.bg_color || "#777777",
          },
        },
        div({
          class: "progress-bar",
          style: {
            width: `${(100 * (v - attrs.min)) / (attrs.max - attrs.min)}%`,
            height: `${attrs.px_height || 8}px`,
            backgroundColor: attrs.bar_color || "#0000ff",
          },
        })
      );
  },
});

const show_with_html = {
  configFields: [
    {
      input_type: "code",
      name: "code",
      label: "HTML",
      sublabel: "Access the value with <code>{{ it }}</code>.",
      default: "",
      attributes: { mode: "text/html" },
    },
  ],
  isEdit: false,
  description: "Show value with any HTML code",
  run: (v, req, attrs = {}) => {
    const rendered = interpolate(attrs?.code, { it: v }, req?.user);
    return rendered;
  },
};

const heat_cell = (type) => ({
  configFields: (field) => [
    { name: "max_min_formula", type: "Bool", label: "Max/min Formula" },
    ...(!isdef(field.attributes.min)
      ? [
          {
            name: "min",
            label: "Min",
            type,
            required: true,
            showIf: { max_min_formula: false },
          },
        ]
      : []),
    ...(!isdef(field.attributes.max)
      ? [
          {
            name: "max",
            label: "Max",
            type,
            required: true,
            showIf: { max_min_formula: false },
          },
        ]
      : []),
    {
      name: "min_formula",
      label: "Min formula",
      type: "String",
      class: "validate-expression",
      showIf: { max_min_formula: true },
    },
    {
      name: "max_formula",
      label: "Max formula",
      type: "String",
      class: "validate-expression",
      showIf: { max_min_formula: true },
    },

    {
      name: "color_scale",
      type: "String",
      label: "Color scale",
      required: true,
      attributes: { options: ["RedAmberGreen", "Rainbow", "WhiteToRed"] },
    },
    { name: "reverse", type: "Bool", label: "Reverse color scale" },
    { name: "em_height", type: "Integer", label: "Height in em", default: 1.5 },
  ],
  isEdit: false,
  description: "Set background color on according to value on a color scale",
  run: (v, req, attrs = {}) => {
    let max = attrs.max;
    let min = attrs.min;
    if (attrs.max_min_formula && attrs.min_formula && attrs.row)
      min = eval_expression(
        attrs.min_formula,
        attrs.row,
        req.user,
        "Heat cell min formula"
      );
    if (attrs.max_min_formula && attrs.max_formula && attrs.row)
      max = eval_expression(
        attrs.max_formula,
        attrs.row,
        req.user,
        "Heat cell max formula"
      );
    if (typeof v !== "number") return "";
    const pcnt0 = (v - min) / (max - min);
    const pcnt = attrs.reverse ? 1 - pcnt0 : pcnt0;
    const backgroundColor = {
      Rainbow: `hsl(${360 * pcnt},100%, 50%)`,
      RedAmberGreen: `hsl(${100 * pcnt},100%, 50%)`,
      WhiteToRed: `hsl(0,100%, ${100 * (1 - pcnt / 2)}%)`,
    }[attrs.color_scale];

    function getLuminance(hexColor) {
      const r = parseInt(hexColor.substr(1, 2), 16) / 255;
      const g = parseInt(hexColor.substr(3, 2), 16) / 255;
      const b = parseInt(hexColor.substr(5, 2), 16) / 255;

      const a = [r, g, b].map((v) => {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });

      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function hslToHex(h, s, l) {
      l /= 100;
      const a = (s * Math.min(l, 1 - l)) / 100;
      const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
          .toString(16)
          .padStart(2, "0"); // convert to Hex and prefix "0" if needed
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    }

    const [h, s, l] = backgroundColor.match(/\d+/g).map(Number);
    const hexColor = hslToHex(h, s, l);
    const luminance = getLuminance(hexColor);

    const textColor = luminance > 0.5 ? "#000000" : "#FFFFFF";

    return div(
      {
        class: "px-2",
        style: {
          width: "100%",
          height: `${attrs.em_height || 1}em`,
          backgroundColor,
          color: textColor,
        },
      },
      text(v)
    );
  },
});

const number_limit = (direction) => ({
  isEdit: false,
  isFilter: true,
  blockDisplay: true,
  configFields: [
    { name: "stepper_btns", label: "Stepper buttons", type: "Bool" },
  ],
  run: (nm, v, attrs = {}, cls, required, field, state = {}) => {
    const onChange = `set_state_field('_${direction}_${nm}', this.value, this)`;
    return attrs?.stepper_btns
      ? number_stepper(
          undefined,
          isdef(state[`_${direction}_${nm}`])
            ? text_attr(state[`_${direction}_${nm}`])
            : undefined,
          {
            ...attrs,
            onChange: `set_state_field('_${direction}_${nm}', $('#numlim_${nm}_${direction}').val(), this)`,
          },
          cls,
          undefined,
          `numlim_${nm}_${direction}`
        )
      : input({
          type: "number",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          onChange,
          step: 1,
          ...(isdef(attrs.max) && { max: attrs.max }),
          ...(isdef(attrs.min) && { min: attrs.min }),
          ...(isdef(state[`_${direction}_${nm}`]) && {
            value: text_attr(state[`_${direction}_${nm}`]),
          }),
        });
  },
});

const float_number_limit = (direction) => ({
  isEdit: false,
  isFilter: true,
  blockDisplay: true,
  run: (nm, v, attrs = {}, cls, required, field, state = {}) =>
    input({
      type: "number",
      class: ["form-control", cls],
      disabled: attrs.disabled,
      readonly: attrs.readonly,
      onChange: `set_state_field('_${direction}_${nm}', this.value, this)`,
      step: attrs.decimal_places ? Math.pow(10, -attrs.decimal_places) : "0.01",
      ...(isdef(attrs.max) && { max: attrs.max }),
      ...(isdef(attrs.min) && { min: attrs.min }),
      ...(isdef(state[`_${direction}_${nm}`]) && {
        value: text_attr(state[`_${direction}_${nm}`]),
      }),
    }),
});

const number_stepper = (name, v, attrs, cls, fieldname, id) =>
  div(
    { class: "input-group" },
    button(
      {
        class: "btn btn-outline-secondary",
        type: "button",
        onClick: `$(this).next().val(Math.max(${
          isdef(attrs.min) ? attrs.min : "-Infinity"
        },+$(this).next().val()-1)).trigger('change');${attrs.onChange || ""}`,
      },
      i({ class: "fas fa-minus" })
    ),
    input({
      type: "number",
      class: ["form-control", "hideupdownbtns", cls],
      disabled: attrs.disabled,
      readonly: attrs.readonly,
      "data-fieldname": fieldname,
      name,
      onChange: attrs.onChange,
      id,
      step: "1",
      ...(isdef(attrs.max) && { max: attrs.max }),
      ...(isdef(attrs.min) && { min: attrs.min }),
      ...(isdef(v) && { value: text_attr(v) }),
    }),
    button(
      {
        class: "btn btn-outline-secondary",
        type: "button",
        onClick: `$(this).prev().val(Math.min(${
          isdef(attrs.max) ? attrs.max : "Infinity"
        },+$(this).prev().val()+1)).trigger('change');${attrs.onChange || ""}`,
      },
      i({ class: "fas fa-plus" })
    )
  );

/**
 * @param {string} v
 * @param {string} optsStr
 * @returns {string[]}
 */
const getStrOptions = (v, optsStr, exclude_values_string) => {
  const exclude_values = exclude_values_string
    ? new Set(
        exclude_values_string
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      )
    : new Set([]);
  return typeof optsStr === "string"
    ? optsStr
        .split(",")
        .map((o) => o.trim())
        .filter((o) => eqStr(v, o) || !exclude_values.has(o))
        .map((o) =>
          option(
            { value: text_attr(o), ...(eqStr(v, o) && { selected: true }) },
            text_attr(o)
          )
        )
    : optsStr.map((o, ix) =>
        o?.optgroup
          ? optgroup(
              { label: o.label },
              o.options.map((oi) =>
                option(
                  {
                    selected: v == or_if_undefined(oi.value, oi),
                    value: or_if_undefined(oi.value, oi),
                  },
                  or_if_undefined(oi.label, oi)
                )
              )
            )
          : o && typeof o.name !== "undefined" && typeof o.label !== "undefined"
          ? option(
              {
                value: o.name,
                ...((eqStr(v, o.name) ||
                  (ix === 0 && typeof v === "undefined" && o.disabled)) && {
                  selected: true,
                }),
                ...(o.disabled && { disabled: true }),
              },
              o.label
            )
          : option({ value: o, ...(eqStr(v, o) && { selected: true }) }, o)
      );
};
const join_fields_in_formula = (fml) => {
  if (!fml) return [];
  return [...freeVariables(fml)];
};

const to_locale_string = {
  description: "Show as in locale-sensitive representation",
  configFields: (field) => [
    {
      type: "String",
      name: "locale",
      label: "Locale",
      sublabel: "Blank for default user locale",
    },
    {
      type: "String",
      name: "style",
      label: "Style",
      required: true,
      attributes: {
        options: ["decimal", "currency", "percent", "unit"],
      },
    },
    {
      type: "Integer",
      name: "maximumFractionDigits",
      label: "Max Fraction Digits",
      attributes: {
        min: 0,
      },
    },
    {
      type: "Integer",
      name: "maximumSignificantDigits",
      label: "Max Significant Digits",
      attributes: {
        min: 0,
      },
    },
    {
      type: "String",
      name: "currency",
      label: "Currency",
      sublabel: "ISO 4217. Example: USD or EUR",
      required: true,
      showIf: { style: "currency" },
    },
    {
      type: "String",
      name: "currencyDisplay",
      label: "Currency display",
      required: true,
      showIf: { style: "currency" },
      attributes: {
        options: ["symbol", "code", "narrrowSymbol", "name"],
      },
    },
    {
      type: "String",
      name: "unit",
      label: "Unit",
      required: true,
      showIf: { style: "unit" },
      attributes: {
        options: [
          "acre",
          "bit",
          "byte",
          "celsius",
          "centimeter",
          "day",
          "degree",
          "fahrenheit",
          "fluid-ounce",
          "foot",
          "gallon",
          "gigabit",
          "gigabyte",
          "gram",
          "hectare",
          "hour",
          "inch",
          "kilobit",
          "kilobyte",
          "kilogram",
          "kilometer",
          "liter",
          "megabit",
          "megabyte",
          "meter",
          "microsecond",
          "mile",
          "mile-scandinavian",
          "milliliter",
          "millimeter",
          "millisecond",
          "minute",
          "month",
          "nanosecond",
          "ounce",
          "percent",
          "petabyte",
          "pound",
          "second",
          "stone",
          "terabit",
          "terabyte",
          "week",
          "yard",
          "year",
        ],
      },
    },
    {
      type: "String",
      name: "unitDisplay",
      label: "Unit display",
      required: true,
      showIf: { style: "unit" },
      attributes: {
        options: ["short", "narrow", "long"],
      },
    },
  ],
  isEdit: false,
  run: (v, req, attrs = {}) => {
    const v1 = typeof v === "string" ? +v : v;
    if (typeof v1 === "number") {
      const locale_ = attrs.locale || locale(req);
      return v1.toLocaleString(locale_, {
        style: attrs.style,
        currency: attrs.currency,
        currencyDisplay: attrs.currencyDisplay,
        unit: attrs.unit,
        unitDisplay: attrs.unitDisplay,
        maximumSignificantDigits: attrs.maximumSignificantDigits,
        maximumFractionDigits: attrs.maximumFractionDigits,
      });
    } else return "";
  },
};

/**
 * string type
 * @namespace
 * @category saltcorn-data
 * @subcategory types / string
 */
const string = {
  /** @type {string} */
  name: "String",
  description: "A sequence of unicode characters of any length.",
  /** @type {string} */
  sql_name: "text",
  js_type: "string",

  /**
   * @param {object} param
   * @returns {object}
   */
  attributes: ({ table }) => {
    const strFields =
      table &&
      table.fields.filter(
        (f) =>
          (f.type || {}).name === "String" &&
          !(f.attributes && f.attributes.localizes_field)
      );
    const locales = Object.keys(
      getState().getConfig("localizer_languages", {})
    );
    return [
      {
        name: "options",
        label: "Options",
        type: "String",
        required: false,
        sublabel:
          'Use this to restrict your field to a list of options (separated by commas). For instance, enter <kbd class="fst-normal">Red, Green, Blue</kbd> here if the permissible values are Red, Green and Blue. Leave blank if the string can hold any value.',
      },
      {
        name: "min_length",
        label: "Min length",
        type: "Integer",
        required: false,
        sublabel: "The minimum number of characters in the string",
        attributes: { asideNext: true },
      },
      {
        name: "max_length",
        label: "Max length",
        type: "Integer",
        required: false,
        sublabel: "The maximum number of characters in the string",
      },
      {
        name: "regexp",
        type: "String",
        label: "Regular expression",
        required: false,
        sublabel: "String value must match regular expression",
        validator(s) {
          if (!is_valid_regexp(s)) return "Not a valid Regular Expression";
        },
        attributes: { asideNext: true },
      },
      {
        name: "re_invalid_error",
        label: "Error message",
        type: "String",
        required: false,
        sublabel: "Error message when regular expression does not match",
      },

      ...(table
        ? [
            {
              name: "localizes_field",
              label: "Translation of",
              sublabel:
                "This is a translation of a different field in a different language",
              type: "String",
              attributes: {
                options: strFields.map((f) => f.name),
              },
            },
            {
              name: "locale",
              label: "Locale",
              sublabel: "Language locale of translation",
              input_type: "select",
              options: locales,
              showIf: { localizes_field: strFields.map((f) => f.name) },
            },
          ]
        : []),
    ];
  },
  /**
   * @param {object} opts
   * @param {string|undefined} opts.options
   * @returns {boolean}
   */
  contract: ({ options }) =>
    typeof options === "string"
      ? is.one_of(options.split(","))
      : typeof options === "undefined"
      ? is.str
      : is.one_of(options.map((o) => (typeof o === "string" ? o : o.name))),
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / string
   */
  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    as_text: {
      isEdit: false,
      description: "Show the value with no other formatting",
      run: (s) => text_attr(s || ""),
    },
    preFormatted: {
      isEdit: false,
      description: "Pre-formatted (in a &lt;pre&gt; tag)",
      run: (s) =>
        s ? span({ style: "white-space:pre-wrap" }, text_attr(s || "")) : "",
    },
    code: {
      isEdit: false,
      description: "Show as a code block",
      run: (s) => (s ? pre(code(text_attr(s || ""))) : ""),
    },
    monospace_block: {
      isEdit: false,
      configFields: [
        {
          name: "max_init_height",
          label: "Max initial rows",
          sublabel: "Only show this many rows until the user clicks",
          type: "Integer",
        },
        { name: "copy_btn", label: "Copy button", type: "Bool" },
      ],
      description: "Show as a monospace block",
      run: (s, req, attrs = {}) => {
        if (!s) return "";
        const copy_btn = attrs.copy_btn
          ? button(
              {
                class:
                  "btn btn-secondary btn-sm monospace-copy-btn m-1 d-none-prefer",
                onclick: "copy_monospace_block(this)",
              },
              i({ class: "fas fa-copy" })
            )
          : "";
        if (!attrs.max_init_height)
          return (
            copy_btn +
            pre(
              {
                class: "monospace-block",
              },
              s
            )
          );
        const lines = s.split("\n");

        if (lines.length <= attrs.max_init_height)
          return (
            copy_btn +
            pre(
              {
                class: "monospace-block",
              },
              s
            )
          );
        return (
          copy_btn +
          pre(
            {
              class: "monospace-block",
              onclick: `monospace_block_click(this)`,
            },
            lines.slice(0, attrs.max_init_height).join("\n") + "\n..."
          ) +
          pre({ class: "d-none" }, s)
        );
      },
    },
    ellipsize: {
      isEdit: false,
      configFields: [
        {
          name: "nchars",
          label: "Number of characters",
          type: "Integer",
          default: 20,
        },
      ],
      description:
        "Show First N characters of text followed by ... if truncated",
      run: (s, req, attrs = {}) => {
        if (!s || !s.length) return "";
        if (s.length <= (attrs.nchars || 20)) return text_attr(s);
        return text_attr(s.substr(0, (attrs.nchars || 20) - 3)) + "...";
      },
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    as_link: {
      configFields: [
        {
          name: "link_title",
          label: "Link title",
          type: "String",
          sublabel: "Optional. If blank, label is URL",
        },
      ],
      description: "Show a link with the field value as the URL.",
      isEdit: false,
      run: (s, req, attrs = {}) =>
        s
          ? a({ href: text(s || "") }, text_attr(attrs?.link_title || s || ""))
          : "",
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    img_from_url: {
      isEdit: false,
      description: "Show an image from the URL in the field value",
      run: (s, req, attrs) => img({ src: text(s || ""), style: "width:100%" }),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    as_header: {
      isEdit: false,
      description: "Show this as a header",

      run: (s) => h3(text_attr(s || "")),
    },
    show_with_html,
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    edit: {
      isEdit: true,
      blockDisplay: true,
      description:
        "edit with a standard text input, or dropdown if field has options",
      configFields: (field) => [
        ...(field.attributes.options &&
        field.attributes.options.length > 0 &&
        !field.required
          ? [
              {
                name: "neutral_label",
                label: "Neutral label",
                type: "String",
              },
              {
                name: "force_required",
                label: "Required",
                sublabel:
                  "User must select a value, even if the table field is not required",
                type: "Bool",
              },
            ]
          : []),
        ...(field.attributes.options && field.attributes.options.length > 0
          ? [
              {
                name: "exclude_values",
                label: "Exclude values",
                sublabel:
                  "Comma-separated list of value to exclude from the dropdown select",
                type: "String",
              },
            ]
          : []),
        {
          name: "placeholder",
          label: "Placeholder",
          type: "String",
        },
        {
          name: "input_type",
          label: "Input type",
          input_type: "select",
          options: ["text", "email", "url", "tel", "password", "hidden"],
        },
        {
          name: "autofocus",
          label: "Autofocus",
          type: "Bool",
        },
        {
          name: "readonly",
          label: "Read-only",
          type: "Bool",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        attrs.options && (attrs.options.length > 0 || !required)
          ? attrs.readonly
            ? input({
                type: "text",
                class: ["form-control", "form-select", cls],
                name: text_attr(nm),
                "data-fieldname": text_attr(field.name),
                id: `input${text_attr(nm)}`,
                onChange: attrs.onChange,
                readonly: attrs.readonly,
                value: v,
              })
            : select(
                {
                  class: [
                    "form-control",
                    "form-select",
                    cls,
                    attrs.selectizable ? "selectizable" : false,
                  ],
                  name: text_attr(nm),
                  "data-fieldname": text_attr(field.name),
                  id: `input${text_attr(nm)}`,
                  disabled: attrs.disabled,
                  onChange: attrs.onChange,
                  onBlur: attrs.onChange,
                  autocomplete: "off",
                  required:
                    attrs.placeholder && (required || attrs.force_required),
                },
                attrs.placeholder && (required || attrs.force_required)
                  ? [
                      option(
                        { value: "", disabled: true, selected: !v },
                        attrs.placeholder
                      ),
                      ...getStrOptions(v, attrs.options, attrs.exclude_values),
                    ]
                  : required || attrs.force_required
                  ? getStrOptions(v, attrs.options, attrs.exclude_values)
                  : [
                      option({ value: "" }, attrs.neutral_label || ""),
                      ...getStrOptions(v, attrs.options, attrs.exclude_values),
                    ]
              )
          : attrs.options
          ? none_available(required)
          : attrs.calcOptions
          ? select(
              {
                class: ["form-control", "form-select", cls],
                name: text_attr(nm),
                disabled: attrs.disabled,
                "data-fieldname": text_attr(field.name),
                id: `input${text_attr(nm)}`,
                onChange: attrs.onChange,
                onBlur: attrs.onChange,
                autocomplete: "off",
                "data-selected": v,
                "data-calc-options": encodeURIComponent(
                  JSON.stringify(attrs.calcOptions)
                ),
              },
              option({ value: "" }, "")
            )
          : input({
              type: attrs.input_type || "text",
              disabled: attrs.disabled,
              readonly: attrs.readonly,
              class: ["form-control", cls],
              placeholder: attrs.placeholder,
              onChange: attrs.onChange,
              "data-fieldname": text_attr(field.name),
              name: text_attr(nm),
              required: !!(required || attrs.force_required),
              maxlength: isdef(attrs.max_length) && attrs.max_length,
              minlength: isdef(attrs.min_length) && attrs.min_length,
              pattern: !!attrs.regexp && attrs.regexp,
              autofocus: !!attrs.autofocus,
              title:
                !!attrs.re_invalid_error &&
                !!attrs.regexp &&
                attrs.re_invalid_error,
              id: `input${text_attr(nm)}`,
              ...(isdef(v) && { value: text_attr(v) }),
            }),
    },
    fill_formula_btn: {
      isEdit: true,
      blockDisplay: true,
      description: "Input with a button prefills value from specified formula",
      configFields: [
        {
          name: "formula",
          label: "Formula",
          type: "String",
        },
        {
          name: "label",
          label: "Button label",
          type: "String",
        },
        {
          name: "make_unique",
          label: "Make unique after fill",
          type: "Bool",
        },
        {
          name: "include_space",
          label: "Include space",
          type: "Bool",
          showIf: { make_unique: true },
        },
        {
          name: "start_from",
          label: "Start from",
          type: "Integer",
          default: 0,
          showIf: { make_unique: true },
        },
        {
          name: "always_append",
          label: "Always append",
          type: "Bool",
          showIf: { make_unique: true },
        },
        {
          name: "char_type",
          label: "Append character type",
          input_type: "select",
          options: ["Digits", "Lowercase Letters", "Uppercase Letters"],
          showIf: { make_unique: true },
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        div(
          { class: "input-group" },
          input({
            type: attrs.input_type || "text",
            disabled: attrs.disabled,
            readonly: attrs.readonly,
            class: ["form-control", cls],
            placeholder: attrs.placeholder,
            onChange: attrs.onChange,
            "data-fieldname": text_attr(field.name),
            name: text_attr(nm),
            id: `input${text_attr(nm)}`,
            ...(isdef(v) && { value: text_attr(v) }),
          }),
          button(
            {
              class: "btn btn-secondary",
              type: "button",
              "data-formula": encodeURIComponent(attrs?.formula),
              "data-formula-free-vars": encodeURIComponent(
                JSON.stringify(join_fields_in_formula(attrs?.formula))
              ),
              "data-formula-table": encodeURIComponent(
                JSON.stringify(Table.findOne(field.table_id).to_json)
              ),
              onClick:
                "fill_formula_btn_click(this" +
                (attrs.make_unique
                  ? `,()=>make_unique_field('input${text_attr(nm)}', ${
                      field.table_id
                    }, '${field.name}',  $('#input${text_attr(
                      nm
                    )}'), ${!!attrs.include_space}, ${
                      attrs.start_from || 0
                    }, ${!!attrs.always_append}, '${attrs.char_type}')`
                  : "") +
                ")",
            },
            attrs?.label || "Fill"
          )
        ),
    },
    make_unique: {
      isEdit: true,
      blockDisplay: true,
      description: "Make this input unique in the database table",
      configFields: [
        {
          name: "placeholder",
          label: "Placeholder",
          type: "String",
        },
        {
          name: "input_type",
          label: "Input type",
          input_type: "select",
          options: ["text", "email", "url", "tel", "password"],
        },
        {
          name: "include_space",
          label: "Include space",
          type: "Bool",
        },
        {
          name: "start_from",
          label: "Start from",
          type: "Integer",
          default: 0,
        },
        {
          name: "always_append",
          label: "Always append",
          type: "Bool",
        },
        {
          name: "char_type",
          label: "Append character type",
          input_type: "select",
          options: ["Digits", "Lowercase Letters", "Uppercase Letters"],
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: attrs.input_type || "text",
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          class: ["form-control", cls],
          placeholder: attrs.placeholder,
          onChange: attrs.onChange,
          "data-fieldname": text_attr(field.name),
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && { value: text_attr(v) }),
        }) +
        script(
          domReady(
            `make_unique_field('input${text_attr(nm)}', ${field.table_id}, '${
              field.name
            }', $('#input${text_attr(nm)}'), ${attrs.include_space}, ${
              attrs.start_from
            }, ${attrs.always_append}, ${JSON.stringify(attrs.char_type)})`
          )
        ),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    textarea: {
      isEdit: true,
      blockDisplay: true,
      description: "Edit as a text area (multi line input)",
      configFields: [
        {
          type: "Bool",
          name: "spellcheck",
          label: "Spellcheck",
        },
        {
          type: "Integer",
          name: "rows",
          label: "Rows",
        },
        {
          name: "placeholder",
          label: "Placeholder",
          type: "String",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        textarea(
          {
            class: ["form-control", cls],
            name: text_attr(nm),
            "data-fieldname": text_attr(field.name),
            disabled: attrs.disabled,
            onChange: attrs.onChange,
            readonly: attrs.readonly,
            placeholder: attrs.placeholder,
            spellcheck: attrs.spellcheck === false ? "false" : undefined,
            required: !!required,
            maxlength: isdef(attrs.max_length) && attrs.max_length,
            minlength: isdef(attrs.min_length) && attrs.min_length,
            id: `input${text_attr(nm)}`,
            rows: attrs.rows || 5,
          },
          text(v) || ""
        ),
    },
    code_editor: {
      isEdit: true,
      blockDisplay: true,
      description: "Edit as code",
      configFields: [
        {
          type: "String",
          name: "mode",
          label: "mode",
          required: true,
          attributes: {
            options: [
              "application/javascript",
              "text/html",
              "text/css",
              "text/x-sql",
            ],
          },
        },
        /*{
          type: "Integer",
          name: "rows",
          label: "Rows",
        },*/
      ],
      run: (nm, v, attrs, cls, required, field) =>
        textarea(
          {
            class: ["form-control", "to-code", cls],
            name: text_attr(nm),
            "data-fieldname": text_attr(field.name),
            disabled: attrs.disabled,
            onChange: attrs.onChange,
            readonly: attrs.readonly,
            placeholder: attrs.placeholder,
            spellcheck: "false",
            required: !!required,
            maxlength: isdef(attrs.max_length) && attrs.max_length,
            minlength: isdef(attrs.min_length) && attrs.min_length,
            id: `input${text_attr(nm)}`,
            mode: attrs.mode,
          },
          text(v) || ""
        ),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    radio_group: {
      isEdit: true,
      configFields: [
        {
          type: "Bool",
          name: "inline",
          label: "Inline",
        },
      ],
      description: "Pick from a radio group. Field must have options",
      run: (nm, v, attrs, cls, required, field) =>
        attrs.options
          ? radio_group({
              class: cls,
              name: text_attr(nm),
              disabled: attrs.disabled,
              inline: attrs.inline,
              onChange: attrs.onChange,
              required: !!required,
              options: Array.isArray(attrs.options)
                ? attrs.options
                : attrs.options.split(",").map((o) => o.trim()),
              value: v,
            })
          : none_available(required),
    },
    checkbox_group: {
      isEdit: false,
      isFilter: true,
      description:
        "Filter from a checkbox group. Field must have options. Possible selections are treated as OR.",
      configFields: [
        {
          type: "Bool",
          name: "inline",
          label: "Inline",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        attrs && attrs.options
          ? checkbox_group({
              class: cls,
              name: text_attr(nm),
              disabled: attrs.disabled,
              inline: attrs.inline,
              options: Array.isArray(attrs.options)
                ? attrs.options
                : attrs.options.split(",").map((o) => o.trim()),
              value: v,
            })
          : i("None available"),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / string
     */
    password: {
      isEdit: true,
      blockDisplay: true,
      description: "Password input type, characters are hidden when typed",
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "password",
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),
          onChange: attrs.onChange,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  /**
   * @param {*} v
   * @returns {string|undefined}
   */
  read: (v) => {
    switch (typeof v) {
      case "string":
        //PG dislikes null bytes
        return v.replace(/\0/g, "");
      default:
        return undefined;
    }
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / string
   */
  presets: {
    /**
     * @param {object} opts
     * @param {object} opts.req
     * @returns {object}
     */
    IP: ({ req }) => req.ip,
    /**
     * @param {object} opts
     * @param {object} opts.req
     * @returns {object}
     */
    SessionID: ({ req }) => req.sessionID || req.cookies["express:sess"],
  },
  /**
   * @param {object} param
   * @returns {object|true}
   */
  validate:
    ({ min_length, max_length, regexp, re_invalid_error }) =>
    (x) => {
      if (!x || typeof x !== "string") return true; //{ error: "Not a string" };
      if (isdef(min_length) && x.length < min_length)
        return { error: `Must be at least ${min_length} characters` };
      if (isdef(max_length) && x.length > max_length)
        return { error: `Must be at most ${max_length} characters` };
      if (isdef(regexp) && !new RegExp(regexp).test(x))
        return {
          error: re_invalid_error || `Does not match regular expression`,
        };
      return true;
    },

  /**
   * @param {object} param
   * @returns {object}
   */
  validate_attributes: ({ min_length, max_length, regexp }) =>
    (!isdef(min_length) || !isdef(max_length) || max_length >= min_length) &&
    (!isdef(regexp) || is_valid_regexp(regexp)),
};

/**
 * @param {string} s
 * @returns {boolean}
 */
const is_valid_regexp = (s) => {
  try {
    new RegExp(s);
    return true;
  } catch {
    return false;
  }
};

/**
 * Integer type
 * @namespace
 * @category saltcorn-data
 * @subcategory types / int
 */
const int = {
  /** @type {string} */
  name: "Integer",
  description: "Whole numbers, positive and negative.",
  /** @type {string} */
  sql_name: "int",
  js_type: "number",

  /**
   * @param {object} opts
   * @param {number} opts.min
   * @param {number} opts.max
   * @returns {boolean}
   */
  contract: ({ min, max }) => is.integer({ lte: max, gte: min }),
  primaryKey: { sql_type: "serial" },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / int
   */
  distance_operators: { near: sqlFun("ABS", sqlBinOp("-", "target", "field")) },

  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / int
     */
    show: {
      isEdit: false,
      description: "Show value with no additional formatting.",
      run: (s) => text(s),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / int
     */
    edit: {
      isEdit: true,
      blockDisplay: true,
      description: "Number input, optionally with stepper.",
      configFields: [
        { name: "stepper_btns", label: "Stepper buttons", type: "Bool" },
        {
          name: "readonly",
          label: "Read-only",
          type: "Bool",
        },
        {
          name: "autofocus",
          label: "Autofocus",
          type: "Bool",
        },
      ],
      run: (nm, v, attrs, cls, required, field) => {
        const id = `input${text_attr(nm)}`;
        const name = text_attr(nm);
        return attrs?.stepper_btns
          ? number_stepper(name, v, attrs, cls, text_attr(field.name), id)
          : input({
              type: attrs?.type || "number",
              inputmode: attrs?.inputmode,
              pattern: attrs?.pattern,
              autocomplete: attrs?.autocomplete,
              class: ["form-control", cls],
              disabled: attrs.disabled,
              readonly: attrs.readonly,
              autofocus: attrs.autofocus,
              "data-fieldname": text_attr(field.name),
              name,
              onChange: attrs.onChange,
              id,
              step: "1",
              required: !!required,
              ...(isdef(attrs.max) && { max: attrs.max }),
              ...(isdef(attrs.min) && { min: attrs.min }),
              ...(isdef(v) && { value: text_attr(v) }),
            });
      },
    },
    number_slider: number_slider("Integer"),
    range_interval: range_interval("Integer"),
    progress_bar: progress_bar("Integer"),
    heat_cell: heat_cell("Integer"),
    above_input: number_limit("gte"),
    below_input: number_limit("lte"),
    show_with_html,
    show_star_rating: {
      description: "Show value as filled stars out of maximum.",
      configFields: (field) => [
        ...(!isdef(field.attributes.min)
          ? [{ name: "min", type: "Integer", required: true, default: 1 }]
          : []),
        ...(!isdef(field.attributes.max)
          ? [{ name: "max", type: "Integer", required: true, default: 5 }]
          : []),
      ],
      isEdit: false,
      blockDisplay: true,
      run: (v, req, attrs = {}) =>
        div(
          Array.from(
            { length: attrs.max - attrs.min + 1 },
            (_, i) => i + attrs.min
          ).map((starVal) =>
            i({
              class: "fas fa-star",
              style: { color: starVal <= v ? "#ffc107" : "#ddd" },
            })
          )
        ),
    },
    edit_star_rating: {
      description: "Input by clicking filled stars out of maximum.",
      configFields: (field) => [
        ...(!isdef(field.attributes.min)
          ? [{ name: "min", type: "Integer", required: true, default: 1 }]
          : []),
        ...(!isdef(field.attributes.max)
          ? [{ name: "max", type: "Integer", required: true, default: 5 }]
          : []),
      ],
      isEdit: true,
      blockDisplay: true,
      run: (nm, v, attrs = {}, cls, required, field, state = {}) => {
        //https://codepen.io/pezmotion/pen/RQERdm
        return div(
          { class: "editStarRating" },
          Array.from(
            { length: attrs.max - attrs.min + 1 },
            (_, i) => attrs.max - i
          ).map(
            (starVal) =>
              input({
                id: `input${text_attr(nm)}-${starVal}`,
                type: "radio",
                name: text_attr(nm),
                value: starVal,
                checked: v === starVal,
              }) +
              label(
                { for: `input${text_attr(nm)}-${starVal}` },
                i({ class: "fas fa-star" })
              )
          )
        );
      },
    },
    to_locale_string,
    role_select: {
      isEdit: true,
      blockDisplay: true,
      description: "Select a user role",
      fill_options: async (field) => {
        const roles = await User.get_roles();
        field.options = roles;
      },
      run: (nm, v, attrs, cls, required, field) => {
        return select(
          {
            class: [
              "form-control",
              "form-select",
              cls,
              attrs.selectizable ? "selectizable" : false,
            ],
            name: text_attr(nm),
            "data-fieldname": text_attr(field.name),
            id: `input${text_attr(nm)}`,
            disabled: attrs.disabled,
            onChange: attrs.onChange,
            onBlur: attrs.onChange,
            autocomplete: "off",
            required: true,
          },
          field.options.map(({ id, role }) =>
            option({ value: id, selected: v == id }, role)
          )
        );
      },
    },
  },
  /** @type {object[]}  */
  attributes: [
    { name: "min", label: "Minimum", type: "Integer", required: false },
    { name: "max", label: "Maximum", type: "Integer", required: false },
  ],
  /**
   * @param {object} param
   * @returns {boolean}
   */
  validate_attributes: ({ min, max }) =>
    !isdef(min) || !isdef(max) || max > min,
  /**
   * @param {object} v
   * @returns {object}
   */
  read: (v) => {
    switch (typeof v) {
      case "number":
        return Math.round(v);
      case "string":
        if (v === "") return undefined;
        const parsed = +v;
        return isNaN(parsed) ? undefined : parsed;
      default:
        return undefined;
    }
  },
  /**
   * @param {object} param
   * @returns {boolean}
   */
  validate:
    ({ min, max }) =>
    (x) => {
      if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
      if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
      return true;
    },
};

/**
 * Color Type
 * @namespace color
 * @category saltcorn-data
 * @subcategory types / color
 */
const color = {
  /** @type {string} */
  name: "Color",
  description: "Colors, defined as Red, Green and Blue with 256 level each",
  /** @type {string} */
  sql_name: "text",
  js_type: "string",

  /**
   * @returns {function}
   */
  contract: () => is.str,
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / color
   */
  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / color
     */
    show: {
      isEdit: false,
      description: "A box filled with the color",
      run: (s) =>
        s
          ? div({
              class: "color-type-show",
              style: `background: ${s};`,
            })
          : "",
    },
    show_with_html,
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / color
     */
    edit: {
      isEdit: true,
      blockDisplay: true,
      description: "Simple color picker",
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "color",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          onChange: attrs.onChange,
          "data-fieldname": text_attr(field.name),
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  /** @type {object[]} */
  attributes: [],
  /**
   * @param {object} v
   * @returns {object}
   */
  read: (v) => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
  /**
   * @returns {boolean}
   */
  validate: () => (x) => {
    return true;
  },
};

/**
 * Float type
 * @namespace
 * @category saltcorn-data
 * @subcategory types / float
 */
const float = {
  /** @type {string} */
  name: "Float",
  description: "Floating-point numbers",
  /** @type {string} */
  sql_name: "double precision",
  js_type: "number",

  /**
   * @param {object} opts
   * @param {number} opts.min
   * @param {number} opts.max
   * @returns {function}
   */
  contract: ({ min, max }) => is.number({ lte: max, gte: min }),

  distance_operators: { near: sqlFun("ABS", sqlBinOp("-", "target", "field")) },

  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / float
   */
  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / float
     */
    show: {
      isEdit: false,
      description: "Show number with no additional formatting",
      run: (s) => text(s),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / float
     */
    edit: {
      isEdit: true,
      blockDisplay: true,
      description: "Number input",
      configFields: [
        {
          name: "readonly",
          label: "Read-only",
          type: "Bool",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "number",
          class: ["form-control", cls],
          name: text_attr(nm),
          "data-fieldname": text_attr(field.name),
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          onChange: attrs.onChange,
          required: !!required,
          step: attrs.decimal_places
            ? Math.round(
                Math.pow(10, -attrs.decimal_places) *
                  Math.pow(10, attrs.decimal_places)
              ) / Math.pow(10, attrs.decimal_places)
            : "any",
          id: `input${text_attr(nm)}`,
          ...(isdef(attrs.max) && { max: attrs.max }),
          ...(isdef(attrs.min) && { min: attrs.min }),
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
    number_slider: number_slider("Float"),
    range_interval: range_interval("Float"),
    progress_bar: progress_bar("Float"),
    heat_cell: heat_cell("Float"),
    above_input: float_number_limit("gte"),
    below_input: float_number_limit("lte"),
    to_locale_string,
    show_with_html,
  },
  /** @type {object[]} */
  attributes: [
    { name: "min", type: "Float", required: false },
    { name: "max", type: "Float", required: false },
    { name: "units", type: "String", required: false },
    { name: "decimal_places", type: "Integer", required: false },
  ],
  /**
   * @param {object} v
   * @returns {number|string|undefined}
   */
  read: (v) => {
    switch (typeof v) {
      case "number":
        return v;
      case "string":
        const stripped = v.replace(/[^0-9.\-e]+/g, "");
        if (!stripped) return undefined;
        const parsed = Number(stripped);
        return isNaN(parsed) ? undefined : parsed;
      default:
        return undefined;
    }
  },
  /**
   * @param {object} param
   * @returns {object|boolean}
   */
  validate:
    ({ min, max }) =>
    (x) => {
      if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
      if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
      return true;
    },
};

/**
 * @param {object} req
 * @returns {string|undefined}
 */
const locale = (req) => {
  //console.log(req && req.getLocale ? req.getLocale() : undefined);
  return req && req.getLocale ? req.getLocale() : undefined;
};

/**
 * @param {*} x
 * @returns {*}
 */
const logit = (x) => {
  console.log(x);
  return x;
};

/**
 * Date type
 * @namespace
 * @category saltcorn-data
 * @subcategory types / date
 */
const date = {
  /** @type {string} */
  name: "Date",
  description: "Dates, with or without time",
  /** @type {string} */
  sql_name: "timestamptz",
  js_type: "Date",

  /**
   * @returns {function}
   */
  contract: () => is.date,
  /** @type {object[]} */
  attributes: [
    {
      name: "day_only",
      label: "Only day",
      type: "Bool",
      sublabel: "Do not pick or compare time",
    },
  ],
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / date
   */
  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    show: {
      isEdit: false,
      description: "Show date and time in the users locale",
      run: (d, req, attrs = {}) => {
        const shower = attrs?.day_only ? localeDate : localeDateTime;
        return typeof d === "string" || typeof d === "number"
          ? shower(new Date(d))
          : d && d.toISOString
          ? shower(d)
          : "";
      },
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    showDay: {
      isEdit: false,
      description: "Show date in the users locale",

      run: (d, req) =>
        typeof d === "string" || typeof d === "number"
          ? localeDate(new Date(d))
          : d && d.toISOString
          ? localeDate(d)
          : "",
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    format: {
      isEdit: false,
      description: "Display date with a specified format",
      configFields: [
        {
          name: "format",
          label: "Format",
          type: "String",
          sublabel: "moment.js format specifier",
        },
      ],
      run: (d, req, options) => {
        if (!d) return "";
        if (req?.noHTML) return moment(d).format(options?.format);
        return time(
          {
            datetime: new Date(d).toISOString(),
            "locale-date-format": encodeURIComponent(
              JSON.stringify(options?.format)
            ),
          },
          moment(d).format(options?.format)
        );
      },
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    relative: {
      isEdit: false,
      description: "Display relative to current time (e.g. 2 hours ago)",
      run: (d, req) => {
        if (!d) return "";
        const loc = locale(req);
        if (loc) return text(moment(d).locale(loc).fromNow());
        else return text(moment(d).fromNow());
      },
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    yearsAgo: {
      isEdit: false,
      description: "Show how many years ago this occurred.",

      run: (d, req) => {
        if (!d) return "";
        return text(moment.duration(new Date() - d).years());
      },
    },
    show_with_html,
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    edit: {
      isEdit: true,
      blockDisplay: true,
      description:
        "Ask user to enter a date string. For a better user experience install the flatpickr module.",
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "text",
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),
          name: text_attr(nm),
          onChange: attrs.onChange,
          disabled: attrs.disabled,
          readonly: attrs.readonly,
          required: !!required,
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && {
            value: text_attr(
              typeof v === "string"
                ? new Date(v).toLocaleString(attrs.locale)
                : v.toLocaleString(attrs.locale)
            ),
          }),
        }),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / date
     */
    editDay: {
      isEdit: true,
      blockDisplay: true,
      description:
        "Ask user to enter a day string. For a better user experience install the flatpickr module.",

      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "text",
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),
          name: text_attr(nm),
          onChange: attrs.onChange,
          readonly: attrs.readonly,
          disabled: attrs.disabled,
          required: !!required,
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && {
            value: text_attr(
              typeof v === "string"
                ? new Date(v).toLocaleDateString(attrs.locale)
                : v.toLocaleDateString(attrs.locale)
            ),
          }),
        }),
    },
  },
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / date
   */
  presets: {
    Now: () => new Date(),
  },
  /**
   * @param {object} v
   * @param {object} attrs
   * @returns {object}
   */
  read: (v, attrs) => {
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "string" || (typeof v === "number" && !isNaN(v))) {
      if (attrs && attrs.locale) {
        const d = moment(v, "L LT", attrs.locale).toDate();
        if (d instanceof Date && !isNaN(d)) return d;
      }
      const d = new Date(v);
      if (d instanceof Date && !isNaN(d)) return d;
      else return null;
    }
  },
  /**
   * @param {object} param
   * @returns {boolean}
   */
  validate: () => (v) => v instanceof Date && !isNaN(v),
};

/**
 * Boolean Type
 * @namespace
 * @category saltcorn-data
 * @subcategory types / bool
 */
const bool = {
  /** @type {string} */
  name: "Bool",
  description: "Boolean values: true or false",
  /** @type {string} */
  sql_name: "boolean",
  js_type: "boolean",
  /**
   * @returns {function}
   */
  contract: () => is.bool,
  /**
   * @namespace
   * @category saltcorn-data
   * @subcategory types / bool
   */
  fieldviews: {
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / bool
     */
    show: {
      isEdit: false,
      description: "Show as a green tick or red cross circle",
      run: (v, req) =>
        typeof v === "undefined" || v === null
          ? ""
          : req.generate_email
          ? v
            ? "&#10004;"
            : "&#10008;"
          : v
          ? i({
              class: "fas fa-lg fa-check-circle text-success",
            })
          : i({
              class: "fas fa-lg fa-times-circle text-danger",
            }),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / bool
     */
    checkboxes: {
      isEdit: false,
      description: "Show with a non-editable checkbox",
      run: (v) =>
        v === true
          ? input({ disabled: true, type: "checkbox", checked: true })
          : v === false
          ? input({ type: "checkbox", disabled: true })
          : "",
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / bool
     */
    TrueFalse: {
      isEdit: false,
      description: "Show as True or False",

      run: (v) => (v === true ? "True" : v === false ? "False" : ""),
    },
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / bool
     */
    edit: {
      isEdit: true,
      description: "Edit with a checkbox",
      configFields: [
        {
          name: "size",
          label: "Size",
          type: "String",
          attributes: {
            options: ["normal", "medium", "large"],
          },
        },
        {
          name: "readonly",
          label: "Read-only",
          type: "Bool",
        },
      ],
      run: (nm, v, attrs, cls, required, field) => {
        const onChange =
          attrs.isFilter && v
            ? `unset_state_field('${nm}', this)`
            : attrs.onChange;
        return input({
          class: ["me-2 mt-1", attrs?.size || null, cls],
          "data-fieldname": text_attr(field.name),
          type: "checkbox",
          onChange,
          readonly: attrs.readonly,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(v && { checked: true }),
          ...(attrs.disabled && { onclick: "return false;" }),
        });
      },
    },
    switch: {
      isEdit: true,
      description: "Edit with a switch",
      run: (nm, v, attrs, cls, required, field) => {
        const onChange =
          attrs.isFilter && v
            ? `unset_state_field('${nm}', this)`
            : attrs.onChange;
        return span(
          { class: "form-switch" },
          input({
            class: ["form-check-input", cls],
            "data-fieldname": text_attr(field.name),
            type: "checkbox",
            onChange,
            readonly: attrs.readonly,
            role: "switch",
            name: text_attr(nm),
            id: `input${text_attr(nm)}`,
            ...(v && { checked: true }),
            ...(attrs.disabled && { onclick: "return false;" }),
          })
        );
      },
    },
    show_with_html,
    /**
     * @namespace
     * @category saltcorn-data
     * @subcategory types / bool
     */
    tristate: {
      isEdit: true,
      description:
        "Edit with a control that can be True, False and Null (missing)",
      configFields: [
        {
          name: "false_label",
          label: "False label",
          type: "String",
        },
        {
          name: "null_label",
          label: "Null label",
          type: "String",
        },
        {
          name: "true_label",
          label: "True label",
          type: "String",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        attrs.disabled
          ? !(!isdef(v) || v === null)
            ? ""
            : v
            ? "T"
            : "F"
          : input({
              type: "hidden",
              "data-fieldname": text_attr(field.name),
              name: text_attr(nm),
              onChange: attrs.onChange,
              "data-postprocess": `it=='on'?true:it=='off'?false:null`,
              id: `input${text_attr(nm)}`,
              value: !isdef(v) || v === null ? "?" : v ? "on" : "off",
            }) +
            button(
              {
                onClick: `tristateClick(this, ${JSON.stringify(required)})`,
                type: "button",
                "data-true-label": attrs?.true_label,
                "data-false-label": attrs?.false_label,
                "data-null-label": attrs?.null_label,
                class: [
                  "btn btn-xs",
                  !isdef(v) || v === null
                    ? "btn-secondary"
                    : v
                    ? "btn-success"
                    : "btn-danger",
                ],
                id: `trib${text_attr(nm)}`,
              },
              !isdef(v) || v === null
                ? attrs?.null_label || "?"
                : v
                ? attrs?.true_label || "T"
                : attrs?.false_label || "F"
            ),
    },
  },
  /** @type {object[]} */
  attributes: [],
  /**
   * @param {*} rec
   * @param {string} name
   * @returns {boolean|null}
   */
  readFromFormRecord: (rec, name) => {
    if (rec[name] === "") return null;
    if (!rec[name]) return false;
    if (["undefined", "false", "off", "no"].includes(rec[name])) return false;
    if (rec[name] === "?") return null;
    return rec[name] ? true : false;
  },
  /**
   * @param {object} v
   * @returns {boolean|null}
   */
  read: (v) => {
    switch (typeof v) {
      case "string":
        if (["TRUE", "T", "ON", "YES"].includes(v.toUpperCase())) return true;
        if (v === "?" || v === "") return null;
        else return false;
      default:
        if (v === null) return null;
        return v ? true : false;
    }
  },
  /**
   * @param {object} v
   * @returns {object}
   */
  readFromDB: (v) => !!v,
  /**
   * @param {object} v
   * @returns {object}
   */
  listAs: (v) => JSON.stringify(v),
  /**
   * @returns {boolean}
   */
  validate: () => (x) => true,
};

module.exports = { string, int, bool, date, float, color };
