/**
 * Workflow step Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_step
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { WorkflowStepCfg } from "@saltcorn/types/model-abstracts/abstract_workflow_step";
import User from "./user";
import Trigger from "./trigger";
import Table from "./table";
import Expression from "./expression";
import FieldRepeat from "./fieldrepeat";
const {
 jsIdentifierValidator
} = require("../utils");

const { eval_expression } = Expression;

const { getState } = require("../db/state");
/**
 * WorkflowStep Class
 * @category saltcorn-data
 */
class WorkflowStep {
  id?: number;
  name: string;
  trigger_id: number;
  next_step?: string;
  only_if?: string;
  action_name: string;
  initial_step: boolean;
  configuration: any;

  /**
   * WorkflowStep constructor
   * @param {object} o
   */
  constructor(o: WorkflowStepCfg | WorkflowStep) {
    this.id = o.id;
    this.name = o.name;
    this.trigger_id = o.trigger_id;
    this.next_step = o.next_step;
    this.only_if = o.only_if;
    this.action_name = o.action_name;
    this.initial_step = !!o.initial_step;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration;
  }

  /**
   * @param {object} lib_in
   */
  static async create(step_in: WorkflowStepCfg): Promise<void> {
    const step = new WorkflowStep(step_in);
    if (step.initial_step) {
      await db.updateWhere(
        "_sc_workflow_steps",
        { initial_step: false },
        {
          trigger_id: step.trigger_id,
        }
      );
    }
    return await db.insert("_sc_workflow_steps", step.toJson);
  }

  /**
   * @type {...*}
   */
  get toJson(): any {
    const { id, ...rest } = this;
    return rest;
  }

  /**
   * @param {*} where
   * @param {*} selectopts
   * @returns {WorkflowStep[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<WorkflowStep[]> {
    const us = await db.select("_sc_workflow_steps", where, selectopts);
    return us.map((u: any) => new WorkflowStep(u));
  }

  /**
   * @param {*} where
   * @returns {WorkflowStep}
   */
  static async findOne(where: Where): Promise<WorkflowStep> {
    const u = await db.selectMaybeOne("_sc_workflow_steps", where);
    return u ? new WorkflowStep(u) : u;
  }

