const db = require("../db");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("../db/internal.js");
const Field = require("./field");
const { contract, is } = require("contractis");

class Table {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    contract.class(this);
  }
  static async findOne(where) {
    const tbl = await db.selectOne("tables", where);

    return new Table(tbl);
  }
  static async find(where) {
    const tbls = await db.select("tables", where);

    return tbls.map(t => new Table(t));
  }
  static async create(name) {
    await db.query(`create table ${sqlsanitize(name)} (id serial primary key)`);
    const id = await db.insert("tables", { name });
    return new Table({ name, id });
  }
  async delete() {
    await db.query("delete FROM fields WHERE table_id = $1", [this.id]);

    await db.query("delete FROM tables WHERE id = $1", [this.id]);
    await db.query(`drop table ${sqlsanitize(this.name)}`);
  }

  async deleteRows(where) {
    await db.deleteWhere(this.name, where);
  }

  async getRow(where) {
    return await db.selectOne(this.name, where);
  }

  async getRows(where, selopts) {
    return await db.select(this.name, where, selopts);
  }
  async countRows(where) {
    return await db.count(this.name, where);
  }
  async updateRow(v, id) {
    return await db.update(this.name, v, id);
  }

  async insertRow(v) {
    return await db.insert(this.name, v);
  }

  async getFields() {
    if (!this.fields) this.fields = await Field.find({ table_id: this.id });
    return this.fields;
  }

  static async rename(id, new_name) {
    //TODO RENAME TABLE
    await db.query("update tables set name=$1 where id=$2", [new_name, id]);
  }

  async get_parent_relations() {
    const fields = await this.getFields();
    var parent_relations = [];
    var parent_field_list = [];
    for (const f of fields) {
      if (f.is_fkey) {
        const table = await Table.findOne({ name: f.reftable_name });
        await table.getFields();
        table.fields.forEach(pf => {
          parent_field_list.push(`${f.name}.${pf.name}`);
        });
        parent_relations.push({ key_field: f, table });
      }
    }
    return { parent_relations, parent_field_list };
  }

  async get_child_relations() {
    const cfields = await Field.find({ reftable_name: this.name });
    var child_relations = [];
    var child_field_list = [];
    for (const f of cfields) {
      if (f.is_fkey) {
        const table = await Table.findOne({ id: f.table_id });
        child_field_list.push(`${table.name}.${f.name}`);
        await table.getFields();
        child_relations.push({ key_field: f, table });
      }
    }
    return { child_relations, child_field_list };
  }
  async getJoinedRows(opts = {}) {
    const fields = await this.getFields();
    var fldNms = ["a.id"];
    var joinq = "";
    var joinTables = [];
    var joinFields = opts.joinFields || [];

    fields
      .filter(f => f.is_fkey)
      .forEach(f => {
        joinFields[f.name] = {
          ref: f.name,
          reftable: f.reftable_name,
          target: f.attributes.summary_field || "id"
        };
      });

    Object.entries(joinFields).forEach(([fldnm, { ref, target }]) => {
      const reftable = fields.find(f => f.name === ref).reftable_name;
      const jtNm = `${reftable}_jt_${ref}`;
      if (!joinTables.includes(jtNm)) {
        joinTables.push(jtNm);
        joinq += ` left join ${sqlsanitize(reftable)} ${sqlsanitize(
          jtNm
        )} on ${sqlsanitize(jtNm)}.id=a.${sqlsanitize(ref)}`;
      }
      fldNms.push(`${jtNm}.${target} as ${fldnm}`);
    });
    for (const f of fields) {
      if (!f.is_fkey) {
        fldNms.push(`a.${f.name}`);
      }
    }
    Object.entries(opts.aggregations || {}).forEach(
      ([fldnm, { table, ref, field, aggregate }]) => {
        fldNms.push(
          `(select ${sqlsanitize(aggregate)}(${sqlsanitize(field) ||
            "*"}) from ${sqlsanitize(table)} where ${sqlsanitize(
            ref
          )}=a.id) ${sqlsanitize(fldnm)}`
        );
      }
    );

    var whereObj = {};
    if (opts.where) {
      Object.keys(opts.where).forEach(k => {
        whereObj["a." + k] = opts.where[k];
      });
    }
    const { where, values } = mkWhere(whereObj);
    const selectopts = {
      limit: opts.limit,
      orderBy: opts.orderBy,
      orderDesc: opts.orderDesc,
      offset: opts.offset
    };
    const sql = `SELECT ${fldNms.join()} FROM ${sqlsanitize(
      this.name
    )} a ${joinq} ${where}  ${mkSelectOptions(selectopts)}`;
    //console.log(sql);
    const { rows } = await db.query(sql, values);

    return rows;
  }
}

Table.contract = {
  constructs: { name: is.str },
  variables: { name: is.str },
  methods: {
    delete: is.fun([], is.promise(is.eq(undefined))),
    deleteRows: is.fun(is.obj(), is.promise(is.eq(undefined))),
    getRow: is.fun(is.obj(), is.promise(is.obj())),
    getRows: is.fun(is.maybe(is.obj()), is.promise(is.array(is.obj()))),
    countRows: is.fun(is.maybe(is.obj()), is.promise(is.posint)),
    updateRow: is.fun([is.obj(), is.positive], is.promise(is.eq(undefined))),
    insertRow: is.fun(is.obj(), is.promise(is.posint)),
    getFields: is.fun([], is.promise(is.array(is.class("Field")))),
    get_parent_relations: is.fun(
      [],
      is.promise(
        is.obj({
          parent_relations: is.array(
            is.obj({
              key_field: is.class("Field"),
              table: is.class("Table")
            })
          ),
          parent_field_list: is.array(is.str)
        })
      )
    ),
    get_child_relations: is.fun(
      [],
      is.promise(
        is.obj({
          child_relations: is.array(
            is.obj({
              key_field: is.class("Field"),
              table: is.class("Table")
            })
          ),
          child_field_list: is.array(is.str)
        })
      )
    ),
    getJoinedRows: is.fun(
      is.maybe(
        is.obj({
          joinFields: is.maybe(
            is.objVals(is.obj({ ref: is.str, target: is.str }))
          ),
          aggregations: is.maybe(
            is.objVals(
              is.obj({
                ref: is.str,
                table: is.str,
                field: is.str,
                aggregate: is.str
              })
            )
          ),
          where: is.maybe(is.obj()),
          limit: is.maybe(is.positive),
          offset: is.maybe(is.positive),
          orderBy: is.maybe(is.str),
          orderDesc: is.maybe(is.bool)
        })
      ),
      is.promise(is.array(is.obj({})))
    )
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("Table")))),
    findOne: is.fun(is.obj(), is.promise(is.class("Table"))),
    create: is.fun(is.str, is.promise(is.class("Table"))),
    rename: is.fun([is.posint, is.str], is.promise(is.eq(undefined)))
  }
};
module.exports = Table;
