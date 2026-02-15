/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/edit
 * @subcategory base-plugin
 */
import Field from "../../models/field";
import Table from "../../models/table";
import User from "../../models/user";
import Crash from "../../models/crash";
import Form from "../../models/form";
import Page from "../../models/page";
import View from "../../models/view";
import Workflow from "../../models/workflow";
import Trigger from "../../models/trigger";
import File from "../../models/file";
import { GenObj } from "@saltcorn/types/common_types";
import { Layout, Column, Req, Res } from "@saltcorn/types/base_types";

const PageGroup = require("../../models/page_group");
const FieldRepeat = require("../../models/fieldrepeat");
const Library = require("../../models/library");

const { getState } = require("../../db/state");
import {
  text,
  text_attr,
  script,
  domReady,
  div,
  button,
  i,
  pre,
} from "@saltcorn/markup/tags";
const { renderForm } = require("@saltcorn/markup");
import expression from "../../models/expression";
const {
  get_expression_function,
  expressionChecker,
  eval_expression,
  freeVariables,
  freeVariablesInInterpolation,
  add_free_variables_to_aggregations,
} = expression;
import utils from "../../utils";
const {
  InvalidConfiguration,
  isNode,
  isWeb,
  isTest,
  mergeIntoWhere,
  interpolate,
  asyncMap,
  removeEmptyStrings,
  structuredClone,
} = utils;
import { check_view_columns } from "../../plugin-testing";
import {
  initial_config_all_fields,
  calcfldViewOptions,
  get_parent_views,
  picked_fields_to_query,
  stateFieldsToWhere,
  stateFieldsToQuery,
  getActionConfigFields,
  run_action_column,
  add_free_variables_to_joinfields,
  readState,
  displayType,
  runCollabEvents,
} from "../../plugin-helper";
import {
  splitUniques,
  getForm,
  setDateLocales,
  transformForm,
  fill_presets,
  parse_view_select,
  get_view_link_query,
  edit_build_in_actions,
  updateViewSelect,
} from "../../viewable_fields";
import layout from "../../models/layout";
const {
  traverse,
  getStringsForI18n,
  traverseSync,
  splitLayoutContainerFields,
  findLayoutBranchhWith,
} = layout;
import { extractFromLayout } from "../../diagram/node_extract_utils";
import db from "../../db";
const { Relation, RelationType } = require("@saltcorn/common-code");

/**
 * @param req
 * @returns
 */
const configuration_workflow = (req: Req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context: GenObj) => {
          const table = Table.findOne({ id: context.table_id })!;
          const fields = table
            .getFields()
            .filter((f: any) => !f.primary_key || f.attributes?.NonSerial);
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = Table.findOne({
                name: field.reftable_name,
              }) as any;
              if (field.reftable) await field.reftable.getFields();
            }
          }

          const { field_view_options, handlesTextStyle, blockDisplay } =
            calcfldViewOptions(fields as any, "edit");

          const roles = await User.get_roles();
          const images = await File.find({ mime_super: "image" });
          const stateActions = (
            Object.entries(getState().actions) as [string, GenObj][]
          ).filter(([k, v]) => !v.disableInBuilder && !v.disableIf?.());
          const triggerActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
          });
          const actions = Trigger.action_options({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            forBuilder: true,
            builtInLabel: "Edit Actions",
            builtIns: edit_build_in_actions,
          });

          const actionConfigForms: GenObj = {
            Delete: [
              {
                name: "after_delete_url",
                label: req.__("URL after delete"),
                type: "String",
              },
            ],
            GoBack: [
              {
                name: "save_first",
                label: req.__("Save before going back"),
                type: "Bool",
              },
              {
                name: "reload_after",
                label: req.__("Reload after going back"),
                type: "Bool",
              },
              {
                name: "steps",
                label: req.__("Steps to go back"),
                type: "Integer",
                default: 1,
              },
            ],
          };
          for (const [name, action] of stateActions) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table,
                { mode: "edit", req }
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
          if (table.name === "users") {
            actions.push("Login");
            actions.push("Sign up");
            Object.entries(getState().auth_methods).forEach(
              ([k, v]: [string, any]) => {
                actions.push(`Login with ${k}`);
              }
            );
            fields.push(
              new Field({
                name: "password",
                label: req.__("Password"),
                type: "String",
              })
            );
            fields.push(
              new Field({
                name: "passwordRepeat",
                label: req.__("Password Repeat"),
                type: "String",
              })
            );
            fields.push(
              new Field({
                name: "remember",
                label: req.__("Remember me"),
                type: "Bool",
              })
            );

            field_view_options.password = ["password"];
            field_view_options.passwordRepeat = ["password"];
            field_view_options.remember = ["edit"];
          }
          const library = (await Library.find({})).filter((l: any) =>
            l.suitableFor("edit")
          );
          const myviewrow = View.findOne({ name: context.viewname });
          const { parent_field_list } = await table.get_parent_relations(
            true,
            true
          );
          const pages = await Page.find();
          const groups = (await PageGroup.find()).map((g: any) => ({
            name: g.name,
          }));

          return {
            tableName: table.name,
            fields: fields.map((f: any) => f.toBuilder || f),
            field_view_options,
            parent_field_list,
            handlesTextStyle,
            blockDisplay,
            roles,
            actions,
            triggerActions,
            builtInActions: edit_build_in_actions,
            actionConfigForms,
            images,
            allowMultiStepAction: true,
            min_role: (myviewrow || {}).min_role,
            library,
            mode: "edit",
            ownership:
              !!table.ownership_field_id ||
              !!table.ownership_formula ||
              table.name === "users",
            excluded_subview_templates: ["Room"],
            pages,
            page_groups: groups,
          };
        },
      },
      {
        name: req.__("Fixed and blocked fields"),
        contextField: "fixed",
        onlyWhen: async (context: GenObj) => {
          const table = Table.findOne({ id: context.table_id })!;
          const fields = table.getFields();
          const in_form_fields = context.columns.map((f: any) => f.field_name);
          return fields.some(
            (f: any) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
        },
        form: async (context: GenObj) => {
          const table = Table.findOne({ id: context.table_id })!;
          const fields = table.getFields();
          const in_form_fields = context.columns.map((f: any) => f.field_name);
          const omitted_fields = fields.filter(
            (f: any) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
          const formFields: any[] = [];
          const blockFields: any[] = [];
          omitted_fields.forEach((f: any) => {
            f.required = false;
            if (f.type?.name === "Bool") {
              f.fieldview = "tristate";
            }
            formFields.push(f);

            if (f.presets) {
              formFields.push(
                new Field({
                  name: "preset_" + f.name,
                  label: (req as any).__("Preset %s", f.label),
                  type: "String",
                  attributes: { options: Object.keys(f.presets) },
                })
              );
            }
            blockFields.push({
              name: `_block_${f.name}`,
              type: "Bool",
              label: f.label,
            });
          });

          const form = new Form({
            fields: [
              {
                input_type: "section_header",
                label: req.__(
                  "These fields were missing, you can give values here. The values you enter here can be overwritten by information coming from other views, for instance if the form is triggered from a list."
                ),
              },
              ...formFields,
              {
                input_type: "section_header",
                label: req.__(
                  "Do not allow the following fields to have a value set from the query string or state"
                ),
              },
              ...blockFields,
            ],
          });
          await form.fill_fkey_options();
          return form;
        },
      },
      {
        name: req.__("Edit options"),
        form: async (context: GenObj) => {
          const own_views = await View.find_all_views_where(
            ({ state_fields, viewrow }: GenObj) =>
              viewrow.table_id === context.table_id ||
              state_fields.every((sf: any) => !sf.required)
          );
          const table = Table.findOne({ id: context.table_id })!;
          own_views.forEach((v: any) => {
            if (!v.table && v.table_id === table.id) v.table = table;
            else if (!v.table && v.table_id) {
              const vtable = Table.findOne({ id: v.table_id });
              v.table = vtable;
            }
          });
          const parent_views = await get_parent_views(table, context.viewname);

          const done_view_opts = own_views.map((v: any) => v.select_option);
          parent_views.forEach(({ relation, related_table, views }: GenObj) =>
            views.forEach((v: any) => {
              done_view_opts.push(`${v.name}.${relation.name}`);
            })
          );
          const pages = await Page.find();
          const groups = await PageGroup.find();
          const triggers = Trigger.find();
          return new Form({
            fields: [
              {
                name: "auto_save",
                label: req.__("Auto save"),
                sublabel: req.__("Save any changes immediately"),
                type: "Bool",
              },
              {
                name: "confirm_leave",
                label: req.__("Confirm leaving unsaved"),
                sublabel: req.__(
                  "Ask the user to confirm if they close a tab with unsaved changes"
                ),
                type: "Bool",
                showIf: { auto_save: false },
              },
              {
                name: "auto_create",
                label: req.__("Allocate new row"),
                sublabel: req.__(
                  "If the view is run without existing row, allocate a new row on load. Defaults must be set on all required fields."
                ),
                type: "Bool",
              },
              {
                name: "delete_unchanged_auto_create",
                label: req.__("Delete unchanged"),
                sublabel: req.__(
                  "Delete allocated row if there are no changes."
                ),
                type: "Bool",
                showIf: { auto_create: true },
              },
              {
                name: "split_paste",
                label: req.__("Split paste"),
                sublabel: req.__("Separate paste content into separate inputs"),
                type: "Bool",
              },
              {
                name: "enable_realtime",
                label: req.__("Real-time updates"),
                sublabel: req.__("Enable real-time updates for this view"),
                type: "Bool",
                default: false,
              },

              new FieldRepeat({
                name: "update_events",
                showIf: { enable_realtime: true },
                fields: [
                  {
                    type: "String",
                    name: "event",
                    label: req.__("Update event"),
                    sublabel: req.__("Custom event for real-time updates"),
                    attributes: {
                      options: triggers.map((t: any) => t.name),
                    },
                  },
                ],
              }),

              {
                name: "destination_type",
                label: "Destination type",
                type: "String",
                required: true,
                sublabel: req.__(
                  "This is the view to which the user will be sent when the form is submitted. The view you specify here can be ignored depending on the context of the form, for instance if it appears in a pop-up the redirect will not take place."
                ),
                attributes: {
                  options: [
                    "Back to referer",
                    "View",
                    "Page",
                    "PageGroup",
                    "Formula",
                    "URL formula",
                  ],
                },
              },
              {
                name: "view_when_done",
                label: req.__("Destination view"),
                type: "String",
                required: true,
                attributes: {
                  options: done_view_opts,
                },
                showIf: { destination_type: "View" },
              },
              {
                name: "page_when_done",
                label: req.__("Destination page"),
                type: "String",
                required: true,
                attributes: {
                  options: pages.map((p: any) => p.name),
                },
                showIf: { destination_type: "Page" },
              },
              {
                name: "page_group_when_done",
                label: req.__("Destination page group"),
                type: "String",
                required: true,
                attributes: {
                  options: groups.map((p: any) => p.name),
                },
                showIf: { destination_type: "PageGroup" },
              },
              {
                name: "dest_url_formula",
                label: req.__("Destination URL Formula"),
                type: "String",
                required: true,
                class: "validate-expression",
                showIf: { destination_type: "URL formula" },
              },
              new FieldRepeat({
                name: "formula_destinations",
                showIf: { destination_type: "Formula" },
                fields: [
                  {
                    type: "String",
                    name: "expression",
                    label: "Formula",
                    class: "validate-expression",
                    sublabel:
                      "if this formula evaluates to true, use the following view",
                  },
                  {
                    name: "view",
                    label: req.__("View"),
                    type: "String",
                    required: true,
                    attributes: {
                      options: done_view_opts,
                    },
                  },
                ],
              }),
            ],
          });
        },
      },
    ],
  });

