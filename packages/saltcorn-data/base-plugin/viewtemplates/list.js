const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { mkTable, h, post_btn, link } = require("@saltcorn/markup");
const { text, script, button, div } = require("@saltcorn/markup/tags");
const pluralize = require("pluralize");
const {
  removeEmptyStrings,
  removeDefaultColor,
  applyAsync,
} = require("../../utils");
const {
  field_picker_fields,
  picked_fields_to_query,
  stateFieldsToWhere,
  initial_config_all_fields,
  stateToQueryString,
  stateFieldsToQuery,
  link_view,
  getActionConfigFields,
  readState,
  run_action_column,
} = require("../../plugin-helper");
const { get_viewable_fields } = require("./viewable_fields");
const { getState } = require("../../db/state");
const { get_async_expression_function } = require("../../models/expression");
const db = require("../../db");
const { get_existing_views } = require("../../models/discovery");

const create_db_view = async (context) => {
  const table = await Table.findOne({ id: context.table_id });
  const fields = await table.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(
    context.columns,
    fields
  );

  const { sql } = await table.getJoinedQuery({
    where: {},
    joinFields,
    aggregations,
  });
  const schema = db.getTenantSchemaPrefix();
  // is there already a table with this name ? if yes add _sqlview
  const extable = await Table.findOne({ name: context.viewname });
  const sql_view_name = `${schema}"${db.sqlsanitize(context.viewname)}${
    extable ? "_sqlview" : ""
  }"`;
  await db.query(`drop view if exists ${sql_view_name};`);
  await db.query(`create or replace view ${sql_view_name} as ${sql};`);
};

const on_delete = async (table_id, viewname, { default_state }) => {
  if (!db.isSQLite) {
    const sqlviews = (await get_existing_views()).map((v) => v.table_name);
    const vnm = db.sqlsanitize(viewname);
    const schema = db.getTenantSchemaPrefix();
    if (sqlviews.includes(vnm))
      await db.query(`drop view if exists ${schema}"${vnm}";`);
    if (sqlviews.includes(vnm + "_sqlview"))
      await db.query(`drop view if exists ${schema}"${vnm + "_sqlview"}";`);
  }
};

