/**
 * Page Database Access Layer
 * @category saltcorn-data
 * @module models/page
 * @subcategory models
 */
import { action_link, fill_presets } from "../viewable_fields.js";
import { run_action_column, stateToQueryString } from "../plugin-helper.js";
import { getState } from "../db/state.js";
import User from "./user.js";
import * as nsState from "../db/state.js";
import db from "../db/index.js";
import View from "./view.js";
import Table from "./table.js";
import File from "./file.js";
import { readFile } from "fs/promises";
import { parseDocument, DomUtils } from "htmlparser2";
import * as layout from "./layout.js";
const { eachView, eachPage, traverse, getStringsForI18n, translateLayout } =
  layout;
import * as config from "./config.js";
import type {
  Layout,
  RunExtra,
  ConnectedObjects,
} from "@saltcorn/types/base_types";
import { instanceOWithHtmlFile } from "@saltcorn/types/base_types";
import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import Role from "./role.js";
import type {
  AbstractPage,
  PageCfg,
  PagePack,
} from "@saltcorn/types/model-abstracts/abstract_page";
import * as expression from "./expression.js";
import tags from "@saltcorn/markup/tags";
const { script, domReady, div } = tags;
import { eval_expression } from "./expression.js";

import { remove_from_menu } from "./config.js";
import * as utils from "../utils.js";

