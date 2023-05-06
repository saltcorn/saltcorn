/**
 * Model Instance Database Access Layer
 * @category saltcorn-data
 * @module models/model_instance
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { ModelInstanceCfg } from "@saltcorn/types/model-abstracts/abstract_model";

/**
 * Model Class
 * @category saltcorn-data
 */
class ModelInstance {
  id?: number;
  name: string;
  model_id: number;
  state: any;
  hyperparameters: any;
  trained_on: Date;
  report: string;
  metric_values: any;
  parameters: any;
  fit_object: Buffer;
  is_default: boolean;

  /**
   * ModelInstance constructor
   * @param {object} o
   */
  constructor(o: ModelInstanceCfg | ModelInstance) {
    this.id = o.id;
    this.name = o.name;
    this.model_id = o.model_id;
    this.state = typeof o.state === "string" ? JSON.parse(o.state) : o.state;
    this.hyperparameters =
      typeof o.hyperparameters === "string"
        ? JSON.parse(o.hyperparameters)
        : o.hyperparameters;
    this.parameters =
      typeof o.parameters === "string"
        ? JSON.parse(o.parameters)
        : o.parameters;
    this.metric_values =
      typeof o.metric_values === "string"
        ? JSON.parse(o.metric_values)
        : o.metric_values;
    this.trained_on = ["string", "number"].includes(typeof o.trained_on)
      ? new Date(o.trained_on)
      : o.trained_on;
    this.fit_object = o.fit_object;
    this.is_default = o.is_default || false;
    this.report = o.report;
  }

  /**
   * @param {object} lib_in
   */
  static async create(lib_in: ModelInstanceCfg): Promise<ModelInstance> {
    const lib = new ModelInstance(lib_in);
    const id = await db.insert("_sc_model_instances", {
      name: lib.name,
      model_id: lib.model_id,
      state: lib.state,
      hyperparameters: lib.hyperparameters,
      parameters: lib.parameters,
      trained_on: lib.trained_on,
      report: lib.report,
      metric_values: lib.metric_values,
      fit_object: lib.fit_object,
      is_default: lib.is_default,
    });
    lib.id = id;
    return lib;
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
   * @returns {ModelInstance[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<ModelInstance[]> {
    const us = await db.select("_sc_model_instances", where, selectopts);
    return us.map((u: any) => new ModelInstance(u));
  }

  /**
   * @param {*} where
   * @returns {ModelInstance}
   */
  static async findOne(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<ModelInstance> {
    const u = await db.selectMaybeOne("_sc_model_instances", where, selectopts);
    return u ? new ModelInstance(u) : u;
  }

  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_model_instances WHERE id = $1`, [
      this.id,
    ]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await db.update("_sc_model_instances", row, this.id);
  }

  async predict(rows: Row): Promise<any> {
    const Model = require("./model");
    const model = await Model.findOne({ id: this.model_id });
    const template = model.templateObj;
    return await template.predict({
      ...this,
      model,
      rows,
    });
  }

  async make_default(disable?: boolean): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `update ${schema}_sc_model_instances set is_default = (id = $1) where model_id = $2`,
      [disable ? -1 : this.id, this.model_id]
    );
    this.is_default = !disable;
  }
}

export = ModelInstance;
