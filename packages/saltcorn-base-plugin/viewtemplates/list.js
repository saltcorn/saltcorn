const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const Workflow = require("saltcorn-data/models/workflow");
const { mkTable, h, post_btn, link } = require("saltcorn-markup");
const { text, script } = require("saltcorn-markup/tags");
const { field_picker_fields,picked_fields_to_query } = require("saltcorn-data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "listfields",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const field_picker_repeat = await field_picker_fields({ table });
          return new Form({
            blurb:
              "Finalise your list view by specifying the fields in the table",
            fields: [
              new FieldRepeat({
                name: "columns",
                fields: field_picker_repeat
              }),
              {
                name: "link_to_create",
                label: "Link to create",
                type: "Bool",
                sublabel:
                  "Would you like to add a link at the bottom of the list to create a new item?"
              }
            ]
          });
        }
      }
    ]
  });
const get_state_fields = async (table_id, viewname, { columns }) => {
  const table_fields = await Field.find({ table_id });
  var state_fields = [];

  (columns || []).forEach(column => {
    if (column.type === "Field" && column.state_field)
      state_fields.push(table_fields.find(f => f.name == column.field_name));
  });
  state_fields.push({ name: "_sortby", input_type: "hidden" });
  state_fields.push({ name: "_page", input_type: "hidden" });
  return state_fields;
};

const run = async (table_id, viewname, { columns, link_to_create }, state) => {
  //console.log(state);
  const table = await Table.findOne({ id: table_id });

  const fields = await Field.find({ table_id: table.id });
  var qstate = {};
  const {joinFields, aggregations, tfields}
  =picked_fields_to_query(table, fields, columns, text)
  Object.entries(state).forEach(([k, v]) => {
    const field = fields.find(fld => fld.name == k);
    if (field) qstate[k] = v;
    if (
      field &&
      field.type.name === "String" &&
      !(field.attributes && field.attributes.options)
    ) {
      qstate[k] = { ilike: v };
    }
  });
  const rows_per_page = 20;
  const current_page = parseInt(state._page) || 1;
  const rows = await table.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    limit: rows_per_page,
    offset: (current_page - 1) * rows_per_page,
    ...(state._sortby ? { orderBy: state._sortby } : { orderBy: "id" })
  });

  var page_opts = {};

  if (rows.length === rows_per_page) {
    const nrows = await table.countRows(qstate);
    if (nrows > rows_per_page) {
      page_opts = {
        pagination: {
          current_page,
          pages: Math.ceil(nrows / rows_per_page),
          get_page_link: n => `javascript:gopage(${n})`
        }
      };
    }
  }
  const create_link = link_to_create
    ? link(`/edit/${table.name}`, "Add row")
    : "";
  return mkTable(tfields, rows, page_opts) + create_link;
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
