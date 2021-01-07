const User = require("../../models/user");
const Table = require("../../models/table");
const Workflow = require("../../models/workflow");

const {
  div,
  text,
  span,
  option,
  select,
  button,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const { readState } = require("../../plugin-helper");
const { search_bar } = require("@saltcorn/markup/helpers");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Layout",
        builder: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const {
            child_field_list,
            child_relations,
          } = await table.get_child_relations();
          const roles = await User.get_roles();
          for (const cr of child_relations) {
            const cfields = await cr.table.getFields();
            cfields.forEach((cf) => {
              if (cf.name !== cr.key_field.name)
                fields.push({
                  ...cf,
                  label: `${cr.table.name}.${cr.key_field.name}→${cf.name}`,
                  name: `${cr.table.name}.${cr.key_field.name}.${cf.name}`,
                });
            });
          }
          return {
            fields,
            roles,
            mode: "filter",
          };
        },
      },
    ],
  });
const get_state_fields = () => [];

const initial_config = async () => ({ layout: {}, columns: [] });

const run = async (table_id, viewname, { columns, layout }, state, extra) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  const role = extra.req.user ? extra.req.user.role_id : 10;
  const distinct_values = {};
  for (const col of columns) {
    if (col.type === "DropDownFilter") {
      const field = fields.find((f) => f.name === col.field_name);
      if (field)
        distinct_values[col.field_name] = await field.distinct_values(
          extra.req
        );
      else if (col.field_name.includes(".")) {
        const kpath = col.field_name.split(".");
        if (kpath.length === 3) {
          const [jtNm, jFieldNm, lblField] = kpath;
          const jtable = await Table.findOne({ name: jtNm });
          const jfields = await jtable.getFields();
          const jfield = jfields.find((f) => f.name === lblField);
          if (jfield)
            distinct_values[col.field_name] = await jfield.distinct_values();
        }
      }
    }
  }
  const blockDispatch = {
    search_bar() {
      return search_bar("_fts", state["_fts"], {
        onClick:
          "(function(v){v ? set_state_field('_fts', v):unset_state_field('_fts');})($('.search-bar').val())",
      });
    },
    dropdown_filter({ field_name }) {
      return select(
        {
          name: `ddfilter${field_name}`,
          class: "form-control d-inline",
          style: "width: unset;",
          onchange: `this.value=='' ? unset_state_field('${field_name}'): set_state_field('${field_name}', this.value)`,
        },
        distinct_values[field_name].map(({ label, value, jsvalue }) =>
          option(
            {
              value,
              selected: state[field_name] === or_if_undef(jsvalue, value),
            },
            label
          )
        )
      );
    },
    clear_filter({ block, label, btn_style, btn_size }) {
      if (btn_style === "btn-link")
        return a({ href: "javascript:clear_state()" }, label);
      else
        return button(
          {
            onClick: "clear_state()",
            class: `btn ${btn_style || ""} ${btn_size | ""}`,
          },
          label
        );
    },
    toggle_filter({ field_name, value, label }) {
      const field = fields.find((f) => f.name === field_name);
      const isBool = field && field.type.name === "Bool";

      const active = isBool
        ? {
            on: state[field_name],
            off: state[field_name] === false,
            "?": state[field_name] === null,
          }[value]
        : eq_string(state[field_name], value);
      return button(
        {
          class: ["btn", active ? "btn-primary" : "btn-outline-primary"],
          onClick:
            active || value === undefined
              ? `unset_state_field('${field_name}')`
              : `set_state_field('${field_name}', encodeURIComponent('${
                  value || ""
                }'))`,
        },
        label || value
      );
    },
  };
  return renderLayout({ blockDispatch, layout, role });
};

const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);
const eq_string = (x, y) => `${x}` === `${y}`;
module.exports = {
  name: "Filter",
  description:
    "Elements that limit the rows shown in other views on the same page. Filter views do not show any rows on their own.",
  get_state_fields,
  configuration_workflow,
  run,
  initial_config,
  display_state_form: false,
};
