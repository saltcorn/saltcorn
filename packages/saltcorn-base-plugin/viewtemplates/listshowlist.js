const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { text } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async context => {
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.viewtemplate === "List" &&
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
const get_state_fields = async () => [
  {
    name: "id",
    type: "Integer"
  }
];

const run = async (table_id, viewname, config, state) => {
  //console.log({config})
  const { columns } = config;
  const table = await Table.findOne({ id: table_id });
  const form = await getForm(table, viewname, columns, state.id);

  if (state.id) {
    const row = await table.getRow({ id: state.id });
    form.values = row;
  }
  return renderForm(form);
};

module.exports = {
  name: "ListShowList",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false
};
