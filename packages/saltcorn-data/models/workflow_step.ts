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
import View from "./view";
import Table from "./table";
import Expression from "./expression";
import FieldRepeat from "./fieldrepeat";
const { jsIdentifierValidator } = require("../utils");

const { eval_expression, get_async_expression_function } = Expression;

const { getState } = require("../db/state");
/**
 * WorkflowStep Class
 * @category saltcorn-data
 */
const reserved = new Set(["end", "subgraph", "direction"]);

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

  static mmescape(s: string) {
    return reserved.has(s) ? `_${s}_` : s;
  }

  //mermaid compatible name
  get mmname() {
    return reserved.has(this.name) ? `_${this.name}_` : this.name;
  }

  //mermaid compatible name
  get mmnext() {
    return this.next_step && reserved.has(this.next_step)
      ? `_${this.next_step}_`
      : this.next_step;
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
  async delete(connect_prev_next: boolean = false): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    if (connect_prev_next) {
      const allSteps = await WorkflowStep.find({ trigger_id: this.trigger_id });
      const allStepNames = new Set(allSteps.map((s) => s.name));
      if (this.next_step && allStepNames.has(this.next_step))
        await db.query(
          `update ${schema}_sc_workflow_steps SET next_step = $1 WHERE trigger_id = $2 and next_step = $3`,
          [this.next_step, this.trigger_id, this.name]
        );
      else if (!this.next_step) {
        await db.query(
          `update ${schema}_sc_workflow_steps SET next_step = null WHERE trigger_id = $1 and next_step = $2`,
          [this.trigger_id, this.name]
        );
      }
    }
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
      const f = get_async_expression_function(
        this.configuration.ctx_values,
        Object.keys(context).map((k) => ({ name: k })) as any[],
        {
          user,
        }
      );
      return await f(context, user);
    }
    if (this.action_name === "SetErrorHandler") {
      return { __errorHandler: this.configuration.error_handling_step };
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
      if (!trigger)
        throw new Error(`Action or trigger not found: ${this.action_name}`);

      state_action = getState().actions[trigger.action];
      if (!state_action)
        throw new Error(`Action or trigger not found: ${this.action_name}`);
      const runargs: any = {
        configuration: trigger.configuration,
        user,
        mode: "workflow",
      };
      if (this.configuration.row_expr) {
        runargs.row = eval_expression(
          this.configuration.row_expr,
          context,
          user,
          `Row expression in ${this.name} step`
        );
      } else {
        runargs.row = { ...context };
      }
      if (trigger.table_id) {
        runargs.table = Table.findOne({ id: trigger.table_id });
        for (const field of runargs.table.fields) {
          if (
            !field.is_fkey ||
            !field.attributes?.summary_field ||
            typeof runargs.row[field.name] !== "string"
          )
            continue;
          const refTable = Table.findOne({ name: field.reftable_name });
          if (!refTable) continue;
          const refRow = await refTable.getRow({
            [field.attributes.summary_field]: runargs.row[field.name],
          });
          if (refRow) runargs.row[field.name] = refRow[refTable.pk_name];
        }
      }
      return await state_action.run(runargs);
    }
  }

  static generate_diagram(steps: WorkflowStep[], options = {}) {
    const stepNames: string[] = steps.map((s) => s.name);
    const nodeLines = steps.map(
      (s) => `  ${s.mmname}["\`**${s.name}**
    ${s.action_name}\`"]:::wfstep${s.id}${s.only_if ? "@{ shape: hex }" : ""}`
    );

    nodeLines.unshift(`  _Start@{ shape: circle, label: "Start" }`);
    const linkLines = [];
    let step_ix = 0;
    for (const step of steps) {
      if (step.initial_step)
        linkLines.push(
          `  _Start-- <i class="fas fa-plus add-btw-nodes btw-nodes-${0}-${
            step.name
          }"></i> ---${step.mmname}`
        );
      if (stepNames.includes(step.next_step as string)) {
        linkLines.push(
          `  ${step.mmname} -- <i class="fas fa-plus add-btw-nodes btw-nodes-${step.id}-${step.next_step}"></i> --- ${step.mmnext}`
        );
      } else if (step.next_step) {
        let found = false;
        for (const otherStep of stepNames)
          if (step.next_step.includes(otherStep)) {
            linkLines.push(
              `  ${step.mmname} --> ${WorkflowStep.mmescape(otherStep)}`
            );
            found = true;
          }
        if (!found) {
          linkLines.push(
            `  ${step.mmname}-- <a href="/actions/stepedit/${step.trigger_id}/${step.id}">Error: missing next step in ${step.mmname}</a> ---_End_${step.mmname}`
          );
          nodeLines.push(
            `  _End_${step.mmname}:::wfadd${step.id}@{ shape: circle, label: "<i class='fas fa-plus with-link'></i>" }`
          );
        }
      } else if (!step.next_step) {
        linkLines.push(`  ${step.mmname} --> _End_${step.mmname}`);
        nodeLines.push(
          `  _End_${step.mmname}:::wfadd${step.id}@{ shape: circle, label: "<i class='fas fa-plus with-link'></i>" }`
        );
      }
      if (step.action_name === "ForLoop") {
        linkLines.push(
          `  ${step.mmname}-.->${WorkflowStep.mmescape(
            step.configuration.loop_body_initial_step
          )}`
        );
      }
      if (step.action_name === "EndForLoop") {
        // TODO this is not correct. improve.
        let forStep;
        for (let i = step_ix; i >= 0; i -= 1) {
          if (steps[i].action_name === "ForLoop") {
            forStep = steps[i];
            break;
          }
        }
        if (forStep) linkLines.push(`  ${step.mmname} --> ${forStep.mmname}`);
      }
      step_ix += 1;
    }
    if (!steps.length || !steps.find((s) => s.initial_step)) {
      linkLines.push(`  _Start --> _End`);
      nodeLines.push(
        `  _End:::wfaddstart@{ shape: circle, label: "<i class='fas fa-plus with-link'></i>" }`
      );
    }
    const fc =
      "flowchart TD\n" + nodeLines.join("\n") + "\n" + linkLines.join("\n");
    //console.log(fc);

    return fc;
  }

  static builtInActionExplainers(opts: any = {}) {
    const actionExplainers: any = {};
    actionExplainers.SetContext = "Set variables in the context";
    actionExplainers.TableQuery =
      "Query a table into a variable in the context";
    actionExplainers.Output =
      "Display a message to the user. Pause workflow until the message is read.";
    actionExplainers.DataOutput =
      "Display a value to the user. Arrays of objects will be displayed as tables. Pause workflow until the message is read.";
    actionExplainers.OutputView =
      "Display the output of running a Saltcorn view. Pause workflow until the message is read.";
    actionExplainers.WaitUntil = "Pause until a time in the future";
    actionExplainers.WaitNextTick =
      "Decouple workflow from invocation. Pause until the next scheduler invocation (at most 5 minutes), or run in background immediately.";
    actionExplainers.UserForm =
      "Ask a user one or more questions, pause until they are answered";
    actionExplainers.ForLoop =
      "Loop over the items in an array, setting a variable to each item in an iteration of a loop body";
    actionExplainers.SetErrorHandler = "Set the error handling step";
    actionExplainers.EditViewForm =
      "Ask the user to fill in a form from an Edit view, storing the response in the context";
    actionExplainers.Stop = "Terminate the workflow run execution immediately";
    if (opts?.api_call)
      actionExplainers.APIResponse = "Provide the response to an API call";

    return actionExplainers;
  }

  static async builtInActionConfigFields(opts: any = {}) {
    const stepOptions = async () => {
      if (opts?.trigger && !opts?.copilot) {
        const steps = await WorkflowStep.find({ trigger_id: opts.trigger.id });
        return { options: steps.map((s) => s.name) };
      } else return undefined;
    };
    const actionConfigFields = [];
    actionConfigFields.push({
      label: "Loop Array",
      sublabel:
        "Javascript expression, based on the context, for the array to loop over",
      name: "array_expression",
      type: "String",
      class: "validate-expression",
      showIf: { wf_action_name: "ForLoop" },
    });
    actionConfigFields.push({
      label: "Loop item variable",
      sublabel:
        "Javascript identifier; the name of the variable the current item from the loop array will be set to in each loop iteration",
      name: "item_variable",
      class: "validate-identifier",
      type: "String",
      showIf: { wf_action_name: "ForLoop" },
    });
    actionConfigFields.push({
      label: "Loop body step",
      sublabel:
        "The name of the first step in the loop body. The workflow execution inside the loop will start at this step, and continue from that step's next_step, until a step with blank next_step is encountered, which is the end of the loop body",
      name: "loop_body_initial_step",
      type: "String",
      showIf: { wf_action_name: "ForLoop" },
    });
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
      label: "Edit view",
      name: "edit_view",
      type: "String",
      required: true,
      sublabel:
        "Edit view should have a Save button. Other actions and edit view settings will be ignored.",
      attributes: {
        options: (await View.find({ viewtemplate: "Edit" })).map((t) => t.name),
      },
      showIf: { wf_action_name: "EditViewForm" },
    });
    actionConfigFields.push({
      label: "View",
      name: "view",
      type: "String",
      required: true,
      attributes: {
        options: (await View.find()).map((t) => t.name),
      },
      showIf: { wf_action_name: "OutputView" },
    });
    actionConfigFields.push({
      label: "View state",
      name: "view_state",
      sublabel:
        "JavaScript object expression for the view state. Example <code>{id: 2}</code> will run the view with table id = 2",
      type: "String",
      fieldview: "textarea",
      class: "validate-expression",
      default: "{}",
      showIf: { wf_action_name: "OutputView" },
    });
    actionConfigFields.push({
      label: "User ID",
      name: "user_id_expression",
      type: "String",
      sublabel: "Optional. If blank assigned to user starting the workflow",
      showIf: { wf_action_name: "EditViewForm" },
    });
    actionConfigFields.push({
      label: "Response variable",
      name: "response_variable",
      sublabel: "Context variable to write the form response to",
      class: "validate-identifier",
      type: "String",
      validator: jsIdentifierValidator,
      showIf: { wf_action_name: "EditViewForm" },
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
      label: "Response JSON",
      name: "response_expression",
      sublabel: "JavaScript expression for the API response. ",
      type: "String",
      fieldview: "textarea",
      class: "validate-expression",
      default: "{}",
      showIf: { wf_action_name: "APIResponse" },
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
      label: "Run immedately",
      name: "immediately_bg",
      sublabel:
        "Run workflow immediately in background, instead of waiting for next scheduler run.",
      type: "Bool",
      showIf: { wf_action_name: "WaitNextTick" },
    });
    actionConfigFields.push({
      label: "Delay (s)",
      name: "wait_delay",
      type: "Float",
      showIf: { wf_action_name: "WaitNextTick", immediately_bg: true },
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
      label: "Error handling step",
      name: "error_handling_step",
      sublabel:
        "Name of the step which will be invoked on errors in subsequent steps. When an error occurs, execution jumps to the error handling step and continues fron the error handling step's next_step. The error handling step can be changed in the workflow.",
      type: "String",
      required: true,
      class: "validate-identifier",
      attributes: await stepOptions(),
      validator: jsIdentifierValidator,
      showIf: { wf_action_name: "SetErrorHandler" },
    });
    actionConfigFields.push({
      label: "Variable",
      name: "query_variable",
      class: "validate-identifier",
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
            class: "validate-identifier",
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