/**
 * @param table_id
 * @param viewname
 * @param param2
 * @returns
 */
const get_state_fields = async (
  table_id: number | string,
  viewname: string,
  { columns }: GenObj
) => [
  {
    name: "id",
    type: "Integer",
    primary_key: true,
  },
];

const initial_config = initial_config_all_fields(true);

/**
 * @param table_id
 * @param viewname
 * @param cfg
 * @param state
 * @param param4
 * @param param5
 * @returns
 */
const run = async (
  table_id: number | string,
  viewname: string,
  cfg: GenObj,
  state: GenObj,
  {
    res,
    req,
    isPreview,
    hiddenLoginDest,
  }: { res: Res; req: Req; isPreview?: boolean; hiddenLoginDest?: any },
  { editQuery }: GenObj
) => {
  const mobileReferrer = isWeb(req) ? undefined : req?.headers?.referer;
  return await editQuery(state, mobileReferrer, isPreview, hiddenLoginDest);
};

/**
 * @param table_id
 * @param viewname
 * @param param2
 * @param state
 * @param extra
 * @param param5
 * @returns
 */
const runMany = async (
  table_id: number | string,
  viewname: string,
  {
    columns,
    layout,
    auto_save,
    split_paste,
    confirm_leave,
    enable_realtime,
    update_events,
  }: GenObj,
  state: GenObj,
  extra: any,
  { editManyQuery, getRowQuery, optionsQuery }: GenObj
) => {
  let { table, fields, rows } = await editManyQuery(state, {
    limit: extra.limit,
    offset: extra.offset,
    orderBy: extra.orderBy,
    orderDesc: extra.orderDesc,
    where: extra.where,
  });
  if (!isNode()) {
    table = Table.findOne({ id: table.id });
    fields = table.getFields();
  }
  const isRemote = !isWeb(extra.req);
  return await asyncMap(rows, async (row: GenObj): Promise<any> => {
    const html = await render({
      table,
      fields,
      viewname,
      columns,
      layout,
      row,
      req: extra.req,
      res: extra.res,
      state,
      auto_save,
      getRowQuery,
      optionsQuery,
      split_paste,
      isRemote,
      confirm_leave,
      enable_realtime,
      update_events,
    });
    return { html, row };
  });
};

const realTimeScript = (
  viewname: string,
  table_id: number | string,
  row: GenObj,
  scriptId: string
) => {
  const view = View.findOne({ name: viewname })!;
  const table = Table.findOne({ id: table_id })!;
  const rowId = row[table.pk_name];
  return `
  const collabCfg = {
    events: {
      '${view.getRealTimeEventName(
        `UPDATE_EVENT?id=${rowId}`
      )}': async (data) => {
        console.log("Update event received for view ${viewname}", data);
        const script = document.getElementById('${scriptId}');
        const closestDiv = script?.closest(
          'div[data-sc-embed-viewname="${viewname}"]'
        );
        if (data.updates) {
          if (closestDiv) await common_done({set_fields: data.updates, no_onchange: true}, closestDiv);
          else await common_done({set_fields: data.updates, no_onchange: true}, "${viewname}");
        }
        if (data.actions) {
          for (const action of data.actions) {
            if (closestDiv) await common_done(action, closestDiv);
            else await common_done(action, "${viewname}");
          }
        }
      }
    }
  };
  init_collab_room('${viewname}', collabCfg);`.trim();
};

