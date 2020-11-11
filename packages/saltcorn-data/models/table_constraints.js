const db = require("../db");
const { contract, is } = require("contractis");

class TableConstraint {
  constructor(o) {
    this.table_id = +o.table_id;
    this.type = o.type;
    this.id = !o.id ? null : +o.id;
    this.configuration =
      typeof o.configuration === "string"
        ? JSON.parse(o.configuration)
        : o.configuration || {};

    contract.class(this);
  }

  get toJson() {
    return {
      action: this.action,
      when_trigger: this.when_trigger,
      configuration: this.configuration,
    };
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_table_constraints", where, selectopts);
    return db_flds.map((dbf) => new TableConstraint(dbf));
  }

  static async findOne(where) {
    const p = await db.selectMaybeOne("_sc_table_constraints", where);
    return p ? new TableConstraint(p) : null;
  }

  static async create(f) {
    const con = new TableConstraint(f);
    const { id, ...rest } = con;
    const fid = await db.insert("_sc_table_constraints", rest);
    con.id = fid;
    if (con.type === "Unique" && con.configuration.fields) {
      const Table = require("./table");
      const table = await Table.findOne({ id: con.table_id });
      await db.add_unique_constraint(table.name, con.configuration.fields);
    }

    return con;
  }
  async delete() {
    await db.deleteWhere("_sc_table_constraints", { id: this.id });
    if (this.type === "Unique" && this.configuration.fields) {
      const Table = require("./table");
      const table = await Table.findOne({ id: this.table_id });
      await db.drop_unique_constraint(table.name, this.configuration.fields);
    }
  }

  static get type_options() {
    return [
      "Unique",
      /*"Weekly", "Daily", "Hourly", "Often"*/
      ,
    ];
  }
}

TableConstraint.contract = {
  variables: {
    table_id: is.maybe(is.posint),
    type: is.one_of(TableConstraint.type_options),
    id: is.maybe(is.posint),
    configuration: is.obj(),
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("TableConstraint")))
    ),
    create: is.fun(is.obj(), is.promise(is.class("TableConstraint"))),
    findOne: is.fun(
      is.obj(),
      is.promise(is.maybe(is.class("TableConstraint")))
    ),
  },
};

module.exports = TableConstraint;