import { extractFromLayout } from "../diagram/node_extract_utils.js";
import {
  InvalidConfiguration,
  satisfies,
  structuredClone,
  isWeb,
  objectToQueryString,
  stringToJSON,
  dollarizeObject,
  getSessionId,
  cloneName,
  isNode,
  isOfflineMode,
  interpolate,
} from "../utils.js";
import { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";

declare const saltcorn: any;

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
  updated_at?: Date;

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
    this.updated_at = ["string", "number"].includes(typeof o.updated_at)
      ? new Date(o.updated_at as any)
      : o.updated_at;
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
      return getState()!
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
  static findOne(where: Where): Page | undefined {
    const p = getState()!.pages.find(
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
      : undefined;
  }

  /**
   * Update page
   * @param id
   * @param row
   * @returns {Promise<void>}
   */
  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_pages", { ...row, updated_at: new Date() }, id);
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_pages(true);
  }

  static async state_refresh() {
    await nsState.getState()!.refresh_pages();
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
    page.updated_at = new Date();
    const { id, ...rest } = page;
    const fid = await db.insert("_sc_pages", rest);
    page.id = fid;
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_pages(true);
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
      await getState()!.setConfig(role + "_home", "");
    }
    await remove_from_menu({ name: this.name, type: "Page" });
    if (!db.getRequestContext()?.client)
      await nsState.getState()!.refresh_pages(true);
  }

  /**
   * Is root page for role
   * @returns {Promise<*>}
   */
  async is_root_page_for_roles(): Promise<Array<string>> {
    const roles = await User.get_roles();
    return roles
      .filter(
        (r: any) => getState()!.getConfig(r.role + "_home", "") === this.name
      )
      .map((r: any) => r.role);
  }

  /**
   * get menu label for page
   * @type {string|undefined}
   */
  get menu_label(): string | undefined {
    const menu_items = getState()!.getConfig("menu_items", []);
    const item = menu_items.find((mi: any) => mi.pagename === this.name);
    return item ? item.label : undefined;
  }

  /**
   * Clone page
   * @returns {Promise<Page>}
   */
  async clone(): Promise<Page> {
    const existingNames = await Page.find({ name: { ilike: this.name } });
    const newname = cloneName(
      this.name,
      existingNames.map((v) => v.name)
    );

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
  async run(
    querystate: any,
    extraArgs: RunExtra
  ): Promise<Layout | { html_file: string } | { html_string: string } | null> {
    nsState
      .getState()!
      .log(5, `Run page ${this.name} with query ${JSON.stringify(querystate)}`);

    await eachView(
      this.layout,
      async (segment: any, inLazy: boolean) => {
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
          if (view.renderLocally()) {
            segment.contents = div(
              {
                class: "d-inline",
                "data-sc-embed-viewname": view.name,
                "data-sc-view-source": `/view/${view.name}${qs}`,
              },
              inLazy
                ? ""
                : await view.run(mystate, extraArgs, view.isRemoteTable())
            );
          } else {
            const response = await saltcorn.mobileApp.api.apiCall({
              method: "GET",
              path: `/view/${encodeURIComponent(view.name)}${qs}`,
            });
            segment.contents = response.data;
          }
        } else if (segment.state === "local") {
          const mystate = view.combine_state_and_default_state({
            ...querystate,
            ...extra_state,
          });
          const qs = stateToQueryString(mystate, true);
          if (isNode() || isOfflineMode()) {
            segment.contents = div(
              {
                class: "d-inline",
                "data-sc-embed-viewname": view.name,
                "data-sc-local-state": `/view/${view.name}${qs}`,
                "data-sc-view-source": `/view/${view.name}${qs}`,
              },
              inLazy
                ? ""
                : await view.run(mystate, extraArgs, view.isRemoteTable())
            );
          } else {
            const response = await saltcorn.mobileApp.api.apiCall({
              method: "GET",
              path: `/view/${encodeURIComponent(view.name)}${qs}`,
            });
            segment.contents = response.data;
          }
        } else {
          // segment.state === "fixed"
          const table = Table.findOne({ id: view.table_id })!;
          const state =
            segment.configuration || this.fixed_states[segment.name];
          const filled = await fill_presets(table, extraArgs.req, state);

          const mystate = view.combine_state_and_default_state(filled || {});
          const qs = stateToQueryString(mystate, true);

          Object.assign(mystate, extra_state);
          if (view.renderLocally()) {
            segment.contents = div(
              {
                class: "d-inline",
                "data-sc-embed-viewname": view.name,
                "data-sc-view-source": `/view/${view.name}${qs}`,
              },
              inLazy
                ? ""
                : await view.run(mystate, extraArgs, view.isRemoteTable())
            );
          } else {
            const response = await saltcorn.mobileApp.api.apiCall({
              method: "GET",
              path: `/view/${encodeURIComponent(view.name)}${qs}`,
            });
            segment.contents = response.data;
          }
        }
      },
      querystate
    );
    await Page.renderEachEmbeddedPageInLayout(
      this.layout,
      querystate,
      extraArgs
    );
    const pagename = this.name;
    let exit_from_redirect = false;
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
          if (actionResult?.goto && extraArgs?.res) {
            extraArgs.res.redirect(actionResult?.goto);
            exit_from_redirect = true;
            return;
          }
          if (actionResult)
            segment.contents = script(
              domReady(`common_done(${JSON.stringify(actionResult)})`)
            );
          return;
        }

        //TODO page_post_action for mobile
        const url =
          segment.action_name === "GoBack"
            ? `javascript:${
                isWeb(extraArgs.req)
                  ? "history.back()"
                  : "parent.saltcorn.mobileApp.navigation.goBack()"
              }`
            : `javascript:${
                isWeb(extraArgs.req) ? "page_post_action" : "local_post_json"
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
      container: (segment) => {
        if (segment.showIfFormula) {
          try {
            const do_show = eval_expression(
              segment.showIfFormula,
              dollarizeObject(querystate),
              extraArgs.req?.user
            );
            if (!do_show) segment.hide = true;
          } catch (e) {}
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
      blank: (segment) => {
        if (
          segment.isHTML &&
          typeof segment.contents === "string" &&
          segment.contents.includes("{{")
        ) {
          segment.contents = interpolate(
            segment.contents,
            {
              ...(querystate || {}),
              ...dollarizeObject(querystate || {}),
            },
            extraArgs?.req?.user,
            "Page HTML element interpolation"
          );
        }
      },
    });
    if (exit_from_redirect) return null;
    translateLayout(this.layout, extraArgs.req.getLocale());
    if (instanceOWithHtmlFile(this.layout)) {
      const file = await File.findOne(this.layout.html_file);
      const html_string = (await file?.get_contents("utf8")) as string;

      if (html_string?.includes("<embed-view")) {
        const doc = parseDocument(html_string, {
          withStartIndices: true,
          withEndIndices: true,
          xmlMode: true,
        });
        const embedNodes: any[] = DomUtils.findAll(
          (el: any) => el.type === "tag" && el.name === "embed-view",
          doc.children
        );
        type Replacement = { start: number; end: number; content: string };
        const replacements: Replacement[] = [];
        for (const node of embedNodes) {
          const { viewname, ...embedstate } = node.attribs ?? {};
          const view = View.findOne({ name: viewname });
          if (!view) continue;
          try {
            const content = await view.run(
              { ...querystate, ...embedstate },
              extraArgs
            );
            replacements.push({
              start: node.startIndex,
              end: node.endIndex + 1,
              content: content ?? "",
            });
          } catch (e) {
            replacements.push({
              start: node.startIndex,
              end: node.endIndex + 1,
              content: "",
            });
          }
        }
        replacements.sort((a, b) => b.start - a.start);
        let result = html_string;
        for (const { start, end, content } of replacements) {
          result = result.slice(0, start) + content + result.slice(end);
        }
        return { html_string: result };
      }
    }
    return this.layout;
  }

  /**
   * Checks plugin `authorize_page` hooks. Combine with the caller's own
   * role/min_role check, e.g. `role <= page.min_role || (await page.authorize(...))`.
   * @param user - the acting user (or undefined/public)
   * @param opts.action - "get" or "post"
   * @param opts.req - the request object, forwarded to hooks
   * @param opts.state - query/state, for action "get"
   * @param opts.body - POST body, for action "post"
   * @returns {Promise<boolean>}
   */
  async authorize(
    user: any,
    opts: {
      action: "get" | "post";
      req: any;
      state?: Row;
      body?: Row;
    }
  ): Promise<boolean> {
    const result = await nsState.getState()!.authorizePage(
      {
        action: opts.action,
        page: this,
        state: opts.state,
        body: opts.body,
        req: opts.req,
      },
      user
    );
    return result.decision === "allow";
  }

  get html_file(): string | undefined {
    if (instanceOWithHtmlFile(this.layout)) return this.layout.html_file;
    else null;
  }

  connected_objects(): ConnectedObjects {
    return extractFromLayout(this.layout);
  }

  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag.js")).default;
    return await Tag.findWithEntries({ page_id: this.id });
  }

  static async renderEachEmbeddedPageInLayout(
    layout: Layout,
    querystate: Row,
    extraArgs: RunExtra
  ) {
    await eachPage(layout, async (segment: any) => {
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
        segment.contents = (
          getState()!.getLayout(extraArgs.req.user as any) as any
        ).renderBody({
          title: "",
          body: pageContent,
          req: extraArgs.req,
          role,
          alerts: [],
        });
      }
    });
  }
}

export default Page;