const render = async ({
  table,
  fields,
  viewname,
  columns,
  layout,
  row,
  req,
  state,
  res,
  auto_save,
  destination_type,
  isRemote,
  getRowQuery,
  optionsQuery,
  split_paste,
  mobileReferrer,
  confirm_leave,
  delete_unchanged_auto_create,
  isPreview,
  auto_created_row,
  hiddenLoginDest,
  enable_realtime,
}: {
  table: any;
  fields: any[];
  viewname: string;
  columns: any[];
  layout: any;
  row: GenObj | null;
  req: Req;
  state: GenObj;
  res: Res;
  auto_save?: boolean;
  destination_type?: string;
  isRemote?: boolean;
  getRowQuery?: any;
  optionsQuery?: any;
  split_paste?: boolean;
  mobileReferrer?: string;
  confirm_leave?: boolean;
  delete_unchanged_auto_create?: boolean;
  isPreview?: boolean;
  auto_created_row?: boolean;
  hiddenLoginDest?: any;
  enable_realtime?: boolean;
  update_events?: any;
}) => {
  const form = await getForm(
    table,
    viewname,
    columns,
    layout,
    state[table.pk_name],
    req,
    isRemote
  );
  if (split_paste) form.splitPaste = true;

  if (row) {
    form.values = row;
    const file_fields = form.fields.filter((f: any) => f.type === "File");
    if (isWeb(req)) {
      for (const field of file_fields) {
        if (field.fieldviewObj?.valueIsFilename && row[field.name]) {
          const file = await File.findOne({ id: row[field.name] });
          if (file?.id) form.values[field.name] = file.filename;
        }
        if (field.fieldviewObj?.editContent && row[field.name]) {
          const file = await File.findOne(row[field.name]);
          if (file && file.min_role_read >= (req.user?.role_id || 100))
            form.values[`_content_${field.name}`] = await file.get_contents();
        }
      }
    }
    form.hidden(table.pk_name);
    const user_id = req.user ? req.user.id : null;
    const owner_field = await table.owner_fieldname();
    if (table.ownership_formula && user_id) {
      const freeVars = freeVariables(table.ownership_formula);
      if (freeVars.size > 0) {
        const joinFields: GenObj = {};
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
        const row_joined = await table.getJoinedRow({
          where: { [table.pk_name]: row[table.pk_name] },
          forPublic: !req.user,
          forUser: req.user,
          joinFields,
        });
        form.isOwner = await table.is_owner(req.user, row_joined);
      } else form.isOwner = await table.is_owner(req.user, row);
    } else
      form.isOwner = owner_field && user_id && row[owner_field] === user_id;
  } else {
    form.isOwner = true;
  }

  if (destination_type === "Back to referer") {
    form.hidden("_referer");
    form.values._referer = mobileReferrer
      ? mobileReferrer
      : req.headers?.referer;
  }
  if (hiddenLoginDest && req.query.dest) {
    form.hidden("dest");
    if (!req.query.dest.includes(":/") && !req.query.dest.includes("//"))
      form.values.dest = req.query.dest;
  }

  Object.entries(state).forEach(([k, v]) => {
    const field = form.fields.find((f: any) => f.name === k);
    if (field && ((field.type && field.type.read) || field.is_fkey)) {
      form.values[k] = field.type.read
        ? field.type.read(v, field.attributes)
        : v;
    } else {
      const tbl_field = fields.find((f: any) => f.name === k);
      if (tbl_field && !field) {
        form.fields.push(new Field({ name: k, input_type: "hidden" }));
        form.values[k] = tbl_field.type.read
          ? tbl_field.type.read(v, tbl_field.attributes)
          : v;
      }
    }
  });

  // add row values not in columns as hidden if needed for join fields
  if (row) {
    const need_join_fields = new Set(
      columns
        .filter((c: any) => c.type === "JoinField")
        .map((c: any) => c.join_field.split(".")[0])
    );
    const colFields = new Set(
      columns
        .filter((c: any) => c.type === "Field")
        .map((c: any) => c.field_name)
    );
    const formFields = new Set(form.fields.map((f: any) => f.name));
    fields.forEach((f: any) => {
      if (
        !colFields.has(f.name) &&
        !formFields.has(f.name) &&
        typeof row[f.name] !== "undefined" &&
        need_join_fields.has(f.name)
      )
        form.fields.push(new Field({ name: f.name, input_type: "hidden" }));
    });
  }
  // no autosave if new and save button exists
  let hasSave = false;
  traverseSync(layout, {
    action({ action_name }: GenObj) {
      if (action_name === "Save" || action_name === "SubmitWithAjax") {
        hasSave = true;
      }
    },
  });
  const actually_auto_save = auto_save && !(!row && hasSave);
  if (actually_auto_save)
    form.onChange = `saveAndContinueDelayed(this, ${
      !isWeb(req) ? `'${form.action}'` : undefined
    }, event);`;
  let reloadAfterCloseInModalScript =
    actually_auto_save && req.xhr
      ? script(
          domReady(`
    $("#scmodal").on("hidden.bs.modal", function (e) {
     const on_close_reload_view = $("#scmodal").attr(
        "data-on-close-reload-view"
      );
      if(on_close_reload_view)
        reload_embedded_view(on_close_reload_view)
      else
        setTimeout(()=>location.reload(),0);
    });`)
        )
      : "";

  let confirmLeaveScript = "";
  if (confirm_leave) {
    if (!form.onChange) form.onChange = "";
    form.onChange += "this.setAttribute('data-unsaved-changes','true');";
    if (!form.onSubmit) form.onSubmit = "";
    form.onSubmit += "this.removeAttribute('data-unsaved-changes')";

    confirmLeaveScript = script(
      `((curScript)=>{window.addEventListener("beforeunload", (e) => check_unsaved_form(e, curScript));})(document.currentScript)`
    );
  }
  let deleteUnchangedScript = "";
  if (auto_created_row && delete_unchanged_auto_create && !isPreview) {
    if (hasSave) {
      if (!form.onSubmit) form.onSubmit = "";
      form.onSubmit += "this.setAttribute('data-form-changed','true');";
    } else {
      if (!form.onChange) form.onChange = "";
      form.onChange += "this.setAttribute('data-form-changed','true');";
    }
    deleteUnchangedScript = script(
      `((curScript)=>{window.addEventListener("beforeunload", () => check_delete_unsaved("${table.name}", curScript));})(document.currentScript)`
    );
  }

  const formId = isTest()
    ? "test-form-id"
    : `form${Math.floor(Math.random() * 16777215).toString(16)}`;
  const identicalFieldsScript = script(
    domReady(
      `const editForm = document.getElementById('${formId}'); if (editForm) editForm.addEventListener("change", handle_identical_fields, true);`
    )
  );

  const dynamic_updates_enabled = getState().getConfig(
    "enable_dynamic_updates",
    true
  );
  const rndid = isTest()
    ? "test-script-id"
    : Math.floor(Math.random() * 16777215).toString(16);
  const realTimeCollabScript =
    enable_realtime && row && !(req.headers?.pjaxpageload === "true")
      ? (!dynamic_updates_enabled
          ? script({
              src: `/static_assets/${db.connectObj.version_tag}/socket.io.min.js`,
            })
          : "") +
        script(
          { id: rndid },
          domReady(realTimeScript(viewname, table.id, row, rndid))
        )
      : "";

  if (actually_auto_save) {
    for (const field of form.fields) {
      field.in_auto_save = true;
    }
  }
  await form.fill_fkey_options(false, optionsQuery, req.user);
  await transformForm({
    form,
    table,
    req,
    row: row!,
    res,
    getRowQuery,
    viewname,
    optionsQuery,
    state,
  });
  form.id = formId;
  return (
    renderForm(form, !isRemote && req.csrfToken ? req.csrfToken() : false) +
    reloadAfterCloseInModalScript +
    confirmLeaveScript +
    deleteUnchangedScript +
    identicalFieldsScript +
    realTimeCollabScript
  );
};

const identicalFieldNames = (columns: any[]) => {
  const fieldNames = new Set();
  const result = new Set();
  for (const field of columns) {
    if (field.type === "Field") {
      if (fieldNames.has(field.field_name)) result.add(field.field_name);
      else fieldNames.add(field.field_name);
    }
  }
  return result;
};

const prepSafeBody = (body: GenObj, columns: any[]) => {
  const safeBody: GenObj = { ...body };
  const identicalFields = identicalFieldNames(columns);
  for (const field of identicalFields) {
    if (body && body[field as string] && Array.isArray(body[field as string])) {
      safeBody[field as string] = body[field as string][0];
    }
  }
  return safeBody;
};

/**
 * @param table_id
 * @param viewname
 * @param param2
 * @param state
 * @param body
 * @param param5
 * @param param6
 * @param remote
 * @returns
 */
