/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/show
 * @subcategory base-plugin
 */
const Form = require("../../models/form");
const User = require("../../models/user");
const Field = require("../../models/field");
const View = require("../../models/view");
const File = require("../../models/file");
const Table = require("../../models/table");
const Page = require("../../models/page");
const Workflow = require("../../models/workflow");
const Trigger = require("../../models/trigger");

const { post_btn, link } = require("@saltcorn/markup");
const { getState } = require("../../db/state");
const {
  eachView,
  traverse,
  getStringsForI18n,
  translateLayout,
} = require("../../models/layout");

const { div, text, span, a, text_attr, i } = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  stateFieldsToQuery,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
  calcfldViewConfig,
  getActionConfigFields,
  run_action_column,
  readState,
} = require("../../plugin-helper");
const {
  action_url,
  view_linker,
  parse_view_select,
  action_link,
} = require("./viewable_fields");
const db = require("../../db");
const {
  asyncMap,
  structuredClone,
  InvalidConfiguration,
} = require("../../utils");
const { traverseSync } = require("../../models/layout");
const { get_expression_function } = require("../../models/expression");
const { get_base_url } = require("../../models/config");
const Library = require("../../models/library");

/**
 * @param {object} req 
 * @returns {Workflow}
 */
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context) => {
          const table = await Table.findOne(
            context.table_id || context.exttable_name
          );
          const fields = await table.getFields();

          const boolfields = fields.filter(
            (f) => f.type && f.type.name === "Bool"
          );
          const stateActions = Object.entries(getState().actions).filter(
            ([k, v]) => !v.disableInBuilder
          );
          const actions = [
            "Delete",
            ...boolfields.map((f) => `Toggle ${f.name}`),
            ...stateActions.map(([k, v]) => k),
          ];
          const triggers = await Trigger.find({
            when_trigger: { or: ["API call", "Never"] },
          });
          triggers.forEach((tr) => {
            actions.push(tr.name);
          });
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = await Table.findOne({
                name: field.reftable_name,
              });
              if (field.reftable) await field.reftable.getFields();
            }
          }
          const actionConfigForms = {};
          for (const [name, action] of stateActions) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table
              );
            }
          }
          const fieldViewConfigForms = await calcfldViewConfig(fields, false);
          const { field_view_options, handlesTextStyle } = calcfldViewOptions(
            fields,
            false
          );
          if (table.name === "users") {
            fields.push(
              new Field({
                name: "verification_url",
                label: "Verification URL",
                type: "String",
              })
            );
            field_view_options.verification_url = ["as_text", "as_link"];
          }
          const link_view_opts = await get_link_view_opts(
            table,
            context.viewname
          );
          const roles = await User.get_roles();
          const { parent_field_list } = await table.get_parent_relations(true);
          const {
            child_field_list,
            child_relations,
          } = await table.get_child_relations();
          var agg_field_opts = {};
          child_relations.forEach(({ table, key_field }) => {
            agg_field_opts[
              `${table.name}.${key_field.name}`
            ] = table.fields
              .filter((f) => !f.calculated || f.stored)
              .map((f) => f.name);
          });
          const views = link_view_opts;
          const pages = await Page.find();
          const images = await File.find({ mime_super: "image" });
          const library = (await Library.find({})).filter((l) =>
            l.suitableFor("show")
          );
          const myviewrow = await View.findOne({ name: context.viewname });
          return {
            tableName: table.name,
            fields,
            images,
            actions,
            actionConfigForms,
            fieldViewConfigForms,
            field_view_options,
            link_view_opts,
            parent_field_list,
            child_field_list,
            agg_field_opts,
            min_role: (myviewrow || {}).min_role,
            roles,
            views,
            library,
            pages,
            handlesTextStyle,
            mode: "show",
            ownership: !!table.ownership_field_id || table.name === "users",
          };
        },
      },
      {
        name: req.__("Set page title"),
        form: () =>
          new Form({
            blurb: req.__(
              "Skip this section if you do not want to set the page title"
            ),
            fields: [
              {
                name: "page_title",
                label: req.__("Page title"),
                type: "String",
              },
              {
                name: "page_title_formula",
                label: req.__("Page title is a formula?"),
                type: "Bool",
                required: false,
              },
            ],
          }),
      },
    ],
  });

