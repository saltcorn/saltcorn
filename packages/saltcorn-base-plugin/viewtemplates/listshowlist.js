const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { text, div } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async context => {
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow, viewtemplate }) =>
              viewtemplate.view_quantity === "Many" &&
              viewrow.name !== context.viewname &&
              state_fields.every(sf => !sf.required)
          );
          const list_view_opts = list_views.map(v => v.name);
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some(sf => sf.name === "id")
          );
          const show_view_opts = show_views.map(v => v.name);

          return new Form({
            fields: [
              {
                name: "list_view",
                label: "List View",
                type: "String",
                required: true,
                attributes: {
                  options: list_view_opts.join()
                }
              },
              {
                name: "show_view",
                label: "Show View",
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
  { list_view, show_view }
) => {
  const lview = await View.findOne({ name: list_view });
  const sview = await View.findOne({ name: show_view });
  const lview_sfs = await lview.get_state_fields();
  const sview_sfs = await sview.get_state_fields();
  return [...lview_sfs, ...sview_sfs];
};

const run = async (table_id, viewname, { list_view, show_view }, state) => {
  const lview = await View.findOne({ name: list_view });
  const sview = await View.findOne({ name: show_view });
  const lresp = await lview.run(state);
  const sresp = await sview.run(state);
  return div(
    { class: "row" },
    div({ class: "col" }, lresp),
    div({ class: "col" }, sresp)
  );
};

module.exports = {
  name: "ListShowList",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false
};
