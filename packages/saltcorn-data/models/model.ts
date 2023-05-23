/**
 * Model Database Access Layer
 * @category saltcorn-data
 * @module models/model
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { ModelCfg } from "@saltcorn/types/model-abstracts/abstract_model";
import ModelInstance from "./model_instance";
import Table from "./table";

import state from "../db/state";
const { getState } = state;
/**
 * Model Class
 * @category saltcorn-data
 */
class Model {
  id?: number;
  name: string;
  table_id: number;
  modeltemplate: string;
  configuration: any;

  /**
   * Model constructor
   * @param {object} o
   */
  constructor(o: ModelCfg | Model) {
    this.id = o.id;
    this.name = o.name;
    this.modeltemplate = o.modeltemplate;
    this.table_id = o.table_id;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration;
  }

  /**
   * @param {object} lib_in
   */
  static async create(lib_in: ModelCfg): Promise<Model> {
    const lib = new Model(lib_in);
    const id = await db.insert("_sc_models", {
      name: lib.name,
      modeltemplate: lib.modeltemplate,
      table_id: lib.table_id,
      configuration: lib.configuration,
    });
    lib.id = id;
    await require("../db/state").getState().refresh_tables();
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
   * @returns {Model[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Model[]> {
    const us = await db.select("_sc_models", where, selectopts);
    return us.map((u: any) => new Model(u));
  }

  /**
   * @param {*} where
   * @returns {Model}
   */
  static async findOne(where: Where): Promise<Model> {
    const u = await db.selectMaybeOne("_sc_models", where);
    return u ? new Model(u) : u;
  }

  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_models WHERE id = $1`, [this.id]);
    await require("../db/state").getState().refresh_tables();
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await db.update("_sc_models", row, this.id);
  }

  async get_instances(opts?: any) {
    if (typeof opts === "string")
      return await ModelInstance.find({ name: opts, model_id: this.id });
    else
      return await ModelInstance.find({ ...(opts || {}), model_id: this.id });
  }

  get templateObj() {
    return getState()?.modeltemplates[this.modeltemplate];
  }

  static get has_templates() {
    return Object.keys(getState()?.modeltemplates || {}).length > 0;
  }

  async train_instance(
    name: string,
    hyperparameters: any,
    state: {}
  ): Promise<ModelInstance | string> {
    const trainf = this.templateObj.train;
    const table = Table.findOne({ id: this.table_id });
    const result = await trainf({
      table,
      configuration: this.configuration,
      hyperparameters,
      state,
    });
    if (result.error) return result.error;
    else
      return await ModelInstance.create({
        name,
        hyperparameters,
        model_id: this.id,
        state,
        configuration: this.configuration,
        trained_on: new Date(),
        is_default: false,
        ...result,
      });
  }

  get predictor_function() {
    //overloaded. Call with
    // (string, obj) -- model instance name, row. Returns predictions
    // (string) -- model instance name. Return parameters
    // (obj) -- row. Return prediction from default instance
    // () -- Return parameters from default instance
    return async (arg1: any, arg2: any) => {
      let instance, row;
      if (typeof arg1 === "string") {
        instance = await ModelInstance.findOne({
          model_id: this.id,
          name: arg1,
        });
      } else {
        instance = await ModelInstance.findOne({
          model_id: this.id,
          is_default: true,
        });
      }
      if (!instance) {
        // TODO more efficiently by sorting prev query by is_default DESC, trained_on ASC
        instance = await ModelInstance.findOne(
          {
            model_id: this.id,
          },
          { orderBy: "trained_on" }
        );
      }

      if (!instance) throw new Error("Instance not found");

      if (arg2) row = arg2;
      else if (arg1 && typeof arg1 !== "string") row = arg1;
      if (!row) return instance.parameters;

      const template = this.templateObj;
      const results = await template.predict({
        ...instance,
        model: this,
        rows: [row],
      });
      return results[0];
    };
  }
}

export = Model;
