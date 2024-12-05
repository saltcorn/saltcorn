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
  icon: string;
  layout: any;

  /**
   * WorkflowStep constructor
   * @param {object} o
   */
  constructor(o: WorkflowStepCfg | WorkflowStep) {
    this.id = o.id;
    this.name = o.name;
    this.icon = o.icon;
    this.layout =
      typeof o.layout === "string" ? JSON.parse(o.layout) : o.layout;
  }

  /**
   * @param {object} lib_in
   */
  static async create(lib_in: WorkflowStepCfg): Promise<void> {
    const lib = new WorkflowStep(lib_in);
    await db.insert("_sc_workflow_steps", {
      name: lib.name,
      icon: lib.icon,
      layout: lib.layout,
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
  suitableFor(what: string): any {
    let notPage, notShow, notEdit, notFilter, notList;
    if (!this.layout) return false;
    const layout = this.layout.layout ? this.layout.layout : this.layout;
    traverseSync(layout, {
      search_bar() {
        //eg: search - only page and filter
        notShow = true;
        notEdit = true;
        notList = true;
      },
      dropdown_filter() {
        notShow = true;
        notEdit = true;
        notPage = true;
      },
      toggle_filter() {
        notShow = true;
        notEdit = true;
        notPage = true;
        notList = true;
      },
      field() {
        notPage = true;
      },
      view_link() {
        notFilter = true;
      },
      aggregation() {
        notEdit = true;
        notPage = true;
      },
      join_field() {
        notFilter = true;
        notPage = true;
      },
    });
    return {
      page: !notPage,
      show: !notShow,
      edit: !notEdit,
      filter: !notFilter,
      list: !notList,
    }[what];
  }

  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_workflow_steps WHERE id = $1`, [this.id]);
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