const runPost = async (
  table_id: number | string,
  viewname: string,
  {
    columns,
    layout,
    fixed,
    view_when_done,
    formula_destinations,
    auto_save,
    destination_type,
    dest_url_formula,
    page_when_done,
    page_group_when_done,
  }: GenObj,
  state: GenObj,
  body: GenObj,
  { res, req, redirect }: { res: Res; req: Req; redirect?: string },
  {
    tryInsertQuery,
    tryUpdateQuery,
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  }: GenObj,
  remote?: boolean
) => {
  const safeBody = prepSafeBody(body, columns);
  const table = Table.findOne({ id: table_id })!;
  const fields = table.getFields();
  if (safeBody?.password && table_id === User.table.id) {
    safeBody.password = await User.hashPassword(safeBody.password);
  }
  const prepResult = await prepare(
    viewname,
    table,
    fields,
    {
      columns,
      layout,
      fixed,
      auto_save,
    },
    { req, res },
    safeBody,
    {
      getRowQuery,
      saveFileQuery,
      saveFileFromContentsQuery,
      optionsQuery,
      getRowByIdQuery,
    },
    remote
  );
  const view = View.findOne({ name: viewname });
  const pagetitle = { title: viewname, no_menu: view?.attributes?.no_menu };
  if (prepResult) {
    let { form, row, pk, id } = prepResult;
    const cancel = safeBody._cancel;
    const originalID = id;
    let trigger_return: any;
    let ins_upd_error: any;
    if (!cancel) {
      getState().log(
        6,
        `Edit POST ready to insert/update into ${
          table.name
        } Row=${JSON.stringify(row)} ID=${id} Ajax=${!!req.xhr}`
      );
      const doReturn = await db.withTransaction(async (rollback: any) => {
        if (typeof id === "undefined") {
          const ins_res = await tryInsertQuery(row);
          if (ins_res.success) {
            id = ins_res.success;
            row[pk.name] = id;
            trigger_return = ins_res.trigger_return;
          } else {
            ins_upd_error = ins_res.error;
          }
        } else {
          if (
            table.composite_pk_names ||
            table.getField(table.pk_name)!.attributes.NonSerial
          ) {
            const upd_res = await tryInsertOrUpdateImpl(row, id, table, req);
            if ((upd_res as any).error) {
              ins_upd_error = (upd_res as any).error;
            }
            trigger_return = upd_res.trigger_return;
          } else {
            const upd_res = await tryUpdateQuery(row, id);
            if ((upd_res as any).error) {
              ins_upd_error = (upd_res as any).error;
            }
            trigger_return = upd_res.trigger_return;
          }
        }
        if (ins_upd_error) {
          await rollback();
          getState().log(
            6,
            `Insert or update failure ${JSON.stringify(ins_upd_error)}`
          );
          res.status(422);
          if (req.xhr) {
            res.json({ error: ins_upd_error });
          } else {
            await form.fill_fkey_options(false, optionsQuery, req.user);
            (req as any).flash("error", text_attr(ins_upd_error));
            for (const file_field of fields.filter(
              (f: any) => f.type === "File"
            )) {
              if (!form.values[file_field.name]) continue;
              form.values[`__exisiting_file_${file_field.name}`] =
                form.values[file_field.name];
              form.hidden(`__exisiting_file_${file_field.name}`);
            }

            res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
          }
          return true;
        }
        for (const field of form.fields.filter((f: any) => f.isRepeat)) {
          const view_select = parse_view_select(
            field.metadata.view,
            field.metadata.relation_path
          );
          const order_field = field.metadata.order_field;
          const childView = View.findOne({ name: view_select.viewname });
          if (!childView)
            throw new InvalidConfiguration(
              `Cannot find embedded view: ${view_select.viewname}`
            );
          if (
            field.metadata.relation_path &&
            view_select.type === "RelationPath"
          ) {
            const targetTbl = Table.findOne({ id: childView.table_id })!;
            const relation = new Relation(
              field.metadata.relation_path,
              targetTbl.name,
              displayType(await childView.get_state_fields())
            );
            if (relation.type === RelationType.CHILD_LIST)
              updateViewSelect(view_select);
          }

          const childTable = Table.findOne({ id: field.metadata?.table_id })!;
          const submitted_row_ids = new Set(
            (form.values[field.name] || []).map(
              (srow: GenObj) => `${srow[childTable.pk_name]}`
            )
          );
          const childFields = new Set(
            childTable.fields.map((f: any) => f.name)
          );
          let repeatIx = 0;
          for (const [childRow, row_ix] of form.values[field.name].map(
            (r: any, ix: number) => [r, ix]
          )) {
            // set fixed here
            childRow[field.metadata?.relation] = id;
            for (const [k, v] of Object.entries(
              childView?.configuration?.fixed || {}
            )) {
              if (
                typeof childRow[k] === "undefined" &&
                !k.startsWith("_block_") &&
                childFields.has(k) &&
                (v || v === 0)
              )
                childRow[k] = v;
            }
            if (order_field && !childRow[order_field])
              childRow[order_field] = row_ix;
            for (const file_field of field.fields.filter(
              (f: any) => f.type === "File"
            )) {
              const key = `${file_field.name}_${repeatIx}`;
              if (
                req.files?.[key] &&
                (!file_field.fieldviewObj || file_field.fieldviewObj.isEdit)
              ) {
                const file = await File.from_req_files(
                  req.files[key],
                  req.user ? req.user.id : undefined,
                  (file_field.attributes &&
                    +file_field.attributes.min_role_read) ||
                    1,
                  file_field?.attributes?.folder
                );
                childRow[file_field.name] = file.field_value;
              }
            }
            getState().log(
              6,
              `Edit POST ready to insert/update Child row into ${
                childTable.name
              } Row=${JSON.stringify(childRow)} ID=${
                childRow[childTable.pk_name]
              } Ajax=${!!req.xhr}`
            );
            if (childRow[childTable.pk_name]) {
              const upd_res = await childTable.tryUpdateRow(
                childRow,
                childRow[childTable.pk_name],
                req.user || { role_id: 100 },
                undefined,
                { req }
              );
              if ((upd_res as any).error) {
                await rollback();

                getState().log(
                  6,
                  `Update child row failure ${JSON.stringify(upd_res)}`
                );
                (req as any).flash("error", text_attr((upd_res as any).error));
                res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
                return true;
              }
            } else {
              const ins_res = await childTable.tryInsertRow(
                childRow,
                req.user || { role_id: 100 }
              );
              if ((ins_res as any).error) {
                await rollback();
                getState().log(
                  6,
                  `Insert child row failure ${JSON.stringify(ins_res)}`
                );
                (req as any).flash("error", text_attr((ins_res as any).error));
                res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
                return true;
              } else if ((ins_res as any).success) {
                submitted_row_ids.add(`${(ins_res as any).success}`);
              }
            }
            repeatIx += 1;
          }

          //need to delete any rows that are missing
          if (originalID && field.metadata) {
            const childRows = getRowQuery
              ? await getRowQuery(
                  field.metadata.table_id,
                  view_select,
                  originalID
                )
              : await childTable.getRows({
                  [view_select.field_name]: originalID,
                });
            for (const db_child_row of childRows) {
              if (
                !submitted_row_ids.has(`${db_child_row[childTable.pk_name]}`)
              ) {
                await childTable.deleteRows(
                  {
                    [childTable.pk_name]: db_child_row[childTable.pk_name],
                  },
                  req.user || { role_id: 100 }
                );
              }
            }
          }
        }
      });
      if (doReturn) return;
      //Edit-in-edit
    }
    trigger_return = trigger_return || {};
    if (trigger_return.notify && trigger_return.details)
      (req as any).flash(
        "success",
        div(
          { class: "d-inline" },
          trigger_return.notify,
          button(
            {
              class: "btn btn-sm btn-outline-secondary btn-xs",
              type: "button",
              "data-bs-toggle": "collapse",
              "data-bs-target": "#notifyDetails",
              "aria-expanded": "false",
              "aria-controls": "notifyDetails",
            },
            i({ class: "fas fa-plus" })
          ),
          div(
            { class: "collapse", id: "notifyDetails" },
            pre(trigger_return.details)
          )
        )
      );
    else if (trigger_return.notify)
      (req as any).flash("success", trigger_return.notify);
    if (trigger_return.error)
      (req as any).flash("danger", trigger_return.error);
    if (trigger_return.goto) {
      res.redirect(trigger_return.goto);
      return;
    }

    await whenDone(
      viewname,
      table_id,
      fields,
      pk,
      {
        view_when_done,
        formula_destinations,
        destination_type,
        dest_url_formula,
        page_when_done,
        page_group_when_done,
        redirect,
      },
      req,
      res,
      safeBody,
      row,
      !originalID ? { id, ...trigger_return } : trigger_return,
      true,
      originalID,
      table
    );
  }
};

const doAuthPost = async ({
  body,
  table_id,
  req,
}: {
  body: GenObj;
  table_id: number | string;
  req: Req;
}) => {
  const table = Table.findOne({ id: table_id })!;
  const user_id = req.user ? req.user.id : null;
  if (table.ownership_field_id && user_id) {
    const field_name = await table.owner_fieldname();
    if (typeof body[field_name || ""] === "undefined") {
      const fields = table.getFields();
      const { uniques } = splitUniques(fields, body);
      if (Object.keys(uniques).length > 0) {
        const dbrow = await table.getRow(uniques, {
          forUser: req.user,
          forPublic: !req.user,
        });
        if (!dbrow) return false;
        return table.is_owner(req.user, dbrow);
      }
    } else return field_name && `${body[field_name]}` === `${user_id}`;
  }
  if (table.ownership_formula && user_id) {
    let row = { ...body };
    if (body[table.pk_name]) {
      const joinFields: GenObj = {};
      if (table.ownership_formula) {
        const fields = table.getFields();
        const freeVars = freeVariables(table.ownership_formula);
        add_free_variables_to_joinfields(freeVars, joinFields, fields);
      }
      const dbrow = await table.getJoinedRows({
        where: {
          [table.pk_name]: body[table.pk_name],
        },
        joinFields,
      });
      if (dbrow.length > 0) row = { ...body, ...dbrow[0] };
    } else {
      const freeVars = freeVariables(table.ownership_formula);
      const fields = table.getFields();

      const field_names = new Set(fields.map((f: any) => f.name));

      for (const fv of freeVars) {
        const kpath = fv.split(".");
        if (field_names.has(kpath[0]) && kpath.length > 1) {
          const field = fields.find((f: any) => f.name === kpath[0]);
          if (!field)
            throw new Error("Invalid formula:" + table.ownership_formula);
          const reftable = Table.findOne({ name: field.reftable_name })!;
          const joinFields: GenObj = {};
          const [kpath0, ...kpathrest] = kpath;
          add_free_variables_to_joinfields(
            new Set([kpathrest.join(".")]),
            joinFields,
            fields
          );

          const rows = await reftable.getJoinedRows({
            where: {
              [reftable.pk_name]: body[kpath0],
            },
            joinFields,
          });
          row[kpath0] = rows[0];
        }
      }
    }

    const is_owner = await table.is_owner(req.user, row);
    return is_owner;
  }
  if (table.name === "users" && `${body.id}` === `${user_id}`) return true;
  return false;
};

/**
 * @param param0
 * @param param1
 * @returns
 */
const authorise_post = async (
  {
    body,
    table_id,
    req,
  }: { body: GenObj; table_id: number | string; req: Req },
  { authorizePostQuery }: GenObj
) => {
  return await authorizePostQuery(body, table_id);
};

