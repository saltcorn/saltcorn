/**
 * Workflow step Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_step
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { WorkflowStepCfg } from "@saltcorn/types/model-abstracts/abstract_workflow_step";

const { traverseSync } = require("./layout");

/**
 * WorkflowStep Class
 * @category saltcorn-data
 */
class WorkflowStep {
  id?: number;
  name: string;
  trigger_id: number;
  next_step?: string;
  action_name: string;
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
    this.action_name = o.action_name;
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
    await db.insert("_sc_workflow_steps", {
      name: step.name,
      action_name: step.action_name,
      trigger_id: step.trigger_id,
      next_step: step.next_step,
      configuration: step.configuration,
    });
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

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await db.update("_sc_workflow_steps", row, this.id);
  }
}

export = WorkflowStep;
