const db = require("../db");
const { contract, is } = require("contractis");

class Page {
  constructor(o) {
    this.name = o.name;
    this.title = o.title;
    this.description = o.description;
    this.min_role = o.min_role;
    this.id = o.id;
    this.layout = o.layout;
    contract.class(this);
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_pages", where, selectopts);
    return db_flds.map(dbf => new Page(dbf));
  }

  static async findOne(where) {
    const db_fld = await db.selectOne("_sc_pages", where);
    return new Page(db_fld);
  }

  static async update(id, row) {
    await db.update("_sc_pages", row, id);
  }

  static async create(f) {
    const page = new Page(f);
    const { id, ...rest } = page;
    const fid = await db.insert("_sc_pages", rest);
    page.id = fid;
    return page;
  }
}

Page.contract = {
  variables: {
    name: is.str,
    title: is.str,
    description: is.description,
    id: is.maybe(is.posint),
    min_role: is.posint,
    layout: is.obj()
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Page")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.class("Page"))),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined))
  }
};

module.exports = Page;
