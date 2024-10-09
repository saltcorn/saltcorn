/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/edit
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const File = require("../../models/file");
const Table = require("../../models/table");
const User = require("../../models/user");
const Crash = require("../../models/crash");
const Form = require("../../models/form");
const Page = require("../../models/page");
const PageGroup = require("../../models/page_group");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const Trigger = require("../../models/trigger");

const { getState } = require("../../db/state");
const {
  text,
  text_attr,
  script,
  domReady,
  div,
  button,
  i,
  pre,
} = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const FieldRepeat = require("../../models/fieldrepeat");
const {
  get_expression_function,
  expressionChecker,
  eval_expression,
  freeVariables,
  freeVariablesInInterpolation,
} = require("../../models/expression");
const {
  InvalidConfiguration,
  isNode,
  isWeb,
  mergeIntoWhere,
  dollarizeObject,
  getSessionId,
  interpolate,
  asyncMap,
  removeEmptyStrings,
} = require("../../utils");
const Library = require("../../models/library");
const { check_view_columns } = require("../../plugin-testing");
const {
  initial_config_all_fields,
  calcfldViewOptions,
  calcfldViewConfig,
  get_parent_views,
  picked_fields_to_query,
  stateFieldsToWhere,
  stateFieldsToQuery,
  getActionConfigFields,
  run_action_column,
  add_free_variables_to_joinfields,
  readState,
  stateToQueryString,
  pathToState,
  displayType,
} = require("../../plugin-helper");
const {
  splitUniques,
  getForm,
  fill_presets,
  parse_view_select,
  get_view_link_query,
  objToQueryString,
  action_url,
  action_link,
  view_linker,
} = require("./viewable_fields");
const {
  traverse,
  getStringsForI18n,
  translateLayout,
  traverseSync,
} = require("../../models/layout");
const { extractFromLayout } = require("../../diagram/node_extract_utils");
const db = require("../../db");
const { prepare_update_row } = require("../../web-mobile-commons");
const _ = require("underscore");
const { Relation, RelationType } = require("@saltcorn/common-code");

