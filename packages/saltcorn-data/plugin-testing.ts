/**
 * @category saltcorn-data
 * @module plugin-testing
 */
const { is } = require("contractis");

const { getState } = require("./db/state");
const { renderForm } = require("@saltcorn/markup");
const { mockReqRes } = require("./tests/mocks");
import Field from "./models/field";
import Table from "./models/table";
import Trigger from "./models/trigger";
import Workflow from "./models/workflow";
const { expressionValidator } = require("./models/expression");
const { parse_view_select } = require("./viewable_fields");
import View from "./models/view";
import {
  Plugin,
  PluginType,
  Column,
  ViewTemplate,
  instanceOfFieldViewEdit,
  instanceOfFieldViewShow,
} from "@saltcorn/types/base_types";
import { RunResult } from "@saltcorn/types/model-abstracts/abstract_workflow";

function rnd_bool(): boolean {
  return Math.random() < 0.5;
}

const generate_attributes = (
  typeattrs: any,
  validate?: (attrs: Record<string, any>) => boolean,
  table_id?: number
): Record<string, any> => {
  var res: Record<string, any> = {};
  const attrs = Field.getTypeAttributes(typeattrs, table_id);
  (attrs || []).forEach((a: any) => {
    if (a.type && (a.required || rnd_bool())) {
      const contract = a.type.contract || getState().types[a.type].contract;
      const gen = contract({}).generate;
      if (gen) res[a.name] = gen();
    }
  });
  if (validate && !validate(res))
    return generate_attributes(attrs, validate, table_id);
  else return res;
};

const check_view_columns = async (
  view: View,
  columns: Column[]
): Promise<any> => {
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

export { generate_attributes, check_view_columns };
