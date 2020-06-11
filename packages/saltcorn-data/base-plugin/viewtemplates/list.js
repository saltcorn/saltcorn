const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { mkTable, h, post_btn, link } = require("@saltcorn/markup");
const { text, script } = require("@saltcorn/markup/tags");
const pluralize = require("pluralize");
const { removeEmptyStrings } = require("../../utils");

const {
  field_picker_fields,
  picked_fields_to_query,
  stateFieldsToWhere,
  initial_config_all_fields
} = require("../../plugin-helper");
const { get_viewable_fields } = require("./viewable_fields");
const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "listfields",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const field_picker_repeat = await field_picker_fields({
            table,
            viewname: context.viewname
          });
          const create_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every(sf => !sf.required)
          );
          const create_view_opts = create_views.map(v => v.name);
          return new Form({
            blurb: "Specify the fields in the table to show",
            fields: [
              new FieldRepeat({
                name: "columns",
                fields: field_picker_repeat
              }),
              {
                name: "view_to_create",
                label: "Use view to create",
                sublabel:
                  "If user has write permission. Leave blank to have no link to create a new item",
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
        name: "default_state",
        contextField: "default_state",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const table_fields = await table.getFields();
          const formfields = context.columns
            .filter(column => column.type === "Field" && column.state_field)
            .map(column => {
              const f = new Field(
                table_fields.find(f => f.name == column.field_name)
              );
              return {
                name: column.field_name,
                label: f.label,
                type: f.type,
                fieldview:
                  f.type && f.type.name === "Bool" ? "tristate" : undefined,
                required: false
              };
            });
          return new Form({
            fields: formfields,
            blurb: "Default search form values when first loaded"
          });
        }
      }
    ]
  });
const get_state_fields = async (table_id, viewname, { columns }) => {
  const table_fields = await Field.find({ table_id });
  var state_fields = [];
  state_fields.push({ name: "_fts", label: "Anywhere", input_type: "text" });
  (columns || []).forEach(column => {
    if (column.type === "Field" && column.state_field) {
      const f = new Field(table_fields.find(f => f.name == column.field_name));
      f.required = false;
      state_fields.push(f);
    }
  });
  state_fields.push({ name: "_sortby", input_type: "hidden" });
  state_fields.push({ name: "_page", input_type: "hidden" });
  return state_fields;
};

const initial_config = initial_config_all_fields(false);

const run = async (
  table_id,
  viewname,
  { columns, view_to_create },
  state,
  extraOpts
) => {
  //console.log({ columns, view_to_create, state });
  const table = await Table.findOne({ id: table_id });

  const fields = await table.getFields();

  const { joinFields, aggregations } = picked_fields_to_query(columns);
  const tfields = await get_viewable_fields(viewname, table, fields, columns);
  const qstate = await stateFieldsToWhere({ fields, state });
  const rows_per_page = 20;
  const current_page = parseInt(state._page) || 1;
  const rows = await table.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    limit: rows_per_page,
    offset: (current_page - 1) * rows_per_page,
    ...(state._sortby && state._sortby !== "undefined"
      ? { orderBy: state._sortby }
      : { orderBy: "id" })
  });

  var page_opts =
    extraOpts && extraOpts.onRowSelect
      ? { onRowSelect: extraOpts.onRowSelect }
      : {};

  if (rows.length === rows_per_page || current_page > 1) {
    const nrows = await table.countRows(qstate);
    if (nrows > rows_per_page || current_page > 1) {
      page_opts.pagination = {
        current_page,
        pages: Math.ceil(nrows / rows_per_page),
        get_page_link: n => `javascript:gopage(${n})`
      };
    }
  }
  const role =
    extraOpts && extraOpts.req && extraOpts.req.user
      ? extraOpts.req.user.role_id
      : 10;

  const create_link =
    view_to_create && role <= table.min_role_write
      ? link(`/view/${view_to_create}`, `Add ${pluralize(table.name, 1)}`)
      : "";
  return mkTable(tfields, rows, page_opts) + create_link;
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  view_quantity: "Many",
  get_state_fields,
  initial_config,
  display_state_form: true,
  default_state_form: ({ default_state }) =>
    default_state && removeEmptyStrings(default_state)
};
