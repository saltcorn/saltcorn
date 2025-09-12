/**
 * Crash Database Access Layer
 * @category saltcorn-data
 * @module models/crash
 * @subcategory models
 */
import db from "../db";
import moment from "moment";
import type {
  PartialSome,
  SelectOptions,
  Where,
} from "@saltcorn/db-common/internal";

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
      body: req.body || {} ? { body: req.body || {} } : null,
      url: req.url,
      headers: req.headers,
    };
    const { getState, getRootState } = require("../db/state");
    const tenants_crash_log = getRootState().getConfig("tenants_crash_log");

    getState().log(1, `ERROR: ${err.stack || err.message}`);
    if (tenants_crash_log) {
      await db.insert("_sc_errors", payload);
    } else {
      await db.runWithTenant(db.connectObj.default_schema, async () => {
        await db.insert("_sc_errors", payload);
      });
    }
    const Trigger = (await import("./trigger")).default;

    Trigger.emitEvent("Error", null, req.user, payload);
  }
}

type CrashCfg = PartialSome<
  Crash,
  "stack" | "message" | "tenant" | "url" | "occur_at" | "headers"
>;

export = Crash;
