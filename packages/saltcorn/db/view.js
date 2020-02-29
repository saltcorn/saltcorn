const db = require(".");
const { sqlsanitize } = require("./internal.js");

class View {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    this.viewtemplate = o.viewtemplate;
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
    this.configuration = o.configuration;
  }
  static async findOne(where) {
    const v = await db.selectOne("views", where);

    return new View(v);
  }
  static async find(where) {
    const views = await db.select("views", where);

    return views.map(v => new View(v));
  }

  static async create(v) {
    const id = await db.insert("views", v);

    return new View({ id, ...v });
  }
  async delete() {
    await db.query("delete FROM views WHERE id = $1", [this.id]);
  }
}
module.exports = View;
