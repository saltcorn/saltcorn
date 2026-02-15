/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/show
 * @subcategory base-plugin
 */
import Form from "../../models/form";
import User from "../../models/user";
import Field from "../../models/field";
import View from "../../models/view";
import Table from "../../models/table";
import Page from "../../models/page";
import Crash from "../../models/crash";
import Workflow from "../../models/workflow";
import Trigger from "../../models/trigger";
import File from "../../models/file";
import { GenObj } from "@saltcorn/types/common_types";
import { Layout, Column, Req, Res } from "@saltcorn/types/base_types";
import { Row } from "@saltcorn/db-common/dbtypes";
const PageGroup = require("../../models/page_group");
const { Relation } = require("@saltcorn/common-code");

const { getState } = require("../../db/state");
const {
  eachView,
  traverse,
  getStringsForI18n,
  translateLayout,
  splitLayoutContainerFields,
  findLayoutBranchhWith,
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

import {
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
} from "../../plugin-helper";
import {
  action_url,
  view_linker,
  parse_view_select,
  action_link,
  splitUniques,
  standardBlockDispatch,
  standardLayoutRowVisitor,
} from "../../viewable_fields";
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
  renderServerSide,
} = require("../../utils");
const { traverseSync } = require("../../models/layout");
const {
  get_expression_function,
  eval_expression,
  freeVariables,
  freeVariablesInInterpolation,
  add_free_variables_to_aggregations,
} = require("../../models/expression");
const { get_base_url } = require("../../models/config");
const Library = require("../../models/library");
const { extractFromLayout } = require("../../diagram/node_extract_utils");
const _ = require("underscore");

const configuration_workflow = (req: Req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context: GenObj) => {
          const table = Table.findOne(
            context.table_id || context.exttable_name
          )!;
          const fields = table.getFields();

          const boolfields = fields.filter(
            (f: GenObj) => f.type && f.type.name === "Bool"
          );
          const stateActions = (Object.entries(getState().actions) as [string, GenObj][]).filter(
            ([k, v]) => !v.disableInBuilder && !v.disableIf?.()
          );
          const builtInActions = [
            "Delete",
            "GoBack",
            ...boolfields.map((f: GenObj) => `Toggle ${f.name}`),
          ];

          const triggerActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
          });
          const actions = Trigger.action_options({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            forBuilder: true,
            builtInLabel: "Show Actions",
            builtIns: builtInActions,
          });
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = Table.findOne({
                name: field.reftable_name,
              }) as any;
              if (field.reftable) await field.reftable.getFields();
            }
          }
          const actionConfigForms: GenObj = {
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
          const workflowActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            onlyWorkflows: true,
          });
          for (const name of workflowActions) {
            actionConfigForms[name] = [
              {
                name: "initial_context",
                label: "Additional context",
                type: "String",
                class: "validate-expression",
              },
            ];
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
          var agg_field_opts: GenObj = {};
          child_relations.forEach(({ table, key_field, through }: GenObj) => {
            const aggKey =
              (through ? `${through.name}->` : "") +
              `${table.name}.${key_field.name}`;
            agg_field_opts[aggKey] = table.fields
              .filter((f: GenObj) => !f.calculated || f.stored)
              .map((f: GenObj) => ({
                name: f.name,
                label: f.label,
                ftype: f.type.name || f.type,
                table_name: table.name,
                table_id: table.id,
              }));
          });
          const agg_fieldview_options: GenObj = {};

          Object.values(getState().types).forEach((t: any) => {
            agg_fieldview_options[t.name] = (Object.entries(t.fieldviews) as [string, GenObj][])
              .filter(([k, v]) => !v.isEdit && !v.isFilter)
              .map(([k, v]) => k);
          });
          const pages = await Page.find();
          const groups = (await PageGroup.find()).map((g: GenObj) => ({
            name: g.name,
          }));
          const images = await File.find({ mime_super: "image" });
          const library = (await Library.find({})).filter((l: GenObj) =>
            l.suitableFor("show")
          );
          const myviewrow = View.findOne({ name: context.viewname });
          return {
            tableName: table.name,
            fields: fields.map((f: GenObj) => f.toBuilder),
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

const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
    primary_key: true,
  },
];

const initial_config = initial_config_all_fields(false);

