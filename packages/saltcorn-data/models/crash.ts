/**
 * Crash Database Access Layer
 * @category saltcorn-data
 * @module models/crash
 * @subcategory models
 */
import db from "../db";
import moment from "moment";
import type { SelectOptions, Where } from "@saltcorn/db-common/internal";

/**
 * Crash Class
 * @category saltcorn-data
 */
class Crash {
  id?: number;
  user_id?: number;
  stack: string;
  message: string;
  tenant: string;
  url: string;
  occur_at: Date;
  headers: any;
  body?: any;

  /**
   * Crash constructor
   * @param {object} o
   */
  constructor(o: CrashCfg) {
    this.id = o.id;
    this.stack = o.stack;
    this.message = o.message;
    this.occur_at =
      typeof o.occur_at === "string" || typeof o.occur_at === "number"
        ? new Date(o.occur_at)
        : o.occur_at;
    this.tenant = o.tenant;
    this.user_id = o.user_id;
    this.body = o.body;
    this.url = o.url;
    this.headers =
      typeof o.headers === "string" ? JSON.parse(o.headers) : o.headers;
  }

  /**
   * @param {object} where
   * @param {object} selopts
   * @returns {Promise<Crash[]>}
   */
  static async find(
    where?: Where,
    selopts: SelectOptions = {}
  ): Promise<Array<Crash>> {
    const us = await db.select("_sc_errors", where, selopts);
    return us.map((u: CrashCfg) => new Crash(u));
  }

  /**
   * @param {object} where
   * @returns {Promise<Crash>}
   */
  static async findOne(where: Where): Promise<Crash> {
    const u = await db.selectOne("_sc_errors", where);
    return new Crash(u);
  }

  /**
   * @type {string}
   */
  get reltime(): string {
    return moment(this.occur_at).fromNow();
  }

  /**
   * @param {object} where
   * @returns {Promise<number>}
   */
  static async count(where: Where): Promise<number> {
    return await db.count("_sc_errors", where || {});
  }

  /**
   * @type {string}
   */
  get msg_short(): string {
    return this.message.length > 90
      ? this.message.substring(0, 90)
      : this.message;
  }

  /**
   * @param {object} err
   * @param {object} [req = {}]
   * @returns {Promise<void>}
   */
  static async create(err: any, req: any = {}): Promise<void> {
    const schema = db.getTenantSchema();
    const payload = {
      stack: err.stack,
      message: err.message,
      occur_at: new Date(),
      tenant: schema,
      user_id: req.user ? req.user.id : null,
      body: req.body ? { body: req.body } : null,
      url: req.url,
      headers: req.headers,
    };
    await db.runWithTenant(db.connectObj.default_schema, async () => {
      await db.insert("_sc_errors", payload);
    });
    const Trigger = (await import("./trigger")).default;

    Trigger.emitEvent("Error", null, req.user, payload);
  }
}

namespace Crash {
  export type CrashCfg = {
    id?: number;
    user_id?: number;
    stack: string;
    message: string;
    tenant: string;
    url: string;
    occur_at: number | string | Date;
    headers: string | any;
    body?: any;
  };
}
type CrashCfg = Crash.CrashCfg;

export = Crash;
