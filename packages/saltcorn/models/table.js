const db = require("../db");
const { sqlsanitize, mkWhere } = require("../db/internal.js");
const Field = require("./field");

class Table {
  constructor(o) {
    this.name = o.name;
    this.summary_field = o.summary_field;
    this.id = o.id;
  }
  static async find(where) {
    const tbl = await db.selectOne("tables", where);

    return new Table(tbl);
  }
  static async create(name, summary_field) {
    await db.query(`create table ${sqlsanitize(name)} (id serial primary key)`);
    const id = await db.insert("tables", { name, summary_field });
    return new Table({ name, id, summary_field });
  }
  async delete() {
    await db.query("delete FROM fields WHERE table_id = $1", [this.id]);

    await db.query("delete FROM tables WHERE id = $1", [this.id]);
    await db.query(`drop table ${sqlsanitize(this.name)}`);
  }
  async getFields() {
    if (!this.fields) this.fields = await Field.get_by_table_id(this.id);
    return this.fields;
  }
  async getJoinedRows(whereObj) {
    const fields = await this.getFields();
    var joinTables = [];
    var fldNms = ["a.id"];
    var joinq = "";
    for (const f of fields) {
      if (f.is_fkey) {
        const table = await db.get_table_by_name(f.reftable);
        joinTables.push({ table: f.reftable, field: f.name });
        joinq += ` left join ${f.reftable} ${f.reftable}_${f.name} on ${f.reftable}_${f.name}.id=a.${f.name}`;
        fldNms.push(
          `${f.reftable}_${f.name}.${table.summary_field || "id"} as ${f.name}`
        );
      } else {
        fldNms.push(`a.${f.name}`);
      }
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
