const Form = require("../../models/form");
const User = require("../../models/user");
const Field = require("../../models/field");
const View = require("../../models/view");
const File = require("../../models/file");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("@saltcorn/markup");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");
const { getState } = require("../../db/state");
const { eachView } = require("../../models/layout");

const {
  div,
  text,
  span,
  option,
  select,
  button,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
  readState,
} = require("../../plugin-helper");
const { action_url, view_linker } = require("./viewable_fields");
const db = require("../../db");
const { relativeTimeRounding } = require("moment");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Layout",
        builder: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();

          const roles = await User.get_roles();

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
        distinct_values[col.field_name] = await field.distinct_values();
    }
  }
  console.log(state);
  console.log(distinct_values);
  const blockDispatch = {
    dropdown_filter({ field_name }) {
      return select(
        {
          name: "role",
          onchange: `this.value=='' ? unset_state_field('${field_name}'): set_state_field('${field_name}', this.value)`,
        },
        distinct_values[field_name].map(({ label, value }) =>
          option({ value, selected: state[field_name] === value }, label)
        )
      );
    },
    toggle_filter({ field_name, value, label }) {
      const active = state[field_name] === value;
      return button(
        {
          class: ["btn", active ? "btn-primary" : "btn-outline-primary"],
          onClick:
            active || value === undefined
              ? `unset_state_field('${field_name}')`
              : `set_state_field('${field_name}', '${value || ""}')`,
        },
        label || value
      );
    },
  };
  return renderLayout({ blockDispatch, layout, role });
};

module.exports = {
  name: "Filter",
  get_state_fields,
  configuration_workflow,
  run,
  initial_config,
  display_state_form: false,
};
