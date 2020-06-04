const db = require("../db");
const { contract, is } = require("contractis");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

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
    this.min_role_read = o.min_role_read;
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_files", where, selectopts);
    return db_flds.map(dbf => new File(dbf));
  }
  static async findOne(where) {
    const db_fld = await db.selectOne("_sc_files", where);
    return new File(db_fld);
  }
  static async update(id, row) {
    await db.update("_sc_files", row, id);
  }

  static async from_req_files(file, user_id) {
    const file_store = db.connectObj.file_store;

    const newFnm = uuidv4();
    const newPath = path.join(file_store, newFnm);
    const [mime_super, mime_sub] = file.mimetype.split("/");
    file.mv(newPath);
    return await File.create({
      filename: file.name,
      location: newPath,
      uploaded_at: new Date(),
      size_kb: Math.round(file.size / 1024),
      user_id,
      mime_super,
      mime_sub,
      min_role_read: 1
    });
  }
  get mimetype() {
    return `${this.mime_super}/${this.mime_sub}`;
  }
  static async create(f) {
    const file = new File(f);
    const { id, ...rest } = file;
    const fid = await db.insert("_sc_files", rest);
    file.id = fid;
    return file;
  }
}

module.exports = File;
