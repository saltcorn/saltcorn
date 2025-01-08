/**
 * Workflow Run Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_run
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { WorkflowRunCfg } from "@saltcorn/types/model-abstracts/abstract_workflow_run";
import WorkflowStep from "./workflow_step";
import WorkflowTrace from "./workflow_trace";
import User from "./user";
import Expression from "./expression";
import Notification from "./notification";
import utils from "../utils";
import moment from "moment";
import { mkTable } from "@saltcorn/markup/index";
const { ensure_final_slash, interpolate } = utils;
const { eval_expression } = Expression;
const { getState } = require("../db/state");

const allReturnDirectives = [
  "popup",
  "goto",
  "eval_js",
  "download",
  "set_fields",
  "notify",
  "notify_success",
  "error",
];

const data_output_to_html = (val: any) => {
  if (Array.isArray(val) && typeof val[0] === "object") {
    let keysSet = new Set();
    val.forEach((v) => {
      if (typeof v === "object")
        keysSet = new Set([...keysSet, ...Object.keys(v)]);
    });
    const hdrs = [...keysSet].map((k) => ({
      label: k as string,
      key: k as string,
    }));
    return mkTable(hdrs, val);
  }
  if (typeof val === "object") {
    const hdrs = Object.keys(val).map((k) => ({
      label: k as string,
      key: k as string,
    }));
    return mkTable(hdrs, [val], { transpose: true });
  }
  return JSON.stringify(val);
};

/**
 * WorkflowRun Class
 * @category saltcorn-data
 */
class WorkflowRun {
  id?: number;
  trigger_id: number;
  context: any;
  wait_info?: any;
  started_at: Date;
  status_updated_at?: Date;
  started_by?: number;
  error?: string;
  session_id?: string;
  status: "Pending" | "Running" | "Finished" | "Waiting" | "Error";
  current_step: any[];
  steps?: Array<WorkflowStep>;

  step_start?: Date;

  /**
   * WorkflowRun constructor
   * @param {object} o
   */
  constructor(o: WorkflowRunCfg | WorkflowRun) {
    this.id = o.id;
    this.trigger_id = o.trigger_id;
    this.context =
      typeof o.context === "string" ? JSON.parse(o.context) : o.context || {};
    this.wait_info =
      typeof o.wait_info === "string" ? JSON.parse(o.wait_info) : o.wait_info;
    this.started_at = o.started_at || new Date();
    this.status_updated_at = o.status_updated_at;
    this.started_by = o.started_by;
    this.session_id = o.session_id;
    this.error = o.error;
    this.status = o.status || "Pending";
    this.current_step = o.current_step || [];
  }

  /**
   * @param {object} lib_in
   */
  static async create(run_in: WorkflowRunCfg): Promise<WorkflowRun> {
    const run = new WorkflowRun(run_in);
    const id = await db.insert("_sc_workflow_runs", run.toJson);
    run.id = id;
    return run;
  }

  /**
   * @type {...*}
   */
  get toJson(): any {
    const { id, steps, step_start, ...rest } = this;
    return rest;
  }

