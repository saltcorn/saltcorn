/**
 * @category saltcorn-data
 * @module plugin-testing
 */
const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");
const { getState } = require("./db/state");
const { renderForm } = require("@saltcorn/markup");
const { mockReqRes } = require("./tests/mocks");
import Field from "./models/field";
import Table from "./models/table";
import Trigger from "./models/trigger";
const { expressionValidator } = require("./models/expression");
const { parse_view_select } = require("./viewable_fields");
import View from "./models/view";

interface TypeAttributes {
  name: string;
  type?: any;
  required?: boolean;
}

interface PluginType {
  attributes?: TypeAttributes[];
  contract?: any;
  validate?: (attrs: any) => (x: any) => boolean;
  validate_attributes?: (attrs: any) => boolean;
  fieldviews?: Record<string, FieldView>;
  read?: (x: any) => any;
  readFromFormRecord?: (record: any, key: string) => any;
}

interface FieldView {
  isEdit?: boolean;
  run: (...args: any[]) => string;
}

interface Workflow {
  run: (ctx: any) => Promise<any>;
}

interface ViewTemplate {
  noAutoTest?: boolean;
  configuration_workflow: (opts: { __: (s: string) => string }) => Workflow;
  initial_config?: (opts: { table_id: number }) => Promise<any>;
  get_state_fields?: (
    table_id: number,
    viewname: string,
    cfg: any
  ) => Promise<any[]>;
  run: (
    table_id: number,
    viewname: string,
    cfg: any,
    state: any,
    extra: any
  ) => Promise<string | string[]>;
}

interface Plugin {
  layout?: {
    wrap: any;
  } | Function;
  types?: PluginType[];
  viewtemplates?: ViewTemplate[];
}

interface Column {
  type: string;
  field_name?: string;
  fieldview?: string;
  action_name?: string;
  action_label?: string;
  action_label_formula?: boolean;
  view?: string;
  view_label?: string;
  view_label_formula?: boolean;
  extra_state_fml?: string;
  join_field?: string;
  link_text?: string;
  link_text_formula?: boolean;
  link_url?: string;
  link_url_formula?: boolean;
  [key: string]: any;
}

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

const auto_test_wrap = (wrap: Function): void => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};

const generate_attributes = (
  typeattrs: TypeAttributes[] | undefined,
  validate?: (attrs: Record<string, any>) => boolean,
  table_id?: number
): Record<string, any> => {
  var res: Record<string, any> = {};
  const attrs = Field.getTypeAttributes(typeattrs, table_id);
  (attrs || []).forEach((a: any) => {
    if (a.type && (a.required || is.bool.generate())) {
      const contract = a.type.contract || getState().types[a.type].contract;
      const gen = contract({}).generate;
      if (gen) res[a.name] = gen();
    }
  });
  if (validate && !validate(res))
    return generate_attributes(attrs, validate, table_id);
  else return res;
};

const auto_test_type = (t: PluginType): void => {
  const fvs = t.fieldviews || {};

  //run edit field views without a value
  Object.values(fvs).forEach((fv) => {
    if (fv.isEdit) {
      const attr = generate_attributes(t.attributes, t.validate_attributes);
      is.str(fv.run("foo", undefined, attr, "myclass", true, { name: "foo" }));
      is.str(fv.run("foo", undefined, attr, "myclass", false, { name: "foo" }));
    }
  });
  //find examples, run all fieldview on each example

  const has_contract = t.contract && t.contract.generate;
  const numex = has_contract ? 20 : 200;
  for (let index = 0; index < numex; index++) {
    const x = has_contract
      ? t.contract.generate()
      : t.read?.(is.any.generate());

    const attribs = generate_attributes(t.attributes, t.validate_attributes);
    if (has_contract || (typeof x !== "undefined" && x !== null))
      if ((t.validate && t.validate(attribs)(x)) || !t.validate) {
        Object.values(fvs).forEach((fv) => {
          if (fv.isEdit) {
            is.str(fv.run("foo", x, attribs, "myclass", true, { name: "foo" }));
            is.str(
              fv.run("foo", x, attribs, "myclass", false, { name: "foo" })
            );
          } else {
            is.str(fv.run(x));
          }
        });
        if (t.readFromFormRecord) t.readFromFormRecord({ akey: x }, "akey");
      }
  }
  if (t.readFromFormRecord) {
    t.readFromFormRecord({}, "akey");
  }
  //todo: try creating a table with this type
};

const auto_test_workflow = async (
  wf: Workflow,
  initialCtx: Record<string, any>
): Promise<Record<string, any>> => {
  const step = async (wf: Workflow, ctx: Record<string, any>): Promise<Record<string, any>> => {
    is.obj(ctx);
    const res = await wf.run(ctx);

    if (res.renderForm) {
      is.str(renderForm(res.renderForm, ""));

      const vs = await res.renderForm.generate();
      return await step(wf, vs);
    } else return res;
  };
  return await step(wf, initialCtx);
};