/**
 * @param tableId
 * @param viewName
 * @param id
 * @param fieldName
 * @param fieldView
 * @param user
 * @param configuration
 * @param targetOpts
 * @returns
 */
const openDataStream = async (
  tableId: number | string,
  viewName: string,
  id: any,
  fieldName: string,
  fieldView: string,
  user: any,
  configuration: GenObj,
  targetOpts: any
) => {
  const table = Table.findOne({ id: tableId })!;
  const field = table.getField(fieldName);
  if (!field) throw new InvalidConfiguration(`Field ${fieldName} not found`);
  if (field.type === "File") {
    const cfgCol = configuration.columns.find(
      (col: any) => col.fieldview === fieldView && col.field_name === fieldName
    );
    const fileView = getState().fileviews[fieldView];
    if (!fileView)
      throw new InvalidConfiguration(`File view ${fieldView} not found`);
    return await fileView.openDataStream(
      tableId,
      id,
      fieldName,
      user,
      cfgCol.configuration,
      targetOpts
    );
  }
};

/**
 * @param view
 * @param id
 * @param fieldName
 * @param user
 * @param targetOpts
 * @returns
 */
const authorizeDataStream = async (
  view: any,
  id: any,
  fieldName: string,
  user: any,
  targetOpts: any
) => {
  if (!user || user.role_id > view.min_role) return false;
  else {
    const table = Table.findOne({ id: view.table_id })!;
    if (!table || user.role_id > table.min_role_write) return false;
    else {
      const field = table.getField(fieldName)!;
      if (field.type === "File") {
        if (targetOpts?.oldTarget) {
          const file = await File.findOne(targetOpts.oldTarget);
          if (file) return file.min_role_read >= user.role_id;
        } else if (id) {
          const row = await table.getRow({ [table.pk_name]: id });
          const fileCol = row![fieldName];
          if (fileCol) {
            const file = await File.findOne(row![fieldName]);
            if (file) return file.min_role_read >= user.role_id;
          }
        }
        return true;
      } else {
        return false;
      }
    }
  }
};

const run_action = async (
  table_id: number | string,
  viewname: string,
  { columns, layout }: GenObj,
  body: GenObj,
  { req, res }: { req: Req; res: Res },
  { actionQuery }: GenObj
) => {
  const result = await actionQuery();
  if (result.json.error) {
    Crash.create({ message: result.json.error, stack: "" }, req as any);
  }
  return result;
};

const update_matching_rows = async (
  table_id: number | string,
  viewname: string,
  {
    columns,
    layout,
    fixed,
    view_when_done,
    formula_destinations,
    auto_save,
    destination_type,
    dest_url_formula,
    page_when_done,
    page_group_when_done,
  }: GenObj,
  body: GenObj,
  { req, res, redirect }: { req: Req; res: Res; redirect?: string },
  {
    updateMatchingQuery,
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  }: GenObj
) => {
  const table = Table.findOne({ id: table_id })!;
  const fields = table.getFields();
  const prepResult = await prepare(
    viewname,
    table,
    fields,
    {
      columns,
      layout,
      fixed,
      auto_save,
    },
    { req, res },
    body,
    {
      getRowQuery,
      saveFileQuery,
      saveFileFromContentsQuery,
      optionsQuery,
      getRowByIdQuery,
    }
  );
  if (prepResult) {
    let { form, row, pk } = prepResult;
    const state = req?.query
      ? readState(removeEmptyStrings(req.query), fields, req)
      : {};
    const where = stateFieldsToWhere({ fields, state, table });
    const repeatFields = form.fields.filter((f: any) => f.isRepeat);
    const childRows: GenObj = {};
    for (const field of repeatFields)
      childRows[field.name] = form.values[field.name];
    const { id, ...rest } = row;
    const uptResults = await updateMatchingQuery(
      where,
      rest,
      repeatFields,
      childRows
    );
    if (uptResults.error || uptResults.rowError || uptResults.inEditError) {
      res.status(422);
      (req as any).flash(
        "error",
        text_attr(
          uptResults.error || uptResults.rowError || uptResults.inEditError
        )
      );
      res.sendWrap(viewname, renderForm(form, req.csrfToken()));
      return;
    }
    const { success, danger, goto } = combineResults(uptResults);
    if (success.length > 0) {
      (req as any).flash("success", success);
    }
    if (danger.length > 0) {
      (req as any).flash("danger", danger);
    } else if (goto) {
      res.redirect(goto);
      return;
    }
    await whenDone(
      viewname,
      table_id,
      fields,
      pk,
      {
        view_when_done,
        formula_destinations,
        destination_type,
        dest_url_formula,
        page_when_done,
        page_group_when_done,
        redirect,
      },
      req,
      res,
      body,
      row
    );
  }
};

const prepare = async (
  viewname: string,
  table: any,
  fields: any[],
  { columns, layout, fixed, auto_save }: GenObj,
  { req, res }: { req: Req; res: Res },
  body: GenObj,
  {
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  }: GenObj,
  remote?: boolean
) => {
  const isRemote = !isWeb(req);
  const form = await getForm(
    table,
    viewname,
    columns,
    layout,
    body.id,
    req,
    isRemote
  );
  if (auto_save)
    form.onChange = `saveAndContinueDelayed(this, ${
      !isWeb(req) ? `'${form.action}'` : undefined
    }, event);`;

  Object.entries(body).forEach(([k, v]) => {
    const form_field = form.fields.find((f: any) => f.name === k);
    const tbl_field = fields.find((f: any) => f.name === k);
    if (tbl_field && !form_field && !fixed?.[`_block_${k}`]) {
      form.fields.push(new Field({ name: k, input_type: "hidden" }));
    }
  });
  setDateLocales(form, req.getLocale());
  await transformForm({
    form,
    table,
    req,
    res,
    row: body[table.pk_name] ? { [table.pk_name]: body[table.pk_name] } : null,
    getRowQuery,
    viewname,
    optionsQuery,
  });
  const cancel = body._cancel;
  await form.asyncValidate({
    ...body,
    _file_names: Object.keys(req.files || {}),
  });
  if (form.hasErrors && !cancel) {
    if (req.xhr) res.status(422);
    await form.fill_fkey_options(false, optionsQuery, req.user);
    const view = View.findOne({ name: viewname });

    res.sendWrap(
      { title: viewname, no_menu: view?.attributes?.no_menu },
      renderForm(form, req.csrfToken ? req.csrfToken() : false)
    );
    return null;
  }
  let row: any;
  const pk = fields.find((f: any) => f.primary_key);
  let id: any;
  if (table.composite_pk_names) {
    id = {};
    table.fields
      .filter((f: any) => f.primary_key)
      .forEach((f: any) => {
        id[f.name] = f.type.read(body[f.name]);
      });
  } else {
    id = pk.type.read(body[pk.name]);
  }
  if (typeof id === "undefined") {
    const use_fixed = await fill_presets(table, req, fixed);
    row = { ...use_fixed, ...form.values };
  } else if (cancel) {
    row = getRowByIdQuery
      ? await getRowByIdQuery(id)
      : await table.getRow({ id }, { forUser: req.user, forPublic: !req.user });
  } else {
    row = { ...form.values };
  }
  for (const field of form.fields.filter((f: any) => f.isRepeat)) {
    delete row[field.name];
  }

  const file_fields = form.fields.filter((f: any) => f.type === "File");
  for (const field of file_fields) {
    if (!field.fieldviewObj?.isEdit || field.fieldviewObj?.isStream) continue;
    if (field.fieldviewObj?.setsFileId) {
      //do nothing
    } else if (field.fieldviewObj?.setsDataURL) {
      if (body[field.name]) {
        if (body[field.name].startsWith("data:")) {
          const path_to_serve = await saveFileQuery(
            body[field.name],
            field.id,
            field.fieldview,
            row
          );
          const storedValue = File.fieldValueFromRelative(path_to_serve);
          row[field.name] = storedValue;
          form.values[field.name] = storedValue;
        }
      }
    } else if (field.fieldviewObj?.editContent) {
      if (body[field.name]) {
        const path_to_serve = await saveFileFromContentsQuery(
          body[`_content_${field.name}`],
          field.id,
          field.fieldview,
          row,
          body[field.name],
          "utf8"
        );
        const storedValue = File.fieldValueFromRelative(path_to_serve);
        row[field.name] = storedValue;
        form.values[field.name] = storedValue;
      }
    } else if (req.files && req.files[field.name]) {
      if (!isWeb(req) && !remote && req.files[field.name].name) {
        throw new Error(
          "The mobile-app supports no local files, please use a remote table."
        );
      }
      if (isWeb(req)) {
        const file = await File.from_req_files(
          req.files[field.name],
          req.user ? req.user.id : undefined,
          (field.attributes && +field.attributes.min_role_read) || 1,
          field?.attributes?.folder
        );
        row[field.name] = file.field_value;
        form.values[field.name] = file.field_value;
      } else {
        const file = req.files[field.name];
        if (file) {
          const serverResp = await File.upload(req.files[field.name]);
          if (serverResp?.location)
            row[field.name] = File.normalizeFieldValueInput(
              serverResp.location
            );
        }
      }
    } else if (typeof body[`__exisiting_file_${field.name}`] === "string") {
      row[field.name] = File.normalizeFieldValueInput(
        body[`__exisiting_file_${field.name}`]
      );
      form.values[field.name] = row[field.name];
    } else {
      delete row[field.name];
    }
  }
  return { form, row, pk, id };
};

