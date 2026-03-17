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
import mocks from "../tests/mocks";
import { FieldLike } from "@saltcorn/types/base_types";
const { mockReqRes } = mocks;
const {
  ensure_final_slash,
  interpolate,
  allReturnDirectives,
  secondaryReturnDirectives,
} = utils;
const { eval_expression } = Expression;
const { getState } = require("../db/state");

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
    this.started_at =
      (["string", "number"].includes(typeof o.started_at)
        ? new Date(o.started_at as any)
        : o.started_at) || new Date();
    this.status_updated_at = o.status_updated_at;
    this.started_by = o.started_by;
    this.session_id = o.session_id;
    this.error = o.error;
    this.status = o.status || "Pending";
    this.current_step =
      typeof o.current_step === "string"
        ? JSON.parse(o.current_step)
        : o.current_step || [];
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

  async provide_form_input(form_values: any, response_variable?: string) {
    //write values
    if (response_variable) {
      if (!this.context[response_variable])
        this.context[response_variable] = {};
      Object.assign(this.context[response_variable], form_values);
    } else Object.assign(this.context, form_values);

    this.wait_info.form = false;
    this.wait_info.output = false;
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
      await db.withTransaction(async () => {
        await run.run({});
      });
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

  async userFormFields(
    step0?: WorkflowStep,
    user?: User
  ): Promise<{ fields: FieldLike[]; validator?: (r: Row) => any }> {
    const step =
      step0 ||
      (await WorkflowStep.findOne({
        trigger_id: this.trigger_id,
        name: this.current_step_name,
      }));
    const qTypeToField = (q: any, ix: number) => {
      switch (q.qtype) {
        case "Yes/No":
          return {
            type: "String",
            attributes: { options: ["Yes", "No"] },
            fieldview: "radio_group",
          };
        case "Checkbox":
          return { type: "Bool" };
        case "Free text":
          return {
            type: "String",
            attributes: { autofocus: ix === 0 || undefined },
          };
        case "Date":
          return {
            type: "Date",
            attributes: { day_only: q.day_only },
            fieldview: getState().types.Date?.fieldviews?.flatpickr
              ? "flatpickr"
              : "edit",
          };
        case "Multiple choice":
          let options = q.options;
          if (typeof options === "string" && options.includes("{{")) {
            options = interpolate(
              q.options,
              this.context,
              user,
              "Multiple choice options"
            );
          }
          const noptions = Array.isArray(options)
            ? options.length
            : typeof options === "string"
              ? options.split(",").length
              : 0;
          return {
            type: "String",
            attributes: { options },
            required: true,
            fieldview: noptions > 5 ? undefined : "radio_group",
          };
        case "Integer":
          return {
            type: "Integer",
            attributes: { autofocus: ix === 0 || undefined },
          };
        case "Float":
          return { type: "Float" };
        default:
          return {};
      }
    };

    const formFields: FieldLike[] = [];
    let hasMultiChecks = false;
    const multiCheckOptions: { [key: string]: string[] } = {};
    (step.configuration.user_form_questions || []).forEach(
      (
        q: {
          qtype: string;
          var_name: string;
          label: string;
          options: string[] | string;
          required?: boolean;
        },
        ix: number
      ) => {
        if (q.qtype === "Multiple checks") {
          hasMultiChecks = true;
          let options = q.options;
          if (typeof options === "string" && options.includes("{{")) {
            options = interpolate(
              q.options as string,
              this.context,
              user,
              "Multiple checks option"
            );
          }
          if (typeof options === "string")
            options = options.split(",").map((o) => o.trim());
          multiCheckOptions[q.var_name] = options;
          formFields.push({
            input_type: "section_header",
            label: " ",
            sublabel: `<span class="fst-normal">${q.label}</span>`,
          } as FieldLike);
          options.forEach((o: string, ix: number) => {
            formFields.push({
              label: o,
              name: `${q.var_name}_${ix}`,
              type: "Bool",
            } as FieldLike);
          });
        } else
          formFields.push({
            label: q.label,
            name: q.var_name,
            ...qTypeToField(q, ix),
          } as FieldLike);
      }
    );

    const formElems: { fields: FieldLike[]; validator?: (r: Row) => any } = {
      fields: formFields,
    };
    if (hasMultiChecks)
      formElems.validator = (row: Row) => {
        (step.configuration.user_form_questions || []).forEach(
          (q: {
            qtype: string;
            var_name: string;
            label: string;
            options: string[] | string;
            required?: boolean;
          }) => {
            if (q.qtype === "Multiple checks") {
              row[q.var_name] = [];
              multiCheckOptions[q.var_name].forEach((o: string, ix: number) => {
                if (row[`${q.var_name}_${ix}`]) {
                  row[q.var_name].push(o);
                }
                delete row[`${q.var_name}_${ix}`];
              });
            }
          }
        );
      };
    return formElems;
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
    req,
  }: {
    user?: User;
    interactive?: boolean;
    noNotifications?: boolean;
    api_call?: boolean;
    trace?: boolean;
    req?: any;
  }) {
    if (this.status === "Error" || this.status === "Finished") return;
    //get steps
    const steps = await WorkflowStep.find({ trigger_id: this.trigger_id });
    this.steps = steps;

    const state = getState();
    //state.logLevel = 6;
    state.log(6, `Running workflow id=${this.id}`);
    const Trigger = (await import("./trigger")).default;

    const allWorkflows = await Trigger.find({});
    const allWorkflowNames = new Set(allWorkflows.map((wf) => wf.name));

    let waiting_fulfilled = false;
    if (this.status === "Waiting") {
      //are wait conditions fulfilled?
      let fulfilled = true;
      for (const [k, v] of Object.entries(this.wait_info || {})) {
        switch (k) {
          case "until_time":
            if (new Date(v as Date | string) > new Date()) fulfilled = false;
            break;
          case "form":
            if (v) fulfilled = false;
            break;
          case "workflow_run":
            const wait_for_run = await WorkflowRun.findOne({ id: v });
            if (wait_for_run.status !== "Finished") fulfilled = false;
          default:
            break;
        }
      }
      if (!fulfilled) return;
      else waiting_fulfilled = true;
    }

    //find current step
    let step: WorkflowStep | undefined | null;
    if (this.current_step?.length)
      step = steps.find((step) => step.name === this.current_step_name);
    else step = steps.find((step) => step.initial_step);

    if (step && this.status !== "Running")
      await this.update({ status: "Running" });
    //run in loop
    while (step) {
      if (step.name !== (this.current_step as unknown as string)) {
        this.set_current_step(step.name);
        await this.update({ current_step: this.current_step });
      }
      state.log(
        6,
        `Workflow run ${this.id} Running step ${step.name} action=${step.action_name} current_step=${this.current_step}`
      );
      this.step_start = new Date();
      let do_break = false;
      let skip_because_only_if = false;
      if (step?.only_if) {
        const proceed = eval_expression(
          step.only_if,
          this.context,
          user,
          `Only if expression in ${step.name} step`
        );
        if (!proceed) skip_because_only_if = true;
      }
      /**
       * Executes a workflow step within a database transaction, handling various workflow actions
       * such as sub-workflows, API responses, user forms, output views, loops, and error handling.
       *
       * @template T - The type of the value returned by the transaction callback.
       *
       * @param {() => Promise<T>} transactionCallback - An asynchronous function that contains the logic
       * to be executed within the transaction. This function may include workflow actions, updates to
       * the workflow state, and context modifications.
       *
       * @param {(error: any) => Promise<void>} errorHandler - An asynchronous function that handles errors
       * occurring during the transaction. This function may update the workflow state to reflect the error
       * or invoke an error handler step if defined.
       *
       * @returns {Promise<T>} A promise that resolves to the result of the transaction callback or the
       * return value of a workflow step. The result type depends on the specific workflow action executed.
       *
       * @throws {Error} If an unhandled error occurs during the transaction or workflow execution.
       */
      const returnVal = await db.tryCatchInTransaction(
        async () => {
          if (
            allWorkflowNames.has(step?.action_name) &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
            const wfTrigger = allWorkflows.find(
              (wf) => wf.name === step?.action_name
            );
            if (wfTrigger?.action === "Workflow") {
              const subwfrun = await WorkflowRun.create({
                trigger_id: wfTrigger!.id!,
                context: step?.configuration.subcontext
                  ? structuredClone(this.context[step.configuration.subcontext])
                  : structuredClone(this.context),
                started_by: this.started_by,
                session_id: this.session_id,
              });
              await this.update({
                status: "Waiting",
                wait_info: { workflow_run: subwfrun.id },
              });

              const subrunres: any = await subwfrun.run({
                user,
                interactive,
                noNotifications,
                api_call,
              });

              if (subwfrun.status === "Finished") {
                if (step?.configuration.subcontext)
                  Object.assign(
                    this.context[step.configuration.subcontext],
                    subwfrun.context
                  );
                else Object.assign(this.context, subwfrun.context);
                await this.update({
                  context: this.context,
                  status: "Running",
                  wait_info: {},
                });
                waiting_fulfilled = true;
              } else {
                do_break = true;
                return subrunres;
              }
            }
          }
          if (step?.action_name === "APIResponse" && !skip_because_only_if) {
            const resp = eval_expression(
              step.configuration.response_expression,
              this.context,
              user,
              `API response expression in step ${step.name}`
            );
            await this.update({
              status: "Finished",
            });
            do_break = true;
            return resp;
          }
          if (
            (step?.action_name === "Stop" ||
              step?.action_name === "TerminateWorkflow") &&
            !skip_because_only_if
          ) {
            const resp = step.configuration.return_value
              ? eval_expression(
                  step.configuration.return_value,
                  this.context,
                  user,
                  `Return value expression in step ${step.name}`
                )
              : {};
            await this.update({
              status: "Finished",
            });
            do_break = true;
            return resp;
          }

          if (
            (step?.action_name === "UserForm" ||
              step?.action_name === "EditViewForm") &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
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
              return {
                popup: `/actions/fill-workflow-form/${this.id}?resume=1`,
              };
            }
            step = null;
            do_break = true;
            return;
          }
          if (
            step?.action_name === "Output" &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
            const output = interpolate(
              step.configuration.output_text,
              this.context,
              user,
              "Output text"
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
              return {
                popup: `/actions/fill-workflow-form/${this.id}?resume=1`,
              };
            }
            step = null;
            do_break = true;
            return;
          }
          if (
            step?.action_name === "DataOutput" &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
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
              return {
                popup: `/actions/fill-workflow-form/${this.id}?resume=1`,
              };
            }
            step = null;
            do_break = true;
            return;
          }
          if (
            step?.action_name === "OutputView" &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
            const View = (await import("./view")).default;
            const view = View.findOne({ name: step.configuration.view });

            const state = eval_expression(
              step.configuration.view_state,
              this.context,
              user,
              `View state expression in step ${step.name}`
            );
            if (!view)
              throw new Error("View not found: " + step.configuration.view);
            const vout = await view.run(state, req ? { req } : mockReqRes);
            await this.update({
              status: "Waiting",
              wait_info: {
                output: vout,
                user_id: user?.id,
              },
            });
            if (trace) this.createTrace(step.name, user);

            if (interactive) {
              return {
                popup: `/actions/fill-workflow-form/${this.id}?resume=1`,
              };
            }
            step = null;
            do_break = true;
            return;
          }
          if (
            step?.action_name === "WaitNextTick" &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
            await this.update({
              status: "Waiting",
              wait_info: {},
            });
            if (step.configuration.immediately_bg) {
              const runNow = async () => {
                return await this.run({
                  user,
                  interactive: false,
                  noNotifications,
                  api_call: false,
                  trace,
                  req,
                });
              };
              if (trace) this.createTrace(step.name, user);
              setTimeout(
                () => {
                  //remove client from request context
                  db.runWithTenant(
                    { tenant: db.getTenantSchema(), req, client: null },
                    () => {
                      db.withTransaction(() =>
                        runNow().catch((e) =>
                          console.error("Workflow bg error", e)
                        )
                      );
                    }
                  );
                },
                (step.configuration.wait_delay || 0) * 1000
              );
              do_break = true;
              return;
            }
            state.waitingWorkflows = true;
            if (trace) this.createTrace(step.name, user);
            do_break = true;
            return;
          }
          if (
            step?.action_name === "WaitUntil" &&
            !waiting_fulfilled &&
            !skip_because_only_if
          ) {
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

            do_break = true;
            return;
          }
          let result: any;
          if (step?.action_name === "ForLoop" && !skip_because_only_if) {
            const array = eval_expression(
              step.configuration.array_expression,
              this.context,
              user,
              `Array expression in step ${step.name}`
            );
            if (array.length) {
              this.current_step.push(0);
              this.current_step.push(step.configuration.loop_body_initial_step);
              const new_context = {
                ...this.context,
                [step.configuration.item_variable]: array[0],
              };
              if (step.configuration.index_variable)
                new_context[step.configuration.index_variable] = 0;
              await this.update({
                current_step: this.current_step,
                context: new_context,
              });

              step = steps.find(
                (s) => s.name === step?.configuration.loop_body_initial_step
              );

              return;
            }
          } else if (waiting_fulfilled) {
            waiting_fulfilled = false;
          } else if (step && user) result = await step.run(this.context, user);

          const nextUpdate: any = {};
          if (typeof result === "object" && result !== null) {
            Object.assign(this.context, result);
            nextUpdate.context = this.context;
          }
          if (trace && !skip_because_only_if)
            this.createTrace(step?.name as string, user);

          //find next step
          const nextStep = step ? this.get_next_step(step, user) : null;

          if (!nextStep) {
            if (this.current_step.length > 1) {
              // end for loop body
              const forStepName =
                this.current_step[this.current_step.length - 3];
              const forStep = steps.find((s) => s.name === forStepName);
              if (!forStep) throw new Error("step not found: " + forStepName);
              const array_data1 = eval_expression(
                forStep.configuration.array_expression,
                this.context,
                user,
                `Array expression in step ${forStep.name}`
              );
              const last_index =
                this.current_step[this.current_step.length - 2];
              if (last_index < array_data1.length - 1) {
                //there is another item
                this.current_step[this.current_step.length - 2] += 1;
                this.set_current_step(
                  forStep.configuration.loop_body_initial_step
                );
                const next_index =
                  this.current_step[this.current_step.length - 2];
                const nextVar = array_data1[next_index];

                nextUpdate.context = {
                  ...this.context,
                  [forStep.configuration.item_variable]: nextVar,
                };
                if (forStep.configuration.index_variable)
                  nextUpdate.context[forStep.configuration.index_variable] =
                    next_index;
                nextUpdate.current_step = this.current_step;
              } else {
                //no more items
                this.current_step.pop();
                this.current_step.pop();
                const afterForStep = this.get_next_step(forStep, user);

                if (afterForStep) {
                  this.set_current_step(afterForStep.name);
                  nextUpdate.current_step = this.current_step;
                } else {
                  //TODO what if there is another level of forloops
                  step = null;
                  nextUpdate.status = "Finished";
                }
                //remove variable from context
                delete this.context[forStep.configuration.item_variable];
                if (forStep.configuration.index_variable)
                  delete this.context[forStep.configuration.index_variable];

                nextUpdate.context = this.context;
                //nextUpdate.current_step = this.current_step;
              }
              step =
                step && steps.find((s) => s.name === this.current_step_name);
            } else {
              step = null;
              nextUpdate.status = "Finished";
            }
          } else {
            step = nextStep;
            nextUpdate.current_step = this.current_step;
            nextUpdate.current_step[Math.max(0, this.current_step.length - 1)] =
              step.name;
          }
          if (
            interactive &&
            result &&
            typeof result === "object" &&
            allReturnDirectives.some((k) => typeof result[k] !== "undefined")
          ) {
            const ret = await this.popReturnDirectives(nextUpdate);
            ret.resume_workflow = this.id;
            return ret;
          } else await this.update(nextUpdate);
        },
        async (e) => {
          if (this.context.__errorHandler) {
            const upd = {
              context: { ...this.context, __error: e },
              current_step: this.current_step,
            };
            //TODO need to think about error handling in loops
            upd.current_step[Math.max(0, this.current_step.length - 1)] =
              this.context.__errorHandler;
            await this.update(upd);
            step = steps.find((s) => s.name === this.context.__errorHandler);
          } else if (step) {
            await this.markAsError(e, step, user);
            do_break = true;
          }
        }
      ); // try-catch
      if (
        returnVal ||
        returnVal === null ||
        returnVal === false ||
        returnVal === ""
      )
        return returnVal;
      if (do_break) break;
    } //while
    return this.context;
  }

  async markAsError(e: Error, step: WorkflowStep, user?: User) {
    console.error("Workflow error", e);
    await this.update({ status: "Error", error: e?.message || e });

    const Trigger = (await import("./trigger")).default;

    Trigger.emitEvent("Error", null, user, {
      workflow_run: this.id,
      message: e.message,
      stack: e.stack,
      step: step?.name,
      run_page: `/actions/run/${this.id}`,
    });
  }
  async popReturnDirectives(nextUpdate?: Row) {
    const retVals: any = {};
    allReturnDirectives.forEach((k) => {
      if (typeof this.context[k] !== "undefined") {
        retVals[k] = this.context[k];
        delete this.context[k];
      }
      if (typeof nextUpdate?.[k] !== "undefined") delete nextUpdate[k];
    });

    Object.keys(secondaryReturnDirectives).forEach((k) => {
      if (typeof retVals[k] !== "undefined")
        secondaryReturnDirectives[k].forEach((secondary_k) => {
          if (typeof this.context[secondary_k] !== "undefined") {
            retVals[secondary_k] = this.context[secondary_k];
            delete this.context[secondary_k];
          }
          if (typeof nextUpdate?.[secondary_k] !== "undefined")
            delete nextUpdate[secondary_k];
        });
    });
    //if (Object.keys(retVals).length)
    if (nextUpdate) {
      await this.update(nextUpdate);
    } else this.update({ context: this.context });

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
