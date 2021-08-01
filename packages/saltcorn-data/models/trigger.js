/**
 *
 * Trigger Data Access Layer
 */

const db = require("../db");
const { contract, is } = require("contractis");
const { satisfies } = require("../utils");
const EventLog = require("./eventlog");

/**
 * Trigger class
 */
class Trigger {
  constructor(o) {
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

    contract.class(this);
  }

  /**
   * Get JSON from Trigger
   * @returns {{when_trigger, configuration: any, name, description, action}}
   */
  get toJson() {
    return {
      name: this.name,
      description: this.description,
      action: this.action,
      when_trigger: this.when_trigger,
      configuration: this.configuration,
      table_id: this.table_id,
      channel: this.channel,
    };
  }

  /**
   * Find triggers in State cache
   * @param where - condition
   * @returns {T[]}
   */
  static find(where) {
    const { getState } = require("../db/state");
    return getState().triggers.filter(satisfies(where));
  }

  /**
   * Find triggers in DB
   * @param where
   * @param selectopts
   * @returns {Promise<*>}
   */
  static async findDB(where, selectopts) {
    const db_flds = await db.select("_sc_triggers", where, selectopts);
    return db_flds.map((dbf) => new Trigger(dbf));
  }

  /**
   * Find all triggers
   * @returns {Promise<*>}
   */
  static async findAllWithTableName() {
    const schema = db.getTenantSchemaPrefix();

    const sql = `select a.id, a.name, a.action, t.name as table_name, a. when_trigger, a.channel 
    from ${schema}_sc_triggers a left join ${schema}_sc_tables t on t.id=table_id order by a.id`;
    const { rows } = await db.query(sql);
    return rows.map((dbf) => new Trigger(dbf));
  }

  /**
   * Find one trigger in State cache
   * @param where
   * @returns {T}
   */
  static findOne(where) {
    const { getState } = require("../db/state");
    return getState().triggers.find(
      where.id ? (v) => v.id === +where.id : satisfies(where)
    );
  }

  /**
   * Update trigger
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id, row) {
    await db.update("_sc_triggers", row, id);
    await require("../db/state").getState().refresh_triggers();
  }

  /**
   * Create trigger
   * @param f
   * @returns {Promise<Trigger>}
   */
  static async create(f) {
    const trigger = new Trigger(f);
    const { id, table_name, ...rest } = trigger;
    const fid = await db.insert("_sc_triggers", rest);
    trigger.id = fid;
    await require("../db/state").getState().refresh_triggers();
    return trigger;
  }

  /**
   * Delete current trigger
   * @returns {Promise<void>}
   */
  async delete() {
    await db.deleteWhere("_sc_triggers", { id: this.id });
    await require("../db/state").getState().refresh_triggers();
  }

  // Emit an event: run associated triggers
  static async emitEvent(eventType, channel, userPW = {}, payload) {
    const { password, ...user } = userPW || {};
    const { getState } = require("../db/state");
    const findArgs = { when_trigger: eventType };

    let table;
    if (["Insert", "Update", "Delete"].includes(channel)) {
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
      user_id: (userPW || {}).id || null,
      payload,
      occur_at: new Date(),
    });
  }

  /**
   * Run table triggers
   * @param when_trigger
   * @param table
   * @param row
   * @returns {Promise<void>}
   */
  static async runTableTriggers(when_trigger, table, row) {
    const triggers = await Trigger.getTableTriggers(when_trigger, table);
    for (const trigger of triggers) {
      await trigger.run(row);
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
   * @returns {Promise<*>}
   */
  async runWithoutRow(runargs = {}) {
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
   * @returns {Promise<*>}
   */
  static async getTableTriggers(when_trigger, table) {
    const { getState } = require("../db/state");

    const triggers = await Trigger.find({ when_trigger, table_id: table.id });
    for (const trigger of triggers) {
      const action = getState().actions[trigger.action];
      trigger.run = (row) =>
        action &&
        action.run &&
        action.run({
          table,
          configuration: trigger.configuration,
          row,
          ...row,
        });
    }
    return triggers;
  }

  /**
   *  Trigger when options
   * @returns {string[]}
   */
  static get when_options() {
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
      ...Object.keys(getState().eventTypes),
    ];
  }
}
// todo clone trigger
/**
 * Trigger contract
 * @type {{variables: {when_trigger: ((function(*=): *)|*), configuration: ((function(*=): *)|*), name: ((function(*=): *)|*), action: ((function(*=): *)|*), id: ((function(*=): *)|*), table_id: ((function(*=): *)|*)}, methods: {delete: ((function(*=): *)|*)}, static_methods: {find: ((function(*=): *)|*), findOne: ((function(*=): *)|*), create: ((function(*=): *)|*), update: ((function(*=): *)|*), getTableTriggers: ((function(*=): *)|*), runTableTriggers: ((function(*=): *)|*)}}}
 */
Trigger.contract = {
  variables: {
    action: is.str,
    table_id: is.maybe(is.posint),
    name: is.maybe(is.str),
    when_trigger: is.str,
    id: is.maybe(is.posint),
    configuration: is.obj(),
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.array(is.class("Trigger"))
    ),
    create: is.fun(is.obj(), is.promise(is.class("Trigger"))),
    findOne: is.fun(is.obj(), is.maybe(is.class("Trigger"))),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined)),
    runTableTriggers: is.fun(
      [is.str, is.class("Table"), is.obj({})],
      is.promise(is.undefined)
    ),
    getTableTriggers: is.fun(
      [is.str, is.class("Table")],
      is.promise(
        is.array(is.obj({ action: is.str, run: is.fun(is.obj({}), is.any) }))
      )
    ),
  },
};

module.exports = Trigger;
