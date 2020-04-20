const { input, select, option, text, h3 } = require("saltcorn-markup/tags");

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
    { name: "match", type: "String", required: false },
    { name: "options", type: "String", required: false }
  ],
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
          : input({
              type: "text",
              class: ["form-control", cls],
              name: text(nm),
              id: `input${text(nm)}`,
              ...(isdef(v) && { value: text(v) })
            })
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
  validate: ({ match }) => x => true
};

const int = {
  name: "Integer",
  sql_name: "int",
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
    { name: "max", type: "Integer", required: false },
    { name: "min", type: "Integer", required: false }
  ],
  read: v => {
    switch (typeof v) {
      case "number":
        return v;
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

const bool = {
  name: "Bool",
  sql_name: "boolean",
  fieldviews: {
    show: {
      isEdit: false,
      run: v => (v === true ? "True" : v === false ? "False" : "")
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, fld) =>
        input({
          class: ["form-check-input", cls],
          type: "checkbox",
          name: text(nm),
          id: `input${text(nm)}`,
          ...(v && { checked: true })
        })
    }
  },
  attributes: [],
  readFromFormRecord: (rec, name) => {
    if (!rec[name]) return false;
    if (rec[name] === "undefined" || rec[name] === "false") return false;
    return rec[name] ? true : false;
  },
  read: v => {
    switch (typeof v) {
      case "string":
        if (v.toUpperCase === "TRUE" || v.toUpperCase === "T") return true;
        else return false;
      default:
        return v ? true : false;
    }
  },
  validate: () => x => true
};

module.exports = { string, int, bool };
