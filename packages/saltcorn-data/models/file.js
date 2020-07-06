const db = require("../db");
const { contract, is } = require("contractis");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs").promises;

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
    contract.class(this);
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

  static get_new_path() {
    const file_store = db.connectObj.file_store;

    const newFnm = uuidv4();
    return path.join(file_store, newFnm);
  }
  static async from_req_files(file, user_id, min_role_read = 1) {
    
    const newPath = File.get_new_path()
    const [mime_super, mime_sub] = file.mimetype.split("/");
    await file.mv(newPath);
    return await File.create({
      filename: file.name,
      location: newPath,
      uploaded_at: new Date(),
      size_kb: Math.round(file.size / 1024),
      user_id,
      mime_super,
      mime_sub,
      min_role_read
    });
  }
  async delete() {
    await fs.unlink(this.location);
    await db.deleteWhere("_sc_files", { id: this.id });
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

File.contract = {
  variables: {
    filename: is.str,
    location: is.str,
    mime_super: is.str,
    mime_sub: is.str,
    uploaded_at: is.class("Date"),
    size_kb: is.posint,
    id: is.maybe(is.posint),
    user_id: is.posint,
    min_role_read: is.posint
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("File")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.class("File"))),
    create: is.fun(is.obj(), is.promise(is.class("File"))),
    from_req_files: is.fun(
      [is.obj(), is.posint, is.maybe(is.posint)],
      is.promise(is.class("File"))
    ),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined))
  }
};

module.exports = File;
