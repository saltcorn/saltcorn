/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/list
 * @subcategory base-plugin
 */
import Field from "../../models/field";
import Table from "../../models/table";
import Form from "../../models/form";
import View from "../../models/view";
import Workflow from "../../models/workflow";
import Crash from "../../models/crash";
import Trigger from "../../models/trigger";
import Page from "../../models/page";
import User from "../../models/user";
import { GenObj } from "@saltcorn/types/common_types";
import File from "../../models/file";
import { Layout, Column, Req, Res } from "@saltcorn/types/base_types";
const FieldRepeat = require("../../models/fieldrepeat");
const PageGroup = require("../../models/page_group");
const Library = require("../../models/library");

const { Relation, RelationType } = require("@saltcorn/common-code");

const { mkTable, h, post_btn, link } = require("@saltcorn/markup");
const { text, script, button, div, a, code } = require("@saltcorn/markup/tags");
const {
  eachView,
  traverse,
  getStringsForI18n,
  translateLayout,
} = require("../../models/layout");
const pluralize = require("pluralize");
const {
  removeEmptyStrings,
  removeDefaultColor,
  applyAsync,
  mergeIntoWhere,
  mergeConnectedObjects,
  hashState,
  dollarizeObject,
  getSessionId,
} = require("../../utils");
import {
  field_picker_fields,
  picked_fields_to_query,
  stateFieldsToWhere,
  initial_config_all_fields,
  stateToQueryString,
  stateFieldsToQuery,
  link_view,
  getActionConfigFields,
  calcfldViewOptions,
  calcrelViewOptions,
  readState,
  run_action_column,
  add_free_variables_to_joinfields,
  pathToState,
  displayType,
} from "../../plugin-helper";
import { PrimaryKeyValue } from "@saltcorn/db-common/dbtypes";
const {
  get_viewable_fields,
  parse_view_select,
  get_viewable_fields_from_layout,
  action_url,
} = require("../../viewable_fields");
const { getState } = require("../../db/state");
const {
  get_async_expression_function,
  jsexprToWhere,
  freeVariables,
  get_expression_function,
  eval_expression,
} = require("../../models/expression");
const db = require("../../db");
const { get_existing_views } = require("../../models/discovery");
const { InvalidConfiguration, isWeb } = require("../../utils");
const { check_view_columns } = require("../../plugin-testing");
const {
  extractFromColumns,
  extractViewToCreate,
} = require("../../diagram/node_extract_utils");
const { validID } = require("@saltcorn/markup/layout_utils");

const create_db_view = async (context: GenObj, req: Req) => {
  const table = Table.findOne({ id: context.table_id })!;
  const fields = table.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(
    context.columns,
    fields,
    undefined,
    req,
    table
  );

  const { sql } = await table.getJoinedQuery({
    where: {},
    joinFields,
    aggregations,
  });
  const schema = db.getTenantSchemaPrefix();
  // is there already a table with this name ? if yes add _sqlview
  const extable = Table.findOne({ name: context.viewname });
  const sql_view_name = `${schema}"${db.sqlsanitize(context.viewname)}${
    extable ? "_sqlview" : ""
  }"`;
  await db.query(`drop view if exists ${sql_view_name};`);
  await db.query(`create or replace view ${sql_view_name} as ${sql};`);
};

const on_delete = async (
  table_id: number | string,
  viewname: string,
  { default_state }: GenObj
) => {
  if (!db.isSQLite) {
    const sqlviews = (await get_existing_views()).map(
      (v: GenObj) => v.table_name
    );
    const vnm = db.sqlsanitize(viewname);
    const schema = db.getTenantSchemaPrefix();
    if (sqlviews.includes(vnm))
      await db.query(`drop view if exists ${schema}"${vnm}";`);
    if (sqlviews.includes(vnm + "_sqlview"))
      await db.query(`drop view if exists ${schema}"${vnm + "_sqlview"}";`);
  }
};