  /**
   * @param {*} what
   * @returns {object}
   */
  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_workflow_steps WHERE id = $1`, [
      this.id,
    ]);
  }

  static async deleteForTrigger(trigger_id: number): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `delete FROM ${schema}_sc_workflow_steps WHERE trigger_id = $1`,
      [trigger_id]
    );
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    if (row.initial_step) {
      await db.updateWhere(
        "_sc_workflow_steps",
        { initial_step: false },
        {
          trigger_id: this.trigger_id,
          not: { id: this.id },
        }
      );
    }
    await db.update("_sc_workflow_steps", row, this.id);
  }

  async run(context: any, user: User) {
    if (this.only_if) {
      const proceed = eval_expression(
        this.only_if,
        context,
        user,
        `Only if expression in ${this.name} step`
      );
      if (!proceed) return;
    }

    if (this.action_name === "TableQuery") {
      const table = Table.findOne({ name: this.configuration.query_table });
      if (!table)
        throw new Error(`Table ${this.configuration.query_table} not found`);
      const query = eval_expression(
        this.configuration.query_object,
        context,
        user,
        `Query expression in ${this.name} step`
      );
      const rows = await table.getRows(query);
      return { [this.configuration.query_variable]: rows };
    }
    if (this.action_name === "SetContext") {
      return eval_expression(
        this.configuration.ctx_values,
        context,
        user,
        `Context values expression in ${this.name} step`
      );
    }
    let state_action = getState().actions[this.action_name];
    if (state_action) {
      return await state_action.run({
        configuration: this.configuration,
        user,
        row: context,
        mode: "workflow",
      });
    } else {
      const trigger = await Trigger.findOne({ name: this.action_name });
      state_action = getState().actions[trigger.action];
      return await state_action.run({
        configuration: trigger.configuration,
        user,
        row: context,
        mode: "workflow",
      });
    }
  }
  static builtInActionExplainers() {
    const actionExplainers: any = {};
    actionExplainers.SetContext = "Set variables in the context";
    actionExplainers.TableQuery =
      "Query a table into a variable in the context";
    actionExplainers.Output =
      "Display a message to the user. Pause workflow until the message is read.";
    actionExplainers.DataOutput =
      "Display a value to the user. Arrays of objects will be displayed as tables. Pause workflow until the message is read.";
    actionExplainers.WaitUntil = "Pause until a time in the future";
    actionExplainers.WaitNextTick =
      "Pause until the next scheduler invocation (at most 5 minutes)";
    actionExplainers.UserForm =
      "Ask a user one or more questions, pause until they are answered";
    return actionExplainers;
  }

  static async builtInActionConfigFields() {
    const actionConfigFields = [];
    actionConfigFields.push({
      label: "Form header",
      sublabel: "Text shown to the user at the top of the form",
      name: "form_header",
      type: "String",
      showIf: { wf_action_name: "UserForm" },
    });
    actionConfigFields.push({
      label: "User ID",
      name: "user_id_expression",
      type: "String",
      sublabel: "Optional. If blank assigned to user starting the workflow",
      showIf: { wf_action_name: "UserForm" },
    });
    actionConfigFields.push({
      label: "Resume at",
      name: "resume_at",
      sublabel:
        "JavaScript expression for the time to resume. <code>moment</code> is in scope.",
      type: "String",
      showIf: { wf_action_name: "WaitUntil" },
    });
    actionConfigFields.push({
      label: "Context values",
      name: "ctx_values",
      sublabel:
        "JavaScript object expression for the variables to set. Example <code>{x: 5, y:y+1}</code> will set x to 5 and increment existing context variable y",
      type: "String",
      fieldview: "textarea",
      class: "validate-expression",
      default: "{}",
      showIf: { wf_action_name: "SetContext" },
    });
    actionConfigFields.push({
      label: "Output text",
      name: "output_text",
      sublabel:
        "Message shown to the user. Can contain HTML tags and use interpolations {{ }} to access the context",
      type: "String",
      fieldview: "textarea",
      showIf: { wf_action_name: "Output" },
    });
    actionConfigFields.push({
      label: "Output expression",
      name: "output_expr",
      sublabel:
        "JavaScript expression for the value to output. Typically the name of a variable",
      type: "String",
      class: "validate-expression",
      showIf: { wf_action_name: "DataOutput" },
    });
    actionConfigFields.push({
      label: "Markdown",
      name: "markdown",
      sublabel:
        "The contents are markdown formatted and should be rendered to HTML",
      type: "Bool",
      showIf: { wf_action_name: "Output" },
    });
    actionConfigFields.push({
      label: "Table",
      name: "query_table",
      type: "String",
      required: true,
      attributes: { options: (await Table.find()).map((t) => t.name) },
      showIf: { wf_action_name: "TableQuery" },
    });
    actionConfigFields.push({
      label: "Query",
      name: "query_object",
      sublabel: "Where object, example <code>{manager: 1}</code>",
      type: "String",
      required: true,
      class: "validate-expression",
      default: "{}",
      showIf: { wf_action_name: "TableQuery" },
    });
    actionConfigFields.push({
      label: "Variable",
      name: "query_variable",
      sublabel: "Context variable to write to query results to",
      type: "String",
      required: true,
      validator: jsIdentifierValidator,
      showIf: { wf_action_name: "TableQuery" },
    }); 
    actionConfigFields.push(
      new FieldRepeat({
        name: "user_form_questions",
        showIf: { wf_action_name: "UserForm" },
        fields: [ 
          {
            label: "Label",
            name: "label",
            type: "String",
            sublabel:
              "The text that will shown to the user above the input elements",
          },
          {
            label: "Variable name",
            name: "var_name",
            type: "String",
            sublabel:
              "The answer will be set in the context with this variable name",
            validator: jsIdentifierValidator,
          },
          {
            label: "Input Type",
            name: "qtype",
            type: "String",
            required: true,
            attributes: {
              options: [
                "Yes/No",
                "Checkbox",
                "Free text",
                "Multiple choice",
                //"Multiple checks",
                "Integer",
                "Float",
                //"File upload",
              ],
            },
          },
          {
            label: "Options",
            name: "options",
            type: "String",
            sublabel: "Comma separated list of multiple choice options",
            showIf: { qtype: ["Multiple choice", "Multiple checks"] },
          },
        ],
      })
    );
    return actionConfigFields;
  }
}

export = WorkflowStep;