/**
 * @returns {object[]}
 */
const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
    primary_key: true,
  },
];

/** @type {function} */
const initial_config = initial_config_all_fields(false);

/**
 * @param {string} table_id 
 * @param {string} viewname 
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {object} opts.layout
 * @param {string} [opts.page_title]
 * @param {boolean} opts.page_title_formula
 * @param {object} state 
 * @param {object} extra 
 * @returns {Promise<string>}
 */
const run = async (
  table_id,
  viewname,
  { columns, layout, page_title, page_title_formula },
  state,
  extra
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const tbl = await Table.findOne(table_id);
  const fields = await tbl.getFields();
  if (tbl.name === "users") {
    fields.push(
      new Field({
        name: "verification_token",
        label: "Verification Token",
        type: "String",
      })
    );
  }
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  readState(state, fields);
  const qstate = await stateFieldsToWhere({ fields, state, approximate: true });
  if (Object.keys(qstate).length === 0) return extra.req.__("No row selected");
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    limit: 5,
  });
  if (rows.length > 1)
    rows.sort((a, b) => {
      let diff = 0;
      Object.keys(state).forEach((key) => {
        if (a[key] && b[key]) {
          if (typeof a[key] === "string" && typeof b[key] === "string") {
            diff += a[key].length - b[key].length;
          }
        }
      });
      return diff;
    });

  if (rows.length == 0) return extra.req.__("No row selected");
  if (tbl.name === "users") {
    const base = get_base_url(extra.req);
    fields.push(
      new Field({
        name: "verification_url",
        label: "Verification URL",
        type: "String",
      })
    );
    for (const row of rows) {
      row.verification_url = `${base}auth/verify?token=${
        row.verification_token
      }&email=${encodeURIComponent(row.email)}`;
    }
  }
  await set_join_fieldviews({ layout, fields });

  const rendered = (
    await renderRows(tbl, viewname, { columns, layout }, extra, [rows[0]])
  )[0];
  let page_title_preamble = "";
  if (page_title) {
    let the_title = page_title;
    if (page_title_formula) {
      const f = get_expression_function(page_title, fields);
      the_title = f(rows[0]);
    }
    page_title_preamble = `<!--SCPT:${text_attr(the_title)}-->`;
  }
  return page_title_preamble + rendered;
};

/**
 * @param {object} opts
 * @param {object} opts.layout
 * @param {object[]} opts.fields
 * @returns {Promise<void>}
 */
const set_join_fieldviews = async ({ layout, fields }) => {
  await traverse(layout, {
    join_field: async (segment) => {
      const { join_field, fieldview } = segment;
      if (!fieldview) return;
      const keypath = join_field.split(".");
      if (keypath.length === 2) {
        const [refNm, targetNm] = keypath;
        const ref = fields.find((f) => f.name === refNm);
        if (!ref) return;
        const table = await Table.findOne({ name: ref.reftable_name });
        if (!table) return;
        const reffields = await table.getFields();
        const field = reffields.find((f) => f.name === targetNm);
        if (field && field.type === "File") segment.field_type = "File";
        else if (
          field &&
          field.type &&
          field.type.name &&
          field.type.fieldviews &&
          field.type.fieldviews[fieldview]
        )
          segment.field_type = field.type.name;
      } else {
        //const [refNm, through, targetNm] = keypath;
      }
    },
  });
};

/**
 * @param {object} table 
 * @param {string} viewname 
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {object} opts.layout
 * @param {object} extra 
 * @param {object[]} rows 
 * @returns {Promise<string>}
 */
