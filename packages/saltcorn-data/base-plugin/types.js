const moment = require("moment");
const {
  input,
  select,
  option,
  text,
  h3,
  button,
  textarea
} = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");

const isdef = x => (typeof x === "undefined" || x === null ? false : true);

const getStrOptions = (v, optsStr) =>
  typeof optsStr === "string"
    ? optsStr
        .split(",")
        .map(o => text(o.trim()))
        .map(o => option({ value: o, ...(v === o && { selected: true }) }, o))
    : optsStr.map(({ name, label }) =>
        option({ value: name, ...(v === name && { selected: true }) }, label)
      );

const string = {
  name: "String",
  sql_name: "text",
  attributes: [
    //{ name: "match", type: "String", required: false },
    {
      name: "options",
      type: "String",
      required: false,
      sublabel:
        'Use this to restrict your field to a list of options (separated by commas). For instance, if the permissible values are "Red", "Green" and "Blue", enter "Red, Green, Blue" here. Leave blank if the string can hold any value.'
    }
  ],
  contract: ({ options }) =>
    typeof options === "string"
      ? is.one_of(options.split(","))
      : typeof options === "undefined"
      ? is.str
      : is.one_of(options.map(o => o.name)),
  fieldviews: {
    as_text: { isEdit: false, run: s => text(s) },
    as_header: { isEdit: false, run: s => h3(text(s)) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, required) =>
        attrs.options
          ? select(
              {
                class: ["form-control", cls],
                name: text(nm),
                id: `input${text(nm)}`
              },
              required
                ? getStrOptions(v, attrs.options)
                : [
                    option({ value: "" }, ""),
                    ...getStrOptions(v, attrs.options)
                  ]
            )
          : attrs.calcOptions
          ? select(
              {
                class: ["form-control", cls],
                name: text(nm),
                id: `input${text(nm)}`,
                "data-selected": v,
                "data-calc-options": encodeURIComponent(
                  JSON.stringify(attrs.calcOptions)
                )
              },
              option({ value: "" }, "")
            )
          : input({
              type: "text",
              class: ["form-control", cls],
              name: text(nm),
              id: `input${text(nm)}`,
              ...(isdef(v) && { value: text(v) })
            })
    },
    textarea: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        textarea(
          {
            class: ["form-control", cls],
            name: text(nm),
            id: `input${text(nm)}`,
            rows: 10
          },
          text(v) || ""
        )
    }
  },
  read: v => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
  validate: () => x => true
};

const int = {
  name: "Integer",
  sql_name: "int",
  contract: ({ min, max }) => is.integer({ lte: max, gte: min }),
  fieldviews: {
    show: { isEdit: false, run: s => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "number",
          class: ["form-control", cls],
          name: text(nm),
          id: `input${text(nm)}`,
          step: "1",
          ...(attrs.max && { max: attrs.max }),
          ...(attrs.min && { min: attrs.min }),
          ...(isdef(v) && { value: text(v) })
        })
    }
  },
  attributes: [
    { name: "max", type: "Integer", required: false },
    { name: "min", type: "Integer", required: false }
  ],
  read: v => {
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
  validate: ({ min, max }) => x => {
    if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
    if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
    return true;
  }
};

const float = {
  name: "Float",
  sql_name: "double precision",
  contract: ({ min, max }) => is.number({ lte: max, gte: min }),
  fieldviews: {
    show: { isEdit: false, run: s => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "number",
          class: ["form-control", cls],
          name: text(nm),
          id: `input${text(nm)}`,
          ...(attrs.max && { max: attrs.max }),
          ...(attrs.min && { min: attrs.min }),
          ...(isdef(v) && { value: text(v) })
        })
    }
  },
  attributes: [
    { name: "max", type: "Float", required: false },
    { name: "min", type: "Float", required: false },
    { name: "units", type: "String", required: false }
  ],
  read: v => {
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
  validate: ({ min, max }) => x => {
    if (isdef(min) && x < min) return { error: `Must be ${min} or higher` };
    if (isdef(max) && x > max) return { error: `Must be ${max} or less` };
    return true;
  }
};

const date = {
  name: "Date",
  sql_name: "timestamp",
  contract: () => is.date,
  attributes: [],
  fieldviews: {
    show: { isEdit: false, run: d => text(d.toISOString()) },
    relative: { isEdit: false, run: d => text(moment(d).fromNow()) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "text",
          class: ["form-control", cls],
          name: text(nm),
          id: `input${text(nm)}`,
          ...(isdef(v) && { value: text(v.toISOString()) })
        })
    }
  },
  presets: {
    Now: () => new Date()
  },
  read: v => {
    if (v instanceof Date && !isNaN(v)) return v;

    if (typeof v === "string") {
      const d = new Date(v);
      if (d instanceof Date && !isNaN(d)) return d;
      else return null;
    }
  },
  validate: ({}) => v => v instanceof Date && !isNaN(v)
};

const bool = {
  name: "Bool",
  sql_name: "boolean",
  contract: () => is.bool,
  fieldviews: {
    show: {
      isEdit: false,
      run: v => (v === true ? "True" : v === false ? "False" : "")
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          class: ["form-check-input", cls],
          type: "checkbox",
          name: text(nm),
          id: `input${text(nm)}`,
          ...(v && { checked: true })
        })
    },
    tristate: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        input({
          type: "hidden",
          name: text(nm),
          id: `input${text(nm)}`,
          value: !isdef(v) ? "" : v ? "T" : "F"
        }) +
        button(
          {
            onClick: `tristateClick('${text(nm)}')`,
            type: "button",
            id: `trib${text(nm)}`
          },
          !isdef(v) ? "?" : v ? "T" : "F"
        )
    }
  },
  attributes: [],
  readFromFormRecord: (rec, name) => {
    if (!rec[name]) return false;
    if (["undefined", "false", "off"].includes(rec[name])) return false;
    return rec[name] ? true : false;
  },
  read: v => {
    switch (typeof v) {
      case "string":
        if (["TRUE", "T", "ON"].includes(v.toUpperCase())) return true;
        else return false;
      default:
        return v ? true : false;
    }
  },
  validate: () => x => true
};

module.exports = { string, int, bool, date, float };
