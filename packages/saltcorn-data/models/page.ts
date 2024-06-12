/**
 * Page Database Access Layer
 * @category saltcorn-data
 * @module models/page
 * @subcategory models
 */
import db from "../db";
import View from "./view";
import Table from "./table";
import File from "./file";
import { readFile } from "fs/promises";
import layout from "./layout";
const { eachView, eachPage, traverse, getStringsForI18n, translateLayout } =
  layout;
import config from "./config";
import type {
  Layout,
  RunExtra,
  ConnectedObjects,
} from "@saltcorn/types/base_types";
import { instanceOWithHtmlFile } from "@saltcorn/types/base_types";
import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import Role from "./role";
import type {
  AbstractPage,
  PageCfg,
  PagePack,
} from "@saltcorn/types/model-abstracts/abstract_page";
import expression from "./expression";
import tags from "@saltcorn/markup/tags";
const { script, domReady, div } = tags;
const { eval_expression } = expression;

const { remove_from_menu } = config;
const {
  action_link,
  fill_presets,
} = require("../base-plugin/viewtemplates/viewable_fields");
import utils from "../utils";
const { run_action_column, stateToQueryString } = require("../plugin-helper");

import { extractFromLayout } from "../diagram/node_extract_utils";
const {
  InvalidConfiguration,
  satisfies,
  structuredClone,
  isNode,
  objectToQueryString,
  stringToJSON,
  dollarizeObject,
  getSessionId,
} = utils;
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";

/**
 * Page Class
 * @category saltcorn-data
 */
class Page implements AbstractPage {
  name: string;
  title: string;
  description: string;
  id?: number;
  min_role: number;
  layout: Layout;
  fixed_states: any;
  attributes?: any;