const auto_test_viewtemplate = async (vt: ViewTemplate): Promise<void> => {
  if (vt.noAutoTest) return;
  const wf = vt.configuration_workflow({ __: (s) => s });
  is.class("Workflow")(wf);
  for (let index = 0; index < 10; index++) {
    var cfg;
    if (vt.initial_config && Math.random() > 0.5)
      cfg = await vt.initial_config({ table_id: 2 });
    else
      cfg = await auto_test_workflow(wf, {
        table_id: 2,
        viewname: "newview",
      });
    const sfs = vt.get_state_fields
      ? await vt.get_state_fields(1, "newview", cfg)
      : [];
    const res = await vt.run(2, "newview", cfg, {}, mockReqRes);
    is.or(is.str, is.array(is.str))(res);
    if (sfs.some((sf: any) => sf.name === "id")) {
      const resid = await vt.run(2, "newview", cfg, { id: 1 }, mockReqRes);
      is.or(is.str, is.array(is.str))(resid);
    }
  }
};

const auto_test_plugin = async (plugin: Plugin): Promise<void> => {
  is_plugin(plugin);
  getState().registerPlugin("test_plugin", plugin);
  if (plugin.layout) {
    auto_test_wrap((typeof plugin.layout === "function" ? plugin.layout() : plugin.layout).wrap);
  }
  if (plugin.types) {
    plugin.types.forEach(auto_test_type);
  }
  for (const vt of plugin.viewtemplates || []) await auto_test_viewtemplate(vt);

  //is each header reachable
};

const check_view_columns = async (
  view: View,
  columns: Column[]
): Promise<CheckResult> => {
  const errs: string[] = [];
  const warnings: string[] = [];
  const table = Table.findOne(
    view.table_id
      ? { id: view.table_id }
      : view.exttable_name
      ? { name: view.exttable_name }
      : { id: -1 }
  );
  let fields;
  if (table) fields = table.getFields();
  const check_formula = (s: string, loc: string): void => {
    const v = expressionValidator(s, loc);
    if (v === true) return;
    if (typeof v === "string")
      errs.push(`In view ${view.name}, ${loc} ${s}\n${v}`);
  };
  const trigger_actions = (
    await Trigger.find({
      when_trigger: { or: ["API call", "Never"] },
    })
  ).map((tr) => tr.name);
  for (const column of columns) {
    switch (column.type) {
      // in general, if formula checked, make sure it is present
      case "Field":
        //field exists
        if (
          table?.name === "users" &&
          ["remember", "passwordRepeat", "password"].includes(
            column.field_name!
          )
        )
          break;
        if (!fields) break;
        const f = fields.find((fld) => fld.name === column.field_name);
        if (!f) {
          warnings.push(
            `In view ${view.name}, field ${column.field_name} does not exist in table ${table?.name}`
          );
          break;
        }
        if (
          column.fieldview &&
          !(f.is_fkey || f.type === "File") &&
          f.type &&
          typeof f.type !== "string" &&
          f.type.fieldviews &&
          !f.type.fieldviews[column.fieldview]
        )
          warnings.push(
            `In view ${view.name}, field ${column.field_name} of type ${
              typeof f.type === "string" ? f.type : f.type?.name
            } table ${table?.name} does not have fieldview ${column.fieldview}`
          );

        break;
      case "Action":
        if (column.action_label_formula)
          check_formula(
            column.action_label!,
            `Label for action ${column.action_name}`
          );
        if (
          column.action_name!.startsWith("Toggle ") ||
          column.action_name!.startsWith("Login with ") ||
          [
            "GoBack",
            "Delete",
            "Save",
            "Reset",
            "SaveAndContinue",
            "Login",
            "Sign up",
            "Cancel",
          ].includes(column.action_name!)
        )
          break;
        if (
          column.action_name !== "Multi-step action" &&
          !(
            column.action_name == "UpdateMatchingRows" &&
            view.viewtemplate == "Edit"
          ) &&
          !getState().actions[column.action_name!] &&
          !trigger_actions.includes(column.action_name!)
        )
          errs.push(
            `In view ${view.name}, action ${column.action_name} does not exist`
          );
        break;
      case "ViewLink":
        {
          if (column.view_label_formula)
            check_formula(column.view_label!, `Label for view link`);
          if (column.extra_state_fml)
            check_formula(
              column.extra_state_fml,
              `View link extra state formula`
            );
          const { viewname } = parse_view_select(column.view);
          const linkedview = View.findOne({ name: viewname });
          if (!linkedview)
            errs.push(
              `In view ${view.name}, linked view ${viewname} does not exist`
            );
        }
        break;
      case "JoinField":
        if (table && column.join_field) {
          const jf = table.getField(column.join_field);
          if (!jf)
            errs.push(
              `In view ${view.name}, join field ${column.join_field} does not exist`
            );
        }
        break;
      case "Link":
        if (column.link_text_formula)
          check_formula(column.link_text!, `Link text`);
        if (column.link_url_formula)
          check_formula(column.link_url!, `Link URL`);
        break;
      case "Aggregation":
        break;
      default:
        break;
    }
  }
  return { errors: errs, warnings };
};

export { auto_test_plugin, generate_attributes, check_view_columns };
