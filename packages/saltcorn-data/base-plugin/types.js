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
  text_attr,
} = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");

const isdef = (x) => (typeof x === "undefined" || x === null ? false : true);

const getStrOptions = (v, optsStr) =>
  typeof optsStr === "string"
    ? optsStr
        .split(",")
        .map((o) => text_attr(o.trim()))
        .map((o) => option({ value: o, ...(v === o && { selected: true }) }, o))
    : optsStr.map(({ name, label }) =>
        option({ value: name, ...(v === name && { selected: true }) }, label)
      );

const string = {
  name: "String",
  sql_name: "text",
  attributes: [
    //{ name: "match", type: "String", required: false },
    { name: "max_length", type: "Integer", required: false },
    { name: "min_length", type: "Integer", required: false },
    {
      name: "options",
      type: "String",
      required: false,
      sublabel:
        'Use this to restrict your field to a list of options (separated by commas). For instance, if the permissible values are "Red", "Green" and "Blue", enter "Red, Green, Blue" here. Leave blank if the string can hold any value.',
    },
  ],
  contract: ({ options }) =>
    typeof options === "string"
      ? is.one_of(options.split(","))
      : typeof options === "undefined"
      ? is.str
      : is.one_of(options.map((o) => o.name)),
  fieldviews: {
    as_text: { isEdit: false, run: (s) => text(s) },
    as_link: { isEdit: false, run: (s) => a({ href: text(s) }, text(s)) },
    as_header: { isEdit: false, run: (s) => h3(text(s)) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, required) =>
        attrs.options
          ? select(
              {
                class: ["form-control", cls],
                name: text_attr(nm),
                id: `input${text_attr(nm)}`,
                disabled: attrs.disabled,
              },
              required
                ? getStrOptions(v, attrs.options)
                : [
                    option({ value: "" }, ""),
                    ...getStrOptions(v, attrs.options),
                  ]
            )
          : attrs.calcOptions
          ? select(
              {
                class: ["form-control", cls],
                name: text_attr(nm),
                disabled: attrs.disabled,
                id: `input${text_attr(nm)}`,
                "data-selected": v,
                "data-calc-options": encodeURIComponent(
                  JSON.stringify(attrs.calcOptions)
                ),
              },
              option({ value: "" }, "")
            )
          : input({
              type: "text",
              disabled: attrs.disabled,
              class: ["form-control", cls],
              name: text_attr(nm),
              id: `input${text_attr(nm)}`,
              ...(isdef(v) && { value: text_attr(v) }),
            }),
    },
    textarea: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        textarea(
          {
            class: ["form-control", cls],
            name: text_attr(nm),
            disabled: attrs.disabled,
            id: `input${text_attr(nm)}`,
            rows: 10,
          },
          text(v) || ""
        ),
    },
  },
  read: (v) => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
  validate: ({ min_length, max_length }) => (x) => {
    if (!x || typeof x !== "string") return true; //{ error: "Not a string" };
    if (isdef(min_length) && x.length < min_length)
      return { error: `Must be at least ${min_length} characters` };
    if (isdef(max_length) && x.length > max_length)
      return { error: `Must be at most ${max_length} characters` };
    return true;
  },
};