const renderRows = async (
  table,
  viewname,
  { columns, layout },
  extra,
  rows
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return req.__("View not yet built");

  const fields = await table.getFields();

  const role = extra.req.user ? extra.req.user.role_id : 10;
  var views = {};
  const getView = async (nm) => {
    if (views[nm]) return views[nm];
    const view_select = parse_view_select(nm);
    const view = await View.findOne({ name: view_select.viewname });
    if (!view) return false;
    if (view.table_id === table.id) view.table = table;
    else view.table = await Table.findOne({ id: view.table_id });
    view.view_select = view_select;
    views[nm] = view;
    return view;
  };
  await set_join_fieldviews({ layout, fields });

  const owner_field = await table.owner_fieldname();
  return await asyncMap(rows, async (row) => {
    await eachView(layout, async (segment) => {
      const view = await getView(segment.view);
      if (!view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
        );
      view.check_viewtemplate();
      if (view.viewtemplateObj.renderRows && view.view_select.type === "Own") {
        segment.contents = (
          await view.viewtemplateObj.renderRows(
            view.table,
            view.name,
            view.configuration,
            extra,
            [row]
          )
        )[0];
      } else {
        let state;
        const pk_name = table.pk_name;
        switch (view.view_select.type) {
          case "Own":
            state = { [pk_name]: row[pk_name] };
            break;
          case "Independent":
            state = {};
            break;
          case "ChildList":
          case "OneToOneShow":
            state = { [view.view_select.field_name]: row[pk_name] };
            break;
          case "ParentShow":
            //todo set by pk name of parent tablr
            state = { id: row[view.view_select.field_name] };
            break;
        }
        segment.contents = await view.run(state, extra);
      }
    });
    const user_id = extra.req.user ? extra.req.user.id : null;

    const is_owner =
      table.ownership_formula && user_id
        ? await table.is_owner(extra.req.user, row)
        : owner_field && user_id && row[owner_field] === user_id;

    return render(
      row,
      fields,
      layout,
      viewname,
      table,
      role,
      extra.req,
      is_owner
    );
  });
};

/**
 * @param {number} table_id 
 * @param {string} viewname 
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {object} opts.layout
 * @param {object} state 
 * @param {object} extra 
 * @returns {Promise<object[]>}
 */
const runMany = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra
) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state });
  const q = await stateFieldsToQuery({ state, fields });
  if (extra && extra.where) Object.assign(qstate, extra.where);

  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    ...(extra && extra.limit && { limit: extra.limit }),
    ...(extra && extra.offset && { offset: extra.offset }),
    ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
    ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc }),
    ...q,
  });

  const rendered = await renderRows(
    tbl,
    viewname,
    { columns, layout },
    extra,
    rows
  );

  return rendered.map((html, ix) => ({ html, row: rows[ix] }));
};

/**
 * @param {object} row 
 * @param {Field[]} fields 
 * @param {Layout} layout0 
 * @param {string} viewname 
 * @param {Table} table 
 * @param {Role} role 
 * @param {object} req 
 * @param {object} is_owner 
 * @throws {Error}
 * @returns {Layout}
 */
