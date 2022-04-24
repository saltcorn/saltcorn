/**
 * Trigger Data Access Layer
 * @category saltcorn-data
 * @module models/trigger
 * @subcategory models
 */

import db = require("../db");
import EventLog from "./eventlog";
import Table from "./table";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type {
  TriggerCfg,
  AbstractTrigger,
} from "@saltcorn/types/model-abstracts/abstract_trigger";

const { satisfies } = require("../utils");

/**
 * Trigger class
 * @category saltcorn-data
 */
class Trigger implements AbstractTrigger {
  name?: string;
  action: string;
  description?: string;
  table_id?: number | null;
  table_name?: string;
  when_trigger: string;
  channel?: string;
  id?: number | null;
  configuration: any;
  min_role?: number | null;
  run?: (row: Row) => boolean;

  /**
   * Trigger constructor
   * @param {object} o
   */
  constructor(o: TriggerCfg) {
    this.name = o.name;
    this.action = o.action;
    this.description = o.description;
    this.table_id = !o.table_id ? null : +o.table_id;
    this.table_name = o.table_name;
    if (o.table) {
      this.table_id = o.table.id;
      this.table_name = o.table.name;
    }
    this.when_trigger = o.when_trigger;
    this.channel = o.channel;
    this.id = !o.id ? null : +o.id;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration || {};
    this.min_role = !o.min_role ? null : +o.min_role;
  }

  /**
   * Get JSON from Trigger
   * @type {{when_trigger, configuration: any, name, description, action}}
   */
  get toJson(): any {
    let table_name = this.table_name;
    if (!table_name && this.table_id) {
      const Table = require("./table");
      const table = Table.findOne(+this.table_id);
      table_name = table.name;
    }
    return {
      name: this.name,
      description: this.description,
      action: this.action,
      when_trigger: this.when_trigger,
      configuration: this.configuration,
      table_name,
      channel: this.channel,
      min_role: this.min_role,
    };
  }

  /**
   * Find triggers in State cache
   * @param where - condition
   * @returns {Trigger[]}
   */
  static find(where: Where): Trigger[] {
    const { getState } = require("../db/state");
    return getState().triggers.filter(satisfies(where));
  }

  /**
   * Find triggers in DB
   * @param where
   * @param selectopts
   * @returns {Promise<Trigger[]>}
   */
  static async findDB(
    where?: Where,
    selectopts?: SelectOptions
  ): Promise<Trigger[]> {
    const db_flds = await db.select("_sc_triggers", where, selectopts);
    return db_flds.map((dbf: TriggerCfg) => new Trigger(dbf));
  }

  /**
   * Find all triggers
   * @returns {Promise<Trigger[]>}
   */
  static async findAllWithTableName(): Promise<Trigger[]> {
    const schema = db.getTenantSchemaPrefix();

    const sql = `select a.id, a.name, a.action, t.name as table_name, a. when_trigger, a.channel, a.min_role 
    from ${schema}_sc_triggers a left join ${schema}_sc_tables t on t.id=table_id order by a.id`;
    const { rows } = await db.query(sql);
    return rows.map((dbf: any) => new Trigger(dbf));
  }

  /**
   * Find one trigger in State cache
   * @param where
   * @returns {Trigger}
   */
  static findOne(where: Where) {
    const { getState } = require("../db/state");
    return getState().triggers.find(
      where.id ? (v: Trigger) => v.id === +where.id : satisfies(where)
    );
  }

  /**
   * Update trigger
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_triggers", row, id);
    await require("../db/state").getState().refresh_triggers();
  }

  /**
   * Create trigger
   * @param f
   * @returns {Promise<Trigger>}
   */
  static async create(f: TriggerCfg): Promise<Trigger> {
    const trigger = new Trigger(f);
    const { id, table_name, ...rest } = trigger;
    if (table_name && !rest.table_id) {
      const Table = require("./table");
      const table = Table.findOne(table_name);
      rest.table_id = table.id;
    }
    const fid = await db.insert("_sc_triggers", rest);
    trigger.id = fid;
    await require("../db/state").getState().refresh_triggers();
    return trigger;
  }

