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
const Crash = require("../../models/crash");
const Workflow = require("../../models/workflow");
const Trigger = require("../../models/trigger");

const { getState } = require("../../db/state");
const {
  eachView,
  traverse,
  getStringsForI18n,
  translateLayout,
} = require("../../models/layout");
const { check_view_columns } = require("../../plugin-testing");

const {
  div,
  text,
  span,
  a,
  text_attr,
  i,
  button,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  stateFieldsToQuery,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
  calcrelViewOptions,
  calcfldViewConfig,
  getActionConfigFields,
  run_action_column,
  readState,
  add_free_variables_to_joinfields,
} = require("../../plugin-helper");
const {
  action_url,
  view_linker,
  parse_view_select,
  action_link,
  splitUniques,
} = require("./viewable_fields");
const db = require("../../db");
const {
  asyncMap,
  structuredClone,
  InvalidConfiguration,
  mergeIntoWhere,
  isWeb,
  hashState,
} = require("../../utils");
const { traverseSync } = require("../../models/layout");
const {
  get_expression_function,
  eval_expression,
  freeVariables,
} = require("../../models/expression");
const { get_base_url } = require("../../models/config");
const Library = require("../../models/library");
const { extractFromLayout } = require("../../diagram/node_extract_utils");

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
            "GoBack",
            ...boolfields.map((f) => `Toggle ${f.name}`),
            ...stateActions.map(([k, v]) => k),
          ];
          (
            await Trigger.find({
              when_trigger: { or: ["API call", "Never"] },
            })
          ).forEach((tr) => {
            actions.push(tr.name);
          });
          (
            await Trigger.find({
              table_id: context.table_id,
            })
          ).forEach((tr) => {
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
            "show"
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
          const rel_field_view_options = await calcrelViewOptions(
            table,
            "show"
          );
          const { link_view_opts, view_name_opts, view_relation_opts } =
            await get_link_view_opts(table, context.viewname);
          const roles = await User.get_roles();
          const { parent_field_list } = await table.get_parent_relations(
            true,
            true
          );

          const { child_field_list, child_relations } =
            await table.get_child_relations(true);
          var agg_field_opts = {};
          child_relations.forEach(({ table, key_field, through }) => {
            const aggKey =
              (through ? `${through.name}->` : "") +
              `${table.name}.${key_field.name}`;
            agg_field_opts[aggKey] = table.fields
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
            field_view_options: {
              ...field_view_options,
              ...rel_field_view_options,
            },
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
            view_name_opts,
            view_relation_opts,
            mode: "show",
            ownership:
              !!table.ownership_field_id ||
              !!table.ownership_formula ||
              table.name === "users",
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
                class: "validate-expression validate-expression-conditional",
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
  extra,
  { showQuery }
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
  const { rows, message } = await showQuery(state, fields);
  if (message) return extra.req.__(message);
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
  await set_join_fieldviews({ table: tbl, layout, fields });

  const rendered = (
    await renderRows(
      tbl,
      viewname,
      { columns, layout },
      extra,
      [rows[0]],
      state
    )
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
  if (!extra.req.generate_email) return page_title_preamble + rendered;
  else {
    return {
      markup: rendered.markup,
      styles: rendered.styles,
    };
  }
};

/**
 * @param {object} opts
 * @param {object} opts.layout
 * @param {object[]} opts.fields
 * @returns {Promise<void>}
 */
const set_join_fieldviews = async ({ table, layout, fields }) => {
  await traverse(layout, {
    join_field: async (segment) => {
      const { join_field, fieldview } = segment;
      if (!fieldview) return;
      const field = await table.getField(join_field);

      if (field && field.type === "File") segment.field_type = "File";
      else if (field?.type.name && field?.type?.fieldviews[fieldview])
        segment.field_type = field.type.name;
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
  rows,
  state
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";

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
  await set_join_fieldviews({ table, layout, fields });

  const owner_field = await table.owner_fieldname();
  const subviewExtra = { ...extra };
  if (extra.req?.generate_email) {
    // no mjml markup for for nested subviews, only for the top view
    subviewExtra.req = { ...extra.req, generate_email: false };
  }
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
            subviewExtra,
            [row],
            state
          )
        )[0];
      } else {
        let state1;
        const pk_name = table.pk_name;
        switch (view.view_select.type) {
          case "Own":
            state1 = { [pk_name]: row[pk_name] };
            break;
          case "Independent":
            state1 = {};
            break;
          case "ChildList":
          case "OneToOneShow":
            state1 = {
              [view.view_select.through
                ? `${view.view_select.throughTable}.${view.view_select.through}.${view.view_select.table_name}.${view.view_select.field_name}`
                : view.view_select.field_name]: row[pk_name],
            };
            break;
          case "ParentShow":
            //todo set by pk name of parent tablr
            state1 = { id: row[view.view_select.field_name] };
            break;
        }
        const extra_state = segment.extra_state_fml
          ? eval_expression(segment.extra_state_fml, row, extra.req.user)
          : {};
        const { id, ...outerState } = state;
        const state2 = { ...outerState, ...state1, ...extra_state };
        segment.contents = await view.run(state2, subviewExtra);
      }
    });
    const user_id = extra.req.user ? extra.req.user.id : null;

    const is_owner =
      table.ownership_formula && user_id && role > table.min_role_read
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
  extra,
  { runManyQuery }
) => {
  const tbl = await Table.findOne({ id: table_id });
  const rows = await runManyQuery(state, {
    where: extra.where,
    limit: extra.limit,
    offset: extra.offset,
    orderBy: extra.orderBy,
    orderDesc: extra.orderDesc,
  });
  const rendered = await renderRows(
    tbl,
    viewname,
    { columns, layout },
    extra,
    rows,
    state
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
        segment[key] = eval_expression(segment[key], row, req.user);
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
        if (field.type === "File")
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
      const cfg = { ...field.attributes, ...configuration };
      if (fieldview && field.type === "File") {
        return val
          ? getState().fileviews[fieldview].run(
              val,
              row[`${field_name}__filename`],
              cfg
            )
          : "";
      } else if (
        fieldview &&
        field.type &&
        field.type.fieldviews &&
        field.type.fieldviews[fieldview]
      )
        return field.type.fieldviews[fieldview].run(val, req, cfg);
      else return text(val);
    },
    join_field(jf) {
      const { join_field, field_type, fieldview, configuration } = jf;
      const keypath = join_field.split(".");
      let value;
      if (join_field.includes("->")) {
        const [relation, target] = join_field.split("->");
        const [ontable, ref] = relation.split(".");
        value = row[`${ref}_${ontable}_${target}`];
      } else {
        value = row[join_field.split(".").join("_")];
      }
      if (field_type === "File") {
        return value ? getState().fileviews[fieldview].run(value, "") : "";
      }

      if (field_type && fieldview) {
        const type = getState().types[field_type];
        if (type && getState().types[field_type]) {
          return type.fieldviews[fieldview].run(value, req, configuration);
        } else return text(value);
      } else return text(value);
    },
    aggregation({ agg_relation, stat, aggwhere }) {
      let table, fld, through;
      if (agg_relation.includes("->")) {
        let restpath;
        [through, restpath] = agg_relation.split("->");
        [table, fld] = restpath.split(".");
      } else {
        [table, fld] = agg_relation.split(".");
      }
      const targetNm = (
        stat +
        "_" +
        table +
        "_" +
        fld +
        db.sqlsanitize(aggwhere || "")
      ).toLowerCase();
      const val = row[targetNm];
      if (stat.toLowerCase() === "array_agg" && Array.isArray(val))
        return val.map((v) => text(v.toString())).join(", ");
      else return text(val);
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
      const { key } = view_linker(view, fields, (s) => s, isWeb(req), req.user);
      return key(row);
    },
    tabs(segment, go) {
      if (segment.tabsStyle !== "Value switch") return false;
      const value = row[segment.field];
      const ix = segment.titles.findIndex((t) =>
        typeof t.value === "undefined"
          ? `${t}` === `${value}`
          : value === t.value
      );
      if (ix === -1) return "";
      return go(segment.contents[ix]);
    },
  };
  return renderLayout({
    blockDispatch,
    layout,
    role,
    is_owner,
    req,
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
  { req, res },
  { actionQuery }
) => {
  const result = await actionQuery();
  if (result.json.error) {
    Crash.create({ message: result.json.error, stack: "" }, req);
  }
  return result;
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
  /*authorise_get: async ({ query, table_id }, { authorizeGetQuery }) => {
    return await authorizeGetQuery(query, table_id);
  },*/
  queries: ({
    table_id,
    exttable_name,
    name, // viewname
    configuration: { columns, layout },
    req,
    res,
  }) => ({
    async showQuery(state, fields) {
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout
      );
      readState(state, fields);
      const tbl = await Table.findOne(table_id || exttable_name);
      const qstate = await stateFieldsToWhere({
        fields,
        state,
        approximate: true,
        table: tbl,
      });
      if (Object.keys(qstate).length === 0)
        return {
          rows: null,
          message: "No row selected",
        };
      if (tbl.ownership_formula) {
        const freeVars = freeVariables(tbl.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
      }
      const rows = await tbl.getJoinedRows({
        where: qstate,
        joinFields,
        aggregations,
        limit: 5,
        starFields: tbl.name === "users",
        forPublic: !req.user,
        forUser: req.user,
      });
      return {
        rows,
        message: null,
      };
    },
    async runManyQuery(state, { where, limit, offset, orderBy, orderDesc }) {
      const tbl = await Table.findOne({ id: table_id });
      const fields = await tbl.getFields();
      readState(state, fields);
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout
      );
      const stateHash = hashState(state, name);
      const qstate = await stateFieldsToWhere({ fields, state, table: tbl });
      const q = await stateFieldsToQuery({ state, fields, stateHash });
      if (where) mergeIntoWhere(qstate, where);
      const role = req && req.user ? req.user.role_id : 10;
      if (tbl.ownership_field_id && role > tbl.min_role_read && req) {
        const owner_field = fields.find((f) => f.id === tbl.ownership_field_id);
        if (qstate[owner_field.name])
          qstate[owner_field.name] = [
            qstate[owner_field.name],
            req.user ? req.user.id : -1,
          ];
        else qstate[owner_field.name] = req.user ? req.user.id : -1;
      }
      if (tbl.ownership_formula && role > tbl.min_role_read) {
        const freeVars = freeVariables(tbl.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
      }
      let rows = await tbl.getJoinedRows({
        where: qstate,
        joinFields,
        aggregations,
        ...(limit && { limit: limit }),
        ...(offset && { offset: offset }),
        ...(orderBy && { orderBy: orderBy }),
        ...(orderDesc && { orderDesc: orderDesc }),
        ...q,
        forPublic: !req.user,
        forUser: req.user,
      });
      if (tbl.ownership_formula && role > tbl.min_role_read && req) {
        rows = rows.filter((row) => tbl.is_owner(req.user, row));
      }
      return rows;
    },
    async actionQuery() {
      const body = req.body;
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
          res,
          referrer: req.get("Referrer"),
        });
        return { json: { success: "ok", ...(result || {}) } };
      } catch (e) {
        return { json: { error: e.message || e } };
      }
    },
    /*async authorizeGetQuery(query, table_id) {
      let body = query || {};
      const user_id = req.user ? req.user.id : null;

      if (user_id && Object.keys(body).length == 1) {
        const table = await Table.findOne({ id: table_id });
        if (table.ownership_field_id || table.ownership_formula) {
          const fields = await table.getFields();
          const { uniques } = splitUniques(fields, body);
          if (Object.keys(uniques).length > 0) {
            const row = await table.getJoinedRows({
              where: uniques,
              forPublic: !req.user,
              forUser: req.user,
            });
            if (row.length > 0) return true;
            else return false;
          }
        }
      }
      return false;
    },*/
  }),
  configCheck: async (view) => {
    return await check_view_columns(view, view.configuration.columns);
  },
  connectedObjects: async (configuration) => {
    return extractFromLayout(configuration.layout);
  },
};
