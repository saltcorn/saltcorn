const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4 } = require("saltcorn-markup/tags");
const { renderForm, tabs } = require("saltcorn-markup");
const { mkTable } = require("saltcorn-markup");

const configuration_workflow = () =>
  new Workflow({
    // need order
    steps: [
      {
        name: "views",
        form: async context => {
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewtemplate.runMany &&
              viewrow.name !== context.viewname &&
              state_fields.some(sf => sf.name === "id")
          );
          const show_view_opts = show_views.map(v => v.name);

          return new Form({
            fields: [
              {
                name: "show_view",
                label: "Item View",
                type: "String",
                required: true,
                attributes: {
                  options: show_view_opts.join()
                }
              }
            ]
          });
        }
      }
    ]
  });

const get_state_fields = async (
  table_id,
  viewname,
  { show_view }
) => {
  var sview_sfs = [];
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    sview_sfs = await await sview.get_state_fields();
  }
  return sview_sfs;
};

const run = async (
  table_id,
  viewname,
  { list_view, show_view, subtables },
  state,
  extraArgs
) => {
  const sview = await View.findOne({ name: show_view });
  const sresp = await sview.run(state, extraArgs);
  return sresp
  
};

module.exports = {
  name: "Feed",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
