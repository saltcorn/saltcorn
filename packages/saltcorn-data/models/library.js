const db = require("../db");
const { contract, is } = require("contractis");

class Library {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.icon = o.icon;
    this.layout =
      typeof o.layout === "string" ? JSON.parse(o.layout) : o.layout;
  }
  static async create(lib_in) {
    const lib = new Library(lib_in);
    await db.insert("_sc_library", {
      name: lib.name,
      icon: lib.icon,
      layout: lib.layout,
    });
  }

  static async find(where, selectopts) {
    const us = await db.select("_sc_library", where, selectopts);
    return us.map((u) => new Library(u));
  }
  static async findOne(where) {
    const u = await db.selectMaybeOne("_sc_library", where);
    return u ? new Library(u) : u;
  }

  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_library WHERE id = $1`, [this.id]);
  }

  async update(row) {
    await db.update("_sc_library", row, this.id);
  }
}

module.exports = Library;
