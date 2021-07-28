/**
 * Embedded Types definition.
 *
 * More types can be added by plugin store mechanism https://store.saltcorn.com/
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
} = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");
const { radio_group } = require("@saltcorn/markup/helpers");

const isdef = (x) => (typeof x === "undefined" || x === null ? false : true);

const eqStr = (x, y) => `${x}` === `${y}`;

const getStrOptions = (v, optsStr) =>
  typeof optsStr === "string"
    ? optsStr
        .split(",")
        .map((o) => o.trim())
        .map((o) =>
          option(
            { value: text_attr(o), ...(eqStr(v, o) && { selected: true }) },
            text_attr(o)
          )
        )
    : optsStr.map((o, ix) =>
        o && typeof o.name !== "undefined" && typeof o.label !== "undefined"
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
/**
 * String type
 * @type {{read: ((function(*=): (*))|*), presets: {IP: (function({req: *}): string), SessionID: (function({req: *}))}, fieldviews: {as_text: {isEdit: boolean, run: (function(*=): string|string)}, as_link: {isEdit: boolean, run: (function(*=): string)}, as_header: {isEdit: boolean, run: (function(*=): string)}, password: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, img_from_url: {isEdit: boolean, run: (function(*=, *, *): string)}, edit: {isEdit: boolean, run: (function(*=, *=, *, *, *=, *): string), configFields: (function(*): [...[{name: string, label: string, type: string}, {name: string, label: string, type: string, sublabel: string}]|*[], {name: string, label: string, type: string}])}, radio_group: {isEdit: boolean, run: (function(*=, *=, *, *=, *, *): *|string)}, textarea: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}}, contract: (function({options?: *}): (function(*=): *)|*), name: string, attributes: [{name: string, validator(*=): (string|undefined), type: string, required: boolean, sublabel: string}, {name: string, type: string, required: boolean, sublabel: string}, {name: string, type: string, required: boolean, sublabel: string}, {name: string, type: string, required: boolean, sublabel: string}, {name: string, type: string, required: boolean, sublabel: string}], sql_name: string, validate_attributes: (function({min_length?: *, max_length?: *, regexp?: *})), validate: (function({min_length?: *, max_length?: *, regexp?: *, re_invalid_error?: *}): function(*=): (boolean|{error: string}))}}
 */
const string = {
  name: "String",
  sql_name: "text",
  attributes: [
    {
      name: "regexp",
      type: "String",
      required: false,
      sublabel: "Match regular expression",
      validator(s) {
        if (!is_valid_regexp(s)) return "Not a valid Regular Expression";
      },
    },
    {
      name: "re_invalid_error",
      type: "String",
      required: false,
      sublabel: "Error message when regular expression does not match",
    },
    {
      name: "max_length",
      type: "Integer",
      required: false,
      sublabel: "The maximum number of characters in the string",
    },
    {
      name: "min_length",
      type: "Integer",
      required: false,
      sublabel: "The minimum number of characters in the string",
    },
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
      : is.one_of(options.map((o) => (typeof o === "string" ? o : o.name))),
  fieldviews: {
    as_text: { isEdit: false, run: (s) => text_attr(s || "") },
    as_link: {
      isEdit: false,
      run: (s) => a({ href: text(s || "") }, text_attr(s || "")),
    },
    img_from_url: {
      isEdit: false,
      run: (s, req, attrs) => img({ src: text(s || ""), style: "width:100%" }),
    },
    as_header: { isEdit: false, run: (s) => h3(text_attr(s || "")) },
    edit: {
      isEdit: true,
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
        {
          name: "placeholder",
          label: "Placeholder",
          type: "String",
        },
      ],
      run: (nm, v, attrs, cls, required, field) =>
        attrs.options && (attrs.options.length > 0 || !required)
          ? select(
              {
                class: ["form-control", cls],
                name: text_attr(nm),
                "data-fieldname": text_attr(field.name),
                id: `input${text_attr(nm)}`,
                disabled: attrs.disabled,
              },
              required || attrs.force_required
                ? getStrOptions(v, attrs.options)
                : [
                    option({ value: "" }, attrs.neutral_label || ""),
                    ...getStrOptions(v, attrs.options),
                  ]
            )
          : attrs.options
          ? i("None available")
          : attrs.calcOptions
          ? select(
              {
                class: ["form-control", cls],
                name: text_attr(nm),
                disabled: attrs.disabled,
                "data-fieldname": text_attr(field.name),
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
              placeholder: attrs.placeholder,
              "data-fieldname": text_attr(field.name),
              name: text_attr(nm),
              id: `input${text_attr(nm)}`,
              ...(isdef(v) && { value: text_attr(v) }),
            }),
    },
    textarea: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        textarea(
          {
            class: ["form-control", cls],
            name: text_attr(nm),
            "data-fieldname": text_attr(field.name),
            disabled: attrs.disabled,
            id: `input${text_attr(nm)}`,
            rows: 5,
          },
          text(v) || ""
        ),
    },
    radio_group: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        attrs.options
          ? radio_group({
              class: cls,
              name: text_attr(nm),
              disabled: attrs.disabled,
              options: attrs.options.split(",").map((o) => o.trim()),
              value: v,
            })
          : i("None available"),
    },
    password: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "password",
          disabled: attrs.disabled,
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),

          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(isdef(v) && { value: text_attr(v) }),
        }),
    },
  },
  read: (v) => {
    switch (typeof v) {
      case "string":
        //PG dislikes null bytes
        return v.replace(/\0/g, "");
      default:
        return undefined;
    }
  },
  presets: {
    IP: ({ req }) => req.ip,
    SessionID: ({ req }) => req.sessionID || req.cookies['express:sess'],
  },
  validate: ({ min_length, max_length, regexp, re_invalid_error }) => (x) => {
    if (!x || typeof x !== "string") return true; //{ error: "Not a string" };
    if (isdef(min_length) && x.length < min_length)
      return { error: `Must be at least ${min_length} characters` };
    if (isdef(max_length) && x.length > max_length)
      return { error: `Must be at most ${max_length} characters` };
    if (isdef(regexp) && !new RegExp(regexp).test(x))
      return { error: re_invalid_error || `Does not match regular expression` };
    return true;
  },
  validate_attributes: ({ min_length, max_length, regexp }) =>
    (!isdef(min_length) || !isdef(max_length) || max_length >= min_length) &&
    (!isdef(regexp) || is_valid_regexp(regexp)),
};
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
 * @type {{read: ((function(*=): (number))|*), fieldviews: {edit: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, show: {isEdit: boolean, run: (function(*=): string|*)}}, contract: (function({min?: *, max?: *}): function(*=): *), name: string, attributes: [{name: string, type: string, required: boolean}, {name: string, type: string, required: boolean}], sql_name: string, validate_attributes: (function({min?: *, max?: *})), primaryKey: {sql_type: string}, validate: (function({min?: *, max?: *}): function(*): ({error: string}|boolean))}}
 */
