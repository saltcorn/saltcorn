/**
 * EventLog Database Access Layer
 * @category saltcorn-data
 * @module models/eventlog
 * @subcategory models
 */

import db from "../db";
import type { Where, SelectOptions } from "@saltcorn/db-common/internal";
import moment from "moment";

/**
 * EventLog Class
 * @category saltcorn-data
 */
class EventLog {
  id?: number;
  event_type: string;
  channel?: string | null;
  occur_at: Date;
  user_id?: number | null;
  payload?: any;
  email?: string;

  /**
   * EventLog constructor
   * @param {object} o
   */
  constructor(o: EventLogCfg) {
    this.id = o.id;
    this.event_type = o.event_type;
    this.channel = o.channel;
    this.occur_at = ["string", "number"].includes(typeof o.occur_at)
      ? new Date(o.occur_at)
      : o.occur_at;
    this.user_id = o.user_id;
    this.payload =
      typeof o.payload === "string" ? JSON.parse(o.payload) : o.payload;
  }

  /**
   * @param {object} where
   * @param {object} selopts
   * @returns {Promise<EventLog[]>}
   */
  static async find(
    where: Where,
    selopts?: SelectOptions
  ): Promise<EventLog[]> {
    const us = await db.select("_sc_event_log", where, selopts);
    return us.map((u: EventLogCfg) => new EventLog(u));
  }

  /**
   * @param {object} where
   * @returns {Promise<EventLog>}
   */
  static async findOne(where: Where): Promise<EventLog> {
    const u = await db.selectOne("_sc_event_log", where);
    return new EventLog(u);
  }

  /**
   * @param {number} id
   * @returns {Promise<EventLog>}
   */
  static async findOneWithUser(id: number): Promise<EventLog> {
    const schema = db.getTenantSchemaPrefix();
    const {
      rows,
    } = await db.query(
      `select el.*, u.email from ${schema}_sc_event_log el left join ${schema}users u on el.user_id = u.id where el.id = $1`,
      [id]
    );
    const u = rows[0];
    const el = new EventLog(u);
    el.email = u.email;
    return el;
  }

  /**
   * @param {object} where
   * @returns {Promise<number>}
   */
  static async count(where: Where): Promise<number> {
    return await db.count("_sc_event_log", where || {});
  }

  /**
   * @type {string}
   */
  get reltime(): string {
    return moment(this.occur_at).fromNow();
  }

  /**
   * @param {object} o
   * @returns {Promise<EventLog>}
   */
  static async create(o: EventLogCfg): Promise<EventLog | void> {
    const { getState } = require("../db/state");

    const settings = getState().getConfig("event_log_settings", {});
    if (!settings[o.event_type]) return;
    const hasTable = EventLog.hasTable(o.event_type);
    if (hasTable && !settings[`${o.event_type}_${o.channel}`]) return;
    const hasChannel = EventLog.hasChannel(o.event_type);
    if (hasChannel && settings[`${o.event_type}_channel`]) {
      const wantChannels = settings[`${o.event_type}_channel`]
        .split(",")
        .map((s: string) => s.trim());
      if (!wantChannels.includes(o.channel)) return;
    }
    const ev = new EventLog(o);
    const { id, ...rest } = ev;

    ev.id = await db.insert("_sc_event_log", rest);
    return ev;
  }

  /**
   * @param {string} evType
   * @returns {boolean}
   */
  static hasTable(evType: string): boolean {
    return ["Insert", "Update", "Delete"].includes(evType);
  }

  /**
   * @param {string} evType
   * @returns {boolean}
   */
  static hasChannel(evType: string): boolean {
    const { getState } = require("../db/state");
    const t = getState().eventTypes[evType];
    return t && t.hasChannel;
  }
}

namespace EventLog {
  export type EventLogCfg = {
    id?: number;
    event_type: string;
    channel?: string | null;
    occur_at: Date;
    user_id?: number | null;
    payload?: any | null;
  };
}
type EventLogCfg = EventLog.EventLogCfg;

export = EventLog;
