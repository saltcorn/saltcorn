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
const PageGroup = require("../../models/page_group");
const Crash = require("../../models/crash");
const Workflow = require("../../models/workflow");
const Trigger = require("../../models/trigger");
const { Relation } = require("@saltcorn/common-code");

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
  script,
  domReady,
} = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  stateFieldsToQuery,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
  calcrelViewOptions,
  calcfldViewConfig,
  getActionConfigFields,
  run_action_column,
  readState,
  add_free_variables_to_joinfields,
  stateToQueryString,
  pathToState,
  displayType,
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
  getSafeBaseUrl,
  dollarizeObject,
  getSessionId,
  interpolate,
  validSqlId,
} = require("../../utils");
const { traverseSync } = require("../../models/layout");
const {
  get_expression_function,
  eval_expression,
  freeVariables,
  freeVariablesInInterpolation,
} = require("../../models/expression");
const { get_base_url } = require("../../models/config");
const Library = require("../../models/library");
const { extractFromLayout } = require("../../diagram/node_extract_utils");
const _ = require("underscore");

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
          const table = Table.findOne(
            context.table_id || context.exttable_name
          );
          const fields = table.getFields();

          const boolfields = fields.filter(
            (f) => f.type && f.type.name === "Bool"
          );
          const stateActions = Object.entries(getState().actions).filter(
            ([k, v]) => !v.disableInBuilder
          );
          const builtInActions = [
            "Delete",
            "GoBack",
            ...boolfields.map((f) => `Toggle ${f.name}`),
          ];

          const triggerActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
          });
          const actions = Trigger.action_options({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            builtInLabel: "Show Actions",
            builtIns: builtInActions,
          });
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = Table.findOne({
                name: field.reftable_name,
              });
              if (field.reftable) await field.reftable.getFields();
            }
          }
          const actionConfigForms = {
            Delete: [
              {
                name: "after_delete_action",
                label: req.__("After delete"),
                type: "String",
                required: true,
                attributes: {
                  options: ["Go to URL", "Reload page"],
                },
              },
              {
                name: "after_delete_url",
                label: req.__("URL after delete"),
                type: "String",
                showIf: { after_delete_action: "Go to URL" },
              },
            ],
          };
          for (const [name, action] of stateActions) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table,
                { mode: "show", req }
              );
            }
          }

          //const fieldViewConfigForms = await calcfldViewConfig(fields, false);
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
              }),
              new Field({
                name: "reset_password_url",
                label: "Reset Password URL",
                type: "String",
              })
            );
            field_view_options.verification_url = ["as_text", "as_link"];
            field_view_options.reset_password_url = ["as_text", "as_link"];
          }
          const rel_field_view_options = await calcrelViewOptions(
            table,
            "show"
          );
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
              .map((f) => ({
                name: f.name,
                label: f.label,
                ftype: f.type.name || f.type,
                table_name: table.name,
                table_id: table.id,
              }));
          });
          const agg_fieldview_options = {};

          Object.values(getState().types).forEach((t) => {
            agg_fieldview_options[t.name] = Object.entries(t.fieldviews)
              .filter(([k, v]) => !v.isEdit && !v.isFilter)
              .map(([k, v]) => k);
          });
          const pages = await Page.find();
          const groups = (await PageGroup.find()).map((g) => ({
            name: g.name,
          }));
          const images = await File.find({ mime_super: "image" });
          const library = (await Library.find({})).filter((l) =>
            l.suitableFor("show")
          );
          const myviewrow = View.findOne({ name: context.viewname });
          return {
            tableName: table.name,
            fields: fields.map((f) => f.toBuilder),
            images,
            actions,
            triggerActions,
            builtInActions,
            actionConfigForms,
            //fieldViewConfigForms,
            field_view_options: {
              ...field_view_options,
              ...rel_field_view_options,
            },
            parent_field_list,
            child_field_list,
            agg_field_opts,
            agg_fieldview_options,
            min_role: (myviewrow || {}).min_role,
            roles,
            library,
            pages,
            page_groups: groups,
            allowMultiStepAction: true,
            handlesTextStyle,
            mode: "show",
            ownership:
              !!table.ownership_field_id ||
              !!table.ownership_formula ||
              table.name === "users",
          };
        },
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
  const tbl = Table.findOne(table_id);
  const fields = await tbl.getFields();
  if (tbl.name === "users") {
    fields.push(
      new Field({
        name: "verification_token",
        label: "Verification Token",
        type: "String",
      }),
      new Field({
        name: "reset_password_token",
        label: "Reset Password Token",
        type: "String",
      })
    );
  }
  const { rows, message } = await showQuery(state);
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
      }),
      new Field({
        name: "reset_password_url",
        label: "Reset Password URL",
        type: "String",
      })
    );
    for (const row of rows) {
      row.verification_url = `${base}auth/verify?token=${
        row.verification_token
      }&email=${encodeURIComponent(row.email)}`;
      row.reset_password_url = `${base}auth/reset?token=${
        row.reset_password_token
      }&email=${encodeURIComponent(row.email)}`;
    }
  }
  await set_load_actions_join_fieldviews({
    table: tbl,
    layout,
    fields,
    req: extra.req,
    res: extra.res,
    row: rows[0],
    isPreview: extra.isPreview,
  });

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

  //legacy
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
    return rendered;
  }
};

