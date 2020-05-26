const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4, hr } = require("@saltcorn/markup/tags");
const { renderForm, tabs, link } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const { stateToQueryString } = require("./viewable_fields");
const pluralize = require("pluralize");
const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async context => {
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewtemplate, viewrow }) =>
              viewtemplate.runMany &&
              viewrow.name !== context.viewname &&
              state_fields.some(sf => sf.name === "id")
          );
          const create_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every(sf => !sf.required)
          );
          const show_view_opts = show_views.map(v => v.name);
          const create_view_opts = create_views.map(v => v.name);
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
              },
              {
                name: "view_to_create",
                label: "Use view to create",
                sublabel: "Leave blank to have no link to create a new item",
                type: "String",
                attributes: {
                  options: create_view_opts.join()
                }
              }
            ]
          });
        }
      },
      {
        name: "order",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          return new Form({
            fields: [
              {
                name: "order_field",
                label: "Order by",
                type: "String",
                required: true,
                attributes: {
                  options: fields.map(f => f.name).join()
                }
              },
              {
                name: "descending",
                label: "Descending",
                type: "Bool",
                required: true
              }
            ]
          });
        }
      }
    ]
  });

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table_fields = await Field.find({ table_id });
  return table_fields.map(f => {
    const sf = new Field(f);
    sf.required = false;
    return sf;
  });
};
const run = async (
  table_id,
  viewname,
  { show_view, order_field, descending, view_to_create },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });

  const sview = await View.findOne({ name: show_view });
  const sresp = await sview.runMany(state, {
    ...extraArgs,
    orderBy: order_field,
    ...(descending && { orderDesc: true })
  });
  const create_link = view_to_create
    ? link(
        `/view/${view_to_create}${stateToQueryString(state)}`,
        `Add ${pluralize(table.name, 1)}`
      )
    : "";
  return div(
    sresp.map(r => div(r.html) + hr()),
    create_link
  );
};

module.exports = {
  name: "Feed",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false
};