const int = {
  name: "Integer",
  sql_name: "int",
  contract: ({ min, max }) => is.integer({ lte: max, gte: min }),
  primaryKey: { sql_type: "serial" },
  fieldviews: {
    show: { isEdit: false, run: (s) => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "number",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          "data-fieldname": text_attr(field.name),
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
        if (v === "") return undefined;
        const parsed = +v;
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
/**
 * Color Type
 * @type {{read: ((function(*=): (string))|*), fieldviews: {edit: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, show: {isEdit: boolean, run: (function(*): string|string)}}, contract: (function(): (function(*=): *)|*), name: string, attributes: *[], sql_name: string, validate: (function(): function(*): boolean)}}
 */
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
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "color",
          class: ["form-control", cls],
          disabled: attrs.disabled,
          "data-fieldname": text_attr(field.name),
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
/**
 * Float type
 * @type {{read: ((function(*=): (number))|*), fieldviews: {edit: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, show: {isEdit: boolean, run: (function(*=): string|*)}}, contract: (function({min?: *, max?: *}): function(*=): *), name: string, attributes: [{name: string, type: string, required: boolean}, {name: string, type: string, required: boolean}, {name: string, type: string, required: boolean}, {name: string, type: string, required: boolean}], sql_name: string, validate: (function({min?: *, max?: *}): function(*): ({error: string}|boolean))}}
 */
const float = {
  name: "Float",
  sql_name: "double precision",
  contract: ({ min, max }) => is.number({ lte: max, gte: min }),
  fieldviews: {
    show: { isEdit: false, run: (s) => text(s) },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "number",
          class: ["form-control", cls],
          name: text_attr(nm),
          "data-fieldname": text_attr(field.name),
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
/**
 * Date type
 * @type {{presets: {Now: (function(): Date)}, read: ((function(*=, *=): (Date|null|undefined))|*), fieldviews: {edit: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, editDay: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, yearsAgo: {isEdit: boolean, run: ((function(*=, *): (string|string|*))|*)}, show: {isEdit: boolean, run: (function(*=, *=): string|*)}, showDay: {isEdit: boolean, run: (function(*=, *=): string|*)}, format: {isEdit: boolean, run: ((function(*=, *, *=): (string|string|*))|*), configFields: [{name: string, label: string, type: string, sublabel: string}]}, relative: {isEdit: boolean, run: ((function(*=, *=): (string|string|*))|*)}}, contract: (function(): (function(*=): *)|*), name: string, attributes: *[], sql_name: string, validate: (function({}): function(*=): *)}}
 */
const date = {
  name: "Date",
  sql_name: "timestamptz",
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
    format: {
      isEdit: false,
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
        if (!options || !options.format) return text(moment(d).format());
        return text(moment(d).format(options.format));
      },
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
    yearsAgo: {
      isEdit: false,
      run: (d, req) => {
        if (!d) return "";
        return text(moment.duration(new Date() - d).years());
      },
    },
    edit: {
      isEdit: true,
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "text",
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),
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
      run: (nm, v, attrs, cls, required, field) =>
        input({
          type: "text",
          class: ["form-control", cls],
          "data-fieldname": text_attr(field.name),
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
/**
 * Boolean Type
 * @type {{readFromFormRecord: ((function(*, *): (boolean|null|boolean))|*), read: ((function(*=): (boolean|null|boolean))|*), fieldviews: {TrueFalse: {isEdit: boolean, run: (function(*): string)}, tristate: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string|string)}, checkboxes: {isEdit: boolean, run: (function(*): string|string)}, edit: {isEdit: boolean, run: (function(*=, *=, *, *, *, *): string)}, show: {isEdit: boolean, run: (function(*): string|string)}}, contract: (function(): (function(*=): *)|*), name: string, listAs: (function(*=): string), attributes: *[], sql_name: string, readFromDB: (function(*=): boolean), validate: (function(): function(*): boolean)}}
 */
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
      run: (nm, v, attrs, cls, required, field) =>
        input({
          class: ["mr-2 mt-1", cls],
          "data-fieldname": text_attr(field.name),
          type: "checkbox",
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
          ...(v && { checked: true }),
          ...(attrs.disabled && {onclick: "return false;"})
        }),
    },
    tristate: {
      isEdit: true,
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