const configuration_workflow = (req: Req) =>
  new Workflow({
    onDone: async (ctx: GenObj) => {
      if (ctx.default_state._create_db_view) {
        await create_db_view(ctx, req);
      }

      return ctx;
    },
    steps: [
      {
        name: req.__("Columns"),
        builder: async (context: GenObj) => {
          const table = Table.findOne(
            context.table_id || context.exttable_name
          )!;
          const fields = table.getFields();

          const boolfields = fields.filter(
            (f: GenObj) => f.type && f.type.name === "Bool"
          );
          const stateActions = (
            Object.entries(getState().actions) as [string, GenObj][]
          ).filter(([k, v]) => !v.disableInBuilder && !v.disableIf?.());
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
            builtInLabel: "List Actions",
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
          const actionConfigForms: GenObj = {};
          for (const [name, action] of stateActions) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table,
                { mode: "list", req }
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
            "list"
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
            "list"
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
            agg_fieldview_options[t.name] = (
              Object.entries(t.fieldviews) as [string, GenObj][]
            )
              .filter(([k, v]) => !v.isEdit && !v.isFilter)
              .map(([k, v]) => k);
          });
          const pages = await Page.find();
          const groups = (await PageGroup.find()).map((g: GenObj) => ({
            name: g.name,
          }));
          const images = await File.find({ mime_super: "image" });
          const library = (await Library.find({})).filter((l: GenObj) =>
            l.suitableFor("list")
          );
          const myviewrow = View.findOne({ name: context.viewname });
          // generate layout for legacy views
          if (!context.layout?.list_columns) {
            const newCols: GenObj[] = [];
            const actionDropdown: GenObj[] = [];
            const typeMap: GenObj = {
              Field: "field",
              JoinField: "join_field",
              ViewLink: "view_link",
              Link: "link",
              Action: "action",
              Text: "blank",
              DropdownMenu: "dropdown_menu",
              Aggregation: "aggregation",
            };
            (context.columns || []).forEach((col: GenObj) => {
              const newCol: GenObj = {
                alignment: col.alignment || "Default",
                col_width: col.col_width || "",
                showif: col.showif || "",
                header_label: col.header_label || "",
                col_width_units: col.col_width_units || "px",
                contents: {
                  ...col,
                  configuration: { ...col },
                  type: typeMap[col.type],
                },
              };
              delete newCol.contents._columndef;
              delete newCol.contents.configuration._columndef;
              delete newCol.contents.configuration.type;

              switch (col.type) {
                case "Action":
                  newCol.contents.isFormula = {
                    action_label: !!col.action_label_formula,
                  };
                  break;
                case "ViewLink":
                  newCol.contents.isFormula = {
                    label: !!col.view_label_formula,
                  };
                  break;
                case "Link":
                  newCol.contents.isFormula = {
                    url: !!col.link_url_formula,
                    text: !!col.link_text_formula,
                  };
                  newCol.contents.text = col.link_text;
                  newCol.contents.url = col.link_url;
                  break;
              }
              if (col.in_dropdown)
                actionDropdown.push({ ...col, type: typeMap[col.type] });
              else newCols.push(newCol);
            });
            if (actionDropdown.length) {
              newCols.push({
                contents: {
                  type: "dropdown_menu",
                  label: "Action",
                  action_size: "btn-xs",
                  action_style: "btn-outline-secondary",
                  contents: { above: actionDropdown },
                },
              });
            }

            context.layout = {
              besides: newCols,
              list_columns: true,
            };
          }
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
            allowMultipleElementsPerColumn: true,
            page_groups: groups,
            allowMultiStepAction: true,
            handlesTextStyle,
            mode: "list",
            ownership:
              !!table.ownership_field_id ||
              !!table.ownership_formula ||
              table.name === "users",
          };
        },
      },
      {
        name: req.__("Create new row"),
        onlyWhen: async (context: GenObj) => {
          const create_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ state_fields, viewrow }: GenObj) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf: GenObj) => !sf.required)
          );
          return create_views.length > 0;
        },
        form: async (context: GenObj) => {
          const table = Table.findOne(
            context.table_id
              ? { id: context.table_id }
              : { name: context.exttable_name }
          )!;
          const create_views = await View.find_table_views_where(
            context.table_id || context.exttable_name,
            ({ state_fields, viewrow }: GenObj) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf: GenObj) => !sf.required)
          );
          const create_view_opts = create_views.map(
            (v: GenObj) => v.select_option
          );
          return new Form({
            blurb: req.__("Specify how to create a new row"),
            fields: [
              {
                name: "view_to_create",
                label: req.__("Use view to create"),
                sublabel:
                  req.__(
                    "If user has write permission. Leave blank to have no link to create a new item"
                  ) +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${view_to_create}\``,
                      "data-show-if":
                        "showIfFormulaInputs($('select[name=view_to_create]'), 'view_to_create')",
                      target: "_blank",
                    },
                    req.__("Configure")
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
                showIf: {
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
              },
              {
                name: "create_view_showif",
                label: req.__("Show if formula"),
                input_type: "code",
                attributes: {
                  mode: "application/javascript",
                  singleline: true,
                  table: table.name,
                  user: true,
                  expression_type: "boolean",
                },
                sublabel: req.__(
                  "Show link or embed if true, don't show if false. Based on state variables from URL query string and <code>user</code>. For the full state use <code>row</code>. Example: <code>!!row.createlink</code> to show link if and only if state has <code>createlink</code>."
                ),
                showIf: {
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
              },
              {
                name: "create_view_label",
                label: req.__("Label for create"),
                sublabel: req.__(
                  "Label in link or button to create. Leave blank for a default label"
                ),
                attributes: { asideNext: true },
                type: "String",
                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
              },
              {
                name: "create_view_location",
                label: req.__("Location"),
                sublabel: req.__("Location of link to create new row"),
                required: true,
                attributes: {
                  options: [
                    "Bottom left",
                    "Bottom right",
                    "Top left",
                    "Top right",
                  ],
                },
                type: "String",
                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
              },
              {
                name: "create_view_location",
                label: req.__("Location"),
                sublabel: req.__("Location of view to create new row"),
                required: true,
                attributes: {
                  options: ["Bottom", "Top"],
                },
                type: "String",
                showIf: {
                  create_view_display: ["Embedded"],
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
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

                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
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
                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o: GenObj) => o.name),
                },
              },
            ],
          });
        },
      },
      {
        name: req.__("Default state"),
        contextField: "default_state",
        form: async (context: GenObj) => {
          const table = Table.findOne(
            context.table_id || context.exttable_name
          )!;
          const table_fields = table
            .getFields()
            .filter((f: GenObj) => !f.calculated || f.stored);
          const formfields = table_fields.map((f: GenObj) => {
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
          form.fields.forEach((ff: GenObj) => {
            if (ff.reftable_name === "users" && ff.options) {
              // key to user
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
        form: async (context: GenObj) => {
          const table = Table.findOne(
            context.table_id || context.exttable_name
          )!;
          const triggerActions = Trigger.trigger_actions({
            tableTriggers: table.id,
            apiNeverTriggers: true,
          });

          if (
            context.default_state?._row_click_url_formula &&
            !context.default_state?._row_click_type
          ) {
            //legacy
            context.default_state._row_click_type = "Link";
          }

          const table_fields = table
            .getFields()
            .filter((f: GenObj) => !f.calculated || f.stored);
          const formfields: GenObj[] = [];
          const { child_field_list, child_relations } =
            await table.get_child_relations();
          const joinFields = context.columns?.filter(
            (jf: GenObj) => jf.type === "JoinField"
          );
          const tree_options = table_fields
            .filter((f) => f.reftable_name === table.name)
            .map((f: GenObj) => f.name);
          formfields.push({
            name: "_order_field",
            label: req.__("Default order by"),
            type: "String",
            default: table.pk_name,
            attributes: {
              asideNext: true,
              options: [
                ...table_fields.map((f: GenObj) => f.name),
                ...(joinFields
                  ? joinFields.map((jf: GenObj) => jf.join_field)
                  : []),
              ],
            },
          });
          formfields.push({
            name: "_descending",
            label: req.__("Descending?"),
            type: "Bool",
            required: true,
          });
          formfields.push({
            name: "_group_by",
            label: req.__("Group by"),
            input_type: "code",
            attributes: {
              mode: "application/javascript",
              singleline: true,
              table: table.name,
              user: true,
              expression_type: "value",
            },
            sublabel: "Formula for the group headings",
            class: "validate-expression",
          });
          if (!db.isSQLite)
            formfields.push({
              name: "_tree_field",
              label: req.__("Tree field"),
              sublabel: req.__("A field that is Key to own table"),
              type: "String",
              attributes: {
                options: tree_options,
              },
            });
          formfields.push({
            name: "include_fml",
            label: req.__("Row inclusion formula"),
            class: "validate-expression",
            sublabel:
              req.__("Only include rows where this formula is true. ") +
              req.__("In scope:") +
              " " +
              [
                ...table.fields.map((f: GenObj) => f.name),
                "user",
                "year",
                "month",
                "day",
                "today()",
              ]
                .map((s: string) => code(s))
                .join(", "),
            input_type: "code",
            attributes: {
              mode: "application/javascript",
              singleline: true,
              table: table.name,
              user: true,
              expression_type: "boolean",
            },
            help: {
              topic: "Inclusion Formula",
              context: { table_name: table.name },
            },
          });
          formfields.push({
            name: "exclusion_relation",
            label: req.__("Exclusion relations"),
            sublabel: req.__("Do not include row if this relation has a match"),
            type: "String",
            required: false,
            attributes: { options: child_field_list },
          });
          formfields.push({
            name: "exclusion_where",
            label: req.__("Exclusion where"),
            class: "validate-expression",
            type: "String",
            showIf: { exclusion_relation: child_field_list },
          });
          formfields.push({
            name: "_rows_per_page",
            label: req.__("Rows per page"),
            type: "Integer",
            default: 20,
            attributes: { min: 0 },
          });

          formfields.push({
            name: "_hide_pagination",
            label: req.__("Hide pagination"),
            type: "Bool",
          });
          formfields.push({
            name: "_full_page_count",
            label: req.__("Full page count"),
            type: "Bool",
            sublabel: req.__(
              "Disable for to increase performance for large tables"
            ),
            default: true,
          });
          formfields.push({
            name: "_row_click_type",
            label: req.__("Row click event"),
            sublabel: req.__("What happens when a row is clicked"),
            type: "String",
            required: true,
            attributes: {
              options: [
                "Nothing",
                "Link",
                "Link new tab",
                "Popup",
                "Anchor link",
                "Action",
              ],
            },
          });
          formfields.push({
            name: "_row_click_action",
            label: req.__("Row click action"),
            sublabel: req.__("Run this action when row is clicked"),
            type: "String",
            required: true,
            attributes: { options: triggerActions },
            showIf: { _row_click_type: "Action" },
          });

          formfields.push({
            name: "_row_click_url_formula",
            label: req.__("Row click URL"),
            sublabel:
              req.__("Formula. Navigate to this URL when row is clicked") +
              ". " +
              req.__("Example: <code>`/view/TheOtherView?id=${id}`</code>"),
            type: "String",
            class: "validate-expression",
            showIf: {
              _row_click_type: ["Link", "Link new tab", "Popup", "Anchor link"],
            },
          });
          formfields.push({
            name: "_header_filters",
            label: req.__("Header filters"),
            type: "Bool",
          });
          formfields.push({
            name: "_header_filters_toggle",
            label: req.__("Toggle header filters"),
            type: "Bool",
            showIf: { _header_filters: true, _header_filters_dropdown: false },
          });
          formfields.push({
            name: "_header_filters_dropdown",
            label: req.__("Dropdown header filters"),
            type: "Bool",
            showIf: { _header_filters: true, _header_filters_toggle: false },
          });
          formfields.push({
            name: "transpose",
            label: req.__("Transpose"),
            sublabel: req.__("Display one column per line"),
            type: "Bool",
            tab: "Layout options",
          });
          formfields.push({
            name: "transpose_width",
            label: req.__("Vertical column width"),
            type: "Integer",
            showIf: { transpose: true },
            tab: "Layout options",
          });
          formfields.push({
            name: "transpose_width_units",
            label: req.__("Vertical width units"),
            type: "String",
            fieldview: "radio_group",
            attributes: {
              inline: true,
              options: ["px", "%", "vw", "em", "rem", "cm"],
            },
            tab: "Layout options",
            showIf: { transpose: true },
          });
          formfields.push({
            name: "_omit_header",
            label: req.__("Omit header"),
            sublabel: req.__("Do not display the header"),
            type: "Bool",
            tab: "Layout options",
          });
          formfields.push({
            name: "hide_null_columns",
            label: req.__("Hide null columns"),
            sublabel: req.__(
              "Do not display a column if it contains entirely missing values"
            ),
            type: "Bool",
            tab: "Layout options",
          });
          formfields.push({
            name: "_hover_rows",
            label: req.__("Hoverable rows"),
            type: "Bool",
            sublabel: req.__("Highlight row under cursor"),
            tab: "Layout options",
          });
          formfields.push({
            name: "_striped_rows",
            label: req.__("Striped rows"),
            type: "Bool",
            sublabel: req.__("Add zebra stripes to rows"),
            tab: "Layout options",
          });
          formfields.push({
            name: "_card_rows",
            label: req.__("Card rows"),
            type: "Bool",
            sublabel: req.__("Each row in a card. Not supported by all themes"),
            tab: "Layout options",
          });
          formfields.push({
            name: "_borderless",
            label: req.__("Remove border"),
            type: "Bool",
            sublabel: req.__("No lines between tables"),
            tab: "Layout options",
          });
          formfields.push({
            name: "_cell_valign",
            label: req.__("Vertical alignment"),
            type: "String",
            required: true,
            attributes: {
              options: "Middle,Top,Bottom",
            },
            tab: "Layout options",
          });
          formfields.push({
            name: "_responsive_collapse",
            label: req.__("Responsve collapse"),
            type: "Bool",
            sublabel: req.__("Horizontal display on smaller screens"),
            tab: "Layout options",
          });
          formfields.push({
            name: "_collapse_breakpoint_px",
            label: req.__("Collapse breakpoint (px)"),
            type: "Integer",
            tab: "Layout options",
            default: 760,
            showIf: { _responsive_collapse: true },
          });
          formfields.push({
            name: "_table_layout",
            label: req.__("Table layout"),
            input_type: "select",
            options: ["Auto", "Fixed"],
            tab: "Layout options",
          });
          formfields.push({
            name: "_sticky_header",
            label: req.__("Sticky headers"),
            type: "Bool",
            tab: "Layout options",
          });
          formfields.push({
            name: "_row_color_formula",
            label: req.__("Row color formula"),
            sublabel: req.__(
              "Formula for row background color. Ex.: <code>age>65 ?'#aaffaa': null</code>"
            ),
            type: "String",
            tab: "Functionality",
            class: "validate-expression",
          });

          if (!db.isSQLite && !table.external)
            formfields.push({
              name: "_create_db_view",
              label: req.__("Create database view"),
              sublabel: req.__(
                "Create an SQL view in the database with the fields in this list"
              ),
              help: {
                topic: "Create SQL view",
              },
              type: "Bool",
              tab: "Database options",
            });

          const form = new Form({
            fields: formfields as any,
            tabs: { tabsStyle: "Accordion" },
          });
          await form.fill_fkey_options(true);
          return form;
        },
      },
    ],
  });

const get_state_fields = async (
  table_id: number | string,
  viewname: string,
  { columns }: GenObj
) => {
  const table = Table.findOne(table_id);
  if (!table) return [];
  const table_fields = table.fields;
  let state_fields: GenObj[] = [];
  state_fields.push({ name: "_fts", label: "Anywhere", input_type: "text" });
  (columns || []).forEach((column: GenObj) => {
    if (column.type === "Field") {
      const tbl_fld = table_fields.find(
        (f: GenObj) => f.name == column.field_name
      );
      if (tbl_fld && !tbl_fld.primary_key) {
        const f = new Field(tbl_fld);
        f.required = false;
        if (column.header_label) f.label = column.header_label;
        state_fields.push(f);
      }
    }
  });
  return state_fields;
};

const set_join_fieldviews = async ({ table, columns, fields }: GenObj) => {
  //legacy
  for (const segment of columns) {
    const { join_field, join_fieldview } = segment;
    if (!join_fieldview) continue;

    const field = table.getField(join_field);
    if (field && field.type === "File") segment.field_type = "File";
    else if (field?.type.name && field?.type?.fieldviews[join_fieldview])
      segment.field_type = field.type.name;
  }
};

const initial_config = async ({ table_id, exttable_name }: GenObj) => {
  const table = Table.findOne(
    table_id ? { id: table_id } : { name: exttable_name }
  )!;

  const fields = table
    .getFields()
    .filter((f: GenObj) => !f.primary_key || f?.attributes?.NonSerial);
  const columns: GenObj[] = [];
  const layoutCols: GenObj[] = [];
  fields.forEach((f: GenObj) => {
    if (!f.type) return;
    if (f.type === "File") {
      const col = {
        type: "field",
        fieldview: "Link",
        field_name: f.name,
      };
      columns.push({ ...col, type: "Field" });
      layoutCols.push({ contents: col, header_label: f.label });
    } else if (f.is_fkey) {
      const col = {
        type: "join_field",
        fieldview: "as_text",
        join_field: `${f.name}.${f.attributes?.summary_field || "id"}`,
      };
      columns.push({ ...col, type: "JoinField" });
      layoutCols.push({ contents: col, header_label: f.label });
    } else {
      const fieldview = f.type?.fieldviews?.show
        ? "show"
        : f.type?.fieldviews?.as_text
          ? "as_text"
          : undefined;
      const col = {
        type: "field",
        fieldview,
        field_name: f.name,
      };
      columns.push({ ...col, type: "Field" });
      layoutCols.push({ contents: col, header_label: f.label });
    }
  });

  return { columns, layout: { list_columns: true, besides: layoutCols } };
};

const run = async (
  table_id: number | string,
  viewname: string,
  {
    columns,
    layout,
    view_to_create,
    create_view_display,
    create_view_label,
    default_state,
    create_view_location,
    create_link_style,
    create_link_size,
    create_view_showif,
  }: GenObj,
  stateWithId: GenObj,
  extraOpts: { req: Req; res: Res; [key: string]: any },
  { listQuery }: GenObj
) => {
  const table = Table.findOne(
    typeof table_id === "string" ? { name: table_id } : { id: table_id }
  )!;
  const pk_name = table.pk_name;
  const fields = table.getFields();
  const appState = getState();
  const locale = extraOpts.req.getLocale();
  const __ = (s: string) =>
    isWeb(extraOpts.req) ? appState.i18n.__({ phrase: s, locale }) || s : s;
  //move fieldview cfg into configuration subfield in each column
  for (const col of columns) {
    if (col.type === "Field") {
      const field = fields.find((f: GenObj) => f.name === col.field_name);
      if (!field) continue;
      const fieldviews =
        field.type === "Key"
          ? appState.keyFieldviews
          : (field.type as any)?.fieldviews || {};
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
      : 100;
  await set_join_fieldviews({ table, columns, fields });

  readState(stateWithId, fields, extraOpts.req);
  const id = stateWithId[pk_name];
  let state = { ...stateWithId };
  if (extraOpts?.removeIdFromstate) delete state[pk_name];

  const statehash = hashState(state, viewname);

  const { rows, rowCount } = await listQuery(state, statehash);

  const viewResults: GenObj = {};
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
  await eachView(layout, async (segment: GenObj) => {
    const view = await getView(segment.view, segment.relation);
    if (!view)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${segment.view}`
      );
    view.check_viewtemplate();
    let stateMany: GenObj | undefined,
      getRowState: ((row: GenObj) => GenObj) | undefined;
    const get_extra_state = (row: GenObj) =>
      segment.extra_state_fml
        ? eval_expression(
            segment.extra_state_fml,
            {
              ...dollarizeObject(state),
              session_id: getSessionId(extraOpts.req),
              ...row,
            },
            extraOpts.req.user,
            `Extra state formula for view ${view.name}`
          )
        : {};
    if (view.view_select.type === "RelationPath") {
      const relation = new Relation(
        segment.relation,
        view.table_id ? Table.findOne({ id: view.table_id })!.name : undefined,
        displayType(await view.get_state_fields())
      );
      switch (relation.type) {
        case RelationType.OWN:
          if (segment.extra_state_fml)
            stateMany = {
              or: rows.map((row: GenObj) => ({
                [pk_name]: row[pk_name],
                ...get_extra_state(row),
              })),
            };
          else
            stateMany = {
              [pk_name]: { in: rows.map((row: GenObj) => row[pk_name]) },
            };
          getRowState = (row: GenObj) => ({
            [pk_name]: row[pk_name],
            ...get_extra_state(row),
          });
          break;
        case RelationType.CHILD_LIST:
          stateMany = {
            or: rows.map((row: GenObj) => ({
              [relation.path[0].inboundKey]: row[table.pk_name],
              ...get_extra_state(row),
            })),
          };
          getRowState = (row: GenObj) => ({
            [relation.path[0].inboundKey]: row[table.pk_name],
            ...get_extra_state(row),
          });
          break;
        case RelationType.PARENT_SHOW:
          const refTable = Table.findOne({ id: view.table_id })!;
          stateMany = {
            or: rows.map((row: GenObj) => ({
              [refTable.pk_name]: row[relation.targetTblName],
              ...get_extra_state(row),
            })),
          };
          getRowState = (row: GenObj) => ({
            [refTable.pk_name]: row[relation.targetTblName],
            ...get_extra_state(row),
          });
          break;
        case RelationType.INDEPENDENT:
        case RelationType.NONE:
          stateMany = segment.extra_state_fml
            ? {
                or: rows.map((row: GenObj) => get_extra_state(row)),
              }
            : {};
          getRowState = (row: GenObj) => get_extra_state(row);

          break;
        default:
          throw new Error(
            `View in List: invalid relation type ${relation.type}`
          );
      }
    }

    //todo:
    // other rel types
    if (view.viewtemplateObj?.runMany) {
      const runs = await view.runMany(stateMany, extraOpts);
      viewResults[segment.view + segment.relation] = (row: GenObj) =>
        runs.find((rh: GenObj) => rh.row[pk_name] == row[pk_name])?.html;
    } else if (view.viewtemplateObj?.renderRows) {
      const rendered = await view.viewtemplateObj.renderRows(
        view.table,
        view.name,
        view.configuration,
        extraOpts,
        rows,
        state
      );

      viewResults[segment.view + segment.relation] = (row: GenObj) =>
        rendered
          .map((html: string, ix: number) => ({
            html,
            row: rows[ix],
          }))
          .find((rh: GenObj) => rh.row[pk_name] == row[pk_name])?.html;
    } else {
      const results: GenObj[] = [];

      for (const row of rows) {
        const rowState = getRowState!(row);
        const qs = stateToQueryString(rowState, true);

        const rendered = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-local-state": `/view/${view.name}${qs}`,
          },
          await view.run(rowState, extraOpts)
        );
        results.push({
          html: rendered,
          row,
        });
      }
      viewResults[segment.view + segment.relation] = (row: GenObj) =>
        results.find((rh) => rh.row[pk_name] == row[pk_name])?.html;
    }
  });
  const is_row_click =
    (default_state?._row_click_url_formula ||
      default_state?._row_click_action) &&
    default_state?._row_click_type !== "Nothing";
  const tfields = layout?.list_columns
    ? get_viewable_fields_from_layout(
        viewname,
        statehash,
        table,
        fields,
        columns,
        false,
        extraOpts.req,
        __,
        state,
        viewname,
        layout.besides,
        viewResults,
        is_row_click,
        !!default_state?._tree_field
      )
    : get_viewable_fields(
        viewname,
        statehash,
        table,
        fields,
        columns,
        false,
        extraOpts.req,
        __,
        state,
        viewname,
        is_row_click,
        !!default_state?._tree_field
      );
  const rows_per_page = (default_state && default_state._rows_per_page) || 20;
  const current_page = parseInt(state[`_${statehash}_page`]) || 1;
  var page_opts: GenObj =
    extraOpts && extraOpts.onRowSelect
      ? { onRowSelect: extraOpts.onRowSelect, selectedId: id }
      : { selectedId: id };
  page_opts.pk_name = table.pk_name;
  if (
    default_state?._row_click_url_formula &&
    default_state?._row_click_type !== "Nothing" &&
    default_state?._row_click_type !== "Action"
  ) {
    let fUrl = get_expression_function(
      default_state._row_click_url_formula,
      fields
    );
    if (default_state?._row_click_type === "Link new tab")
      page_opts.onRowSelect = (row: GenObj) =>
        `window.open('${fUrl(row, extraOpts.req.user)}', '_blank').focus();`;
    else if (default_state?._row_click_type === "Popup")
      page_opts.onRowSelect = (row: GenObj) =>
        `ajax_modal('${fUrl(row, extraOpts.req.user)}')`;
    else if (default_state?._row_click_type === "Anchor link") {
      page_opts.onRowSelect = (row: GenObj) => fUrl(row, extraOpts.req.user);
      page_opts.rowAnchorLink = true;
    } else
      page_opts.onRowSelect = (row: GenObj) =>
        `location.href='${fUrl(row, extraOpts.req.user)}'`;
  } else if (default_state?._row_click_type === "Action") {
    page_opts.onRowSelect = (row: GenObj) => {
      const actionUrl = action_url(
        viewname,
        table,
        default_state?._row_click_action,
        row,
        default_state?._row_click_action,
        "action_name"
      );
      if (actionUrl.javascript) return actionUrl.javascript;
    };
  }
  page_opts.class = "";

  if (
    (!default_state?._hide_pagination &&
      rows &&
      rows.length === rows_per_page) ||
    current_page > 1
  ) {
    const nrows = rowCount;
    if (nrows > rows_per_page || current_page > 1) {
      page_opts.pagination = {
        current_page,
        pages: Math.ceil(nrows / rows_per_page),
        noMaxPage: default_state?._full_page_count === false,
        get_page_link: (n: number) =>
          `gopage(${n}, ${rows_per_page}, '${statehash}', {}, this)`,
      };
    }
  }

  if (default_state?._omit_header) {
    page_opts.noHeader = true;
  }
  if (default_state?._hover_rows) {
    page_opts.class += "table-hover ";
  }
  if (default_state?._striped_rows) {
    page_opts.class += "table-striped ";
  }
  if (default_state?._card_rows) {
    page_opts.class += "table-card-rows ";
  }
  if (default_state?._borderless) {
    page_opts.class += "table-borderless ";
  }
  if (default_state?._table_layout) {
    page_opts.table_layout = default_state?._table_layout;
  }

  if (default_state?._sticky_header) {
    page_opts.sticky_header = default_state?._sticky_header;
  }

  if (default_state?._tree_field) {
    page_opts.level_indicator = true;
  }

  if (default_state?._responsive_collapse) {
    page_opts.responsiveCollapse = true;
    page_opts.collapse_breakpoint_px = default_state._collapse_breakpoint_px;
    page_opts.tableId = `${validID(viewname)}_${statehash}`;
  }

  page_opts.class += `table-valign-${(default_state?._cell_valign || "Middle").toLowerCase()} `;

  page_opts.transpose = (default_state || {}).transpose;
  page_opts.header_filters = (default_state || {})._header_filters;
  page_opts.header_filters_toggle = (
    default_state || {}
  )._header_filters_toggle;
  page_opts.header_filters_dropdown = (
    default_state || {}
  )._header_filters_dropdown;
  if (page_opts.header_filters_toggle || page_opts.header_filters_dropdown) {
    page_opts.header_filters_open = new Set(
      Object.keys(state).filter(
        (k) =>
          !k.startsWith("_") ||
          k.startsWith("_from") ||
          k.startsWith("_to") ||
          k.startsWith("_lt") ||
          k.startsWith("_gt")
      )
    );
  }

  page_opts.transpose_width = (default_state || {}).transpose_width;
  page_opts.transpose_width_units = (default_state || {}).transpose_width_units;
  page_opts.row_color_formula = (default_state || {})._row_color_formula;

  const [vpos, hpos] = (create_view_location || "Bottom left").split(" ");
  const istop = vpos === "Top";
  const isright = hpos === "right";

  var create_link = "";
  const user_id =
    extraOpts && extraOpts.req.user ? extraOpts.req.user.id : null;
  const create_link_showif_pass = create_view_showif
    ? eval_expression(
        create_view_showif,
        state,
        extraOpts.req.user,
        "Create view show if formula"
      )
    : undefined;
  if (
    create_link_showif_pass !== false &&
    view_to_create &&
    (create_link_showif_pass ||
      role <= table.min_role_write ||
      table.ownership_field_id)
  ) {
    const create_view = View.findOne({ name: view_to_create });
    const ownership_field: any =
      table.ownership_field_id &&
      table.fields.find((f: GenObj) => f.id === table.ownership_field_id);
    const about_user = fields.some(
      (f: GenObj) =>
        f.reftable_name === "users" &&
        state[f.name] &&
        state[f.name] === user_id
    );

    if (
      create_link_showif_pass ||
      role <= table.min_role_write ||
      (role < 100 &&
        ((ownership_field?.reftable_name === "users" && about_user) ||
          create_view?.configuration?.fixed?.[
            `preset_${ownership_field?.name}`
          ] === "LoggedIn"))
    ) {
      if (create_view_display === "Embedded") {
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
          create_view_display === "Popup" ? { reload_view: viewname } : false,
          create_link_style,
          create_link_size
        );
      }
    }
  }

  const create_link_div = isright
    ? div({ class: "float-end" }, create_link)
    : create_link;

  let tableHtml;

  if (default_state?._group_by) {
    const groups: GenObj = {};
    for (const row of rows) {
      const group = eval_expression(
        default_state?._group_by,
        row,
        extraOpts.req.user,
        "Group by expression"
      );
      if (!groups[group]) groups[group] = [];
      groups[group].push(row);
    }
    page_opts.grouped = true;
    tableHtml = mkTable(
      default_state?.hide_null_columns
        ? remove_null_cols(tfields, rows)
        : tfields,
      groups,
      page_opts
    );
  } else {
    tableHtml = mkTable(
      default_state?.hide_null_columns
        ? remove_null_cols(tfields, rows)
        : tfields,
      rows,
      page_opts
    );
  }

  return istop ? create_link_div + tableHtml : tableHtml + create_link_div;
};

const remove_null_cols = (tfields: GenObj[], rows: GenObj[]) =>
  tfields.filter((tfield) => {
    const key = tfield.row_key || tfield.key;
    if (!(typeof key === "string" || Array.isArray(key))) return true; //unable to tell if should be removed
    const is_not_null_simple = (row: GenObj) =>
      row[key as string] !== null && typeof row[key as string] !== "undefined";
    const is_not_null_array = (row: GenObj) =>
      row[(key as any[])[0]] !== null &&
      typeof row[(key as any[])[0]] !== "undefined" &&
      typeof row[(key as any[])[0]][(key as any[])[1]] !== "undefined";
    if (Array.isArray(key)) return rows.some(is_not_null_array);
    else return rows.some(is_not_null_simple);
  });

const run_action = async (
  table_id: number | string,
  viewname: string,
  { columns, layout, default_state }: GenObj,
  body: GenObj,
  { req, res }: { req: Req; res: Res },
  { getRowQuery }: GenObj
) => {
  return await db.withTransaction(
    async () => {
      const col = columns.find(
        (c: GenObj, index: number) =>
          c.type === "Action" &&
          (c.rndid == body.rndid ||
            (c.action_name === body.action_name &&
              body.action_name &&
              (body.column_index ? body.column_index === index : true)))
      );
      const table = Table.findOne({ id: table_id })!;
      const row = await getRowQuery(body[table.pk_name]);
      if (!col && body.action_name === default_state?._row_click_action) {
        const trigger = Trigger.findOne({ name: body.action_name })!;
        const result = await trigger.runWithoutRow({
          row,
          table,
          Table,
          referrer: req?.get?.("Referrer"),
          user: req.user,
          req,
        });
        return { json: { success: "ok", ...(result || {}) } };
      }
      const state_action = getState().actions[col.action_name];
      col.configuration = col.configuration || {};
      if (state_action) {
        const cfgFields = await getActionConfigFields(state_action, table, {
          mode: "list",
          req,
        });
        cfgFields.forEach(({ name }: GenObj) => {
          if (typeof col.configuration[name] === "undefined")
            col.configuration[name] = col[name];
        });
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
      Crash.create(e, req);
      return { json: { error: e.message || e } };
    }
  );
};

const createBasicView = async ({
  table,
  viewname,
  template_view,
  template_table,
  all_views_created,
}: GenObj) => {
  const configuration = await initial_config_all_fields(false)({
    table_id: table.id,
  });
  delete configuration.layout;
  let template_table_views: GenObj = {};
  if (template_view) {
    (
      await View.find({
        table_id: template_table.id,
      })
    ).forEach((v: GenObj) => {
      template_table_views[v.name] = v.viewtemplate;
    });

    template_view.configuration.columns.forEach((c: GenObj) => {
      if (c.type === "Field") {
        const field = template_table.getField(c.field_name);
        c.field_type = field.type.name || field.type;
      }
    });
    configuration.columns.forEach((mycol: GenObj) => {
      if (mycol.type === "Field") {
        const field_name = mycol.field_name;
        const field = table.getField(field_name);
        const field_type = field.type.name || field.type;
        const matched = template_view.configuration.columns.find(
          (c: GenObj) => c.field_type === field_type
        );
        if (matched) {
          if (matched.configuration)
            Object.assign(mycol, matched.configuration);
          Object.assign(mycol, matched);
          mycol.field_name = field_name;
        }
      }
    });
  }

  const comppk = table.composite_pk_names;

  //show link
  if (all_views_created.Show) {
    if (template_view) {
      //find link to show view
      const col = template_view.configuration.columns.find(
        (c: GenObj) =>
          c.type === "ViewLink" &&
          template_table_views[c.view?.split?.(":")[1]] === "Show"
      );
      if (col) {
        configuration.columns.push({
          ...col,
          view: `Own:${all_views_created.Show}`,
          view_name: all_views_created.Show,
          relation: undefined,
          view_label: col.view_label || col.label,
        });
      }
    } else if (comppk)
      configuration.columns.push({
        link_url:
          "`/view/" +
          all_views_created.Show +
          "?" +
          comppk.map((pkNm: string) => pkNm + "=${" + pkNm + "}").join("&") +
          "`", //"Street=${Street}&Number=${Number}"
        link_text: "Show",
        type: "Link",
        block: false,
        link_src: "URL",
        nofollow: false,
        link_url_formula: true,
        header_label: "Show",
      });
    else
      configuration.columns.push({
        type: "ViewLink",
        view: `Own:${all_views_created.Show}`,
        view_name: all_views_created.Show,
        link_style: "",
        view_label: "Show",
        header_label: "Show",
      });
  }

  //edit link
  if (all_views_created.Edit) {
    configuration.view_to_create = all_views_created.Edit;
    if (template_view) {
      //find link to show view
      const col = template_view.configuration.columns.find(
        (c: GenObj) =>
          c.type === "ViewLink" &&
          template_table_views[c.view?.split?.(":")[1]] === "Edit"
      );
      if (col) {
        configuration.columns.push({
          ...col,
          view: `Own:${all_views_created.Edit}`,
          view_name: all_views_created.Edit,
          relation: undefined,
          view_label: col.view_label || col.label,
        });
      }
    } else if (comppk)
      configuration.columns.push({
        link_url:
          "`/view/" +
          all_views_created.Edit +
          "?" +
          comppk.map((pkNm: string) => pkNm + "=${" + pkNm + "}").join("&") +
          "`", //"Street=${Street}&Number=${Number}"
        link_text: "Edit",
        type: "Link",
        block: false,
        link_src: "URL",
        nofollow: false,
        link_url_formula: true,
        header_label: "Edit",
      });
    else
      configuration.columns.push({
        type: "ViewLink",
        view: `Own:${all_views_created.Edit}`,
        view_name: all_views_created.Edit,
        link_style: "",
        view_label: "Edit",
        header_label: "Edit",
      });
  }
  if (template_view) {
    const matched = template_view.configuration.columns.filter(
      (c: GenObj) => c.type === "Action"
    );
    if (matched.length) configuration.columns.push(...matched);
  } else
    configuration.columns.push({
      type: "Action",
      action_name: "Delete",
      action_style: "btn-primary",
    });

  const copy_cfg = (keys: string | string[], parent_field?: string) => {
    if (parent_field && !configuration[parent_field])
      configuration[parent_field] = {};
    for (const key of Array.isArray(keys)
      ? keys
      : keys.split(" ").filter(Boolean)) {
      if (parent_field)
        configuration[parent_field][key] =
          template_view.configuration[parent_field][key];
      else configuration[key] = template_view.configuration[key];
    }
  };

  // create new row options

  if (template_view && all_views_created.Edit) {
    copy_cfg(
      "create_view_display create_view_location create_link_style create_link_size"
    );
  }
  // list layout settings
  if (template_view && template_view.configuration.default_state) {
    copy_cfg(
      "_rows_per_page _full_page_count _hide_pagination transpose transpose_width transpose_width_units _omit_header hide_null_columns _hover_rows _striped_rows _card_rows _borderless _cell_valign _header_filters _header_filters_toggle _header_filters_dropdown _responsive_collapse _sticky_header _collapse_breakpoint_px _row_color_formula _table_layout",
      "default_state"
    );
  }
  //console.log("new cols", configuration.columns);
  return configuration;
};

export = {
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
  default_state_form: ({ default_state }: GenObj) => {
    if (!default_state) return default_state;
    const {
      _omit_state_form,
      _create_db_view,
      _order_field,
      _descending,
      include_fml,
      exclusion_relation,
      exclusion_where,
      _rows_per_page,
      _full_page_count,
      _group_by,
      _tree_field,
      _hide_pagination,
      _row_click_url_formula,
      _row_click_url_type,
      _row_click_type,
      _row_click_url_action,
      transpose,
      transpose_width,
      transpose_width_units,
      _omit_header,
      hide_null_columns,
      _hover_rows,
      _striped_rows,
      _card_rows,
      _borderless,
      _cell_valign,
      _table_layout,
      _responsive_collapse,
      _collapse_breakpoint_px,
      _header_filters,
      _header_filters_toggle,
      _header_filters_dropdown,
      _row_color_formula,
      _sticky_header,
      ...ds
    } = default_state;
    return ds && removeDefaultColor(removeEmptyStrings(ds));
  },
  getStringsForI18n({ columns, layout, create_view_label }: GenObj) {
    const strings: string[] = [];
    const maybeAdd = (s: string) => {
      if (s) strings.push(s);
    };

    for (const column of columns) {
      maybeAdd(column.header_label);
      maybeAdd(column.link_text);
      maybeAdd(column.view_label);
      maybeAdd(column.label);
      maybeAdd(column.action_label);
    }
    for (const lseg of layout?.besides || []) {
      maybeAdd(lseg.header_label);
    }
    maybeAdd(create_view_label);
    return strings;
  },
  createBasicView,
  queries: ({
    table_id,
    exttable_name,
    name, // viewname
    configuration: { columns, layout, default_state },
    req,
  }: GenObj) => ({
    async listQuery(state: GenObj, stateHash: string) {
      const table = Table.findOne(
        typeof exttable_name === "string"
          ? { name: exttable_name }
          : { id: table_id }
      )!;
      const pk_name = table.pk_name;
      const fields = table.getFields();
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields,
        layout,
        req,
        table
      );
      const where = stateFieldsToWhere({
        fields,
        state,
        table,
        prefix: "a.",
      });
      const whereForCount = stateFieldsToWhere({
        fields,
        state,
        table,
      });
      const q = stateFieldsToQuery({
        state,
        fields,
        prefix: "a.",
        stateHash,
      });
      const rows_per_page =
        (default_state && default_state._rows_per_page) || 20;
      if (!q.limit) q.limit = rows_per_page;
      const sort_from_state = !!q.orderBy;
      if (!q.orderBy && default_state?._order_field)
        q.orderBy = default_state?._order_field;
      if (!q.orderDesc && !sort_from_state)
        q.orderDesc = default_state && default_state._descending;

      if (default_state?._group_by)
        add_free_variables_to_joinfields(
          freeVariables(default_state._group_by || ""),
          joinFields,
          fields
        );
      const role = req && req.user ? req.user.role_id : 100;

      if (default_state?.include_fml) {
        const ctx = { ...state, user_id: req.user?.id || null, user: req.user };
        let where1 = jsexprToWhere(default_state.include_fml, ctx, fields);
        mergeIntoWhere(where, where1 || {});
        mergeIntoWhere(whereForCount, where1 || {});
      }
      if (default_state?.exclusion_relation) {
        const [reltable, relfld] = default_state.exclusion_relation.split(".");
        const relTable = Table.findOne({ name: reltable })!;
        const relWhere = default_state.exclusion_where
          ? jsexprToWhere(
              default_state.exclusion_where,
              {
                user_id: req?.user?.id,
                user: req?.user,
              },
              relTable.fields
            )
          : {};
        const relRows = await relTable.getRows(relWhere);
        if (relRows.length > 0) {
          const mergeObj = !db.isSQLite
            ? {
                [table.pk_name]: {
                  not: { in: relRows.map((r: GenObj) => r[relfld]) },
                },
              }
            : {
                not: { or: relRows.map((r: GenObj) => ({ id: r[relfld] })) },
              };
          mergeIntoWhere(where, mergeObj);
          mergeIntoWhere(whereForCount, mergeObj);
        }
      }

      let rows: GenObj[];
      if (default_state?._tree_field) {
        const tree_rows = await table.getRows(where, {
          ...q,
          forPublic: !req.user || req.user.role_id === 100,
          forUser: req.user,
          tree_field: default_state?._tree_field,
          pk_name,
        });
        //console.log("tree rows", tree_rows);

        const joined_rows = await table.getJoinedRows({
          where: {
            [pk_name]: { in: tree_rows.map((r) => r[pk_name]) },
          },
          joinFields,
          aggregations,
          ...q,
          forPublic: !req.user || req.user.role_id === 100,
          forUser: req.user,
        });

        const joined_map: Record<PrimaryKeyValue, GenObj> = {};
        joined_rows.forEach((r) => (joined_map[r[pk_name]] = r));
        rows = tree_rows.map((r) => {
          const r2 = joined_map[r[pk_name]];
          r2._level = r._level;
          return r2;
        });
      } else
        rows = await table.getJoinedRows({
          where,
          joinFields,
          aggregations,
          ...q,
          forPublic: !req.user || req.user.role_id === 100,
          forUser: req.user,
        });
      //console.log("rows", rows);

      const rowCount = default_state?._hide_pagination
        ? undefined
        : q.limit && rows.length < q.limit
          ? rows.length
          : await table.countRows(whereForCount, {
              forPublic: !req.user,
              forUser: req.user,
              ...(default_state?._full_page_count === false
                ? { limit: (q.offset || 0) + 4 * (q.limit || 100) + 1 }
                : {}),
            });
      return { rows, rowCount };
    },
    async getRowQuery(id: any) {
      const table = Table.findOne({ id: table_id })!;
      if (table.ownership_formula) {
        const freeVars = freeVariables(table.ownership_formula);
        const joinFields: GenObj = {};
        add_free_variables_to_joinfields(freeVars, joinFields, table.fields);
        return await table.getJoinedRow({
          where: { [table.pk_name]: id },
          joinFields,
          forUser: req.user || { role_id: 100 },
          forPublic: !req.user,
        });
      } else
        return await table.getRow(
          { [table.pk_name]: id },
          { forUser: req.user, forPublic: !req.user }
        );
    },
  }),
  configCheck: async (view: GenObj) => {
    return await check_view_columns(view, view.configuration.columns);
  },
  connectedObjects: async (configuration: GenObj) => {
    const fromColumns = extractFromColumns(configuration.columns);
    const toCreate = extractViewToCreate(configuration);
    return toCreate
      ? mergeConnectedObjects(fromColumns, toCreate)
      : fromColumns;
  },
};
