const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { mkTable, h, post_btn, link } = require("@saltcorn/markup");
const { text, script, button } = require("@saltcorn/markup/tags");
const pluralize = require("pluralize");
const { removeEmptyStrings } = require("../../utils");
const {
  field_picker_fields,
  picked_fields_to_query,
  stateFieldsToWhere,
  initial_config_all_fields,
  stateToQueryString,
  stateFieldsToQuery,
  link_view,
  getActionConfigFields,
} = require("../../plugin-helper");
const { get_viewable_fields } = require("./viewable_fields");
const { getState } = require("../../db/state");

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Columns"),
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          //console.log(context);
          const field_picker_repeat = await field_picker_fields({
            table,
            viewname: context.viewname,
            req,
          });
          const create_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const create_view_opts = create_views.map((v) => v.name);
          return new Form({
            blurb: req.__("Specify the fields in the table to show"),
            fields: [
              new FieldRepeat({
                name: "columns",
                fields: field_picker_repeat,
              }),
              ...(create_view_opts.length > 0
                ? [
                    {
                      name: "view_to_create",
                      label: req.__("Use view to create"),
                      sublabel: req.__(
                        "If user has write permission. Leave blank to have no link to create a new item"
                      ),
                      type: "String",
                      attributes: {
                        options: create_view_opts.join(),
                      },
                    },
                    {
                      name: "create_view_display",
                      label: req.__("Display create view as"),
                      type: "String",
                      class: "create_view_display",
                      required: true,
                      attributes: {
                        options: "Link,Embedded,Popup",
                      },
                    },
                    {
                      name: "create_view_label",
                      label: req.__("Label for create"),
                      sublabel: req.__(
                        "Label in link or button to create. Leave blank for a default label"
                      ),
                      type: "String",
                      showIf: { ".create_view_display": ["Link", "Popup"] },
                    },
                  ]
                : []),
            ],
          });
        },
      },
      {
        name: req.__("Default state"),
        contextField: "default_state",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const table_fields = await table.getFields();
          const formfields = table_fields
            .filter((f) => !f.calculated || f.stored)
            .map((f) => {
              return {
                name: f.name,
                label: f.label,
                type: f.type,
                reftable_name: f.reftable_name,
                attributes: f.attributes,
                fieldview:
                  f.type && f.type.name === "Bool" ? "tristate" : undefined,
                required: false,
              };
            });
          formfields.push({
            name: "_omit_state_form",
            label: req.__("Omit search form"),
            sublabel: req.__("Do not display the search filter form"),
            type: "Bool",
          });
          const form = new Form({
            fields: formfields,
            blurb: req.__("Default search form values when first loaded"),
          });
          await form.fill_fkey_options(true);
          return form;
        },
      },
    ],
  });
const get_state_fields = async (table_id, viewname, { columns }) => {
  const table_fields = await Field.find({ table_id });
  var state_fields = [];
  state_fields.push({ name: "_fts", label: "Anywhere", input_type: "text" });
  (columns || []).forEach((column) => {
    if (column.type === "Field" && column.state_field) {
      const tbl_fld = table_fields.find((f) => f.name == column.field_name);
      if (tbl_fld) {
        const f = new Field(tbl_fld);
        f.required = false;
        if (column.header_label) f.label = column.header_label;
        state_fields.push(f);
      }
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
  { columns, view_to_create, create_view_display, create_view_label },
  stateWithId,
  extraOpts
) => {
  //console.log({ columns, view_to_create, state });
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const tfields = get_viewable_fields(
    viewname,
    table,
    fields,
    columns,
    false,
    extraOpts.req
  );
  const { id, ...state } = stateWithId || {};
  const where = await stateFieldsToWhere({ fields, state });
  const q = await stateFieldsToQuery({ state, fields, prefix: "a." });
  const rows_per_page = 20;
  if (!q.limit) q.limit = rows_per_page;
  if (!q.orderBy) q.orderBy = "id";

  const current_page = parseInt(state._page) || 1;
  const rows = await table.getJoinedRows({
    where,
    joinFields,
    aggregations,
    ...q,
  });

  var page_opts =
    extraOpts && extraOpts.onRowSelect
      ? { onRowSelect: extraOpts.onRowSelect, selectedId: id }
      : { selectedId: id };

  if (rows.length === rows_per_page || current_page > 1) {
    const nrows = await table.countRows(where);
    if (nrows > rows_per_page || current_page > 1) {
      page_opts.pagination = {
        current_page,
        pages: Math.ceil(nrows / rows_per_page),
        get_page_link: (n) => `javascript:gopage(${n}, ${rows_per_page})`,
      };
    }
  }
  const role =
    extraOpts && extraOpts.req && extraOpts.req.user
      ? extraOpts.req.user.role_id
      : 10;

  var create_link = "";
  if (view_to_create && role <= table.min_role_write) {
    if (create_view_display === "Embedded") {
      const create_view = await View.findOne({ name: view_to_create });
      create_link = await create_view.run(state, extraOpts);
    } else {
      create_link = link_view(
        `/view/${view_to_create}${stateToQueryString(state)}`,
        create_view_label || `Add ${pluralize(table.name, 1)}`,
        create_view_display === "Popup"
      );
    }
  }

  return mkTable(tfields, rows, page_opts) + create_link;
};

const run_action = async (
  table_id,
  viewname,
  { columns, layout },
  body,
  { req, res }
) => {
  const col = columns.find(
    (c) =>
      c.type === "Action" &&
      c.action_name === body.action_name &&
      body.action_name
  );

  const table = await Table.findOne({ id: table_id });
  const row = await table.getRow({ id: body.id });
  const state_action = getState().actions[col.action_name];
  const configuration = {};
  const cfgFields = getActionConfigFields(
    state_action,
    table
  )(cfgFields).forEach(({ name }) => {
    configuration[name] = col[name];
  });
  await state_action.run({ configuration, table, row, user: req.user });
  return { json: { success: "ok" } };
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  view_quantity: "Many",
  get_state_fields,
  initial_config,
  routes: { run_action },
  display_state_form: (opts) =>
    !(opts && opts.default_state && opts.default_state._omit_state_form),
  default_state_form: ({ default_state }) =>
    default_state && removeEmptyStrings(default_state),
};
