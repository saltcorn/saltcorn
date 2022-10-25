/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/list
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const Crash = require("../../models/crash");

const { mkTable, h, post_btn, link } = require("@saltcorn/markup");
const { text, script, button, div } = require("@saltcorn/markup/tags");
const pluralize = require("pluralize");
const {
  removeEmptyStrings,
  removeDefaultColor,
  applyAsync,
  mergeIntoWhere,
  mergeConnectedObjects,
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
  add_free_variables_to_joinfields,
} = require("../../plugin-helper");
const {
  get_viewable_fields,
  parse_view_select,
} = require("./viewable_fields");
const { getState } = require("../../db/state");
const {
  get_async_expression_function,
  jsexprToWhere,
  freeVariables,
} = require("../../models/expression");
const db = require("../../db");
const { get_existing_views } = require("../../models/discovery");
const { InvalidConfiguration, isWeb } = require("../../utils");
const { check_view_columns } = require("../../plugin-testing");
const {
  extractFromColumns,
  extractViewToCreate,
} = require("../../diagram/node_extract_utils");

/**
 * @param {object} context
 * @returns {Promise<void>}
 */
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
  const sql_view_name = `${schema}"${db.sqlsanitize(context.viewname)}${extable ? "_sqlview" : ""
    }"`;
  await db.query(`drop view if exists ${sql_view_name};`);
  await db.query(`create or replace view ${sql_view_name} as ${sql};`);
};

/**
 * @param {*} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {*} opts.default_state
 * @returns {Promise<void>}
 */
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