const render = (row, fields, layout0, viewname, table, role, req, is_owner) => {
  const evalMaybeExpr = (segment, key, fmlkey) => {
    if (segment.isFormula && segment.isFormula[fmlkey || key]) {
      try {
        const f = get_expression_function(segment[key], fields);
        segment[key] = f(row, req.user);
      } catch (error) {
        error.message = `Error in formula ${segment[key]} for property ${key} in segment of type ${segment.type}:\n${error.message}`;
        throw error;
      }
    }
  };
  const layout = structuredClone(layout0);
  traverseSync(layout, {
    link(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "text");
    },
    view_link(segment) {
      evalMaybeExpr(segment, "view_label", "label");
    },
    blank(segment) {
      evalMaybeExpr(segment, "contents", "text");
    },
    action(segment) {
      evalMaybeExpr(segment, "action_label");
    },
    card(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "title");
    },
    image(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "alt");
      if (segment.srctype === "Field") {
        const field = fields.find((f) => f.name === segment.field);
        if (!field) return;
        if (field.type.name === "String") segment.url = row[segment.field];
        if (field.reftable_name === "_sc_files")
          segment.url = `/files/serve/${row[segment.field]}`;
      }
    },
    container(segment) {
      evalMaybeExpr(segment, "bgColor");
      evalMaybeExpr(segment, "customClass");
      evalMaybeExpr(segment, "url");

      if (segment.showIfFormula) {
        const f = get_expression_function(segment.showIfFormula, fields);
        if (!f(row)) segment.hide = true;
      }
    },
  });
  const locale = req.getLocale();
  translateLayout(layout, locale);
  const blockDispatch = {
    field({ field_name, fieldview, configuration }) {
      let field = fields.find((fld) => fld.name === field_name);
      if (!field) return "";

      let val = row[field_name];
      if (
        field &&
        field.attributes &&
        field.attributes.localized_by &&
        field.attributes.localized_by[locale]
      ) {
        const localized_fld = field.attributes.localized_by[locale];
        val = row[localized_fld];
      }

      if (fieldview && field.type === "File") {
        return val
          ? getState().fileviews[fieldview].run(
              val,
              row[`${field_name}__filename`],
              configuration
            )
          : "";
      } else if (
        fieldview &&
        field.type &&
        field.type.fieldviews &&
        field.type.fieldviews[fieldview]
      )
        return field.type.fieldviews[fieldview].run(val, req, configuration);
      else return text(val);
    },
    join_field({ join_field, field_type, fieldview }) {
      const keypath = join_field.split(".");
      let value;
      if (keypath.length === 2) {
        const [refNm, targetNm] = keypath;
        value = row[`${refNm}_${targetNm}`];
      } else {
        const [refNm, through, targetNm] = keypath;
        value = row[`${refNm}_${through}_${targetNm}`];
      }
      if (field_type === "File") {
        return value ? getState().fileviews[fieldview].run(value, "") : "";
      }
      if (field_type && fieldview) {
        const type = getState().types[field_type];
        if (type && getState().types[field_type])
          return type.fieldviews[fieldview].run(value, req);
        else return text(value);
      } else return text(value);
    },
    aggregation({ agg_relation, stat }) {
      const [table, fld] = agg_relation.split(".");
      const targetNm = (stat + "_" + table + "_" + fld).toLowerCase();
      const val = row[targetNm];
      return text(val);
    },
    action(segment) {
      const url = action_url(
        viewname,
        table,
        segment.action_name,
        row,
        segment.rndid,
        "rndid"
      );
      return action_link(url, req, segment);
    },
    view_link(view) {
      const { key } = view_linker(view, fields);
      return key(row);
    },
  };
  return renderLayout({
    blockDispatch,
    layout,
    role,
    is_owner,
  });
};

/**
 * @param {number} table_id 
 * @param {*} viewname 
 * @param {object} opts
 * @param {object[]} opts.columns
 * @param {*} opts.layout
 * @param {*} body 
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
  { req, res }
) => {
  const col = columns.find(
    (c) => c.type === "Action" && c.rndid === body.rndid && body.rndid
  );
  const table = await Table.findOne({ id: table_id });
  const row = await table.getRow({ id: body.id });
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
    return { json: { error: e.message || e } };
  }
};

module.exports = {
  /** @type {string} */
  name: "Show",
  /** @type {string} */
  description: "Show a single row, with flexible layout",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  renderRows,
  initial_config,
  /** @type {boolean} */
  display_state_form: false,
  routes: { run_action },
  /**
   * @param {object} opts
   * @param {object} opts.layout
   * @returns {string[]}
   */
  getStringsForI18n({ layout }) {
    return getStringsForI18n(layout);
  },
};