const builtInActions = [
  "Save",
  "SaveAndContinue",
  "UpdateMatchingRows",
  "SubmitWithAjax",
  "Reset",
  "GoBack",
  "Delete",
  "Cancel",
];

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
          const table = Table.findOne({ id: context.table_id });
          const fields = table.getFields().filter((f) => !f.primary_key);
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = Table.findOne({
                name: field.reftable_name,
              });
              if (field.reftable) await field.reftable.getFields();
            }
          }

          const { field_view_options, handlesTextStyle, blockDisplay } =
            calcfldViewOptions(fields, "edit");
          //const fieldViewConfigForms = await calcfldViewConfig(fields, true);

          const roles = await User.get_roles();
          const images = await File.find({ mime_super: "image" });
          const stateActions = Object.entries(getState().actions).filter(
            ([k, v]) => !v.disableInBuilder
          );
          const triggerActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
          });
          const actions = Trigger.action_options({
            tableTriggers: table.id,
            apiNeverTriggers: true,
            builtInLabel: "Edit Actions",
            builtIns: builtInActions,
          });

          const actionConfigForms = {
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
                { mode: "edit" }
              );
            }
          }
          if (table.name === "users") {
            actions.push("Login");
            actions.push("Sign up");
            Object.entries(getState().auth_methods).forEach(([k, v]) => {
              actions.push(`Login with ${k}`);
            });
            fields.push({
              name: "password",
              label: req.__("Password"),
              type: "String",
            });
            fields.push({
              name: "passwordRepeat",
              label: req.__("Password Repeat"),
              type: "String",
            });
            fields.push({
              name: "remember",
              label: req.__("Remember me"),
              type: "Bool",
            });

            field_view_options.password = ["password"];
            field_view_options.passwordRepeat = ["password"];
            field_view_options.remember = ["edit"];
          }
          const library = (await Library.find({})).filter((l) =>
            l.suitableFor("edit")
          );
          const myviewrow = View.findOne({ name: context.viewname });
          const { parent_field_list } = await table.get_parent_relations(
            true,
            true
          );
          const pages = await Page.find();
          const groups = (await PageGroup.find()).map((g) => ({
            name: g.name,
          }));

          return {
            tableName: table.name,
            fields: fields.map((f) => f.toBuilder || f),
            field_view_options,
            parent_field_list,
            handlesTextStyle,
            blockDisplay,
            roles,
            actions,
            triggerActions,
            builtInActions,
            //fieldViewConfigForms,
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
        onlyWhen: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const fields = table.getFields();
          const in_form_fields = context.columns.map((f) => f.field_name);
          return fields.some(
            (f) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
        },
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const fields = table.getFields();
          const in_form_fields = context.columns.map((f) => f.field_name);
          const omitted_fields = fields.filter(
            (f) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
          const formFields = [];
          const blockFields = [];
          omitted_fields.forEach((f) => {
            f.required = false;
            if (f.type?.name === "Bool") {
              f.fieldview = "tristate";
            }
            formFields.push(f);

            if (f.presets) {
              formFields.push(
                new Field({
                  name: "preset_" + f.name,
                  label: req.__("Preset %s", f.label),
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
        form: async (context) => {
          const own_views = await View.find_all_views_where(
            ({ state_fields, viewrow }) =>
              viewrow.table_id === context.table_id ||
              state_fields.every((sf) => !sf.required)
          );
          const table = Table.findOne({ id: context.table_id });
          own_views.forEach((v) => {
            if (!v.table && v.table_id === table.id) v.table = table;
            else if (!v.table && v.table_id) {
              const vtable = Table.findOne({ id: v.table_id });
              v.table = vtable;
            }
          });
          const parent_views = await get_parent_views(table, context.viewname);

          const done_view_opts = own_views.map((v) => v.select_option);
          parent_views.forEach(({ relation, related_table, views }) =>
            views.forEach((v) => {
              done_view_opts.push(`${v.name}.${relation.name}`);
            })
          );
          const pages = await Page.find();
          const groups = await PageGroup.find();
          return new Form({
            fields: [
              {
                name: "auto_save",
                label: req.__("Auto save"),
                sublabel: req.__("Save any changes immediately"),
                type: "Bool",
              },
              {
                name: "split_paste",
                label: req.__("Split paste"),
                sublabel: req.__("Separate paste content into separate inputs"),
                type: "Bool",
              },
              {
                name: "destination_type",
                label: "Destination type",
                type: "String",
                required: true,
                sublabel: req.__(
                  "This is the view to which the user will be sent when the form is submitted. The view you specify here can be ignored depending on the context of the form, for instance if it appears in a pop-up the redirect will not take place."
                ),
                //fieldview: "radio_group",
                attributes: {
                  options: [
                    "View",
                    "Page",
                    "PageGroup",
                    "Formula",
                    "URL formula",
                    "Back to referer",
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
                  options: pages.map((p) => p.name),
                },
                showIf: { destination_type: "Page" },
              },
              {
                name: "page_group_when_done",
                label: req.__("Destination page group"),
                type: "String",
                required: true,
                attributes: {
                  options: groups.map((p) => p.name),
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
 * @param {*} table_id
 * @param {*} viewname
 * @param {object} opts
 * @param {*} opts.columns
 * @returns {Promise<object[]>}
 */
const get_state_fields = async (table_id, viewname, { columns }) => [
  {
    name: "id",
    type: "Integer",
    primary_key: true,
  },
];

/**
 * @param {Form} form
 * @param {string} locale
 */
const setDateLocales = (form, locale) => {
  form.fields.forEach((f) => {
    if (f.type && f.type.name === "Date") {
      f.attributes.locale = locale;
    }
  });
};

/**
 * update viewSelect so that it looks like a normal ChildList
 */
const updateViewSelect = (viewSelect) => {
  if (viewSelect.path.length === 1) {
    viewSelect.field_name = viewSelect.path[0].inboundKey;
    viewSelect.table_name = viewSelect.path[0].table;
  } else if (viewSelect.path.length === 2) {
    viewSelect.field_name = viewSelect.path[1].inboundKey;
    viewSelect.table_name = viewSelect.path[1].table;
    viewSelect.throughTable = viewSelect.path[0].inboundKey;
    viewSelect.through = viewSelect.path[0].table;
  }
};

/** @type {function} */
const initial_config = initial_config_all_fields(true);

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {*} optsOne.columns
 * @param {*} optsOne.layout
 * @param {string} state
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<Form>}
 */
const run = async (
  table_id,
  viewname,
  cfg,
  state,
  { res, req },
  { editQuery }
) => {
  const mobileReferrer = isWeb(req) ? undefined : req?.headers?.referer;
  return await editQuery(state, mobileReferrer);
};

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {*} opts.columns
 * @param {*} opts.layout
 * @param {State} state
 * @param {object} extra
 * @returns {Promise<Form[]>}
 */
const runMany = async (
  table_id,
  viewname,
  { columns, layout, auto_save, split_paste },
  state,
  extra,
  { editManyQuery, getRowQuery, optionsQuery }
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
  return await asyncMap(rows, async (row) => {
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
    });
    return { html, row };
  });
};

/**
 * @param {object} opts
 * @param {Form} opts.form
 * @param {Table} opts.table
 * @param {object} opts.req
 * @param {object} opts.row
 * @param {object} opts.res
 * @throws {InvalidConfiguration}
 * @returns {Promise<void>}
 */
const transformForm = async ({
  form,
  table,
  req,
  row,
  res,
  getRowQuery,
  viewname,
  optionsQuery,
}) => {
  let pseudo_row = {};
  if (!row) {
    table.fields.forEach((f) => {
      pseudo_row[f.name] = undefined;
    });
  }
  await traverse(form.layout, {
    container(segment) {
      if (segment.click_action) {
        segment.url = `javascript:view_post(this, 'run_action', {click_action: '${segment.click_action}', ...get_form_record(this) })`;
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
        if (req.method === "POST") return;

        //run action
        try {
          const actionResult = await run_action_column({
            col: { ...segment },
            referrer: req?.get?.("Referrer"),
            req,
            res,
            table,
            row: row || pseudo_row,
          });

          if (actionResult)
            segment.contents = script(
              domReady(
                `common_done(${JSON.stringify(actionResult)}, "${viewname}")`
              )
            );
        } catch (e) {
          getState().log(
            5,
            `Error in Edit ${viewname} on page load action: ${e.message}`
          );
          e.message = `Error in evaluating Run on Page Load action in view ${viewname}: ${e.message}`;
          throw e;
        }
      }
      if (segment.action_name === "Delete") {
        if (form.values && form.values.id) {
          segment.action_url = `/delete/${table.name}/${form.values.id}`;
        } else {
          segment.type = "blank";
          segment.contents = "";
        }
      } else if (
        !["Sign up", ...builtInActions].includes(segment.action_name) &&
        !segment.action_name.startsWith("Login")
      ) {
        let url = action_url(
          viewname,
          table,
          segment.action_name,
          row,
          segment.rndid,
          "rndid",
          segment.confirm
        );
        if (url.javascript) {
          //redo to include dynamic row
          const confirmStr = segment.confirm
            ? `if(confirm('Are you sure?'))`
            : "";

          url.javascript = `${confirmStr}view_post(this, 'run_action', {rndid:'${segment.rndid}', ...get_form_record(this)});`;
        }
        segment.action_link = action_link(url, req, segment);
      }
    },
    join_field(segment) {
      const qs = objToQueryString(segment.configuration);
      segment.sourceURL = `/field/show-calculated/${table.name}/${segment.join_field}/${segment.fieldview}?${qs}`;
    },
    tabs(segment) {
      const to_delete = new Set();
      (segment.showif || []).forEach((sif, ix) => {
        if (sif) {
          const showit = eval_expression(
            sif,
            row || pseudo_row,
            req.user,
            "Tab show if formula"
          );
          if (!showit) to_delete.add(ix);
        }
      });

      segment.titles = segment.titles.filter((v, ix) => !to_delete.has(ix));
      segment.contents = segment.contents.filter((v, ix) => !to_delete.has(ix));

      (segment.titles || []).forEach((t, ix) => {
        if (typeof t === "string" && t.includes("{{")) {
          segment.titles[ix] = interpolate(t, row, req.user);
        }
      });
    },
    view_link(segment) {
      segment.type = "blank";
      const view_select = parse_view_select(segment.view);
      if (!row && view_select.type !== "Independent") {
        segment.contents = "";
      } else {
        const prefix =
          req.generate_email && req.get_base_url ? req.get_base_url() : "";
        const { key } = view_linker(
          segment,
          table.fields,
          (s) => s,
          isWeb(req),
          req.user,
          prefix,
          req.query,
          req,
          viewname
        );
        segment.contents = key(row || {});
      }
    },
    async view(segment) {
      //console.log(segment);
      const view_select = parse_view_select(segment.view, segment.relation);
      //console.log({ view_select });

      const view = View.findOne({ name: view_select.viewname });
      if (!view)
        throw new InvalidConfiguration(
          `Cannot find embedded view: ${view_select.viewname}`
        );
      // check if the relation path matches a ChildList relations
      let childListRelPath = false;
      if (segment.relation && view.table_id) {
        const targetTbl = Table.findOne({ id: view.table_id });
        const relation = new Relation(
          segment.relation,
          targetTbl.name,
          displayType(await view.get_state_fields())
        );
        childListRelPath = relation.type === RelationType.CHILD_LIST;
      }
      // Edit-in-edit
      if (
        view.viewtemplate === "Edit" &&
        (view_select.type === "ChildList" || childListRelPath)
      ) {
        if (childListRelPath) updateViewSelect(view_select);
        const childTable = Table.findOne({ id: view.table_id });
        const childForm = await getForm(
          childTable,
          view.name,
          view.configuration.columns,
          view.configuration.layout,
          row?.id,
          req,
          !isWeb(req)
        );
        traverseSync(childForm.layout, {
          field(segment) {
            segment.field_name = `${view_select.field_name}.${segment.field_name}`;
          },
        });
        for (const field of childForm.fields) {
          if (field.name === childTable.pk_name) {
            field.class = field.class
              ? `${field.class} omit-repeater-clone`
              : "omit-repeater-clone";
          }
        }
        await childForm.fill_fkey_options(false, optionsQuery, req.user);

        const fr = new FieldRepeat({
          name: view_select.field_name,
          label: view_select.field_name,
          fields: childForm.fields,
          layout: childForm.layout,
          metadata: {
            table_id: childTable.id,
            view: segment.view,
            relation: view_select.field_name,
            relation_path: segment.relation,
            order_field: segment.order_field,
          },
        });
        if (row?.id) {
          const childRows = getRowQuery
            ? await getRowQuery(
                view.table_id,
                view_select,
                row.id,
                segment.order_field
              )
            : await childTable.getRows(
                {
                  [view_select.field_name]: row.id,
                },
                segment.order_field ? { orderBy: segment.order_field } : {}
              );
          fr.metadata.rows = childRows;
          if (!fr.fields.map((f) => f.name).includes(childTable.pk_name))
            fr.fields.push({
              name: childTable.pk_name,
              input_type: "hidden",
            });
        }
        form.fields.push(fr);
        segment.type = "field_repeat";
        segment.field_repeat = fr;
        return;
      } // end edit in edit
      let state = {};
      if (view_select.type === "RelationPath" && view.table_id) {
        const targetTbl = Table.findOne({ id: view.table_id });
        if (targetTbl) {
          const relation = new Relation(
            segment.relation,
            targetTbl.name,
            displayType(await view.get_state_fields())
          );
          const type = relation.type;
          if (!row && type == RelationType.OWN) {
            segment.type = "blank";
            segment.contents = div({ "sc-load-on-assign-id": view.name });
            return;
          } else if (!row && type !== RelationType.INDEPENDENT) {
            segment.type = "blank";
            segment.contents = "";
            return;
          }
          state = pathToState(relation, (k) => row[k]);
        }
      } else {
        const isIndependent = view_select.type === "Independent";
        // legacy none check ?
        if (!row && !isIndependent) {
          segment.type = "blank";
          segment.contents = "";
          return;
        }
        if (!view)
          throw new InvalidConfiguration(
            `Edit view incorrectly configured: cannot find embedded view ${view_select.viewname}`
          );
        switch (view_select.type) {
          case "Own":
            state = { id: row.id };
            break;
          case "Independent":
            state = {};
            break;
          case "ChildList":
          case "OneToOneShow":
            state = { [view_select.field_name]: row.id };
            break;
          case "ParentShow":
            state = { id: row[view_select.field_name] };
            break;
        }
      }
      const extra_state = segment.extra_state_fml
        ? eval_expression(
            segment.extra_state_fml,
            {
              ...dollarizeObject(req.query),
              session_id: getSessionId(req),
              ...(row || pseudo_row),
            },
            req.user,
            `Extra state formula for embedding view ${view.name}`
          )
        : {};
      const qs = stateToQueryString({ ...state, ...extra_state }, true);
      segment.contents = div(
        {
          class: "d-inline",
          "data-sc-embed-viewname": view.name,
          "data-sc-view-source": `/view/${view.name}${qs}`,
        },
        await view.run(
          { ...state, ...extra_state },
          { req, res },
          view.isRemoteTable()
        )
      );
    },
  });
  translateLayout(form.layout, req.getLocale());

  if (req.xhr) form.xhrSubmit = true;
  setDateLocales(form, req.getLocale());
};

/**
 * @param {object} opts
 * @param {Table} opts.table
 * @param {Fields[]} opts.fields
 * @param {string} opts.viewname
 * @param {object[]} opts.columns
 * @param {Layout} opts.layout
 * @param {object} opts.row
 * @param {object} opts.req
 * @param {object} opts.state
 * @param {object} opts.res
 * @returns {Promise<Form>}
 */
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
}) => {
  const form = await getForm(
    table,
    viewname,
    columns,
    layout,
    state.id,
    req,
    isRemote
  );
  if (split_paste) form.splitPaste = true;

  if (row) {
    form.values = row;
    const file_fields = form.fields.filter((f) => f.type === "File");
    if (isWeb(req)) {
      for (const field of file_fields) {
        if (field.fieldviewObj?.valueIsFilename && row[field.name]) {
          const file = await File.findOne({ id: row[field.name] });
          if (file.id) form.values[field.name] = file.filename;
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
      //need to fetch with joinfields
      if (freeVars.size > 0) {
        const joinFields = {};
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
  Object.entries(state).forEach(([k, v]) => {
    const field = form.fields.find((f) => f.name === k);
    if (field && ((field.type && field.type.read) || field.is_fkey)) {
      form.values[k] = field.type.read ? field.type.read(v) : v;
    } else {
      const tbl_field = fields.find((f) => f.name === k);
      if (tbl_field && !field) {
        form.fields.push(new Field({ name: k, input_type: "hidden" }));
        form.values[k] = tbl_field.type.read ? tbl_field.type.read(v) : v;
      }
    }
  });

  // add row values not in columns as hidden if needed for join fields
  if (row) {
    const need_join_fields = new Set(
      columns
        .filter((c) => c.type === "JoinField")
        .map((c) => c.join_field.split(".")[0])
    );
    const colFields = new Set(
      columns.filter((c) => c.type === "Field").map((c) => c.field_name)
    );
    const formFields = new Set(form.fields.map((f) => f.name));
    fields.forEach((f) => {
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
  // !row && hasSave
  let hasSave = false;
  traverseSync(layout, {
    action({ action_name }) {
      if (action_name === "Save" || action_name === "SubmitWithAjax") {
        hasSave = true;
      }
    },
  });
  const actually_auto_save = auto_save && !(!row && hasSave);
  if (actually_auto_save)
    form.onChange = `saveAndContinue(this, ${
      !isWeb(req) ? `'${form.action}'` : undefined
    }, event)`;
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
  await form.fill_fkey_options(false, optionsQuery, req.user);
  await transformForm({
    form,
    table,
    req,
    row,
    res,
    getRowQuery,
    viewname,
    optionsQuery,
  });
  return (
    renderForm(form, !isRemote && req.csrfToken ? req.csrfToken() : false) +
    reloadAfterCloseInModalScript
  );
};

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {object[]} optsOne.columns
 * @param {Layout} optsOne.layout
 * @param {object} optsOne.fixed
 * @param {boolean} optsOne.view_when_done
 * @param {object[]} optsOne.formula_destinations
 * @param {object} state
 * @param {*} body
 * @param {object} optsTwo
 * @param {object} optsTwo.res
 * @param {object} optsTwo.req
 * @param {string} optsTwo.redirect
 * @returns {Promise<void>}
 */
const runPost = async (
  table_id,
  viewname,
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
  },
  state,
  body,
  { res, req, redirect },
  {
    tryInsertQuery,
    tryUpdateQuery,
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  },
  remote
) => {
  const table = Table.findOne({ id: table_id });
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
    },
    remote
  );
  const view = View.findOne({ name: viewname });
  const pagetitle = { title: viewname, no_menu: view?.attributes?.no_menu };
  if (prepResult) {
    let { form, row, pk, id } = prepResult;
    const cancel = body._cancel;
    const originalID = id;
    let trigger_return;
    let ins_upd_error;
    if (!cancel) {
      getState().log(
        6,
        `Edit POST ready to insert/update into ${
          table.name
        } Row=${JSON.stringify(row)} ID=${id} Ajax=${!!req.xhr}`
      );
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
        const upd_res = await tryUpdateQuery(row, id);
        if (upd_res.error) {
          ins_upd_error = upd_res.error;
        }
        trigger_return = upd_res.trigger_return;
      }
      if (ins_upd_error) {
        getState().log(
          6,
          `Insert or update failure ${JSON.stringify(ins_upd_error)}`
        );
        res.status(422);
        if (req.xhr) {
          res.json({ error: ins_upd_error });
        } else {
          req.flash("error", text_attr(ins_upd_error));
          res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
        }
        return;
      }
      //Edit-in-edit
      for (const field of form.fields.filter((f) => f.isRepeat)) {
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
          const targetTbl = Table.findOne({ id: childView.table_id });
          const relation = new Relation(
            field.metadata.relation_path,
            targetTbl.name,
            displayType(await childView.get_state_fields())
          );
          if (relation.type === RelationType.CHILD_LIST)
            updateViewSelect(view_select);
        }

        const childTable = Table.findOne({ id: field.metadata?.table_id });
        const submitted_row_ids = new Set(
          (form.values[field.name] || []).map(
            (srow) => `${srow[childTable.pk_name]}`
          )
        );
        const childFields = new Set(childTable.fields.map((f) => f.name));
        let repeatIx = 0;
        for (const [childRow, row_ix] of form.values[field.name].map(
          (r, ix) => [r, ix]
        )) {
          // set fixed here
          childRow[field.metadata?.relation] = id;
          for (const [k, v] of Object.entries(
            childView?.configuration?.fixed || {}
          )) {
            if (
              typeof childRow[k] === "undefined" &&
              !k.startsWith("_block_") &&
              childFields.has(k)
            )
              childRow[k] = v;
          }
          if (order_field && !childRow[order_field])
            childRow[order_field] = row_ix;
          for (const file_field of field.fields.filter(
            (f) => f.type === "File"
          )) {
            const key = `${file_field.name}_${repeatIx}`;
            if (req.files?.[key]) {
              const file = await File.from_req_files(
                req.files[key],
                req.user ? req.user.id : null,
                (file_field.attributes &&
                  +file_field.attributes.min_role_read) ||
                  1,
                file_field?.attributes?.folder
              );
              childRow[file_field.name] = file.path_to_serve;
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
              req.user || { role_id: 100 }
            );
            if (upd_res.error) {
              getState().log(
                6,
                `Update child row failure ${JSON.stringify(upd_res)}`
              );
              req.flash("error", text_attr(upd_res.error));
              res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
              return;
            }
          } else {
            const ins_res = await childTable.tryInsertRow(
              childRow,
              req.user || { role_id: 100 }
            );
            if (ins_res.error) {
              getState().log(
                6,
                `Insert child row failure ${JSON.stringify(ins_res)}`
              );
              req.flash("error", text_attr(ins_res.error));
              res.sendWrap(pagetitle, renderForm(form, req.csrfToken()));
              return;
            } else if (ins_res.success) {
              submitted_row_ids.add(`${ins_res.success}`);
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
            if (!submitted_row_ids.has(`${db_child_row[childTable.pk_name]}`)) {
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
    }
    trigger_return = trigger_return || {};
    if (trigger_return.notify && trigger_return.details)
      req.flash(
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
    else if (trigger_return.notify) req.flash("success", trigger_return.notify);
    if (trigger_return.error) req.flash("danger", trigger_return.error);
    if (trigger_return.goto) {
      res.redirect(trigger_return.goto);
      return;
    }

    /*if (req.xhr && !originalID && !req.smr) {
      res.json({ id, view_when_done, ...trigger_return });
      return;
    } else if (req.xhr && !req.smr) {
      res.json({ view_when_done, ...trigger_return });
      return;
    }*/
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
      row,
      !originalID ? { id, ...trigger_return } : trigger_return,
      true
    );
  }
};

const doAuthPost = async ({ body, table_id, req }) => {
  const table = Table.findOne({ id: table_id });
  const user_id = req.user ? req.user.id : null;
  if (table.ownership_field_id && user_id) {
    const field_name = await table.owner_fieldname();
    if (typeof body[field_name] === "undefined") {
      const fields = table.getFields();
      const { uniques } = splitUniques(fields, body);
      if (Object.keys(uniques).length > 0) {
        body = await table.getRow(uniques, {
          forUser: req.user,
          forPublic: !req.user,
        });
        return table.is_owner(req.user, body);
      }
    } else return field_name && `${body[field_name]}` === `${user_id}`;
  }
  if (table.ownership_formula && user_id) {
    let row = { ...body };
    if (body[table.pk_name]) {
      const joinFields = {};
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
      // need to check new row conforms to ownership fml
      const freeVars = freeVariables(table.ownership_formula);
      const fields = table.getFields();

      const field_names = new Set(fields.map((f) => f.name));

      // loop free vars, substitute in row
      for (const fv of freeVars) {
        const kpath = fv.split(".");
        if (field_names.has(kpath[0]) && kpath.length > 1) {
          const field = fields.find((f) => f.name === kpath[0]);
          if (!field)
            throw new Error("Invalid formula:" + table.ownership_formula);
          const reftable = Table.findOne({ name: field.reftable_name });
          const joinFields = {};
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
 * @param {object} opts
 * @param {object} opts.body
 * @param {string} opts.table_id
 * @param {object} opts.req
 * @returns {Promise<boolean>}
 */
const authorise_post = async (
  { body, table_id, req },
  { authorizePostQuery }
) => {
  return await authorizePostQuery(body, table_id);
};

const openDataStream = async (
  tableId,
  viewName,
  id,
  fieldName,
  fieldView,
  user,
  configuration,
  targetOpts
) => {
  const table = Table.findOne({ id: tableId });
  const field = table.getField(fieldName);
  if (!field) throw new InvalidConfiguration(`Field ${fieldName} not found`);
  if (field.type === "File") {
    const cfgCol = configuration.columns.find(
      (col) => col.fieldview === fieldView && col.field_name === fieldName
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

// TODO is owner check
const authorizeDataStream = async (view, id, fieldName, user, targetOpts) => {
  if (!user || user.role_id > view.min_role) return false;
  else {
    const table = Table.findOne({ id: view.table_id });
    if (!table || user.role_id > table.min_role_write) return false;
    else {
      const field = table.getField(fieldName);
      if (field.type === "File") {
        if (targetOpts?.oldTarget) {
          // continue old file ?
          const file = await File.findOne(targetOpts.oldTarget);
          if (file) return file.min_role_read >= user.role_id;
        } else if (id) {
          // continue file of existing row ?
          const row = await table.getRow({ [table.pk_name]: id });
          const fileCol = row[fieldName];
          if (fileCol) {
            const file = await File.findOne(row[fieldName]);
            if (file) return file.min_role_read >= user.role_id;
          }
        }
        // stream is new or the file does not exist
        return true;
      } else {
        // only files for now
        return false;
      }
    }
  }
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

const update_matching_rows = async (
  table_id,
  viewname,
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
  },
  body,
  { req, res, redirect },
  {
    updateMatchingQuery,
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  }
) => {
  const table = Table.findOne({ id: table_id });
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
    const repeatFields = form.fields.filter((f) => f.isRepeat);
    const childRows = {};
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
      req.flash(
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
      req.flash("success", success);
    }
    if (danger.length > 0) {
      req.flash("danger", danger);
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

/**
 * preparations for the form and the data row
 * @param {*} viewname
 * @param {*} table table of the view
 * @param {*} fields all fields in table
 * @param {*} param3 columns, layout, fixed, auto_save
 * @param {*} param4  req, res
 * @param {*} body request body
 * @param {*} param6 getRowQuery, saveFileQuery, saveFileFromContentsQuery, optionsQuery, getRowByIdQuery
 * @param {*} remote
 * @returns null on error, { form, row, pk, id } on success
 */
const prepare = async (
  viewname,
  table,
  fields,
  { columns, layout, fixed, auto_save },
  { req, res },
  body,
  {
    getRowQuery,
    saveFileQuery,
    saveFileFromContentsQuery,
    optionsQuery,
    getRowByIdQuery,
  },
  remote
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
    form.onChange = `saveAndContinue(this, ${
      !isWeb(req) ? `'${form.action}'` : undefined
    }, event)`;

  Object.entries(body).forEach(([k, v]) => {
    const form_field = form.fields.find((f) => f.name === k);
    const tbl_field = fields.find((f) => f.name === k);
    if (tbl_field && !form_field && !fixed?.[`_block_${k}`]) {
      form.fields.push(new Field({ name: k, input_type: "hidden" }));
    }
  });
  setDateLocales(form, req.getLocale());
  await transformForm({
    form,
    table,
    req,
    row: body[table.pk_name]
      ? { [table.pk_name]: body[table.pk_name] }
      : undefined,
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
  let row;
  const pk = fields.find((f) => f.primary_key);
  let id = pk.type.read(body[pk.name]);
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
  for (const field of form.fields.filter((f) => f.isRepeat)) {
    delete row[field.name];
  }

  const file_fields = form.fields.filter((f) => f.type === "File");
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
          row[field.name] = path_to_serve;
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
        row[field.name] = path_to_serve;
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
          req.user ? req.user.id : null,
          (field.attributes && +field.attributes.min_role_read) || 1,
          field?.attributes?.folder
        );
        row[field.name] = file.path_to_serve;
      } else {
        const file = req.files[field.name];
        if (file?.name) {
          const serverResp = await File.upload(req.files[field.name]);
          if (serverResp?.location) row[field.name] = serverResp.location;
        }
      }
    } else {
      delete row[field.name];
    }
  }
  return { form, row, pk, id };
};

/**
 * take care of final redirect
 * @param {*} viewname
 * @param {*} table_id id of the table of the view
 * @param {*} fields all fields in table
 * @param {*} pk private key field
 * @param {*} param4 view_when_done, formula_destinations, destination_type, dest_url_formula, page_when_done, page_group_when_done, redirect
 * @param {*} req
 * @param {*} res
 * @param {*} body reuqest body
 * @param {*} row row of the form
 * @returns
 */
const whenDone = async (
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
  row,
  trigger_return,
  check_ajax
) => {
  const res_redirect = (url) => {
    if (check_ajax && req.xhr && !req.smr)
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
  if (check_ajax && req.xhr && !req.smr && trigger_return?.error) {
    res.json({
      view_when_done,
      ...(trigger_return || {}),
    });
    return;
  }

  let use_view_when_done = view_when_done;
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
    req.flash(
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
      state_fields.some((sf) => sf.name === pk.name) &&
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

/**
 * @param {*} results results from updateMatchingQuery
 * @returns success, danger, goto
 */
const combineResults = (results) => {
  const combined = { success: [], danger: [] };
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
    if (trigger_return.goto && !combined.goto) combined.trigger_return.goto;
  }
  return combined;
};

const tryUpdateImpl = async (row, id, table, user) => {
  const result = {};
  const upd_res = await table.tryUpdateRow(
    row,
    id,
    user || { role_id: 100 },
    result
  );
  upd_res.trigger_return = result;
  return upd_res;
};

module.exports = {
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
  /** @type {boolean} */
  display_state_form: false,
  authorise_post,
  /**
   * @param {object} opts
   * @param {object} opts.query
   * @param {...*} opts.rest
   * @returns {Promise<boolean>}
   */
  authorise_get: async ({ query, table_id, req }, { authorizeGetQuery }) => {
    return await authorizeGetQuery(query, table_id);
  },
  /**
   * @param {object} opts
   * @param {Layout} opts.layout
   * @returns {string[]}
   */
  getStringsForI18n({ layout }) {
    return getStringsForI18n(layout);
  },
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
    },
    req,
    res,
  }) => ({
    async editQuery(state, mobileReferrer) {
      const table = Table.findOne({ id: table_id });
      const fields = table.getFields();
      const { uniques } = splitUniques(fields, state);
      let row = null;
      if (Object.keys(uniques).length > 0) {
        // add joinfields from certain locations if they are not fields in columns
        const joinFields = {};
        const picked = picked_fields_to_query([], fields, layout, req);
        const colFields = new Set(
          columns.map((c) =>
            c.join_field ? c.join_field.split(".")[0] : c.field_name
          )
        );

        Object.entries(picked.joinFields).forEach(([nm, jfv]) => {
          if (!colFields.has(jfv.ref)) joinFields[nm] = jfv;
        });
        row = await table.getJoinedRow({
          where: uniques,
          joinFields,
          forPublic: !req.user,
          forUser: req.user,
        });
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
        mobileReferrer,
      });
    },
    async editManyQuery(state, { limit, offset, orderBy, orderDesc, where }) {
      const table = Table.findOne({ id: table_id });
      const fields = table.getFields();
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        undefined,
        req
      );
      const qstate = await stateFieldsToWhere({ fields, state, table });
      const q = await stateFieldsToQuery({ state, fields });
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
    async tryInsertQuery(row) {
      const table = Table.findOne({ id: table_id });
      const result = {};
      const ins_res = await table.tryInsertRow(
        row,
        req.user || { role_id: 100 },
        result
      );
      ins_res.trigger_return = result;
      return ins_res;
    },

    async tryUpdateQuery(row, id) {
      const table = Table.findOne(table_id);
      return await tryUpdateImpl(row, id, table, req.user);
    },
    async saveFileQuery(fieldVal, fieldId, fieldView, row) {
      const field = await Field.findOne({ id: fieldId });
      const column = columns.find(
        (c) => c.type === "Field" && c.field_name === field.name
      );
      field.fieldviewObj = getState().fileviews[fieldView];
      const [pre, allData] = fieldVal.split(",");
      const buffer = require("buffer/").Buffer.from(allData, "base64");
      const mimetype = pre.split(";")[0].split(":")[1];
      const filename =
        field.fieldviewObj?.setsDataURL?.get_filename?.({
          ...row,
          ...field.attributes,
        }) || "file";
      const folder = field.fieldviewObj?.setsDataURL?.get_folder?.({
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
      return file.path_to_serve;
    },
    async saveFileFromContentsQuery(
      fieldVal,
      fieldId,
      fieldView,
      row,
      filename,
      encoding = "base64"
    ) {
      const field = await Field.findOne({ id: fieldId });
      const column = columns.find(
        (c) => c.type === "Field" && c.field_name === field.name
      );
      field.fieldviewObj = getState().fileviews[fieldView];
      let mimetype, allData;
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
          return existing_file.path_to_serve;
        } else throw new Error("Not authorized to write file");
      }

      const file = await File.from_contents(
        filename1,
        mimetype,
        buffer,
        req.user?.id,
        field.attributes.min_role_read || 1
      );
      return file.path_to_serve;
    },
    async authorizePostQuery(body, table_id /*overwrites*/) {
      return await doAuthPost({ body, table_id, req });
    },
    async authorizeGetQuery(query, table_id) {
      let body = query || {};
      const table = Table.findOne({ id: table_id });
      if (Object.keys(body).length == 1) {
        if (table.ownership_field_id || table.ownership_formula) {
          const fields = table.getFields();
          const { uniques } = splitUniques(fields, body);
          if (Object.keys(uniques).length > 0) {
            const joinFields = {};
            if (table.ownership_formula) {
              const freeVars = freeVariables(table.ownership_formula);
              add_free_variables_to_joinfields(freeVars, joinFields, fields);
            }
            const row = await table.getJoinedRows({
              where: uniques,
              joinFields,
            });
            if (row.length > 0) return table.is_owner(req.user, row[0]);
            else return true; // TODO ??
          } else {
            return true;
          }
        }
      } else {
        return table.ownership_field_id || table.ownership_formula;
      }
      return doAuthPost({ body, table_id, req });
    },
    async getRowQuery(table_id, view_select, row_id, order_field) {
      const childTable = Table.findOne({ id: table_id });
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
    async getRowByIdQuery(id) {
      const table = Table.findOne({ id: table_id });
      return await table.getRow(
        { id },
        {
          forUser: req.user,
          forPublic: !req.user,
        }
      );
    },
    async actionQuery() {
      const {
        rndid,
        _csrf,
        onchange_action,
        onchange_field,
        click_action,
        ...body
      } = req.body;

      const table = Table.findOne({ id: table_id });
      let row = body.id
        ? await table.getRow(
            { id: body.id },
            {
              forPublic: !req.user,
              forUser: req.user,
            }
          )
        : {};

      table.fields.forEach((f) => {
        if (!f?.validate) return;
        const valres = f.validate(body);
        if ("success" in valres) row[f.name] = valres.success;
      });
      if (fixed) {
        const use_fixed = await fill_presets(table, req, fixed);
        Object.keys(use_fixed).forEach((k) => {
          if (row[k] === null || typeof row[k] === "undefined")
            row[k] = use_fixed[k];
        });
      }

      try {
        if (click_action) {
          let container;
          traverseSync(layout, {
            container(segment) {
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
            (c) =>
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
            (c) => c.type === "Action" && c.rndid === rndid && rndid
          );
          const result = await run_action_column({
            col,
            req,
            table,
            row,
            res,
            referrer: req?.get?.("Referrer"),
          });
          //console.log("result", result);
          return { json: { success: "ok", ...(result || {}) } };
        }
      } catch (e) {
        console.error(e);
        return { json: { error: e.message || e } };
      }
    },
    async optionsQuery(reftable_name, type, attributes, where) {
      const rows = await db.select(
        reftable_name,
        type === "File" ? attributes.select_file_where : where
      );
      return rows;
    },
    async updateMatchingQuery(where, updateVals, repeatFields, childRows) {
      const table = Table.findOne(table_id);
      const rows = await table.getRows(where);
      const results = [];
      let inTransaction = false;
      try {
        if (rows.length === 0) return results;
        await db.begin();
        inTransaction = true;
        for (const row of rows) {
          const uptRes = await tryUpdateImpl(
            updateVals,
            row.id,
            table,
            req.user
          );
          if (uptRes.error) {
            inTransaction = false;
            await db.rollback();
            return { rowError: uptRes.error };
          }
          results.push(uptRes);
          for (const field of repeatFields) {
            const childTable = Table.findOne({ id: field.metadata?.table_id });
            await childTable.deleteRows({ [field.metadata?.relation]: row.id });
            for (const childRow of childRows[field.name]) {
              childRow[field.metadata?.relation] = row.id;
              const insRow = { ...childRow };
              delete insRow[childTable.pk_name];
              const insRes = await childTable.tryInsertRow(
                insRow,
                req.user || { role_id: 100 }
              );
              if (insRes.error) {
                inTransaction = false;
                await db.rollback();
                return { inEditError: insRes.error };
              }
            }
          }
        }
        if (inTransaction) await db.commit();
      } catch (error) {
        if (inTransaction) await db.rollback();
        return { error: error.message };
      }
      return results;
    },
  }),
  routes: { run_action, update_matching_rows },
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

      return interpolate(title, row);
    } else {
      return interpolate(title, null);
    }
  },
  configCheck: async (view) => {
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
    const errs = [];
    const warnings = [];

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
  connectedObjects: async (configuration) => {
    return extractFromLayout(configuration.layout);
  },
};
