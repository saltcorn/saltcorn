/**
 * Page Data Access Layer
 */

const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");
const { eachView, traverseSync, getStringsForI18n } = require("./layout");
const { div } = require("@saltcorn/markup/tags");
const { remove_from_menu } = require("./config");
const { action_link } = require("../base-plugin/viewtemplates/viewable_fields");
const {
  InvalidConfiguration,
  satisfies,
  structuredClone,
} = require("../utils");

/**
 * Page Class
 */
class Page {
  constructor(o) {
    this.name = o.name;
    this.title = o.title;
    this.description = o.description;
    this.min_role = +o.min_role;
    this.id = o.id;
    this.layout =
      typeof o.layout === "string" ? JSON.parse(o.layout) : o.layout;
    this.fixed_states =
      typeof o.fixed_states === "string"
        ? JSON.parse(o.fixed_states)
        : o.fixed_states || {};
    contract.class(this);
  }

  /**
   * Find pages in DB
   * @param where
   * @param selectopts
   * @returns {Promise<*>}
   */
  static async find(where, selectopts = { orderBy: "name", nocase: true }) {
    const db_flds = await db.select("_sc_pages", where, selectopts);
    return db_flds.map((dbf) => new Page(dbf));
  }

  /**
   * Find one page
   * @param where
   * @returns {Promise<Page|*>}
   */
  static async findOne(where) {
    const { getState } = require("../db/state");
    const p = getState().pages.find(
      where.id
        ? (v) => v.id === +where.id
        : where.name
        ? (v) => v.name === where.name
        : satisfies(where)
    );
    return p
      ? new Page({
          ...p,
          layout: structuredClone(p.layout),
          fixed_states: structuredClone(p.fixed_states),
        })
      : p;
  }

  /**
   * Update page
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id, row) {
    await db.update("_sc_pages", row, id);
    await require("../db/state").getState().refresh_pages();
  }
  getStringsForI18n() {
    return getStringsForI18n(this.layout);
  }
  /**
   * Create page
   * @param f
   * @returns {Promise<Page>}
   */
  static async create(f) {
    const page = new Page(f);
    const { id, ...rest } = page;
    const fid = await db.insert("_sc_pages", rest);
    page.id = fid;
    await require("../db/state").getState().refresh_pages();

    return page;
  }

  /**
   * Delete current page
   * @returns {Promise<void>}
   */
  async delete() {
    await db.deleteWhere("_sc_pages", { id: this.id });
    const root_page_for_roles = await this.is_root_page_for_roles();
    for (const role of root_page_for_roles) {
      const { getState } = require("../db/state");
      await getState().setConfig(role + "_home", "");
    }
    await remove_from_menu({ name: this.name, type: "Page" });
    await require("../db/state").getState().refresh_pages();
  }

  /**
   * Is root page for role
   * @returns {Promise<*>}
   */
  async is_root_page_for_roles() {
    const User = require("./user");
    const { getState } = require("../db/state");

    const roles = await User.get_roles();
    return roles
      .filter((r) => getState().getConfig(r.role + "_home", "") === this.name)
      .map((r) => r.role);
  }

  /**
   * get menu label for page
   * @returns {*|undefined}
   */
  get menu_label() {
    const { getState } = require("../db/state");
    const menu_items = getState().getConfig("menu_items", []);
    const item = menu_items.find((mi) => mi.pagename === this.name);
    return item ? item.label : undefined;
  }

  /**
   * Clone page
   * @returns {Promise<Page>}
   */
  async clone() {
    const basename = this.name + " copy";
    let newname;
    for (let i = 0; i < 100; i++) {
      newname = i ? `${basename} (${i})` : basename;
      const existing = await Page.findOne({ name: newname });
      if (!existing) break;
    }
    const createObj = {
      ...this,
      name: newname,
    };
    delete createObj.id;
    return await Page.create(createObj);
  }

  /**
   * Run (Show) page
   * @param querystate
   * @param extraArgs
   * @returns {Promise<any>}
   */
  async run(querystate, extraArgs) {
    await eachView(this.layout, async (segment) => {
      const view = await View.findOne({ name: segment.view });
      if (!view) {
        throw new InvalidConfiguration(
          `Page ${this.name} configuration error in embedded view: ` +
            (segment.view
              ? `view "${segment.view}" not found`
              : "no view specified")
        );
      } else if (segment.state === "shared") {
        const mystate = view.combine_state_and_default_state(querystate);
        segment.contents = await view.run(mystate, extraArgs);
      } else {
        const state = this.fixed_states[segment.name];
        const mystate = view.combine_state_and_default_state(state || {});
        segment.contents = await view.run(mystate, extraArgs);
      }
    });
    const pagename = this.name;
    traverseSync(this.layout, {
      action(segment) {
        const url = `javascript:ajax_post_json('/page/${pagename}/action/${segment.rndid}')`;
        const html = action_link(url, extraArgs.req, segment);
        segment.type = "blank";
        segment.contents = html;
      },
    });
    return this.layout;
  }
}

/**
 * Page contract
 * @type {{variables: {min_role: ((function(*=): *)|*), layout: ((function(*=): *)|*), name: ((function(*=): *)|*), fixed_states: ((function(*=): *)|*), description: ((function(*=): *)|*), id: ((function(*=): *)|*), title: ((function(*=): *)|*)}, methods: {run: ((function(*=): *)|*), delete: ((function(*=): *)|*), is_root_page_for_roles: ((function(*=): *)|*), menu_label: ((function(*=): *)|*)}, static_methods: {find: ((function(*=): *)|*), findOne: ((function(*=): *)|*), create: ((function(*=): *)|*), update: ((function(*=): *)|*)}}}
 */
Page.contract = {
  variables: {
    name: is.str,
    title: is.str,
    description: is.str,
    id: is.maybe(is.posint),
    min_role: is.posint,
    layout: is.obj(),
    fixed_states: is.obj(),
  },
  methods: {
    delete: is.fun([], is.promise(is.undefined)),

    menu_label: is.getter(is.maybe(is.str)),
    run: is.fun(
      [is.obj(), is.obj({ req: is.obj(), res: is.obj() })],
      is.promise(is.any)
    ),
    is_root_page_for_roles: is.fun([], is.promise(is.array(is.str))),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("Page")))
    ),
    create: is.fun(is.obj(), is.promise(is.class("Page"))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Page")))),
    update: is.fun([is.posint, is.obj()], is.promise(is.undefined)),
  },
};

module.exports = Page;
