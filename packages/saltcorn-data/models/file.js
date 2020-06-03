const db = require("../db");
const { contract, is } = require("contractis");

class File {
  constructor(o) {
    this.filename = o.filename;
    this.location = o.location;
    this.uploaded_at = o.uploaded_at;
    this.size_kb = o.size_kb;
    this.id = o.id;
    this.user_id = o.user_id;
    this.mime_super = o.mime_super;
    this.mime_sub = o.mime_sub;
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_files", where, selectopts);
    return db_flds.map(dbf => new File(dbf));
  }
  static async findOne(where) {
    const db_fld = await db.selectOne("_sc_files", where);
    return new File(db_fld);
  }
}

module.exports = File;