const run = async (
  table_id: number | string,
  viewname: string,
  { columns, layout, page_title, page_title_formula }: { columns: Column[]; layout: Layout; page_title?: string; page_title_formula?: boolean },
  state: GenObj,
  extra: { req: Req; res: Res; isPreview?: boolean; [key: string]: any },
  { showQuery }: GenObj
) => {
  if (!columns || !layout) return "View not yet built";
  const tbl = Table.findOne(table_id)!;
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
    rows.sort((a: Row, b: Row) => {
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

const set_load_actions_join_fieldviews = async ({
  table,
  layout,
  fields,
  req,
  res,
  row,
  isPreview,
}: {
  table: any;
  layout: Layout;
  fields: any[];
  req: Req;
  res?: Res;
  row?: Row;
  isPreview?: boolean;
}) => {
  await traverse(layout, {
    join_field: async (segment: GenObj) => {
      const { join_field, fieldview } = segment;
      if (!fieldview) return;
      const field = table.getField(join_field);

      if (field && field.type === "File") segment.field_type = "File";
      else if (field?.type.name && field?.type?.fieldviews[fieldview]) {
        segment.field_type = field.type.name;
        segment.target_field_attributes = field.attributes;
      }
    },
    async action(segment: GenObj) {
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

const renderRows = async (
  table: any,
  viewname: string,
  { columns, layout }: { columns: Column[]; layout: Layout },
  extra: { req: Req; res: Res; [key: string]: any },
  rows: Row[],
  state: GenObj
) => {
  if (!columns || !layout) return "View not yet built";

  const fields = table.getFields();

  const role = extra.req.user ? extra.req.user.role_id : 100;
  var views: GenObj = {};
  const getView = async (name: string, relation: string) => {
    if (views[name]) return views[name];
    const view_select = parse_view_select(name, relation);
    const view = View.findOne({ name: view_select.viewname });
    if (!view) return false;
    if (view.table_id === table.id) (view as any).table = table;
    else (view as any).table = Table.findOne({ id: view.table_id });
    (view as any).view_select = view_select;
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
  return await asyncMap(rows, async (row: Row) => {
    await eachView(
      layout,
      async (segment: GenObj, inLazy: boolean) => {
        // do all the parsing with data here? make a factory
        const view = await getView(segment.view, segment.relation);
        if (!view)
          throw new InvalidConfiguration(
            `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
          );

        if (
          view.viewtemplateObj.renderRows &&
          view.view_select.type === "Own"
        ) {
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
          let state1: GenObj = {};
          const pk_name = table.pk_name;
          const get_row_val = (k: string) => {
            //handle expanded joinfields
            if (row[k] === null) return null;
            if (row[k]?.id === null) return null;
            return row[k]?.id || row[k];
          };
          const get_user_id = () => (extra.req.user ? extra.req.user.id : 0);
          if (view.view_select.type === "RelationPath" && view.table_id) {
            const targetTbl = Table.findOne({ id: view.table_id })!;
            const relation = new Relation(
              segment.relation,
              targetTbl.name,
              displayType(await view.get_state_fields())
            );
            state1 = pathToState(
              relation,
              relation.isFixedRelation() ? get_user_id : get_row_val
            );
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
                "data-sc-view-source": `/view/${view.name}${qs}`,
              },
              inLazy
                ? ""
                : view.renderLocally()
                  ? await view.run(state2, subviewExtra, view.isRemoteTable())
                  : await renderServerSide(view.name, state2)
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
              inLazy
                ? ""
                : view.renderLocally()
                  ? await view.run(state2, subviewExtra, view.isRemoteTable())
                  : await renderServerSide(view.name, state2)
            );
          }
        }
      },
      state
    );
    await Page.renderEachEmbeddedPageInLayout(layout, state, extra as any);

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

const runMany = async (
  table_id: number | string,
  viewname: string,
  { columns, layout }: { columns: Column[]; layout: Layout },
  state: GenObj,
  extra: { req: Req; res: Res; [key: string]: any },
  { runManyQuery }: GenObj
) => {
  const tbl = Table.findOne({ id: table_id })!;
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

  return rendered.map((html: string, ix: number) => ({ html, row: rows[ix] }));
};

const render = (
  row: GenObj,
  fields: any[],
  layout0: Layout,
  viewname: string,
  table: any,
  role: number,
  req: Req,
  is_owner: boolean,
  state: GenObj,
  extra: GenObj
) => {
  const locale = req.getLocale();

  const layout = structuredClone(layout0);
  translateLayout(layout, locale);
  traverseSync(
    layout,
    standardLayoutRowVisitor(viewname, state, table, row, req)
  );
  return renderLayout({
    blockDispatch: standardBlockDispatch(viewname, state, table, extra as any, row),
    layout,
    role,
    is_owner,
    req,
    hints: getState().getLayout(req.user).hints || {},
  });
};

const run_action = async (
  table_id: number | string,
  viewname: string,
  { columns, layout }: { columns: Column[]; layout: Layout },
  body: GenObj,
  { req, res }: { req: Req; res: Res },
  { actionQuery }: GenObj
) => {
  const result = await actionQuery();
  if (result.json.error) {
    Crash.create({ message: result.json.error, stack: "" }, req);
  }
  return result;
};

const createBasicView = async ({
  table,
  viewname,
  template_view,
  template_table,
  all_views_created,
}: GenObj) => {
  if (!template_view) {
    const configuration = await initial_config_all_fields(false)({
      table_id: table.id,
    });
    return configuration;
  }

  const { inner, outer } = splitLayoutContainerFields(
    template_view.configuration.layout
  );

  const templateFieldTypes: GenObj = {},
    templateFieldLabels: GenObj = {};
  for (const field of template_table.fields) {
    templateFieldTypes[field.name] = field.type_name;
    templateFieldLabels[field.name] = field.label;
  }

  const defaultBranch = findLayoutBranchhWith(
    inner.above || inner.contents.above,
    (s: GenObj) => {
      return s.type === "field";
    }
  );
  const inners: GenObj[] = [],
    columns: GenObj[] = [];
  for (const field of table.fields) {
    if (field.primary_key) continue;
    const branch =
      findLayoutBranchhWith(inner.above || inner.contents.above, (s: GenObj) => {
        return (
          s.type === "field" &&
          templateFieldTypes[s.field_name] === field.type_name
        );
      }) || defaultBranch;
    let oldField: any;
    traverseSync(branch, {
      field(s: GenObj) {
        oldField = template_table.getField(s.field_name);
      },
    });
    const newBranch = structuredClone(branch);
    let newCol: GenObj = {};
    traverseSync(newBranch, {
      field(s: GenObj) {
        s.field_name = field.name;
        newCol = {
          type: "Field",
          fieldview: s.fieldview,
          field_name: field.name,
        };
      },
      blank(s: GenObj) {
        if (s.contents === oldField.label) s.contents = field.label;
      },
    });
    inners.push(newBranch);
    columns.push(newCol);
  }
  const cfg = {
    layout: outer({ above: inners }),
    columns,
  };

  return cfg;
};

export = {
  name: "Show",
  description: "Show a single row, with flexible layout",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  renderRows,
  initial_config,
  createBasicView,
  routes: { run_action },
  getStringsForI18n({ layout }: { layout: Layout }) {
    return getStringsForI18n(layout);
  },
  async interpolate_title_string(table_id: number | string, title: string, state: GenObj) {
    const tbl = Table.findOne(table_id)!;
    if (state?.[tbl.pk_name]) {
      const freeVars = freeVariablesInInterpolation(title);
      const joinFields: GenObj = {};
      const aggregations: GenObj = {};

      add_free_variables_to_joinfields(freeVars, joinFields, tbl.fields);
      add_free_variables_to_aggregations(freeVars, aggregations, tbl);
      const row = await tbl.getJoinedRow({
        where: { [tbl.pk_name]: state[tbl.pk_name] },
        joinFields,
        aggregations,
      });
      return interpolate(title, row, null, "Show view title string");
    } else return title;
  },
  queries: ({
    table_id,
    exttable_name,
    name, // viewname
    configuration: { columns, layout },
    req,
    res,
  }: GenObj) => ({
    async showQuery(state: GenObj) {
      const tbl = Table.findOne(table_id || exttable_name)!;
      const fields = tbl.getFields();
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
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout,
        req,
        tbl
      );
      const unhashed_reset_password_token =
        state._unhashed_reset_password_token;
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
      if (unhashed_reset_password_token && tbl.name === "users")
        rows.forEach((r: Row) => {
          r.reset_password_token = unhashed_reset_password_token;
        });

      return {
        rows,
        message: null,
      };
    },
    async runManyQuery(
      state: GenObj,
      { where, limit, offset, joinFieldsExtra, orderBy, orderDesc }: GenObj
    ) {
      const tbl = Table.findOne({ id: table_id })!;
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
        const owner_field = fields.find((f: GenObj) => f.id === tbl.ownership_field_id)!;
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
        rows = rows.filter((row: Row) => tbl.is_owner(req.user, row));
      }
      return rows;
    },
    async actionQuery() {
      return await db.withTransaction(
        async () => {
          const body = req.body || {};

          const col = columns.find(
            (c: GenObj) => c.type === "Action" && c.rndid === body.rndid && body.rndid
          );
          const table = Table.findOne({ id: table_id })!;
          let row;
          if (table.ownership_formula) {
            const freeVars = freeVariables(table.ownership_formula);
            const joinFields: GenObj = {};
            add_free_variables_to_joinfields(
              freeVars,
              joinFields,
              table.fields
            );
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

          if (body.click_action) {
            let container;
            traverseSync(layout, {
              container(segment: GenObj) {
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
        },
        (e: any) => {
          return { json: { error: e.message || e } };
        }
      );
    },
  }),
  configCheck: async (view: GenObj) => {
    return await check_view_columns(view, view.configuration.columns);
  },
  connectedObjects: async (configuration: GenObj) => {
    return extractFromLayout(configuration.layout);
  },
};
