const db = require("../db");
const { sqlsanitize, mkWhere } = require("../db/internal.js");
const Field = require("./field");

class Table {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
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

  async getRows(where) {
    return await db.select(this.name, where);
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
  async getJoinedRows(whereObj1) {
    const fields = await this.getFields();
    var joinTables = [];
    var fldNms = ["a.id"];
    var joinq = "";
    for (const f of fields) {
      if (f.is_fkey) {
        joinTables.push({ table: f.reftable, field: f.name });
        joinq += ` left join ${f.reftable} ${f.reftable}_${f.name} on ${f.reftable}_${f.name}.id=a.${f.name}`;
        fldNms.push(
          `${f.reftable}_${f.name}.${f.attributes.summary_field || "id"} as ${
            f.name
          }`
        );
      } else {
        fldNms.push(`a.${f.name}`);
      }
    }

    var whereObj = {};
    if (whereObj1) {
      Object.keys(whereObj1).forEach(k => {
        whereObj["a." + k] = whereObj1[k];
      });
    }
    const { where, values } = mkWhere(whereObj);

    const sql = `SELECT ${fldNms.join()} FROM ${sqlsanitize(
      this.name
    )} a ${joinq} ${where}`;
    //console.log(sql)
    const { rows } = await db.query(sql, values);

    return rows;
  }
}
module.exports = Table;