  /**
   * @param {*} where
   * @param {*} selectopts
   * @returns {WorkflowRun[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<WorkflowRun[]> {
    const us = await db.select("_sc_workflow_runs", where, selectopts);
    return us.map((u: any) => new WorkflowRun(u));
  }

  /**
   * @param {*} where
   * @returns {WorkflowRun}
   */
  static async findOne(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<WorkflowRun> {
    const u = await db.selectMaybeOne("_sc_workflow_runs", where, selectopts);
    return u ? new WorkflowRun(u) : u;
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
    await db.query(`delete FROM ${schema}_sc_workflow_runs WHERE id = $1`, [
      this.id,
    ]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    const useRow: any =
      row.status !== this.status
        ? { status_updated_at: new Date(), ...row }
        : { ...row };
    if (useRow.current_step)
      useRow.current_step = JSON.stringify(useRow.current_step);
    await db.update("_sc_workflow_runs", useRow, this.id);
    if (useRow.current_step)
      useRow.current_step = JSON.parse(useRow.current_step);
    Object.assign(this, useRow);
  }

  async provide_form_input(form_values: any) {
    //write values
    Object.assign(this.context, form_values);

    this.wait_info.form = false;
    await this.update({ wait_info: this.wait_info, context: this.context });
  }

  get_next_step(step: WorkflowStep, user?: User): WorkflowStep | null {
    let nextStep;
    if (!step?.next_step) {
      return null;
    } else if (
      (nextStep = this.steps!.find((s) => s.name === step.next_step))
    ) {
      return nextStep;
    } else {
      // eval next_step
      const next_step_ctx = { ...this.context };
      this.steps!.forEach((s) => {
        next_step_ctx[s.name] = s.name;
      });
      const next_step_name = eval_expression(
        step.next_step,
        next_step_ctx,
        user,
        `next_step in step ${step.name}`
      );
      return this.steps!.find((s) => s.name === next_step_name) || null;
    }
  }

  user_allowed_to_fill_form(user: User) {
    if (this.wait_info.user_id) {
      if (this.wait_info.user_id != user?.id) return false;
    }
    return true;
  }

  //get worklows that can be resumed by scheduler
  static async getResumableWorkflows() {
    const state = getState();
    if (!state.waitingWorkflows) return [];

    const waiting_runs = await WorkflowRun.find({ status: "Waiting" });

    const until_runs = waiting_runs.filter((r) => !r.wait_info.form);

    if (!until_runs.length) {
      state.waitingWorkflows = false;
      return [];
    }
    const now = new Date();
    return until_runs.filter(
      (r) => !r.wait_info.until_time || new Date(r.wait_info.until_time) < now
    );
  }

  //call from scheduler
  static async runResumableWorkflows() {
    const runs = await this.getResumableWorkflows();
    for (const run of runs) {
      await run.run({});
    }
  }

  get current_step_name() {
    return this.current_step[this.current_step.length - 1];
  }

  async createTrace(step_name: string, user?: User) {
    await WorkflowTrace.create({
      run_id: this.id!,
      context: this.context,
      step_name_run: step_name,
      wait_info: this.wait_info,
      user_id: user?.id,
      error: this.error,
      status: this.status,
      elapsed: this.step_start
        ? (new Date().getTime() - this.step_start?.getTime()) / 1000
        : 0,
      step_started_at: this.step_start || new Date(),
    });
  }

  async userFormFields(step0?: WorkflowStep) {
    const step =
      step0 ||
      (await WorkflowStep.findOne({
        trigger_id: this.trigger_id,
        name: this.current_step_name,
      }));
    const qTypeToField = (q: any) => {
      switch (q.qtype) {
        case "Yes/No":
          return {
            type: "String",
            attributes: { options: "Yes,No" },
            fieldview: "radio_group",
          };
        case "Checkbox":
          return { type: "Bool" };
        case "Free text":
          return { type: "String" };
        case "Multiple choice":
          return {
            type: "String",
            attributes: { options: q.options },
            fieldview: "radio_group",
          };
        case "Integer":
          return { type: "Integer" };
        case "Float":
          return { type: "Float" };
        default:
          return {};
      }
    };
    return (step.configuration.user_form_questions || []).map((q: any) => ({
      label: q.label,
      name: q.var_name,
      ...qTypeToField(q),
    }));
  }

  set_current_step(stepName: string) {
    this.current_step[Math.max(0, this.current_step.length - 1)] = stepName;
  }

  async run({
    user,
    interactive,
    noNotifications,
    api_call,
    trace,
  }: {
    user?: User;
    interactive?: boolean;
    noNotifications?: boolean;
    api_call?: boolean;
    trace?: boolean;
  }) {
    if (this.status === "Error" || this.status === "Finished") return;
    //get steps
    const steps = await WorkflowStep.find({ trigger_id: this.trigger_id });
    this.steps = steps;

    const state = getState();
    //state.logLevel = 6;
    state.log(6, `Running workflow id=${this.id}`);

    if (this.status === "Waiting") {
      //are wait conditions fulfilled?
      //TODO
      let fulfilled = true;
      Object.entries(this.wait_info || {}).forEach(([k, v]) => {
        switch (k) {
          case "until_time":
            if (new Date(v as Date | string) > new Date()) fulfilled = false;
            break;
          case "form":
            if (v) fulfilled = false;
          default:
            break;
        }
      });
      if (!fulfilled) return;
      else {
        const step = steps.find((step) => step.name === this.current_step_name);
        const nextStep = this.get_next_step(step!, user);
        if (nextStep) this.set_current_step(nextStep.name);
        await this.update({
          wait_info: {},
          status: nextStep ? "Running" : "Finished",
          current_step: this.current_step,
        });
        if (!nextStep) return;
      }
    }

    //find current step
    let step: any;
    if (this.current_step?.length)
      step = steps.find((step) => step.name === this.current_step_name);
    else step = steps.find((step) => step.initial_step);

    if (step && this.status !== "Running")
      await this.update({ status: "Running" });
    //run in loop
    while (step) {
      if (step.name !== this.current_step) {
        this.set_current_step(step.name);
        await this.update({ current_step: this.current_step });
      }
      state.log(6, `Workflow run ${this.id} Running step ${step.name}`);
      this.step_start = new Date();

      try {
        if (step.action_name === "UserForm") {
          let user_id;
          if (step.configuration.user_id_expression) {
            user_id = eval_expression(
              step.configuration.user_id_expression,
              this.context,
              user,
              `User id expression in step ${step.name}`
            );
          } else user_id = user?.id;
          if (user_id && !interactive && !noNotifications) {
            //TODO send notification
            const base_url = state.getConfig("base_url", "");
            await Notification.create({
              title: "Your input is required",
              link: `${ensure_final_slash(
                base_url
              )}actions/fill-workflow-form/${this.id}`,
              user_id,
            });
          }
          await this.update({
            status: "Waiting",
            wait_info: { form: true, user_id: user_id },
          });
          if (trace) this.createTrace(step.name, user);

          if (
            interactive &&
            (!step.configuration.user_id_expression || user_id === user?.id)
          ) {
            return { popup: `/actions/fill-workflow-form/${this.id}?resume=1` };
          }
          step = null;
          break;
        }
        if (step.action_name === "Output") {
          const output = interpolate(
            step.configuration.output_text,
            this.context,
            user
          );
          await this.update({
            status: "Waiting",
            wait_info: {
              output,
              user_id: user?.id,
              markdown: step.configuration.markdown,
            },
          });
          if (trace) this.createTrace(step.name, user);

          if (interactive) {
            return { popup: `/actions/fill-workflow-form/${this.id}?resume=1` };
          }
          step = null;
          break;
        }
        if (step.action_name === "DataOutput") {
          const output_val = eval_expression(
            step.configuration.output_expr,
            this.context,
            user,
            `Data output expression in step ${step.name}`
          );
          await this.update({
            status: "Waiting",
            wait_info: {
              output: data_output_to_html(output_val),
              user_id: user?.id,
            },
          });
          if (trace) this.createTrace(step.name, user);

          if (interactive) {
            return { popup: `/actions/fill-workflow-form/${this.id}?resume=1` };
          }
          step = null;
          break;
        }
        if (step.action_name === "WaitNextTick") {
          await this.update({
            status: "Waiting",
            wait_info: {},
          });
          state.waitingWorkflows = true;
          if (trace) this.createTrace(step.name, user);
          break;
        }
        if (step.action_name === "WaitUntil") {
          const resume_at = eval_expression(
            step.configuration.resume_at,
            { moment, ...this.context },
            user,
            `Resume at expression in step ${step.name}`
          );
          state.waitingWorkflows = true;

          await this.update({
            status: "Waiting",
            wait_info: { until_time: new Date(resume_at).toISOString() },
          });
          if (trace) this.createTrace(step.name, user);

          break;
        }
        let result;
        if (step.action_name === "ForLoop") {
          const array = eval_expression(
            step.configuration.array_expression,
            this.context,
            user,
            `Array expression in step ${step.name}`
          );
          if (array.length) {
            this.current_step.push(0);
            this.current_step.push(step.configuration.loop_body_initial_step);
            await this.update({
              current_step: this.current_step,
              context: {
                ...this.context,
                [step.configuration.item_variable]: array[0],
              },
            });

            step = steps.find(
              (s) => s.name === step.configuration.loop_body_initial_step
            );

            continue;
          }
        } else result = await step.run(this.context, user);

        const nextUpdate: any = {};
        if (typeof result === "object" && result !== null) {
          Object.assign(this.context, result);
          nextUpdate.context = this.context;
        }
        if (trace) this.createTrace(step.name, user);

        //find next step
        const nextStep = this.get_next_step(step, user);

        if (!nextStep) {          
          step = null;
          nextUpdate.status = "Finished";
        } else {
          step = nextStep;
          nextUpdate.current_step = this.current_step;
          nextUpdate.current_step[Math.max(0, this.current_step.length - 1)] =
            step.name;
        }
        await this.update(nextUpdate);
        if (
          interactive &&
          result &&
          typeof result === "object" &&
          allReturnDirectives.some((k) => typeof result[k] !== "undefined")
        ) {
          const ret = await this.popReturnDirectives();
          ret.resume_workflow = this.id;
          return ret;
        }
      } catch (e: any) {
        console.error("Workflow error", e);

        await this.update({ status: "Error", error: e.message });
        const Trigger = (await import("./trigger")).default;

        Trigger.emitEvent("Error", null, user, {
          workflow_run: this.id,
          message: e.message,
          stack: e.stack,
          step: step?.name,
          run_page: `/actions/run/${this.id}`,
        });
        break;
      }
    }
    return this.context;
  }

  async popReturnDirectives() {
    const retVals: any = {};
    allReturnDirectives.forEach((k) => {
      if (typeof this.context[k] !== "undefined") {
        retVals[k] = this.context[k];
        delete this.context[k];
      }
    });
    if (Object.keys(retVals).length)
      await this.update({ context: this.context });

    return retVals;
  }
  static async count(where?: Where): Promise<number> {
    return await db.count("_sc_workflow_runs", where);
  }

  static async prune() {
    for (const status of ["Error", "Finished", "Running", "Waiting"]) {
      let k = `delete_${status.toLowerCase()}_workflows_days`;
      const days = getState().getConfig(k, false);
      if (!days) continue;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      await db.deleteWhere("_sc_workflow_runs", {
        status,
        status_updated_at: { lt: cutoff },
      });
    }
  }
}

export = WorkflowRun;
