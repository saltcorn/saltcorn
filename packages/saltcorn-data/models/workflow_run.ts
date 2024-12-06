/**
 * Workflow step Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_run
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { WorkflowRunCfg } from "@saltcorn/types/model-abstracts/abstract_workflow_run";
import WorkflowStep from "./workflow_step";

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
  started_by?: number;
  error?: string;
  status: "Pending" | "Running" | "Finished" | "Waiting" | "Error";
  current_step: string;

  /**
   * WorkflowRun constructor
   * @param {object} o
   */
  constructor(o: WorkflowRunCfg | WorkflowRun) {
    this.id = o.id;
    this.trigger_id = o.trigger_id;
    this.context =
      typeof o.context === "string" ? JSON.parse(o.context) : o.context;
    this.wait_info =
      typeof o.wait_info === "string" ? JSON.parse(o.wait_info) : o.wait_info;
    this.started_at = o.started_at || new Date();
    this.started_by = o.started_by;
    this.error = o.error;
    this.status = o.status;
    this.current_step = o.current_step;
  }

  /**
   * @param {object} lib_in
   */
  static async create(step_in: WorkflowRunCfg): Promise<void> {
    const step = new WorkflowRun(step_in);

    return await db.insert("_sc_workflow_runs", step.toJson);
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
  static async findOne(where: Where): Promise<WorkflowRun> {
    const u = await db.selectMaybeOne("_sc_workflow_runs", where);
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
    await db.update("_sc_workflow_runs", row, this.id);
    Object.assign(this, row);
  }

  async run() {
    if (this.status === "Error" || this.status === "Finished") return;
    if (this.status === "Waiting") {
      //are wait conditions fulfilled?
      //TODO
      let fulfilled = true;
      Object.entries(this.wait_info || {}).forEach(([k, v]) => {
        switch (k) {
          case "until_time":
            if (new Date(v as Date | string) < new Date()) fulfilled = false;
            break;

          default:
            break;
        }
      });
      if (!fulfilled) return;
    }
    //get steps
    const steps = await WorkflowStep.find({ trigger_id: this.trigger_id });
    //find current step
    let step;
    if (this.current_step)
      step = steps.find((step) => step.name === this.current_step);
    else step = steps.find((step) => step.initial_step);

    //run in loop
    while (step) {
      if (step.name !== this.current_step)
        await this.update({ current_step: step.name });

      //find action

      //run action

      //update context

      //find next step
    }
  }
}

export = WorkflowRun;