  /**
   * @param {object} o
   */
  constructor(o: PageCfg | PagePack | Page) {
    this.name = o.name;
    this.title = o.title;
    this.description = o.description;
    this.min_role = +o.min_role;
    this.id = o.id;
    this.attributes = stringToJSON(o.attributes);

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
      return getState()
        .pages.map((t: Page) => new Page(t))
        .filter(satisfies(where || {}));
    }
    const db_flds = await db.select("_sc_pages", where, selectopts);
    return db_flds.map((dbf: PageCfg) => new Page(dbf));
  }

  /**
   * Find one page
   * @param where
   * @returns {Promise<Page|*>}
   */
  static findOne(where: Where): Page | null {
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
    // delete tag entries from _sc_tag_entries
    await db.deleteWhere("_sc_page_group_members", { page_id: this.id });
    await db.deleteWhere("_sc_tag_entries", { page_id: this.id });
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
      const existing = Page.findOne({ name: newname });
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
    require("../db/state")
      .getState()
      .log(5, `Run page ${this.name} with query ${JSON.stringify(querystate)}`);
    await eachView(this.layout, async (segment: any) => {
      const view = await View.findOne({ name: segment.view });
      const extra_state = segment.extra_state_fml
        ? eval_expression(
            segment.extra_state_fml,
            {
              ...dollarizeObject(querystate || {}),
              session_id: getSessionId(extraArgs.req),
            },
            extraArgs.req.user,
            `Extra state formula when embedding view ${view?.name}`
          )
        : {};
      if (!view) {
        throw new InvalidConfiguration(
          `Page ${this.name} configuration error in embedded view: ` +
            (segment.view
              ? `view "${segment.view}" not found`
              : "no view specified")
        );
      } else if (segment.state === "shared") {
        const mystate = view.combine_state_and_default_state({
          ...querystate,
          ...extra_state,
        });
        const qs = stateToQueryString(mystate, true);
        segment.contents = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-view-source": `/view/${view.name}${qs}`,
          },
          await view.run(mystate, extraArgs, view.isRemoteTable())
        );
      } else if (segment.state === "local") {
        const mystate = view.combine_state_and_default_state({
          ...querystate,
          ...extra_state,
        });
        const qs = stateToQueryString(mystate, true);
        segment.contents = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-local-state": `/view/${view.name}${qs}`,
          },
          await view.run(mystate, extraArgs, view.isRemoteTable())
        );
      } else {
        // segment.state === "fixed"
        const table = Table.findOne({ id: view.table_id });
        const state = segment.configuration || this.fixed_states[segment.name];
        const filled = await fill_presets(table, extraArgs.req, state);

        const mystate = view.combine_state_and_default_state(filled || {});
        const qs = stateToQueryString(mystate, true);

        Object.assign(mystate, extra_state);
        segment.contents = div(
          {
            class: "d-inline",
            "data-sc-embed-viewname": view.name,
            "data-sc-view-source": `/view/${view.name}${qs}`,
          },
          await view.run(mystate, extraArgs, view.isRemoteTable())
        );
      }
    });
    await eachPage(this.layout, async (segment: any) => {
      const page = await Page.findOne({ name: segment.page });
      if (!page) {
        throw new InvalidConfiguration(
          `Page ${this.name} configuration error in embedded page: ` +
            (segment.page
              ? `page "${segment.page}" not found`
              : "no page specified")
        );
      } else if (page.name === this.name) {
        throw new InvalidConfiguration(
          `Page ${this.name} configuration error in embedded page: Infinite loop page-in-page`
        );
      } else {
        const role = (extraArgs.req.user || {}).role_id || 100;
        const pageContent = await page.run(querystate, extraArgs);
        const { getState } = require("../db/state");
        segment.contents = getState().getLayout(extraArgs.req.user).renderBody({
          title: "",
          body: pageContent,
          req: extraArgs.req,
          role,
          alerts: [],
        });
      }
    });
    const pagename = this.name;
    await traverse(this.layout, {
      async action(segment: any) {
        if (segment.action_style === "on_page_load") {
          segment.type = "blank";
          segment.style = {};
          if (segment.minRole && segment.minRole != 100) {
            const minRole = +segment.minRole;
            const userRole = extraArgs?.req?.user?.role_id || 100;
            if (minRole < userRole) return;
          }
          //run action
          const actionResult = await run_action_column({
            col: { ...segment },
            referrer: extraArgs.req.get("Referrer"),
            req: extraArgs.req,
            res: extraArgs.res,
          });
          if (actionResult)
            segment.contents = script(
              domReady(`common_done(${JSON.stringify(actionResult)})`)
            );
          return;
        }
        const url =
          segment.action_name === "GoBack"
            ? `javascript:${isNode() ? "history.back()" : "parent.goBack()"}`
            : `javascript:${
                isNode() ? "ajax_post_json" : "local_post_json"
              }('/page/${pagename}/action/${segment.rndid}')`;
        const html = action_link(url, extraArgs.req, segment);
        segment.type = "blank";
        segment.contents = html;
      },
      link: (segment) => {
        if (segment.transfer_state) {
          segment.url += `?` + objectToQueryString(querystate || {});
        }
        if (segment.view_state_fml) {
          const extra_state = segment.view_state_fml
            ? eval_expression(
                segment.view_state_fml,
                {
                  ...dollarizeObject(querystate || {}),
                  session_id: getSessionId(extraArgs.req),
                },
                extraArgs.req.user,
                `Link extra state formula`
              )
            : {};
          segment.url +=
            (segment.transfer_state ? "&" : `?`) +
            objectToQueryString(extra_state || {});
        }
      },
      image: async (segment) => {
        if (extraArgs.req.isSplashPage) {
          try {
            if (segment.srctype === "File") {
              const file = await File.findOne(segment.fileid);
              if (file) {
                const base64 = await readFile(file.location, "base64");
                segment.encoded_image = `data:${file.mimetype};base64, ${base64}`;
              } else
                throw new Error(`The file '${segment.fileid}' does not exist.`);
            }
          } catch (error: any) {
            segment.encoded_image = "invalid";
            // was started from the build-app command
            // console.log() is redirected into a logfile
            console.log(
              `Unable to encode the image: ${
                error.message ? error.message : "Unknown error"
              }`
            );
          }
        }
      },
    });

    translateLayout(this.layout, extraArgs.req.getLocale());
    return this.layout;
  }

  get html_file(): string | undefined {
    if (instanceOWithHtmlFile(this.layout)) return this.layout.html_file;
    else null;
  }

  connected_objects(): ConnectedObjects {
    return extractFromLayout(this.layout);
  }

  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag")).default;
    return await Tag.findWithEntries({ page_id: this.id });
  }
}

export = Page;
