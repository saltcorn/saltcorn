/**
 * Page Database Access Layer
 * @category saltcorn-data
 * @module models/page
 * @subcategory models
 */
import db from "../db";
import View from "./view";
import Table from "./table";
const {
  eachView,
  traverseSync,
  getStringsForI18n,
  translateLayout,
} = require("./layout");
import tags from "@saltcorn/markup/tags";
const { div } = tags;
import config from "./config";
import type { Layout, RunExtra } from "@saltcorn/types/base_types";
import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import Role from "./role";
import type {
  PageCfg,
  PagePack,
} from "@saltcorn/types/model-abstracts/abstract_page";
const { eval_expression } = require("./expression");

const { remove_from_menu } = config;
const {
  action_link,
  fill_presets,
} = require("../base-plugin/viewtemplates/viewable_fields");
const {
  InvalidConfiguration,
  satisfies,
  structuredClone,
} = require("../utils");

/**
 * Page Class
 * @category saltcorn-data
 */
class Page {
  name: string;
  title: string;
  description: string;
  id?: number;
  min_role: number;
  layout: Layout;
  fixed_states: any;

  /**
   * @param {object} o
   */
  constructor(o: PageCfg | PagePack | Page) {
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
  }

  /**
   * Find pages in DB
   * @param where
   * @param selectopts
   * @returns {Promise<*>}
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Array<Page>> {
    if (selectopts.cached) {
      const { getState } = require("../db/state");
      return getState().pages.map((t: Page) => new Page(t));
    }
    const db_flds = await db.select("_sc_pages", where, selectopts);
    return db_flds.map((dbf: PageCfg) => new Page(dbf));
  }

  /**
   * Find one page
   * @param where
   * @returns {Promise<Page|*>}
   */
  static async findOne(where: Where): Promise<Page> {
    const { getState } = require("../db/state");
    const p = getState().pages.find(
      where.id
        ? (v: Page) => v.id === +where.id
        : where.name
        ? (v: Page) => v.name === where.name
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
  static async update(id: number, row: Row): Promise<void> {
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
  static async create(f: PageCfg | PagePack): Promise<Page> {
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
  async delete(): Promise<void> {
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
  async is_root_page_for_roles(): Promise<Array<string>> {
    const User = require("./user");
    const { getState } = require("../db/state");

    const roles = await User.get_roles();
    return roles
      .filter(
        (r: Role) => getState().getConfig(r.role + "_home", "") === this.name
      )
      .map((r: Role) => r.role);
  }

  /**
   * get menu label for page
   * @type {string|undefined}
   */
  get menu_label(): string | undefined {
    const { getState } = require("../db/state");
    const menu_items = getState().getConfig("menu_items", []);
    const item = menu_items.find((mi: any) => mi.pagename === this.name);
    return item ? item.label : undefined;
  }

  /**
   * Clone page
   * @returns {Promise<Page>}
   */
  async clone(): Promise<Page> {
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
  async run(querystate: any, extraArgs: RunExtra): Promise<Layout> {
    await eachView(this.layout, async (segment: any) => {
      const view = await View.findOne({ name: segment.view });
      if (!view) {
        throw new InvalidConfiguration(
          `Page ${this.name} configuration error in embedded view: ` +
            (segment.view
              ? `view "${segment.view}" not found`
              : "no view specified")
        );
      } else if (segment.state === "shared") {
        const extra_state = segment.extra_state_fml
          ? eval_expression(segment.extra_state_fml, {}, extraArgs.req.user)
          : {};
        const mystate = view.combine_state_and_default_state({
          ...querystate,
          ...extra_state,
        });
        segment.contents = await view.run(mystate, extraArgs);
      } else {
        const table = Table.findOne({ id: view.table_id });
        const state = segment.configuration || this.fixed_states[segment.name];
        const filled = await fill_presets(table, extraArgs.req, state);
        const mystate = view.combine_state_and_default_state(filled || {});
        segment.contents = await view.run(mystate, extraArgs);
      }
    });
    const pagename = this.name;
    traverseSync(this.layout, {
      action(segment: any) {
        const url =
          segment.action_name === "GoBack"
            ? `javascript:history.back()`
            : `javascript:ajax_post_json('/page/${pagename}/action/${segment.rndid}')`;
        const html = action_link(url, extraArgs.req, segment);
        segment.type = "blank";
        segment.contents = html;
      },
    });

    translateLayout(this.layout, extraArgs.req.getLocale());
    return this.layout;
  }
}

export = Page;
