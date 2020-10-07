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

const { div, text, span } = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
} = require("../../plugin-helper");
const { action_url, view_linker } = require("./viewable_fields");
const db = require("../../db");
const { asyncMap } = require("../../utils");

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

const initial_config = initial_config_all_fields(false);

const run = async (table_id, viewname, { columns, layout }, state, extra) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();

  const blockDispatch = {};
  return renderLayout({ blockDispatch, layout, role });
};

module.exports = {
  name: "Filter",
  get_state_fields,
  configuration_workflow,
  run,
  renderRows,
  initial_config,
  display_state_form: false,
};
