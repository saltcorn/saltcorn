const db = require("../db");
const { contract, is } = require("contractis");

class Trigger {
  constructor(o) {
    this.action = o.action;
    this.table_id = !o.table_id ? null : +o.table_id;
    this.table_name = o.table_name;
    this.when_trigger = o.when_trigger;
    this.id = !o.id ? null : +o.id;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration || {};

    contract.class(this);
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_triggers", where, selectopts);
    return db_flds.map((dbf) => new Trigger(dbf));
  }

  static async findAllWithTableName() {
    const sql = `select a.id, a.action, t.name as table_name, a. when_trigger from _sc_triggers a join _sc_tables t on t.id=table_id order by id`;
    const { rows } = await db.query(sql);
    return rows.map((dbf) => new Trigger(dbf));
  }

  static async findOne(where) {
    const p = await db.selectMaybeOne("_sc_triggers", where);
    return p ? new Trigger(p) : null;
  }

  static async update(id, row) {
    await db.update("_sc_triggers", row, id);
  }

  static async create(f) {
    const trigger = new Trigger(f);
    const { id, table_name, ...rest } = trigger;
    const fid = await db.insert("_sc_triggers", rest);
    trigger.id = fid;
    return trigger;
  }
  async delete() {
    await db.deleteWhere("_sc_triggers", { id: this.id });
  }

  static async runTableTriggers(when_trigger, table) {
    const { getState } = require("@saltcorn/data/db/state");

    const triggers = await Trigger.find({ when_trigger, table_id: table.id });
    for (const trigger of triggers) {
      const action = getState().actions[trigger.action];
      await action.run({ table, configuration: trigger.configuration });
    }
  }

  static get when_options() {
    return ["Insert", "Update", "Delete", "Weekly", "Daily", "Hourly", "Often"];
  }
}

Trigger.contract = {
  variables: {
    action: is.str,
    table_id: is.maybe(is.posint),
    when_trigger: is.one_of(Trigger.when_options),
    id: is.maybe(is.posint),
    configuration: is.obj(),
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Trigger")))
    ),
    create: is.fun(is.obj(), is.promise(is.class("Trigger"))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Trigger")))),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined)),
    runTableTriggers: is.fun(
      [is.one_of(Trigger.when_options), is.class("Table")],
      is.promise(is.undefined)
    ),
  },
};

module.exports = Trigger;
