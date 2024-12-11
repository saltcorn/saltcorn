/**
 * Workflow Trace Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_trace
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { WorkflowTraceCfg } from "@saltcorn/types/model-abstracts/abstract_workflow_trace";

/**
 * WorkflowTrace Class
 * @category saltcorn-data
 */
class WorkflowTrace {
  id?: number;
  run_id: number;
  context: any;
  step_name_run: string;
  wait_info?: any;
  step_started_at: Date;
  elapsed: number;
  user_id?: number;
  error?: string;
  status: "Pending" | "Running" | "Finished" | "Waiting" | "Error";

  /**
   * WorkflowTrace constructor
   * @param {object} o
   */
  constructor(o: WorkflowTraceCfg | WorkflowTrace) {
    this.id = o.id;
    this.run_id = o.run_id;
    this.context =
      typeof o.context === "string" ? JSON.parse(o.context) : o.context || {};
    this.wait_info =
      typeof o.wait_info === "string" ? JSON.parse(o.wait_info) : o.wait_info;
    this.step_started_at = o.step_started_at || new Date();
    this.user_id = o.user_id;
    this.error = o.error;
    this.status = o.status || "Pending";
    this.step_name_run = o.step_name_run;
    this.elapsed = o.elapsed;
  }

  /**
   * @param {object} lib_in
   */
  static async create(run_in: WorkflowTraceCfg): Promise<WorkflowTrace> {
    const run = new WorkflowTrace(run_in);
    const id = await db.insert("_sc_workflow_trace", run.toJson);
    run.id = id;
    return run;
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
   * @returns {WorkflowTrace[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<WorkflowTrace[]> {
    const us = await db.select("_sc_workflow_trace", where, selectopts);
    return us.map((u: any) => new WorkflowTrace(u));
  }

  /**
   * @param {*} where
   * @returns {WorkflowTrace}
   */
  static async findOne(where: Where): Promise<WorkflowTrace> {
    const u = await db.selectMaybeOne("_sc_workflow_trace", where);
    return u ? new WorkflowTrace(u) : u;
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
    await db.query(`delete FROM ${schema}_sc_workflow_trace WHERE id = $1`, [
      this.id,
    ]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */

  static async count(where?: Where): Promise<number> {
    return await db.count("_sc_workflow_trace", where);
  }
}

export = WorkflowTrace;