  /**
   * Delete current trigger
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    await db.deleteWhere("_sc_triggers", { id: this.id });
    await require("../db/state").getState().refresh_triggers();
  }

  /**
   * Emit an event: run associated triggers
   * @param {*} eventType
   * @param {*} channel
   * @param {object} [userPW = {}]
   * @param {*} payload
   */
  static emitEvent(
    eventType: string,
    channel: string | null = null,
    userPW = {},
    payload?: any
  ): void {
    setTimeout(async () => {
      const { password, ...user }: any = userPW || {};
      const { getState } = require("../db/state");
      const findArgs: Where = { when_trigger: eventType };

      let table;
      if (channel && ["Insert", "Update", "Delete"].includes(channel)) {
        const Table = require("./table");
        table = await Table.findOne({ name: channel });
        findArgs.table_id = table.id;
      } else if (channel) findArgs.channel = channel;

      const triggers = await Trigger.find(findArgs);

      for (const trigger of triggers) {
        const action = getState().actions[trigger.action];
        action &&
          action.run &&
          (await action.run({
            table,
            channel,
            user,
            configuration: trigger.configuration,
            row: payload,
            ...(payload || {}),
          }));
      }
      EventLog.create({
        event_type: eventType,
        channel,
        user_id: (<any>(userPW || {})).id || null,
        payload,
        occur_at: new Date(),
      });
    }, 0);
  }

  /**
   * Run table triggers
   * @param when_trigger
   * @param table
   * @param row
   * @returns {Promise<void>}
   */
  static async runTableTriggers(
    when_trigger: string,
    table: Table,
    row: Row
  ): Promise<void> {
    const triggers = await Trigger.getTableTriggers(when_trigger, table);
    for (const trigger of triggers) {
      await trigger.run!(row); // getTableTriggers ensures run is set
    }
    EventLog.create({
      event_type: when_trigger,
      channel: table.name,
      user_id: null,
      payload: row,
      occur_at: new Date(),
    });
  }

  /**
   * Run trigger without row
   * @param runargs
   * @returns {Promise<boolean>}
   */
  async runWithoutRow(runargs = {}): Promise<boolean> {
    const { getState } = require("../db/state");
    const action = getState().actions[this.action];
    return (
      action &&
      action.run &&
      action.run({
        ...runargs,
        configuration: this.configuration,
      })
    );
  }

  /**
   * get triggers
   * @param when_trigger
   * @param table
   * @returns {Promise<Trigger[]>}
   */
  static async getTableTriggers(
    when_trigger: string,
    table: Table
  ): Promise<Trigger[]> {
    const { getState } = require("../db/state");

    const triggers = await Trigger.find({ when_trigger, table_id: table.id });
    for (const trigger of triggers) {
      const action = getState().actions[trigger.action];
      trigger.run = (row: Row) =>
        action &&
        action.run &&
        action.run({
          table,
          configuration: trigger.configuration,
          row,
          ...row,
        });
    }
    const virtual_triggers = getState().virtual_triggers.filter(
      (tr: Trigger) =>
        when_trigger === tr.when_trigger && tr.table_id == table.id
    );
    return [...triggers, ...virtual_triggers];
  }

  /**
   * Trigger when options
   * @type {string[]}
   */
  static get when_options(): string[] {
    const { getState } = require("../db/state");

    return [
      "Insert",
      "Update",
      "Delete",
      "Weekly",
      "Daily",
      "Hourly",
      "Often",
      "API call",
      "Never",
      "Login",
      "LoginFailed",
      "Error",
      "Startup",
      "UserVerified",
      ...Object.keys(getState().eventTypes),
    ];
  }
}
// todo clone trigger

export = Trigger;