const whenDone = async (
  viewname: string,
  table_id: number | string,
  fields: any[],
  pk: any,
  {
    view_when_done,
    formula_destinations,
    destination_type,
    dest_url_formula,
    page_when_done,
    page_group_when_done,
    redirect,
  }: GenObj,
  req: Req,
  res: Res,
  body: GenObj,
  row0: GenObj,
  trigger_return?: any,
  check_ajax?: boolean,
  originalID?: any,
  table?: any
) => {
  const res_redirect = (url: string) => {
    if (check_ajax && req.xhr && !(req as any).smr)
      res.json({
        view_when_done,
        url_when_done: url,
        ...(trigger_return || {}),
      });
    else res.redirect(url);
  };

  if (redirect) {
    res_redirect(redirect);
    return;
  }
  if (check_ajax && req.xhr && !(req as any).smr && trigger_return?.error) {
    res.json({
      view_when_done,
      ...(trigger_return || {}),
    });
    return;
  }
  let use_view_when_done = view_when_done;
  let row: GenObj;
  if (
    table &&
    ((originalID && destination_type === "URL formula") ||
      (use_view_when_done || "").includes("."))
  ) {
    const db_row = await table.getRow({ [table.pk_name]: originalID });
    row = { ...db_row, ...row0 };
  } else row = row0;
  if (destination_type === "Back to referer" && body._referer) {
    res_redirect(body._referer);
    return;
  } else if (destination_type === "Page" && page_when_done) {
    res_redirect(`/page/${page_when_done}`);
    return;
  } else if (destination_type === "PageGroup" && page_group_when_done) {
    res_redirect(`/page/${page_group_when_done}`);
    return;
  } else if (destination_type === "URL formula" && dest_url_formula) {
    const url = eval_expression(
      dest_url_formula,
      row,
      "Destination URL formula"
    );
    res_redirect(url);
    return;
  } else if (destination_type !== "View")
    for (const { view, expression } of formula_destinations || []) {
      if (expression) {
        const f = get_expression_function(expression, fields);
        if (f(row)) {
          use_view_when_done = view;
          continue;
        }
      }
    }
  if (!use_view_when_done) {
    res_redirect(`/`);
    return;
  }
  const [viewname_when_done, relation] = use_view_when_done.split(".");
  const nxview = View.findOne({ name: viewname_when_done });
  if (!nxview) {
    (req as any).flash(
      "warning",
      `View "${use_view_when_done}" not found - change "View when done" in "${viewname}" view`
    );
    res_redirect(`/`);
  } else {
    const state_fields = await nxview.get_state_fields();
    let target = `/view/${text(viewname_when_done)}`;
    let query = "";
    if (
      (nxview.table_id === table_id || relation) &&
      state_fields.some((sf: any) => sf.name === pk.name) &&
      viewname_when_done !== viewname
    ) {
      const get_query = get_view_link_query(fields, nxview);
      query = relation ? `?${pk.name}=${text(row[relation])}` : get_query(row);
    }
    const redirectPath = `${target}${query}`;
    if (!isWeb(req)) {
      res.json({ redirect: `get${redirectPath}` });
    } else {
      res_redirect(redirectPath);
    }
  }
};

const combineResults = (results: any[]) => {
  const combined: GenObj = { success: [], danger: [] };
  for (const uptResult of results) {
    const trigger_return = uptResult.trigger_return || {};
    if (trigger_return.notify && trigger_return.details)
      combined.success.push(
        div(
          { class: "d-inline" },
          trigger_return.notify,
          button(
            {
              class: "btn btn-sm btn-outline-secondary btn-xs",
              type: "button",
              "data-bs-toggle": "collapse",
              "data-bs-target": "#notifyDetails",
              "aria-expanded": "false",
              "aria-controls": "notifyDetails",
            },
            i({ class: "fas fa-plus" })
          ),
          div(
            { class: "collapse", id: "notifyDetails" },
            pre(trigger_return.details)
          )
        )
      );
    else if (trigger_return.notify)
      combined.success.push(trigger_return.notify);
    if (trigger_return.error) combined.danger.push(trigger_return.error);
    if (trigger_return.goto && !combined.goto)
      combined.goto = trigger_return.goto;
  }
  return combined;
};

const tryUpdateImpl = async (row: GenObj, id: any, table: any, req: Req) => {
  const result: GenObj = {};
  const upd_res = await table.tryUpdateRow(
    row,
    id,
    req.user || { role_id: 100 },
    result,
    { req }
  );
  upd_res.trigger_return = result;
  return upd_res;
};

const tryInsertOrUpdateImpl = async (
  row: GenObj,
  id: any,
  table: any,
  req: Req
) => {
  const result: GenObj = {};
  const exists = await table.getRow(
    typeof id === "object" ? id : { [table.pk_name]: id }
  );
  if (exists) {
    const upd_res = await table.tryUpdateRow(
      row,
      id,
      req.user || { role_id: 100 },
      result,
      { req }
    );
    upd_res.trigger_return = result;
    return upd_res;
  } else {
    const result: GenObj = {};
    const ins_res = await table.tryInsertRow(
      row,
      req.user || { role_id: 100 },
      result
    );
    (ins_res as any).trigger_return = result;
    return ins_res;
  }
};

/**
 * @param param0
 * @returns
 */