/**
 * @param {object} opts
 * @param {object} opts.layout
 * @param {object[]} opts.fields
 * @returns {Promise<void>}
 */
const set_load_actions_join_fieldviews = async ({
  table,
  layout,
  fields,
  req,
  res,
  row,
  isPreview,
}) => {
  await traverse(layout, {
    join_field: async (segment) => {
      const { join_field, fieldview } = segment;
      if (!fieldview) return;
      const field = table.getField(join_field);

      if (field && field.type === "File") segment.field_type = "File";
      else if (field?.type.name && field?.type?.fieldviews[fieldview]) {
        segment.field_type = field.type.name;
        segment.target_field_attributes = field.attributes;
      }
    },
    async action(segment) {
      if (segment.action_style === "on_page_load") {
        segment.type = "blank";
        segment.style = {};
        if (segment.minRole && segment.minRole != 100) {
          const minRole = +segment.minRole;
          const userRole = req?.user?.role_id || 100;
          if (minRole < userRole) return;
        }
        //run action
        if (isPreview) return;

        const actionResult = await run_action_column({
          col: { ...segment },
          referrer: req?.get?.("Referrer"),
          req,
          res,
          table,
          row,
        });
        segment.type = "blank";
        segment.style = {};
        if (actionResult)
          segment.contents = script(
            domReady(`common_done(${JSON.stringify(actionResult)})`)
          );
        else segment.contents = "";
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
  rows,
  state
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";

  const fields = table.getFields();

  const role = extra.req.user ? extra.req.user.role_id : 100;
  var views = {};
  const getView = async (name, relation) => {
    if (views[name]) return views[name];
    const view_select = parse_view_select(name, relation);
    const view = View.findOne({ name: view_select.viewname });
    if (!view) return false;
    if (view.table_id === table.id) view.table = table;
    else view.table = Table.findOne({ id: view.table_id });
    view.view_select = view_select;
    views[name] = view;
    return view;
  };
  await set_load_actions_join_fieldviews({
    table,
    layout,
    fields,
    req: extra.req,
    res: extra.res,
  });

  const owner_field = await table.owner_fieldname();
  const subviewExtra = { ...extra };
  if (extra.req?.generate_email) {
    // no mjml markup for for nested subviews, only for the top view
    subviewExtra.req = { ...extra.req, isSubView: true };
  }
  return await asyncMap(rows, async (row) => {
    await eachView(layout, async (segment) => {
      // do all the parsing with data here? make a factory
      const view = await getView(segment.view, segment.relation);
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
        let state1 = {};
        const pk_name = table.pk_name;
        const get_row_val = (k) => {
          //handle expanded joinfields
          if (row[k] === null) return null;
          if (row[k]?.id === null) return null;
          return row[k]?.id || row[k];
        };
        if (view.view_select.type === "RelationPath" && view.table_id) {
          const targetTbl = Table.findOne({ id: view.table_id });
          const relation = new Relation(
            segment.relation,
            targetTbl.name,
            displayType(await view.get_state_fields())
          );
          state1 = pathToState(relation, get_row_val);
        } else {
          switch (view.view_select.type) {
            case "Own":
              state1 = { [pk_name]: get_row_val(pk_name) };
              break;
            case "Independent":
              state1 = {};
              break;
            case "ChildList":
            case "OneToOneShow":
              state1 = {
                [view.view_select.through
                  ? `${view.view_select.throughTable}.${view.view_select.through}.${view.view_select.table_name}.${view.view_select.field_name}`
                  : view.view_select.field_name]: get_row_val(pk_name),
              };
              break;
            case "ParentShow":
              //todo set by pk name of parent tablr
              state1 = {
                id: get_row_val(view.view_select.field_name),
              };
              break;
          }
        }
        const extra_state = segment.extra_state_fml
          ? eval_expression(
              segment.extra_state_fml,
              {
                ...dollarizeObject(state),
                session_id: getSessionId(extra.req),
                ...row,
              },
              extra.req.user,
              `Extra state formula for view ${view.name}`
            )
          : {};
        const { id, ...outerState } = state;
        //console.log(segment);
        if (segment.state === "local") {
          const state2 = { ...state1, ...extra_state };
          const qs = stateToQueryString(state2, true);
          if (
            view.name === viewname &&
            JSON.stringify(state) === JSON.stringify(state2)
          )
            throw new InvalidConfiguration(
              `View ${view.name} embeds itself with same state; inifinite loop detected`
            );
          segment.contents = div(
            {
              class: "d-inline",
              "data-sc-embed-viewname": view.name,
              "data-sc-local-state": `/view/${view.name}${qs}`,
            },
            await view.run(state2, subviewExtra, view.isRemoteTable())
          );
        } else {
          const state2 = { ...outerState, ...state1, ...extra_state };
          const qs = stateToQueryString(state2, true);

          if (
            view.name === viewname &&
            JSON.stringify(state) === JSON.stringify(state2)
          )
            throw new InvalidConfiguration(
              `View ${view.name} embeds itself with same state; inifinite loop detected`
            );
          segment.contents = div(
            {
              class: "d-inline",
              "data-sc-embed-viewname": view.name,
              "data-sc-view-source": `/view/${view.name}${qs}`,
            },
            await view.run(state2, subviewExtra, view.isRemoteTable())
          );
        }
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
      is_owner,
      state,
      extra
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
  const tbl = Table.findOne({ id: table_id });
  const rows = await runManyQuery(state, {
    where: extra.where,
    joinFieldsExtra: extra.joinFields,
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
const render = (
  row,
  fields,
  layout0,
  viewname,
  table,
  role,
  req,
  is_owner,
  state,
  extra
) => {
  const session_id = getSessionId(req);
  const locale = req.getLocale();

  const evalMaybeExpr = (segment, key, fmlkey) => {
    if (segment.isFormula && segment.isFormula[fmlkey || key]) {
      segment[key] = eval_expression(
        segment[key],
        { session_id, locale, ...row },
        req.user,
        `property ${key} in segment of type ${segment.type}`
      );
    }
  };
  const layout = structuredClone(layout0);
  traverseSync(layout, {
    link(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "text");
      if (
        req?.generate_email &&
        req.get_base_url &&
        segment.url.startsWith("/")
      ) {
        const targetPrefix = req.get_base_url();
        const safePrefix = (targetPrefix || "").endsWith("/")
          ? targetPrefix.substring(0, targetPrefix.length - 1)
          : targetPrefix || "";
        segment.url = safePrefix + segment.url;
      }
    },
    view_link(segment) {
      evalMaybeExpr(segment, "view_label", "label");
    },
    blank(segment) {
      evalMaybeExpr(segment, "contents", "text");
    },
    tabs(segment) {
      const to_delete = new Set();

      (segment.showif || []).forEach((sif, ix) => {
        if (sif) {
          const showit = eval_expression(
            sif,
            { session_id, ...row },
            req.user,
            `Tabs show if formula`
          );
          if (!showit) to_delete.add(ix);
        }
      });

      // TODO mutation here - potential issue with renderRows
      segment.titles = segment.titles.filter((v, ix) => !to_delete.has(ix));
      segment.contents = segment.contents.filter((v, ix) => !to_delete.has(ix));

      (segment.titles || []).forEach((t, ix) => {
        if (typeof t === "string" && t.includes("{{")) {
          segment.titles[ix] = interpolate(t, row, req.user, "Tab titles");
        }
      });
    },
    action(segment) {
      evalMaybeExpr(segment, "action_label");
    },
    card(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "title");
      evalMaybeExpr(segment, "class");
    },
    image(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "alt");
      if (segment.srctype === "Field") {
        const field = fields.find((f) => f.name === segment.field);
        if (!field) return;
        if (field.type.name === "String") segment.url = row[segment.field];
        if (field.type === "File") {
          segment.url = `/files/serve/${row[segment.field]}`;
          segment.fileid = row[segment.field];
        }
      }
    },
    container(segment) {
      evalMaybeExpr(segment, "bgColor");
      evalMaybeExpr(segment, "customClass");
      evalMaybeExpr(segment, "customId");
      evalMaybeExpr(segment, "url");
      if (segment.bgType === "Image Field") {
        segment.bgType = "Image";
        segment.bgFileId = row[segment.bgField];
      }

      if (segment.showIfFormula) {
        const f = get_expression_function(segment.showIfFormula, fields);
        if (!f({ ...dollarizeObject(state || {}), ...row }, req.user))
          segment.hide = true;
        else segment.hide = false;
      }
      if (segment.click_action) {
        segment.url = `javascript:view_post('${viewname}', 'run_action', {click_action: '${
          segment.click_action
        }', ${table.pk_name}: ${JSON.stringify(row[table.pk_name])}})`;
      }
    },
  });
  translateLayout(layout, locale);
  const blockDispatch = {
    field({ field_name, fieldview, configuration, click_to_edit }) {
      let field = fields.find((fld) => fld.name === field_name);
      if (!field) return "";

      let val = row[field_name];
      let fvrun;
      if (
        field &&
        field.attributes &&
        field.attributes.localized_by &&
        field.attributes.localized_by[locale]
      ) {
        const localized_fld = field.attributes.localized_by[locale];
        val = row[localized_fld];
      }
      const cfg = {
        row,
        ...field.attributes,
        ...configuration,
      };
      if (fieldview && field.type === "File") {
        if (req.generate_email) cfg.targetPrefix = getSafeBaseUrl();
        fvrun = val
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
        fvrun = field.type.fieldviews[fieldview].run(val, req, cfg);
      else fvrun = text(val);
      if (
        click_to_edit &&
        (role <= table.min_role_write || table.is_owner(req.user, row))
      )
        return div(
          {
            "data-inline-edit-fielddata": encodeURIComponent(
              JSON.stringify({
                field_name,
                table_name: table.name,
                pk: row[table.pk_name],
                fieldview,
                configuration,
              })
            ),
            "data-inline-edit-ajax": "true",
            "data-inline-edit-dest-url": `/api/${table.name}/${
              row[table.pk_name]
            }`,
            class: !isWeb(req) ? "mobile-data-inline-edit" : "",
          },
          fvrun
        );
      else return fvrun;
    },
    join_field(jf) {
      const {
        join_field,
        field_type,
        fieldview,
        configuration,
        target_field_attributes,
        click_to_edit,
      } = jf;
      const keypath = join_field.split(".");
      let value;
      if (join_field.includes("->")) {
        const [relation, target] = join_field.split("->");
        const [ontable, ref] = relation.split(".");
        const key =
          jf.targetNm ||
          `${ref}_${ontable.replaceAll(" ", "").toLowerCase()}_${target}`;
        value = row[validSqlId(key)];
      } else {
        value = row[join_field.split(".").join("_")];
      }
      if (field_type === "File") {
        return value
          ? getState().fileviews[fieldview].run(value, "", configuration || {})
          : "";
      }
      let fvRes;
      if (field_type && fieldview) {
        const type = getState().types[field_type];
        if (type && getState().types[field_type]) {
          fvRes = type.fieldviews[fieldview].run(value, req, {
            row,
            ...(target_field_attributes || {}),
            ...configuration,
          });
        } else fvRes = text(value);
      } else fvRes = text(value);
      if (
        click_to_edit &&
        (role <= table.min_role_write || table.is_owner(req.user, row))
      )
        return div(
          {
            "data-inline-edit-fielddata": encodeURIComponent(
              JSON.stringify({
                field_name: keypath[0],
                table_name: table.name,
                pk: row[table.pk_name],
                fieldview,
                configuration,
                join_field: keypath[keypath.length - 1],
              })
            ),
            "data-inline-edit-ajax": "true",
            "data-inline-edit-dest-url": `/api/${table.name}/${
              row[table.pk_name]
            }`,
            class: !isWeb(req) ? "mobile-data-inline-edit" : "",
          },
          fvRes
        );
      else return fvRes;
    },
    aggregation(column) {
      const { agg_relation, stat, aggwhere, agg_field } = column;
      let table, fld, through;
      if (agg_relation.includes("->")) {
        let restpath;
        [through, restpath] = agg_relation.split("->");
        [table, fld] = restpath.split(".");
      } else {
        [table, fld] = agg_relation.split(".");
      }
      let targetNm =
        column.targetNm ||
        db.sqlsanitize(
          (
            stat +
              "_" +
              table +
              "_" +
              fld +
              "_" +
              (agg_field || "").split("@")[0] +
              "_" +
              aggwhere || ""
          ).toLowerCase()
        );
      if (targetNm.length > 58) {
        targetNm = targetNm
          .split("")
          .filter((c, i) => i % 2 == 0)
          .join("");
      }
      const val = row[targetNm];
      if (stat.toLowerCase() === "array_agg" && Array.isArray(val))
        return val.map((v) => text(v.toString())).join(", ");
      else if (column.agg_fieldview) {
        const aggField = Table.findOne(table)?.getField?.(column.agg_field);
        const outcomeType =
          stat === "Percent true" || stat === "Percent false"
            ? "Float"
            : stat === "Count" || stat === "CountUnique"
              ? "Integer"
              : aggField.type?.name;
        const type = getState().types[outcomeType];
        if (type?.fieldviews[column.agg_fieldview]) {
          const readval = type.read(val);
          return type.fieldviews[column.agg_fieldview].run(
            readval,
            req,
            column?.configuration || {}
          );
        }
      }
      return text(val);
    },
    action(segment) {
      if (segment.action_style === "on_page_load") {
        if (extra?.isPreview) return "";
        run_action_column({
          col: { ...segment },
          referrer: req?.get?.("Referrer"),
          req: req,
        }).catch((e) => Crash.create(e, req));
        return "";
      }
      let url = action_url(
        viewname,
        table,
        segment.action_name,
        row,
        segment.rndid,
        "rndid",
        segment.confirm
      );
      if (
        segment.action_name === "Delete" &&
        segment.configuration?.after_delete_action == "Reload page"
      ) {
        url = {
          javascript: `ajax_post('/delete/${table.name}/${
            row[table.pk_name]
          }', {success:()=>{close_saltcorn_modal();location.reload();}})`,
        };
        return action_link(url, req, segment);
      } else if (segment.action_name === "Delete")
        url = `/delete/${table.name}/${
          row[table.pk_name]
        }?redirect=${encodeURIComponent(
          interpolate(
            segment.configuration?.after_delete_url || "/",
            row,
            req?.user,
            "delete action: after delete URL"
          )
        )}`;
      return action_link(url, req, segment);
    },
    view_link(view) {
      const prefix =
        req.generate_email && req.get_base_url ? req.get_base_url() : "";
      const { key } = view_linker(
        view,
        fields,
        (s) => s,
        isWeb(req),
        req.user,
        prefix,
        state,
        req,
        viewname
      );
      return key(row);
    },
    tabs(segment, go) {
      if (segment.tabsStyle !== "Value switch") return false;
      const rval = row[segment.field];
      const value = rval?.id || rval; // TODO pkname of join table
      const ix = segment.titles.findIndex((t) =>
        typeof t.value === "undefined"
          ? `${t}` === `${value}`
          : value === t.value
      );
      if (ix === -1) return "";
      return go(segment.contents[ix]);
    },
    blank(segment) {
      if (segment.isHTML) {
        return interpolate(
          segment.contents,
          { locale, ...row },
          req?.user,
          "HTML element"
        );
      } else return segment.contents;
    },
  };
  return renderLayout({
    blockDispatch,
    layout,
    role,
    is_owner,
    req,
    hints: getState().getLayout(req.user).hints || {},
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
  routes: { run_action },
  /**
   * @param {object} opts
   * @param {object} opts.layout
   * @returns {string[]}
   */
  getStringsForI18n({ layout }) {
    return getStringsForI18n(layout);
  },
  async interpolate_title_string(table_id, title, state) {
    const tbl = Table.findOne(table_id);
    if (state?.[tbl.pk_name]) {
      const freeVars = freeVariablesInInterpolation(title);
      const joinFields = {};
      add_free_variables_to_joinfields(freeVars, joinFields, tbl.fields);
      const row = await tbl.getJoinedRow({
        where: { [tbl.pk_name]: state[tbl.pk_name] },
        joinFields,
      });
      return interpolate(title, row, null, "Show view title string");
    } else return title;
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
    async showQuery(state) {
      const tbl = Table.findOne(table_id || exttable_name);
      const fields = tbl.getFields();
      if (tbl.name === "users") {
        fields.push(
          new Field({
            name: "verification_token",
            label: "Verification Token",
            type: "String",
          }),
          {
            name: "reset_password_token",
            label: "Reset Password Token",
            type: "String",
          }
        );
      }
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout,
        req,
        tbl
      );
      readState(state, fields);
      const qstate = stateFieldsToWhere({
        fields,
        state,
        approximate: true,
        table: tbl,
        prefix: "a.",
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
    async runManyQuery(
      state,
      { where, limit, offset, joinFieldsExtra, orderBy, orderDesc }
    ) {
      const tbl = Table.findOne({ id: table_id });
      const fields = await tbl.getFields();
      readState(state, fields);
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout,
        req,
        tbl
      );
      Object.assign(joinFields, joinFieldsExtra || {});
      const stateHash = hashState(state, name);
      const qstate = stateFieldsToWhere({
        fields,
        state,
        table: tbl,
        prefix: "a.",
      });
      const q = stateFieldsToQuery({ state, fields, stateHash });
      if (where) mergeIntoWhere(qstate, where);
      const role = req && req.user ? req.user.role_id : 100;
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
      const body = req.body || {};

      const col = columns.find(
        (c) => c.type === "Action" && c.rndid === body.rndid && body.rndid
      );
      const table = Table.findOne({ id: table_id });
      let row;
      if (table.ownership_formula) {
        const freeVars = freeVariables(table.ownership_formula);
        const joinFields = {};
        add_free_variables_to_joinfields(freeVars, joinFields, table.fields);
        row = await table.getJoinedRow({
          where: { [table.pk_name]: body[table.pk_name] },
          joinFields,
          forUser: req.user || { role_id: 100 },
          forPublic: !req.user,
        });
      } else
        row = await table.getRow(
          { [table.pk_name]: body[table.pk_name] },
          { forUser: req.user, forPublic: !req.user }
        );
      try {
        if (body.click_action) {
          let container;
          traverseSync(layout, {
            container(segment) {
              if (segment.click_action === body.click_action)
                container = segment;
            },
          });
          if (!container) return { json: { error: "Action not found" } };
          const trigger = Trigger.findOne({ name: body.click_action });
          if (!trigger)
            throw new Error(
              `View ${name}: Container click action ${body.click_action} not found`
            );
          const result = await trigger.runWithoutRow({
            table,
            Table,
            req,
            row,
            user: req.user,
            referrer: req?.get?.("Referrer"),
          });
          return { json: { success: "ok", ...(result || {}) } };
        }
        const result = await run_action_column({
          col,
          req,
          table,
          row,
          res,
          referrer: req?.get?.("Referrer"),
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
        const table = Table.findOne({ id: table_id });
        if (table.ownership_field_id || table.ownership_formula) {
          const fields = table.getFields();
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