const int = {
  name: "Integer",
  sql_name: "int",
  contract: ({ min, max }) => is.integer({ lte: max, gte: min }),
  fieldviews: {
    show: { isEdit: false, run: (s) => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "number",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          step: "1",
          ...(attrs.max && { max: attrs.max }),
          ...(attrs.min && { min: attrs.min }),
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  attributes: [
    { name: "max", type: "Integer", required: false },
    { name: "min", type: "Integer", required: false },
  ],
  validate_attributes: ({ min, max }) =>
    !isdef(min) || !isdef(max) || max > min,
  read: (v) => {
    switch (typeof v) {
      case "number":
        return Math.round(v);
      case "string":
        const parsed = parseInt(v);
        return isNaN(parsed) ? undefined : parsed;
      default:
        return undefined;
    }
  },
  validate: ({ min, max }) => (x) => {
    if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
    if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
    return true;
  },
};

const color = {
  name: "Color",
  sql_name: "text",
  contract: () => is.str,
  fieldviews: {
    show: {
      isEdit: false,
      run: (s) =>
        s
          ? div({
              class: "color-type-show",
              style: `background: ${s};`,
            })
          : "",
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "color",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  attributes: [],
  read: (v) => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
  validate: () => (x) => {
    return true;
  },
};

const float = {
  name: "Float",
  sql_name: "double precision",
  contract: ({ min, max }) => is.number({ lte: max, gte: min }),
  fieldviews: {
    show: { isEdit: false, run: (s) => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "number",
          class: ["form-control", cls],
          name: text_attr(nm),
          disabled: attrs.disabled,
          step: attrs.decimal_places
            ? Math.pow(10, -attrs.decimal_places)
            : "0.01",
          id: `input${text_attr(nm)}`,
          ...(attrs.max && { max: attrs.max }),
          ...(attrs.min && { min: attrs.min }),
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  attributes: [
    { name: "max", type: "Float", required: false },
    { name: "min", type: "Float", required: false },
    { name: "units", type: "String", required: false },
    { name: "decimal_places", type: "Integer", required: false },
  ],
  read: (v) => {
    switch (typeof v) {
      case "number":
        return v;
      case "string":
        const parsed = parseFloat(v);
        return isNaN(parsed) ? undefined : parsed;
      default:
        return undefined;
    }
  },
  validate: ({ min, max }) => (x) => {
    if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
    if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
    return true;
  },
};
const locale = (req) => {
  //console.log(req && req.getLocale ? req.getLocale() : undefined);
  return req && req.getLocale ? req.getLocale() : undefined;
};

const logit = (x) => {
  console.log(x);
  return x;
};

const date = {
  name: "Date",
  sql_name: "timestamp",
  contract: () => is.date,
  attributes: [],
  fieldviews: {
    show: {
      isEdit: false,
      run: (d, req) =>
        text(
          typeof d === "string"
            ? text(d)
            : d && d.toLocaleString
            ? d.toLocaleString(locale(req))
            : ""
        ),
    },
    showDay: {
      isEdit: false,
      run: (d, req) =>
        text(
          typeof d === "string"
            ? text(d)
            : d && d.toLocaleDateString
            ? d.toLocaleDateString(locale(req))
            : ""
        ),
    },
    relative: {
      isEdit: false,
      run: (d, req) => {
        if (!d) return "";
        const loc = locale(req);
        if (loc) return text(moment(d).locale(loc).fromNow());
        else return text(moment(d).fromNow());
      },
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "text",
          class: ["form-control", cls],
          name: text_attr(nm),
          disabled: attrs.disabled,
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && {
            value: text_attr(
              typeof v === "string" ? v : v.toLocaleString(attrs.locale)
            ),
          }),
        }),
    },
    editDay: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "text",
          class: ["form-control", cls],
          name: text_attr(nm),
          disabled: attrs.disabled,
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && {
            value: text_attr(
              typeof v === "string" ? v : v.toLocaleDateString(attrs.locale)
            ),
          }),
        }),
    },
  },
  presets: {
    Now: () => new Date(),
  },
  read: (v, attrs) => {
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "string") {
      if (attrs && attrs.locale) {
        const d = moment(v, "L LT", attrs.locale).toDate();
        if (d instanceof Date && !isNaN(d)) return d;
      }
      const d = new Date(v);
      if (d instanceof Date && !isNaN(d)) return d;
      else return null;
    }
  },
  validate: ({}) => (v) => v instanceof Date && !isNaN(v),
};

const bool = {
  name: "Bool",
  sql_name: "boolean",
  contract: () => is.bool,
  fieldviews: {
    show: {
      isEdit: false,
      run: (v) =>
        v === true
          ? i({
              class: "fas fa-lg fa-check-circle text-success",
            })
          : v === false
          ? i({
              class: "fas fa-lg fa-times-circle text-danger",
            })
          : "",
    },
    checkboxes: {
      isEdit: false,
      run: (v) =>
        v === true
          ? input({ disabled: true, type: "checkbox", checked: true })
          : v === false
          ? input({ type: "checkbox", disabled: true })
          : "",
    },
    TrueFalse: {
      isEdit: false,
      run: (v) => (v === true ? "True" : v === false ? "False" : ""),
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          class: ["form-check-input", cls],
          type: "checkbox",
          disabled: attrs.disabled,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(v && { checked: true }),
        }),
    },
    tristate: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        attrs.disabled
          ? !(!isdef(v) || v === null)
            ? ""
            : v
            ? "T"
            : "F"
          : input({
              type: "hidden",
              name: text_attr(nm),
              id: `input${text_attr(nm)}`,
              value: !isdef(v) || v === null ? "?" : v ? "on" : "off",
            }) +
            button(
              {
                onClick: `tristateClick('${text_attr(nm)}')`,
                type: "button",
                id: `trib${text_attr(nm)}`,
              },
              !isdef(v) || v === null ? "?" : v ? "T" : "F"
            ),
    },
  },
  attributes: [],
  readFromFormRecord: (rec, name) => {
    if (!rec[name]) return false;
    if (["undefined", "false", "off"].includes(rec[name])) return false;
    if (rec[name] === "?") return null;
    return rec[name] ? true : false;
  },
  read: (v) => {
    switch (typeof v) {
      case "string":
        if (["TRUE", "T", "ON"].includes(v.toUpperCase())) return true;
        if (v === "?") return null;
        else return false;
      default:
        if (v === null) return null;
        return v ? true : false;
    }
  },
  readFromDB: (v) => !!v,
  listAs: (v) => JSON.stringify(v),
  validate: () => (x) => true,
};

module.exports = { string, int, bool, date, float, color };