const createBasicView = async ({
  table,
  viewname,
  template_view,
  template_table,
  all_views_created,
}: GenObj) => {
  if (!template_view) {
    const configuration = await initial_config_all_fields(true)({
      table_id: table.id,
    });
    if (all_views_created.List) {
      configuration.view_when_done = all_views_created.List;
      configuration.destination_type = "View";
    }

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
  const defaultBranch = inner
    ? findLayoutBranchhWith(inner.above || inner.contents.above, (s: any) => {
        return s.type === "field";
      })
    : null;
  const inners: any[] = [],
    columns: any[] = [];
  for (const field of table.fields) {
    if (field.primary_key) continue;
    const branch =
      findLayoutBranchhWith(inner.above || inner.contents.above, (s: any) => {
        return (
          s.type === "field" &&
          templateFieldTypes[s.field_name] === field.type_name
        );
      }) || defaultBranch;
    let oldField: any;
    if (branch)
      traverseSync(branch, {
        field(s: any) {
          oldField = template_table.getField(s.field_name);
        },
      });
    const newBranch = structuredClone(branch);
    let newCol: GenObj = {};
    traverseSync(newBranch, {
      field(s: any) {
        s.field_name = field.name;
        newCol = {
          type: "Field",
          fieldview: s.fieldview,
          field_name: field.name,
        };
      },
      blank(s: any) {
        if (s.contents === oldField.label) s.contents = field.label;
        if (s.labelFor === oldField.name) s.labelFor = field.name;
      },
    });
    inners.push(newBranch);
    columns.push(newCol);
  }
  //clone any actions in inner
  for (const tmpl_inner of inner.above || inner.contents.above) {
    let hasField = false;
    let hasAction = false;
    const theActions: any[] = [];
    traverseSync(tmpl_inner, {
      field() {
        hasField = true;
      },
      action(s: any) {
        hasAction = true;
        theActions.push(s);
      },
    });
    if (hasAction && !hasField) inners.push(tmpl_inner);
    theActions.forEach((a: any) => columns.push({ ...a, type: "Action" }));
  }
  const cfg: GenObj = {
    layout: outer({ above: inners }),
    columns,
  };
  if (all_views_created.List) {
    cfg.view_when_done = all_views_created.List;
    cfg.destination_type = "View";
  }

  cfg.auto_save = template_view.configuration.auto_save;
  cfg.confirm_leave = template_view.configuration.confirm_leave;
  cfg.auto_create = template_view.configuration.auto_create;
  cfg.delete_unchanged_auto_create =
    template_view.configuration.delete_unchanged_auto_create;
  cfg.split_paste = template_view.configuration.split_paste;

  return cfg;
};

/**
 * @param table_id
 * @param viewname
 * @param param2
 * @returns
 */
const virtual_triggers = (
  table_id: number | string,
  viewname: string,
  { enable_realtime, update_events }: GenObj
) => {
  if (!enable_realtime) return [];
  const table = Table.findOne({ id: table_id })!;
  const view = View.findOne({ name: viewname })!;
  return [
    {
      when_trigger: "Update",
      table_id: table_id,
      run: async (row: GenObj, { old_row, user }: GenObj) => {
        getState().log(
          6,
          `Virtual trigger Update for ${viewname} on table ${table.name}`
        );
        const fields = table.getFields();
        const changedFields = fields.filter((f: any) => {
          if (f.name === table.pk_name) return false;
          const a = row[f.name];
          const b = old_row[f.name];
          if (f.type?.equals) return !f.type.equals(a, b, f.attributes || {});
          else return row[f.name] !== old_row[f.name];
        });
        const changedLayoutFields = new Set();
        await traverse(view.configuration.layout, {
          field(segment: any) {
            const { field_name } = segment;
            if (changedFields.find((f: any) => f.name === field_name))
              changedLayoutFields.add(field_name);
          },
        });

        if (changedLayoutFields.size === 0) {
          getState().log(
            6,
            "No layout fields changed, skipping real-time update"
          );
        } else {
          const updates: GenObj = {};
          for (const fieldName of changedLayoutFields) {
            const newVal = row[fieldName as string];
            updates[fieldName as string] = newVal;
          }
          const rowId = row[table.pk_name];
          const actionResults = await runCollabEvents(update_events, user, {
            new_row: row,
            old_row: old_row,
            updates: updates,
          });
          getState().log(
            6,
            "Emitting real-time update for row",
            rowId,
            updates
          );
          view.emitRealTimeEvent(`UPDATE_EVENT?id=${rowId}`, {
            updates: updates,
            actions: actionResults,
          });
        }
      },
    },
  ];
};

export = {
  /** @type {string} */
  name: "Edit",
  /** @type {string} */
  description: "Form for creating a new row or editing existing rows",
  configuration_workflow,
  run,
  runMany,
  runPost,
  openDataStream,
  authorizeDataStream,
  get_state_fields,
  initial_config,
  createBasicView,
  authorise_post,
  virtual_triggers,
  /**
   * @param param0
   * @param param1
   * @returns
   */
  authorise_get: async (
    {
      query,
      table_id,
      req,
    }: { query: GenObj; table_id: number | string; req: Req },
    { authorizeGetQuery }: GenObj
  ) => {
    return await authorizeGetQuery(query, table_id);
  },
  /**
   * @param param0
   * @returns
   */
  getStringsForI18n({ layout }: GenObj) {
    return getStringsForI18n(layout);
  },
  /**
   * @param param0
   * @returns
   */
  queries: ({
    table_id,
    name,
    configuration: {
      columns,
      default_state,
      layout,
      auto_save,
      split_paste,
      destination_type,
      fixed,
      confirm_leave,
      auto_create,
      delete_unchanged_auto_create,
      enable_realtime,
      update_events,
    },
    req,
    res,
  }: GenObj) => ({
    async editQuery(
      state: GenObj,
      mobileReferrer: string | undefined,
      isPreview: boolean,
      hiddenLoginDest: any
    ) {
      const table = Table.findOne({ id: table_id })!;
      const fields = table.getFields();
      const { uniques } = splitUniques(fields, state);
      let row: any = null;
      let auto_created_row = false;
      const unique_constraints = table.constraints.filter(
        (tc: any) => tc.type === "Unique"
      );

      const getRow = async (where: GenObj) => {
        const joinFields: GenObj = {};
        const picked = picked_fields_to_query([], fields, layout, req, table);
        const colFields = new Set(
          columns.map((c: any) =>
            c.join_field ? c.join_field.split(".")[0] : c.field_name
          )
        );

        Object.entries(picked.joinFields).forEach(
          ([nm, jfv]: [string, any]) => {
            if (!colFields.has(jfv.ref)) joinFields[nm] = jfv;
          }
        );
        return await table.getJoinedRow({
          where,
          joinFields,
          forPublic: !req.user,
          forUser: req.user,
        });
      };
      if (Object.keys(uniques).length > 0) {
        row = await getRow(uniques);
      } else if (unique_constraints.length) {
        for (const tc of unique_constraints) {
          const fields = tc.configuration.fields;
          if (
            fields &&
            (fields || []).every(
              (fname: string) => typeof state[fname] !== "undefined"
            )
          ) {
            const where: GenObj = {};
            fields.forEach((fnm: string) => (where[fnm] = state[fnm]));
            row = await getRow(where);
            break;
          }
        }
      }

      if (!row && auto_create && !isPreview) {
        row = {};
        fields.forEach((f: any) => {
          if (typeof state[f.name] !== "undefined") {
            if (f.type?.read)
              row[f.name] = f.type?.read
                ? f.type.read(state[f.name], f.attributes)
                : state[f.name];
          } else if (f.required)
            if (
              typeof f.attributes?.default !== "undefined" &&
              f.attributes?.default !== null
            )
              row[f.name] = f.attributes.default;
            else if (f.type.sql_name === "text") row[f.name] = "";
        });
        const use_fixed = await fill_presets(table, req, fixed);
        row = { ...row, ...use_fixed };
        row.id = await table.insertRow(row, req.user);
        auto_created_row = true;
      }
      const isRemote = !isWeb(req);
      return await render({
        table,
        fields,
        viewname: name,
        columns,
        layout,
        row,
        req,
        res,
        state,
        auto_save,
        destination_type,
        isRemote,
        split_paste,
        confirm_leave,
        mobileReferrer,
        delete_unchanged_auto_create,
        isPreview,
        auto_created_row,
        hiddenLoginDest,
        enable_realtime,
        update_events,
      });
    },
    async editManyQuery(
      state: GenObj,
      { limit, offset, orderBy, orderDesc, where }: GenObj
    ) {
      const table = Table.findOne({ id: table_id })!;
      const fields = table.getFields();
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        undefined,
        req,
        table
      );
      const qstate = stateFieldsToWhere({
        fields,
        state,
        table,
        prefix: "a.",
      });
      const q = stateFieldsToQuery({ state, fields });
      if (where) mergeIntoWhere(qstate, where);
      const rows = await table.getJoinedRows({
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
      return {
        table,
        fields,
        rows,
      };
    },
    async tryInsertQuery(row: GenObj) {
      const table = Table.findOne({ id: table_id })!;
      const result: GenObj = {};
      const ins_res = await table.tryInsertRow(
        row,
        req.user || { role_id: 100 },
        result
      );
      (ins_res as any).trigger_return = result;
      return ins_res;
    },

    async tryUpdateQuery(row: GenObj, id: any) {
      const table = Table.findOne(table_id)!;
      return await tryUpdateImpl(row, id, table, req);
    },
    async saveFileQuery(
      fieldVal: string,
      fieldId: number,
      fieldView: string,
      row: GenObj
    ) {
      const field = await Field.findOne({ id: fieldId });
      const column = columns.find(
        (c: any) => c.type === "Field" && c.field_name === field.name
      );
      field.fieldviewObj = getState().fileviews[fieldView];
      const [pre, allData] = fieldVal.split(",");
      const buffer = require("buffer/").Buffer.from(allData, "base64");
      const mimetype = pre.split(";")[0].split(":")[1];
      const filename =
        (field.fieldviewObj as any)?.setsDataURL?.get_filename?.({
          ...row,
          ...field.attributes,
        }) || "file";
      const folder = (field.fieldviewObj as any)?.setsDataURL?.get_folder?.({
        ...row,
        ...field.attributes,
        ...(column?.configuration || {}),
      });
      const file = await File.from_contents(
        filename,
        mimetype,
        buffer,
        req.user?.id,
        field.attributes.min_role_read || 1,
        folder
      );
      return File.fieldValueFromRelative(file.path_to_serve);
    },
    async saveFileFromContentsQuery(
      fieldVal: string,
      fieldId: number,
      fieldView: string,
      row: GenObj,
      filename: string,
      encoding = "base64"
    ) {
      const field = await Field.findOne({ id: fieldId });
      const column = columns.find(
        (c: any) => c.type === "Field" && c.field_name === field.name
      );
      field.fieldviewObj = getState().fileviews[fieldView];
      let mimetype: string, allData: string;
      if (encoding == "base64") {
        let [pre, allData0] = fieldVal.split(",");
        mimetype = pre.split(";")[0].split(":")[1];
        allData = allData0;
      } else {
        allData = fieldVal;
        mimetype =
          (filename && File.nameToMimeType(filename)) ||
          "application/octet-stream";
      }
      const buffer = require("buffer/").Buffer.from(allData, encoding);
      const filename1 = filename || "file";

      const existing_file = await File.findOne(filename1);
      if (existing_file) {
        if (existing_file.min_role_read >= (req.user?.role_id || 100)) {
          await existing_file.overwrite_contents(buffer);
          return File.fieldValueFromRelative(existing_file.path_to_serve);
        } else throw new Error("Not authorized to write file");
      }

      const file = await File.from_contents(
        filename1,
        mimetype,
        buffer,
        req.user?.id,
        field.attributes.min_role_read || 1
      );
      return File.fieldValueFromRelative(file.path_to_serve);
    },
    async authorizePostQuery(body: GenObj, table_id: number | string) {
      return await doAuthPost({ body, table_id, req });
    },
    async authorizeGetQuery(query: GenObj, table_id: number | string) {
      let body = query || {};
      const table = Table.findOne({ id: table_id })!;
      if (Object.keys(body).length == 1) {
        if (table.ownership_field_id || table.ownership_formula) {
          const fields = table!.getFields();
          const { uniques } = splitUniques(fields, body);
          if (Object.keys(uniques).length > 0) {
            const joinFields: GenObj = {};
            if (table.ownership_formula) {
              const freeVars = freeVariables(table.ownership_formula);
              add_free_variables_to_joinfields(freeVars, joinFields, fields);
            }
            const row = await table.getJoinedRows({
              where: uniques,
              joinFields,
            });
            if (row.length > 0) return table.is_owner(req.user, row[0]);
            else return true;
          } else {
            return true;
          }
        }
      } else {
        return table.ownership_field_id || table.ownership_formula;
      }
      return doAuthPost({ body, table_id, req });
    },
    async getRowQuery(
      table_id: number | string,
      view_select: any,
      row_id: any,
      order_field?: string
    ) {
      const childTable = Table.findOne({ id: table_id })!;
      return await childTable.getRows(
        {
          [view_select.field_name]: row_id,
        },
        {
          forPublic: !req.user,
          forUser: req.user,
          orderBy: order_field || undefined,
        }
      );
    },
    async getRowByIdQuery(id: any) {
      const table = Table.findOne({ id: table_id });
      return await table!.getRow(typeof id === "object" ? id : { id }, {
        forUser: req.user,
        forPublic: !req.user,
      });
    },
    async actionQuery() {
      const {
        rndid,
        _csrf,
        onchange_action,
        onchange_field,
        click_action,
        ...body
      } = req.body || {};

      const table = Table.findOne({ id: table_id });
      const pk_name = table!.pk_name;
      let row = body[pk_name]
        ? (await table!.getRow(
            { [pk_name]: body[pk_name] },
            {
              forPublic: !req.user,
              forUser: req.user,
            }
          )) || {}
        : {};

      table!.fields.forEach((f: any) => {
        if (!f?.validate) return;
        const valres = f.validate(body);
        if ("success" in valres) row[f.name] = valres.success;
      });
      if (fixed) {
        const use_fixed = await fill_presets(table, req, fixed);
        Object.keys(use_fixed).forEach((k: string) => {
          if (row[k] === null || typeof row[k] === "undefined")
            row[k] = use_fixed[k];
        });
      }

      try {
        return await db.withTransaction(async () => {
          if (click_action) {
            let container: any;
            traverseSync(layout, {
              container(segment: any) {
                if (segment.click_action === click_action) container = segment;
              },
            });
            if (!container) return { json: { error: "Action not found" } };
            const trigger = Trigger.findOne({ name: click_action });
            if (!trigger)
              throw new Error(
                `View ${name}: Container click action ${click_action} not found`
              );
            const result = await trigger.runWithoutRow({
              table,
              Table,
              req,
              row,
              referrer: req?.get?.("Referrer"),
              user: req.user,
            });
            return { json: { success: "ok", ...(result || {}) } };
          } else if (onchange_action && !rndid) {
            const fldCol = columns.find(
              (c: any) =>
                c.field_name === onchange_field &&
                c.onchange_action === onchange_action
            );
            if (!fldCol) return { json: { error: "Field not found" } };
            const trigger = Trigger.findOne({ name: onchange_action });
            if (!trigger)
              throw new Error(
                `View ${name}: On change action ${onchange_action} for field ${onchange_field} not found`
              );

            const result = await trigger.runWithoutRow({
              table,
              Table,
              req,
              row,
              referrer: req?.get?.("Referrer"),
              user: req.user,
            });
            return { json: { success: "ok", ...(result || {}) } };
          } else {
            const col = columns.find(
              (c: any) => c.type === "Action" && c.rndid === rndid && rndid
            );
            const result = await run_action_column({
              col,
              req,
              table,
              row,
              res,
              referrer: req?.get?.("Referrer"),
              columns,
              viewname: name,
            });
            return { json: { success: "ok", ...(result || {}) } };
          }
        });
      } catch (e: any) {
        console.error(e);
        return { json: { error: e.message || e } };
      }
    },
    async optionsQuery(
      reftable_name: string,
      type: any,
      attributes: any,
      where: GenObj
    ) {
      const refTable = Table.findOne({ name: reftable_name });
      const rows = await refTable!.getRows(where, {
        forUser: req.user,
        forPublic: !req.user,
      });
      return rows;
    },
    async updateMatchingQuery(
      where: GenObj,
      updateVals: GenObj,
      repeatFields: any[],
      childRows: GenObj
    ) {
      const table = Table.findOne(table_id);
      const rows = await table!.getRows(where, {
        forUser: req.user,
        forPublic: !req.user,
      });
      const results: any[] = [];
      let inTransaction = false;
      try {
        if (rows.length === 0) return results;
        await db.begin();
        inTransaction = true;
        for (const row of rows) {
          const uptRes = await tryUpdateImpl(updateVals, row.id, table, req);
          if (uptRes.error) {
            inTransaction = false;
            await db.rollback();
            return { rowError: uptRes.error };
          }
          results.push(uptRes);
          for (const field of repeatFields) {
            const childTable = Table.findOne({ id: field.metadata?.table_id });
            await childTable!.deleteRows(
              { [field.metadata?.relation]: row.id },
              req.user || { role_id: 100 }
            );
            for (const childRow of childRows[field.name]) {
              childRow[field.metadata?.relation] = row.id;
              const insRow = { ...childRow };
              delete insRow[childTable!.pk_name];
              const insRes = await childTable!.tryInsertRow(
                insRow,
                req.user || { role_id: 100 }
              );
              if ((insRes as any).error) {
                inTransaction = false;
                await db.rollback();
                return { inEditError: (insRes as any).error };
              }
            }
          }
        }
        if (inTransaction) await db.commit();
      } catch (error: any) {
        if (inTransaction) await db.rollback();
        return { error: error.message };
      }
      return results;
    },
  }),
  routes: { run_action, update_matching_rows },
  /**
   * @param table_id
   * @param title
   * @param state
   * @returns
   */
  async interpolate_title_string(
    table_id: number | string,
    title: string,
    state: GenObj
  ) {
    const tbl = Table.findOne(table_id)!;
    if (state?.[tbl!.pk_name]) {
      const freeVars = freeVariablesInInterpolation(title);
      const joinFields: GenObj = {};
      const aggregations: GenObj = {};
      add_free_variables_to_joinfields(freeVars, joinFields, tbl!.fields);
      add_free_variables_to_aggregations(freeVars, aggregations, tbl);
      const row = await tbl!.getJoinedRow({
        where: { [tbl!.pk_name]: state[tbl!.pk_name] },
        joinFields,
        aggregations,
      });

      return interpolate(title, row, null, "Edit view title string");
    } else {
      return interpolate(title, null, null, "Edit view title string");
    }
  },
  /**
   * @param view
   * @returns
   */
  configCheck: async (view: View) => {
    const {
      name,
      configuration: {
        view_when_done,
        destination_type,
        dest_url_formula,
        formula_destinations,
        page_when_done,
        page_group_when_done,
      },
    } = view;
    const errs: string[] = [];
    const warnings: string[] = [];

    if (!destination_type || destination_type === "View") {
      const vwd = View.findOne({
        name: (view_when_done || "").split(".")[0],
      });
      if (!vwd)
        warnings.push(
          `In View ${name}, view when done ${view_when_done} not found`
        );
    }
    if (destination_type === "Page") {
      const page = Page.findOne({ name: page_when_done });
      if (!page)
        errs.push(
          `In View ${name}, page when done ${page_when_done} not found`
        );
    }
    if (destination_type === "PageGroup") {
      const group = PageGroup.findOne({ name: page_group_when_done });
      if (!group)
        errs.push(
          `In View ${name}, page group when done ${page_group_when_done} not found`
        );
    }
    if (destination_type === "Formula") {
      for (const { expression } of formula_destinations || []) {
        if (expression)
          expressionChecker(
            expression,
            `In View ${name}, destination formula ${expression} error: `,
            errs
          );
      }
    }
    if (destination_type === "URL Formula") {
      expressionChecker(
        dest_url_formula,
        `In View ${name}, URL formula ${dest_url_formula} error: `,
        errs
      );
    }
    const colcheck = await check_view_columns(view, view.configuration.columns);
    errs.push(...colcheck.errors);
    warnings.push(...colcheck.warnings);
    return { errors: errs, warnings };
  },
  /**
   * @param configuration
   * @returns
   */
  connectedObjects: async (configuration: GenObj) => {
    return extractFromLayout(configuration.layout);
  },
};
