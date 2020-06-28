const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");

class Page {
  constructor(o) {
    this.name = o.name;
    this.title = o.title;
    this.description = o.description;
    this.min_role = o.min_role;
    this.id = o.id;
    this.layout = o.layout;
    this.fixed_states = o.fixed_states;
    contract.class(this);
  }
  static async find(where, selectopts) {
    const db_flds = await db.select("_sc_pages", where, selectopts);
    return db_flds.map(dbf => new Page(dbf));
  }

  static async findOne(where) {
    const p = await db.selectMaybeOne("_sc_pages", where);
    return p ? new Page(p) : null;
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

  async eachView(f) {
    const go = async segment => {
      if (!segment) return;
      if (segment.type === "view") {
        await f(segment)
        return;
      }
      if (segment.contents) {
        if (typeof contents !== "string") await go(segment.contents);
        return;
      }
      if (segment.above) {
        for (const seg of segment.above) await go(seg);
        return;
      }
      if (segment.besides) {
        for (const seg of segment.besides) await go(seg);
        return;
      }
    };
    await go(this.layout);    
  }

  async getViews() {
    const views=[];
    await this.eachView(segment=>{
      views.push(segment)
    })
    return views
  }

  async run(querystate, extraArgs) {
    await this.eachView(async segment=>{
        const view = await View.findOne({ name: segment.view });
        const mystate = view.combine_state_and_default_state(querystate);
        segment.contents = await view.run(mystate, extraArgs);
    })
    return this.layout;
  }
}

Page.contract = {
  variables: {
    name: is.str,
    title: is.str,
    description: is.str,
    id: is.maybe(is.posint),
    min_role: is.posint,
    layout: is.obj(),
    fixed_states: is.obj()
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Page")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Page")))),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined))
  }
};

module.exports = Page;
