/**
 * Model Database Access Layer
 * @category saltcorn-data
 * @module models/model
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { ModelCfg } from "@saltcorn/types/model-abstracts/abstract_model";

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
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await db.update("_sc_models", row, this.id);
  }

  get templateObj() {
    return getState()?.modeltemplates[this.modeltemplate];
  }

  get predictor_function() {
    const ModelInstance = require("../models/model_instance");

    //overloaded
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
      if (!instance)
        throw new Error("Instance not found or no default instance");
      if (arg2) row = arg2;
      else if (arg1 && typeof arg1 !== "string") row = arg1;
      if (!row) return instance.parameters;

      const template = this.templateObj;
      const results = await template.predict({
        ...instance,
        configuration: this.configuration,
        rows: [row],
      });
      return results[0];
    };
  }
}

export = Model;
