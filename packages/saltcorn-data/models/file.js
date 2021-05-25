const db = require("../db");
const { contract, is } = require("contractis");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { asyncMap } = require("../utils");
const fs = require("fs").promises;

class File {
  constructor(o) {
    this.filename = o.filename;
    this.location = o.location;
    this.uploaded_at = ["string", "number"].includes(typeof o.uploaded_at)
      ? new Date(o.uploaded_at)
      : o.uploaded_at;
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
    return db_flds.map((dbf) => new File(dbf));
  }

  static async findOne(where) {
    if (where.id) {
      const { getState } = require("../db/state");
      const f = getState().files[where.id];
      if (f) return new File(f);
    }
    const f = await db.selectMaybeOne("_sc_files", where);
    return f ? new File(f) : null;
  }

  static async update(id, row) {
    await db.update("_sc_files", row, id);
    await require("../db/state").getState().refresh_files();
  }

  static get_new_path(suggest) {
    const file_store = db.connectObj.file_store;

    const newFnm = suggest || uuidv4();
    return path.join(file_store, newFnm);
  }

  static async ensure_file_store() {
    const file_store = db.connectObj.file_store;
    await fs.mkdir(file_store, { recursive: true });
  }

  static async from_req_files(file, user_id, min_role_read = 1) {
    if (Array.isArray(file)) {
      return await asyncMap(file, (f) =>
        File.from_req_files(f, user_id, min_role_read)
      );
    } else {
      const newPath = File.get_new_path();
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
        min_role_read,
      });
    }
  }
  async delete() {
    try {
      await db.deleteWhere("_sc_files", { id: this.id });
      await fs.unlink(this.location);
      await require("../db/state").getState().refresh_files();
    } catch (e) {
      return { error: e.message };
    }
  }
  get mimetype() {
    return `${this.mime_super}/${this.mime_sub}`;
  }
  static async create(f) {
    const file = new File(f);
    const { id, ...rest } = file;
    const fid = await db.insert("_sc_files", rest);
    file.id = fid;
    await require("../db/state").getState().refresh_files();

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
    user_id: is.maybe(is.posint),
    min_role_read: is.posint,
  },
  methods: {
    delete: is.fun(
      [],
      is.promise(is.or(is.obj({ error: is.str }), is.undefined))
    ),
    mimetype: is.getter(is.str),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("File")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("File")))),
    create: is.fun(is.obj(), is.promise(is.class("File"))),
    from_req_files: is.fun(
      [
        is.or(is.obj(), is.array(is.obj())),
        is.maybe(is.posint),
        is.maybe(is.posint),
      ],
      is.promise(is.or(is.class("File"), is.array(is.class("File"))))
    ),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined)),
    ensure_file_store: is.fun([], is.promise(is.undefined)),
    get_new_path: is.fun(is.maybe(is.str), is.str),
  },
};

module.exports = File;
