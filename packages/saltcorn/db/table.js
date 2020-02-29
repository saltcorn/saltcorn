const db = require(".");
const { sqlsanitize } = require("./internal.js");

class Table {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
  }
  static async find(where) {
    const tbl = await db.selectOne("tables", where);

    return new Table(tbl);
  }
  static async create(name) {
    await db.query(`create table ${sqlsanitize(name)} (id serial primary key)`);
    const {
      rows
    } = await db.query("insert into tables(name) values($1) RETURNING id", [
      name
    ]);
    return new Table({ name, id: rows[0].id });
  }
  async delete() {
    await db.query("delete FROM fields WHERE table_id = $1", [this.id]);

    await db.query("delete FROM tables WHERE id = $1 returning *", [this.id]);
    await db.query(`drop table ${sqlsanitize(this.name)}`);
  }
}
module.exports = Table;