/**
 * @param {object} req
 * @returns {Workflow}
 */
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
          // fix legacy values missing view_name
          (context?.columns || []).forEach(column => {
            if (column.type === 'ViewLink' && column.view && !column.view_name) {
              const view_select = parse_view_select(column.view);
              column.view_name = view_select.viewname
            }
          })
          const field_picker_repeat = await field_picker_fields({
            table,
            viewname: context.viewname,
            req,
          });
          return new Form({
            blurb: req.__("Specify the fields in the table to show"),
            fields: [
              new FieldRepeat({
                name: "columns",
                fancyMenuEditor: true,
                fields: field_picker_repeat,
              }),
            ],
          });
        },
      },
      {
        name: req.__("Create new row"),
        onlyWhen: async (context) => {

          const create_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          return create_views.length > 0
        },
        form: async (context) => {
          const table = await Table.findOne(
            context.table_id
              ? { id: context.table_id }
              : { name: context.exttable_name }
          );
          const create_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const create_view_opts = create_views.map((v) => v.select_option);
          return new Form({
            blurb: req.__("Specify how to create a new row"),
            fields: [
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
                attributes: {
                  asideNext: true,
                },
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
              {
                name: "create_link_style",
                label: req.__("Link Style"),
                type: "String",
                required: true,
                attributes: {
                  asideNext: true,
                  options: [
                    { name: "", label: "Link" },
                    { name: "btn btn-primary", label: "Primary button" },
                    { name: "btn btn-secondary", label: "Secondary button" },
                    { name: "btn btn-success", label: "Success button" },
                    { name: "btn btn-danger", label: "Danger button" },
                    {
                      name: "btn btn-outline-primary",
                      label: "Primary outline button",
                    },
                    {
                      name: "btn btn-outline-secondary",
                      label: "Secondary outline button",
                    },
                  ],
                },

                showIf: { create_view_display: ["Link", "Popup"] },
              },
              {
                name: "create_link_size",
                label: req.__("Link size"),
                type: "String",
                required: true,
                attributes: {
                  options: [
                    { name: "", label: "Standard" },
                    { name: "btn-lg", label: "Large" },
                    { name: "btn-sm", label: "Small" },
                    { name: "btn-sm btn-xs", label: "X-Small" },
                    { name: "btn-block", label: "Block" },
                    { name: "btn-block btn-lg", label: "Large block" },
                  ],
                },
                showIf: { create_view_display: ["Link", "Popup"] },
              },


            ]
          })
        }
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
          form.fields.forEach((ff) => {
            if (ff.reftable_name === "users" && ff.options) {
              // key to user
              //console.log(ff);
              ff.options.push({
                label: "LoggedIn",
                value: "Preset:LoggedIn",
              });
            }
          });
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
              asideNext: true,
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
            name: "include_fml",
            label: req.__("Row inclusion formula"),
            class: "validate-expression",
            sublabel: req.__("Only include rows where this formula is true"),
            type: "String",
          });
          formfields.push({
            name: "transpose",
            label: req.__("Transpose"),
            sublabel: req.__("Display one column per line"),
            type: "Bool",
          });
          formfields.push({
            name: "transpose_width",
            label: req.__("Vertical column width"),
            type: "Integer",
            showIf: { transpose: true },
          });
          formfields.push({
            name: "transpose_width_units",
            label: req.__("Vertical width units"),
            type: "String",
            fieldview: "radio_group",
            attributes: {
              inline: true,
              options: ["px", "%", "vw", "em", "rem"],
            },
            showIf: { transpose: true },
          });
          formfields.push({
            name: "_omit_header",
            label: req.__("Omit header"),
            sublabel: req.__("Do not display the header"),
            type: "Bool",
          });
          formfields.push({
            name: "hide_null_columns",
            label: req.__("Hide null columns"),
            sublabel: req.__(
              "Do not display a column if it contains entirely missing values"
            ),
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

/**
 * @param {string} table_id
 * @param {*} viewname
 * @param {object} opts
 * @param {object[]} opts.columns
 * @returns {function}
 */
const get_state_fields = async (table_id, viewname, { columns }) => {
  const table = Table.findOne(table_id);
  const table_fields = await table.getFields();
  //console.log(table_fields);
  var state_fields = [];
  state_fields.push({ name: "_fts", label: "Anywhere", input_type: "text" });
  (columns || []).forEach((column) => {
    if (column.type === "Field") {
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

/**
 * @param {object} opts
 * @param {object} opts.layout
 * @param {object[]} opts.fields
 * @returns {Promise<void>}
 */
const set_join_fieldviews = async ({ table, columns, fields }) => {
  for (const segment of columns) {
    const { join_field, join_fieldview } = segment;
    if (!join_fieldview) continue;

    const field = await table.getField(join_field);
    if (field && field.type === "File") segment.field_type = "File";
    else if (field?.type.name && field?.type?.fieldviews[join_fieldview])
      segment.field_type = field.type.name;
  }
};
/** @type {function} */
const initial_config = initial_config_all_fields(false);

/**
 * @param {string|number} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {string} [opts.view_to_create]
 * @param {string} opts.create_view_display
 * @param {string} [opts.create_view_label]
 * @param {object} [opts.default_state]
 * @param {string} [opts.create_view_location]
 * @param {object} [stateWithId]
 * @param {object} extraOpts
 * @returns {Promise<*>}
 */
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
    create_link_style,
    create_link_size
  },
  stateWithId,
  extraOpts,
  { listQuery }
) => {
  const table = await Table.findOne(
    typeof table_id === "string" ? { name: table_id } : { id: table_id }
  );
  const fields = await table.getFields();
  const appState = getState();
  const locale = extraOpts.req.getLocale();
  const __ = (s) =>
    isWeb(extraOpts.req) ? appState.i18n.__({ phrase: s, locale }) || s : s;
  //move fieldview cfg into configuration subfield in each column
  for (const col of columns) {
    if (col.type === "Field") {
      const field = fields.find((f) => f.name === col.field_name);
      if (!field) continue;
      const fieldviews =
        field.type === "Key"
          ? appState.keyFieldviews
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
  await set_join_fieldviews({ table, columns, fields });

  const tfields = get_viewable_fields(
    viewname,
    table,
    fields,
    columns,
    false,
    extraOpts.req,
    __
  );
  readState(stateWithId, fields, extraOpts.req);
  const { id, ...state } = stateWithId || {};

  const { rows, rowCount } = await listQuery(state);
  const rows_per_page = (default_state && default_state._rows_per_page) || 20;
  const current_page = parseInt(state._page) || 1;
  var page_opts =
    extraOpts && extraOpts.onRowSelect
      ? { onRowSelect: extraOpts.onRowSelect, selectedId: id }
      : { selectedId: id };

  if ((rows && rows.length === rows_per_page) || current_page > 1) {
    const nrows = rowCount;
    if (nrows > rows_per_page || current_page > 1) {
      page_opts.pagination = {
        current_page,
        pages: Math.ceil(nrows / rows_per_page),
        get_page_link: (n) =>
          `javascript:gopage(${n}, ${rows_per_page}, { _paged_view:'${viewname}' })`,
      };
    }
  }

  if (default_state && default_state._omit_header) {
    page_opts.noHeader = true;
  }
  page_opts.transpose = (default_state || {}).transpose;
  page_opts.transpose_width = (default_state || {}).transpose_width;
  page_opts.transpose_width_units = (default_state || {}).transpose_width_units;
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
      if (!create_view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find embedded view to create ${view_to_create}`
        );
      create_link = await create_view.run(state, extraOpts);
    } else {
      const target = `/view/${encodeURIComponent(
        view_to_create
      )}${stateToQueryString(state)}`;
      const hrefVal =
        isWeb(extraOpts.req) || create_view_display === "Popup"
          ? target
          : `javascript:execLink('${target}');`;
      create_link = link_view(
        hrefVal,
        __(create_view_label) || `Add ${pluralize(table.name, 1)}`,
        create_view_display === "Popup",
        create_link_style,
        create_link_size
      );
    }
  }

  const create_link_div = isright
    ? div({ class: "float-end" }, create_link)
    : create_link;

  const tableHtml = mkTable(
    default_state?.hide_null_columns
      ? remove_null_cols(tfields, rows)
      : tfields,
    rows,
    page_opts
  );

  return istop ? create_link_div + tableHtml : tableHtml + create_link_div;
};
const remove_null_cols = (tfields, rows) =>
  tfields.filter((tfield) => {
    const key = tfield.row_key || tfield.key;
    if (!(typeof key === "string" || Array.isArray(key))) return true; //unable to tell if should be removed
    const is_not_null_simple = (row) =>
      row[key] !== null && typeof row[key] !== "undefined";
    const is_not_null_array = (row) =>
      row[key[0]] !== null &&
      typeof row[key[0]] !== "undefined" &&
      typeof row[key[0]][key[1]] !== "undefined";
    if (Array.isArray(key)) return rows.some(is_not_null_array);
    else return rows.some(is_not_null_simple);
  });

/**
 * @param {number} table_id
 * @param {*} viewname
 * @param {object} optsOne
 * @param {object[]} optsOne.columns
 * @param {*} optsOne.layout
 * @param {object} body
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {*} optsTwo.res
 * @returns {Promise<object>}
 */
const run_action = async (
  table_id,
  viewname,
  { columns, layout },
  body,
  { req, res },
  { getRowQuery }
) => {
  const col = columns.find(
    (c, index) =>
      c.type === "Action" &&
      c.action_name === body.action_name &&
      body.action_name &&
      (body.column_index ? body.column_index === index : true)
  );

  const table = await Table.findOne({ id: table_id });
  const row = await getRowQuery(body.id);
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
      referrer: req.get("Referrer"),
    });
    return { json: { success: "ok", ...(result || {}) } };
  } catch (e) {
    Crash.create(e, req);
    return { json: { error: e.message || e } };
  }
};

module.exports = {
  /** @type {string} */
  name: "List",
  /** @type {string} */
  description:
    "Display multiple rows from a table in a grid with columns you specify",
  configuration_workflow,
  run,
  /** @type {string} */
  view_quantity: "Many",
  get_state_fields,
  initial_config,
  on_delete,
  routes: { run_action },
  /**
   * @param {object} opts
   * @returns {boolean}
   */
  display_state_form: (opts) =>
    false,
  /**
   * @param {object} opts
   * @returns {boolean}
   */
  default_state_form: ({ default_state }) => {
    if (!default_state) return default_state;
    const { _omit_state_form, _create_db_view, ...ds } = default_state;
    return ds && removeDefaultColor(removeEmptyStrings(ds));
  },
  /**
   * @param {object} opts
   * @param {*} opts.columns
   * @param {*} opts.create_view_label
   * @returns {string[]}
   */
  getStringsForI18n({ columns, create_view_label }) {
    const strings = [];
    const maybeAdd = (s) => {
      if (s) strings.push(s);
    };

    for (const column of columns) {
      maybeAdd(column.header_label);
      maybeAdd(column.link_text);
      maybeAdd(column.view_label);
      maybeAdd(column.action_label);
    }
    maybeAdd(create_view_label);
    return strings;
  },
  queries: ({
    table_id,
    exttable_name,
    viewname,
    configuration: { columns, default_state },
    req,
  }) => ({
    async listQuery(state) {
      const table = await Table.findOne(
        typeof exttable_name === "string"
          ? { name: exttable_name }
          : { id: table_id }
      );
      const fields = await table.getFields();
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields
      );
      const where = await stateFieldsToWhere({ fields, state, table });
      const q = await stateFieldsToQuery({ state, fields, prefix: "a." });
      const rows_per_page =
        (default_state && default_state._rows_per_page) || 20;
      if (!q.limit) q.limit = rows_per_page;
      if (!q.orderBy)
        q.orderBy =
          (default_state && default_state._order_field) || table.pk_name;
      if (!q.orderDesc)
        q.orderDesc = default_state && default_state._descending;

      const role = req && req.user ? req.user.role_id : 10;
      if (table.ownership_field_id && role > table.min_role_read && req) {
        const owner_field = fields.find(
          (f) => f.id === table.ownership_field_id
        );
        mergeIntoWhere(where, {
          [owner_field.name]: req.user ? req.user.id : -1,
        });
      }
      if (table.ownership_formula && role > table.min_role_read) {
        const freeVars = freeVariables(table.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
      }

      //console.log({ i: default_state.include_fml });
      if (default_state?.include_fml) {
        let where1 = jsexprToWhere(default_state.include_fml, state);
        mergeIntoWhere(where, where1);
      }
      let rows = await table.getJoinedRows({
        where,
        joinFields,
        aggregations,
        ...q,
      });

      //TODO this will mean that limit is not respected. change filter to jsexprToWhere
      if (table.ownership_formula && role > table.min_role_read && req) {
        rows = rows.filter((row) => table.is_owner(req.user, row));
      }
      const rowCount = await table.countRows();
      return { rows, rowCount };
    },
    async getRowQuery(id) {
      const table = await Table.findOne({ id: table_id });
      return await table.getRow({ id });
    },
  }),
  configCheck: async (view) => {
    return await check_view_columns(view, view.configuration.columns);
  },
  connectedObjects: async (configuration) => {
    const fromColumns = extractFromColumns(configuration.columns);
    const toCreate = extractViewToCreate(configuration);
    return toCreate
      ? mergeConnectedObjects(fromColumns, toCreate)
      : fromColumns;
  },
};