const configuration_workflow = (req) =>
  new Workflow({
    onDone: async (ctx) => {
      if (ctx.default_state._create_db_view) {
        await create_db_view(ctx);
      }

      return ctx;
    },
    steps: [
      {
        name: req.__("Columns"),
        form: async (context) => {
          const table = await Table.findOne(
            context.table_id
              ? { id: context.table_id }
              : { name: context.exttable_name }
          );
          //console.log(context);
          const field_picker_repeat = await field_picker_fields({
            table,
            viewname: context.viewname,
            req,
          });
          const create_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const create_view_opts = create_views.map((v) => v.select_option);
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
                        options: create_view_opts,
                      },
                    },
                    {
                      name: "create_view_display",
                      label: req.__("Display create view as"),
                      type: "String",
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
                      showIf: { create_view_display: ["Link", "Popup"] },
                    },
                    {
                      name: "create_view_location",
                      label: req.__("Location"),
                      sublabel: req.__("Location of link to create new row"),
                      //required: true,
                      attributes: {
                        options: [
                          "Bottom left",
                          "Bottom right",
                          "Top left",
                          "Top right",
                        ],
                      },
                      type: "String",
                      showIf: { create_view_display: ["Link", "Popup"] },
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
          const table = await Table.findOne(
            context.table_id || context.exttable_name
          );
          const table_fields = (await table.getFields()).filter(
            (f) => !f.calculated || f.stored
          );
          const formfields = table_fields.map((f) => {
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
          const form = new Form({
            fields: formfields,
            blurb: req.__("Default search form values when first loaded"),
          });
          await form.fill_fkey_options(true);
          return form;
        },
      },
      {
        name: req.__("Options"),
        contextField: "default_state", //legacy...
        form: async (context) => {
          const table = await Table.findOne(
            context.table_id || context.exttable_name
          );
          const table_fields = (await table.getFields()).filter(
            (f) => !f.calculated || f.stored
          );
          const formfields = [];
          formfields.push({
            name: "_order_field",
            label: req.__("Default order by"),
            type: "String",
            attributes: {
              options: table_fields.map((f) => f.name),
            },
          });
          formfields.push({
            name: "_descending",
            label: req.__("Default descending?"),
            type: "Bool",
            required: true,
          });
          formfields.push({
            name: "_omit_state_form",
            label: req.__("Omit search form"),
            sublabel: req.__("Do not display the search filter form"),
            type: "Bool",
            default: true,
          });
          formfields.push({
            name: "_omit_header",
            label: req.__("Omit header"),
            sublabel: req.__("Do not display the header"),
            type: "Bool",
          });
          if (!db.isSQLite && !table.external)
            formfields.push({
              name: "_create_db_view",
              label: req.__("Create database view"),
              sublabel: req.__(
                "Create an SQL view in the database with the fields in this list"
              ),
              type: "Bool",
            });
          formfields.push({
            name: "_rows_per_page",
            label: req.__("Rows per page"),
            type: "Integer",
            default: 20,
            attributes: { min: 0 },
          });
          const form = new Form({
            fields: formfields,
            blurb: req.__("List options"),
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
  {
    columns,
    view_to_create,
    create_view_display,
    create_view_label,
    default_state,
    create_view_location,
  },
  stateWithId,
  extraOpts
) => {
  const table = await Table.findOne(
    typeof table_id === "string" ? { name: table_id } : { id: table_id }
  );
  const fields = await table.getFields();

  //move fieldview cfg into configuration subfield in each column
  for (const col of columns) {
    if (col.type === "Field") {
      const field = fields.find((f) => f.name === col.field_name);
      if (!field) continue;
      const fieldviews =
        field.type === "Key"
          ? getState().keyFieldviews
          : field.type.fieldviews || {};
      if (!fieldviews) continue;
      const fv = fieldviews[col.fieldview];
      if (fv && fv.configFields) {
        const cfgForm = await applyAsync(fv.configFields, field);
        col.configuration = {};
        for (const formField of cfgForm || []) {
          col.configuration[formField.name] = col[formField.name];
        }
      }
    }
  }
  const role =
    extraOpts && extraOpts.req && extraOpts.req.user
      ? extraOpts.req.user.role_id
      : 10;
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const tfields = get_viewable_fields(
    viewname,
    table,
    fields,
    columns,
    false,
    extraOpts.req
  );
  readState(stateWithId, fields);
  const { id, ...state } = stateWithId || {};
  const where = await stateFieldsToWhere({ fields, state });
  const q = await stateFieldsToQuery({ state, fields, prefix: "a." });
  const rows_per_page = (default_state && default_state._rows_per_page) || 20;
  if (!q.limit) q.limit = rows_per_page;
  if (!q.orderBy)
    q.orderBy = (default_state && default_state._order_field) || table.pk_name;
  if (!q.orderDesc) q.orderDesc = default_state && default_state._descending;
  const current_page = parseInt(state._page) || 1;

  if (table.ownership_field_id && role > table.min_role_read && extraOpts.req) {
    const owner_field = fields.find((f) => f.id === table.ownership_field_id);
    if (where[owner_field.name])
      where[owner_field.name] = [
        where[owner_field.name],
        extraOpts.req.user ? extraOpts.req.user.id : -1,
      ];
    else
      where[owner_field.name] = extraOpts.req.user ? extraOpts.req.user.id : -1;
  }
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
  if (default_state && default_state._omit_header) {
    page_opts.noHeader = true;
  }
  const [vpos, hpos] = (create_view_location || "Bottom left").split(" ");
  const istop = vpos === "Top";
  const isright = hpos === "right";

  var create_link = "";
  const user_id =
    extraOpts && extraOpts.req.user ? extraOpts.req.user.id : null;
  const about_user = fields.some(
    (f) =>
      f.reftable_name === "users" && state[f.name] && state[f.name] === user_id
  );
  if (
    view_to_create &&
    (role <= table.min_role_write || (table.ownership_field_id && about_user))
  ) {
    if (create_view_display === "Embedded") {
      const create_view = await View.findOne({ name: view_to_create });
      create_link = await create_view.run(state, extraOpts);
    } else {
      create_link = link_view(
        `/view/${encodeURIComponent(view_to_create)}${stateToQueryString(
          state
        )}`,
        create_view_label || `Add ${pluralize(table.name, 1)}`,
        create_view_display === "Popup"
      );
    }
  }

  const create_link_div = isright
    ? div({ class: "float-right" }, create_link)
    : create_link;

  const tableHtml = mkTable(tfields, rows, page_opts);

  return istop ? create_link_div + tableHtml : tableHtml + create_link_div;
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
  col.configuration = col.configuration || {};
  if (state_action) {
    const cfgFields = await getActionConfigFields(state_action, table);
    cfgFields.forEach(({ name }) => {
      col.configuration[name] = col[name];
    });
  }
  try {
    const result = await run_action_column({
      col,
      req,
      table,
      row,
    });
    return { json: { success: "ok", ...(result || {}) } };
  } catch (e) {
    return { json: { error: e.message || e } };
  }
};

module.exports = {
  name: "List",
  description:
    "Display multiple rows from a table in a grid with columns you specify",
  configuration_workflow,
  run,
  view_quantity: "Many",
  get_state_fields,
  initial_config,
  on_delete,
  routes: { run_action },
  display_state_form: (opts) =>
    !(opts && opts.default_state && opts.default_state._omit_state_form),
  default_state_form: ({ default_state }) => {
    if (!default_state) return default_state;
    const { _omit_state_form, _create_db_view, ...ds } = default_state;
    return ds && removeDefaultColor(removeEmptyStrings(ds));
  },
};
