/**
 * Workflow Trace Database Access Layer
 * @category saltcorn-data
 * @module models/workflow_trace
 * @subcategory models
 */
import { GenObj } from "@saltcorn/types/common_types";
import db from "../db";
import type {
  Where,
  SelectOptions,
  Row,
  PartialSome,
} from "@saltcorn/db-common/internal";

type MetaDataCfg = PartialSome<MetaData, "name" | "type" | "body">;

/**
 * MetaData Class
 * @category saltcorn-data
 */
class MetaData {
  id?: number;
  name: string;
  type: string;
  user_id?: number;
  body: GenObj;
  written_at: Date;

  /**
   * MetaData constructor
   * @param {object} o
   */
  constructor(o: MetaDataCfg | MetaData) {
    this.id = o.id;
    this.body = typeof o.body === "string" ? JSON.parse(o.body) : o.body;
    this.written_at =
      (["string", "number"].includes(typeof o.written_at)
        ? new Date(o.written_at as any)
        : o.written_at) || new Date();
    this.user_id = o.user_id;
    this.name = o.name;
    this.type = o.type;
  }

  /**
   * @param {object} lib_in
   */
  static async create(run_in: MetaDataCfg): Promise<MetaData> {
    const run = new MetaData(run_in);
    const id = await db.insert("_sc_metadata", run.toJson);
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
   * @returns {MetaData[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<MetaData[]> {
    const us = await db.select("_sc_metadata", where, selectopts);
    return us.map((u: any) => new MetaData(u));
  }

  /**
   * @param {*} where
   * @returns {MetaData}
   */
  static async findOne(where: Where): Promise<MetaData> {
    const u = await db.selectMaybeOne("_sc_metadata", where);
    return u ? new MetaData(u) : u;
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
    await db.query(`delete FROM ${schema}_sc_metadata WHERE id = $1`, [
      this.id,
    ]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */

  static async count(where?: Where): Promise<number> {
    return await db.count("_sc_metadata", where);
  }
}

export = MetaData;
