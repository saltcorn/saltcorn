/**
 * View Data Access Layer
 * @category saltcorn-data
 * @module models/view
 * @subcategory models
 */

import db from "../db";
import Form from "./form";
import utils from "../utils";
const {
  removeEmptyStrings,
  stringToJSON,
  InvalidConfiguration,
  satisfies,
  structuredClone,
  isNode,
  isWeb,
} = utils;
const { remove_from_menu } = require("./config");
import tags from "@saltcorn/markup/tags";
const { div } = tags;
import markup from "@saltcorn/markup/index";
const { renderForm } = markup;

import type {
  ViewTemplate,
  FieldLike,
  Tablely,
  RunExtra,
  ConnectedObjects,
} from "@saltcorn/types/base_types";
import type Table from "./table";
import type { Where, SelectOptions } from "@saltcorn/db-common/internal";
import type Workflow from "./workflow";
import { GenObj, instanceOfType } from "@saltcorn/types/common_types";
import type {
  ViewCfg,
  AbstractView,
} from "@saltcorn/types/model-abstracts/abstract_view";
import type { AbstractTable } from "@saltcorn/types/model-abstracts/abstract_table";
import axios from "axios";

declare let window: any;

/**
 * View Class
 * @category saltcorn-data
 */
class View implements AbstractView {
  name: string;
  id?: number;
  table_id?: number;
  viewtemplate: string;
  min_role: number;
  viewtemplateObj?: ViewTemplate;
  default_render_page?: string;
  exttable_name?: string;
  description?: string;
  table_name?: string;
  configuration?: any;
  table?: AbstractTable;
  slug?: any;

  /**
   * View constructor
   * @param {object} o
   */
  constructor(o: ViewCfg | View) {
    this.name = o.name;
    this.id = o.id;
    this.viewtemplate = o.viewtemplate;
    this.exttable_name = o.exttable_name;
    this.description = o.description;
    if (o.table_id) this.table_id = o.table_id;
    if (o.table && !o.table_id) {
      this.table_id = o.table.id;
    }
    if (o.table_name) this.table_name = o.table_name;
    this.configuration = stringToJSON(o.configuration);
    if (!o.min_role && !(o as any).is_public) {
      throw new InvalidConfiguration(
        `Unable to build view ${this.name}, neither 'min_role' or 'is_public' is given.`
      );
    }
    this.min_role =
      !o.min_role && typeWithDefinedMember<ViewCfg>(o, "is_public")
        ? o.is_public
          ? 10
          : 8
        : +o.min_role!;
    const { getState } = require("../db/state");
    this.viewtemplateObj = getState().viewtemplates[this.viewtemplate];
    this.default_render_page = o.default_render_page;
    this.table = o.table;
    this.slug = stringToJSON(o.slug);
  }

  /**
   * @param {object} where
   * @returns {View}
   */
  static findOne(where: Where): View | undefined {
    const { getState } = require("../db/state");
    const v = getState().views.find(
      where.id
        ? (v: View) => v.id === +where.id
        : where.name
        ? (v: View) => v.name === where.name
        : satisfies(where)
    );
    return v
      ? new View({ ...v, configuration: structuredClone(v.configuration) })
      : v;
  }

  /**
   * @param where
   * @param selectopts
   * @returns {Promise<View[]>}
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Array<View>> {
    if (selectopts.cached) {
      const { getState } = require("../db/state");
      return getState().views.map((t: View) => new View(t));
    }
    const views = await db.select("_sc_views", where, selectopts);

    return views.map((v: View) => new View(v));
  }

  /**
   * @returns {Promise<object[]>}
   */
  async get_state_fields(): Promise<Array<FieldLike>> {
    if (
      this.viewtemplateObj &&
      this.viewtemplateObj.get_state_fields &&
      (this.exttable_name || this.table_id)
    ) {
      return await this.viewtemplateObj.get_state_fields(
        // @ts-ignore
        this.exttable_name || this.table_id,
        this.name,
        this.configuration
      );
    } else return [];
  }

  /**
   * Get menu label
   * @type {string|undefined}
   */
  get menu_label(): string | undefined {
    const { getState } = require("../db/state");
    const menu_items = getState().getConfig("menu_items", []);
    const item = menu_items.find((mi: any) => mi.viewname === this.name);
    return item ? item.label : undefined;
  }

  /**
   * @param table
   * @param pred
   * @returns {Promise<object[]>}
   */
  static async find_table_views_where(
    table: number | Tablely | string,
    pred: FindViewsPred
  ): Promise<Array<View>> {
    let link_view_opts = [];
    const link_views = await View.find(
      typeWithDefinedMember<Table>(table, "id")
        ? {
            table_id: table.id,
          }
        : typeWithDefinedMember<Table>(table, "name")
        ? { exttable_name: table.name }
        : typeof table === "string"
        ? { exttable_name: table }
        : { table_id: table },
      { orderBy: "name", nocase: true }
    );

    for (const viewrow of link_views) {
      // may fail if incomplete view
      const sfs = await viewrow.get_state_fields();
      if (
        pred({
          viewrow,
          viewtemplate: viewrow.viewtemplateObj,
          state_fields: sfs,
        })
      )
        link_view_opts.push(viewrow);
    }
    return link_view_opts;
  }

  /**
   * @type {object}
   */
  get select_option(): any {
    return {
      name: this.name,
      label: `${this.name} [${this.viewtemplate}${
        this.table
          ? ` ${this.table.name}`
          : this.table_name
          ? ` ${this.table_name}`
          : ""
      }]`,
    };
  }

  /**
   * @param {function} pred
   * @returns {Promise<object>}
   */
  static async find_all_views_where(pred: FindViewsPred): Promise<Array<View>> {
    let link_view_opts = [];
    const link_views = await View.find({}, { orderBy: "name", nocase: true });

    for (const viewrow of link_views) {
      // may fail if incomplete view
      const sfs = await viewrow.get_state_fields();
      if (
        pred({
          viewrow,
          viewtemplate: viewrow.viewtemplateObj,
          state_fields: sfs,
        })
      )
        link_view_opts.push(viewrow);
    }
    return link_view_opts;
  }

  /**
   * @param {Table|object} table
   * @returns {Promise<View[]>}
   */
  static async find_possible_links_to_table(
    table: number | Tablely | string
  ): Promise<Array<View>> {
    return View.find_table_views_where(
      table,
      ({ state_fields }: { state_fields: Array<FieldLike> }) =>
        state_fields.some((sf: FieldLike) => sf.name === "id" || sf.primary_key)
    );
  }

  /**
   * Create view in database
   * @param v
   * @returns {Promise<View>}
   */
  // todo there hard code about roles and flag is_public
  static async create(v: ViewCfg): Promise<View> {
    // is_public flag processing
    if (!v.min_role && typeof v.is_public !== "undefined") {
      v.min_role = v.is_public ? 10 : 8;
      delete v.is_public;
    }
    const { table, ...row } = v;
    // insert view definition into _sc_views
    const id = await db.insert("_sc_views", row);
    // refresh views list cache
    await require("../db/state").getState().refresh_views();
    return new View({ id, ...v });
  }

  /**
   * Clone View
   * @returns {Promise<View>}
   */
  async clone(): Promise<View> {
    const basename = this.name + " copy";
    let newname;
    // todo there is hard code linmitation about 100 copies of veiew
    for (let i = 0; i < 100; i++) {
      newname = i ? `${basename} (${i})` : basename;
      const existing = await View.findOne({ name: newname });
      if (!existing) break;
    }
    const createObj: View = {
      ...this,
      name: newname,
    };
    delete createObj.viewtemplateObj;
    delete createObj.id;
    return await View.create(createObj);
  }

  /**
   * Delete current view from db
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    if (
      this.viewtemplateObj &&
      this.viewtemplateObj.on_delete &&
      this.table_id &&
      this.configuration
    )
      await this.viewtemplateObj.on_delete(
        this.table_id,
        this.name,
        this.configuration
      );
    // delete view from _sc_view
    await db.deleteWhere("_sc_views", { id: this.id });
    // remove view from menu
    await remove_from_menu({ name: this.name, type: "View" });
    // fresh view list cache
    await require("../db/state").getState().refresh_views();
  }

  /**
   * Delete list of views
   * @param where - condition
   * @returns {Promise<void>}
   */
  static async delete(where: Where): Promise<void> {
    const vs = await View.find(where);
    for (const v of vs) await v.delete();
  }

  /**
   * Update View description
   * @param v - view name
   * @param id - id
   * @returns {Promise<void>}
   */
  static async update(v: any, id: number): Promise<void> {
    // update view description
    await db.update("_sc_views", v, id);
    // fresh view list cache
    await require("../db/state").getState().refresh_views();
  }

  /**
   * @param {*} arg
   * @param {boolean} remote
   * @returns {Promise<object>}
   */
  async authorise_post(
    arg: {
      body: any;
      table_id: number;
      req: NonNullable<any>;
    },
    remote: boolean = false
  ): Promise<boolean> {
    if (!this.viewtemplateObj?.authorise_post) return false;
    return await this.viewtemplateObj.authorise_post(
      arg,
      this.queries(remote, arg.req)
    );
  }

  /**
   * @param {*} arg
   * @param {boolean} remote
   * @returns {Promise<object>}
   */
  async authorise_get(
    arg: {
      query: any;
      table_id: number;
      req: NonNullable<any>;
    },
    remote: boolean = false
  ): Promise<boolean> {
    if (!this.viewtemplateObj?.authorise_get) return false;
    return await this.viewtemplateObj.authorise_get(
      arg,
      this.queries(remote, arg.req)
    );
  }

  /**
   * @returns {string}
   */
  getStringsForI18n(): string[] {
    if (!this.viewtemplateObj || !this.viewtemplateObj.getStringsForI18n)
      return [];
    return this.viewtemplateObj.getStringsForI18n(this.configuration);
  }

  /**
   * Run (Execute) View
   * @param {any} query
   * @param  {RunExtra} extraArgs
   * @param {boolean}  remote
   * @returns {Promise<*>}
   */
  async run(
    query: any,
    extraArgs: RunExtra,
    remote: boolean = !isNode()
  ): Promise<any> {
    this.check_viewtemplate();
    const table_id = this.exttable_name || this.table_id;
    try {
      return await this.viewtemplateObj!.run(
        table_id,
        this.name,
        this.configuration,
        removeEmptyStrings(query),
        extraArgs,
        this.queries(remote, extraArgs.req)
      );
    } catch (error: any) {
      error.message = `In ${this.name} view (${this.viewtemplate} viewtemplate):\n${error.message}`;
      throw error;
    }
  }

  queries(remote?: boolean, req?: any, res?: any) {
    const queryObj = this?.viewtemplateObj?.queries
      ? this.viewtemplateObj!.queries({ ...this, req, res })
      : {};
    if (remote) {
      const { getState } = require("../db/state");

      const base_url =
        getState().getConfig("base_url") || "http://10.0.2.2:3000"; //TODO default from req
      const queries: any = {};
      Object.entries(queryObj).forEach(([k, v]) => {
        queries[k] = async (...args: any[]) => {
          const url = `${base_url}/api/viewQuery/${this.name}/${k}`;
          const headers: any = {
            "X-Requested-With": "XMLHttpRequest",
            "X-Saltcorn-Client": "mobile-app",
          };
          const token = window.localStorage.getItem("auth_jwt");
          if (token) headers.Authorization = `jwt ${token}`;
          try {
            let response = await axios.post(
              url,
              { args },
              {
                headers,
              }
            );
            for (const { type, msg } of response.data.alerts)
              req.flash(type, msg);
            return response.data.success;
          } catch (error: any) {
            if (error.request?.status === 401)
              error.message = req.__("Not authorized");
            else
              error.message = `Unable to call POST ${url}:\n${error.message}`;
            throw error;
          }
        };
      });

      return queries;
    } else {
      return queryObj;
    }
  }

  /**
   * @throws {InvalidConfiguration}
   */
  check_viewtemplate(): void {
    if (!this.viewtemplateObj)
      throw new InvalidConfiguration(
        `Cannot find viewtemplate ${this.viewtemplate} in view ${this.name}`
      );
  }

  /**
   * @param {*} query
   * @param {*} req
   * @param {*} res
   * @param {boolean} remote
   * @returns {Promise<object>}
   */
  async run_possibly_on_page(
    query: any,
    req: any,
    res: any,
    remote: boolean = false
  ): Promise<string> {
    const view = this;
    this.check_viewtemplate();
    if (view.default_render_page && (!req.xhr || req.headers.pjaxpageload)) {
      const Page = require("../models/page");
      const db_page = await Page.findOne({ name: view.default_render_page });
      if (db_page) {
        // return contents
        return await db_page.run(query, { res, req });
      }
    }
    const state = view.combine_state_and_default_state(query);
    const resp = await view.run(state, { res, req }, remote);
    const state_form = await view.get_state_form(state, req);
    // return contents
    return div(state_form ? renderForm(state_form, req.csrfToken()) : "", resp);
  }

  /**
   * @param {*} query
   * @param {*} extraArgs
   * @param {boolean} remote
   * @throws {InvalidConfiguration}
   * @returns {Promise<object>}
   */
  async runMany(
    query: GenObj,
    extraArgs: RunExtra,
    remote: boolean = !isNode()
  ): Promise<string[] | Array<{ html: string; row: any }>> {
    this.check_viewtemplate();
    try {
      if (this.viewtemplateObj?.runMany) {
        if (!this.table_id) {
          throw new InvalidConfiguration(
            `Unable to call runMany, ${this.viewtemplate} is missing 'table_id'.`
          );
        }
        return await this.viewtemplateObj!.runMany(
          this.table_id,
          this.name,
          this.configuration,
          query,
          extraArgs,
          this.queries(remote, extraArgs.req)
        );
      }
      if (this.viewtemplateObj?.renderRows) {
        const Table = (await import("./table")).default;
        const { stateFieldsToWhere } = await import("../plugin-helper");
        const tbl = Table.findOne({ id: this.table_id });
        if (!tbl)
          throw new Error(`Unable to find table with id ${this.table_id}`);
        const fields = await tbl.getFields();
        const qstate = await stateFieldsToWhere({
          fields,
          state: query,
          table: tbl,
        });
        const rows = await tbl.getRows(qstate);
        const rendered = await this.viewtemplateObj!.renderRows(
          tbl,
          this.name,
          this.configuration,
          extraArgs,
          rows,
          query
        );

        return rendered.map((html: string, ix: number) => ({
          html,
          row: rows[ix],
        }));
      }
    } catch (error: any) {
      error.message = `In ${this.name} view (${this.viewtemplate} viewtemplate):\n${error.message}`;
      throw error;
    }
    throw new InvalidConfiguration(
      `runMany on view ${this.name}: viewtemplate ${this.viewtemplate} does not have renderRows or runMany methods`
    );
  }

  /**
   * @param {*} query
   * @param {*} body
   * @param {*} extraArgs
   * @param {boolean} remote
   * @returns {Promise<object>}
   */
  async runPost(
    query: GenObj,
    body: GenObj,
    extraArgs: RunExtra,
    remote: boolean = !isNode()
  ): Promise<any> {
    const { getState } = require("../db/state");
    if (
      !getState().mobileConfig ||
      getState().mobileConfig.localTableIds.indexOf(this.table_id) >= 0
    ) {
      remote = false;
    }
    this.check_viewtemplate();
    if (!this.viewtemplateObj!.runPost)
      throw new InvalidConfiguration(
        `Unable to call runPost, ${this.viewtemplate} is missing 'runPost'.`
      );
    return await this.viewtemplateObj!.runPost(
      this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query),
      removeEmptyStrings(body),
      extraArgs,
      this.queries(remote, extraArgs.req),
      remote
    );
  }

  /**
   * @param {*} route
   * @param {*} body
   * @param {*} res
   * @param {*} extraArgs
   * @param {boolean} remote
   * @returns {Promise<void>}
   */
  async runRoute(
    route: string,
    body: any,
    res: NonNullable<any>,
    extraArgs: RunExtra,
    remote: boolean = false
  ): Promise<any> {
    this.check_viewtemplate();
    if (!this.viewtemplateObj!.routes)
      throw new InvalidConfiguration(
        `Unable to call runRoute of view '${this.name}', ${this.viewtemplate} is missing 'routes'.`
      );

    const result = await this.viewtemplateObj!.routes[route](
      this.table_id,
      this.name,
      this.configuration,
      body,
      extraArgs,
      this.queries(remote, extraArgs.req)
    );
    if (result && result.json) res.json(result.json);
    else if (result && result.html) res.send(result.html);
    else res.json({ success: "ok" });
  }

  /**
   * @param {object} req_query
   * @returns {object}
   */
  combine_state_and_default_state(req_query: any): any {
    var state = { ...req_query };
    this.check_viewtemplate();
    const defstate = this.viewtemplateObj!.default_state_form
      ? this.viewtemplateObj!.default_state_form(this.configuration)
      : {};

    Object.entries(defstate || {}).forEach(([k, v]) => {
      if (!state[k]) {
        state[k] = v;
      }
    });
    return state;
  }

  /**
   * @param {object} query
   * @param {object} req
   * @returns {Promise<Form|null>}
   */
  async get_state_form(query: any, req: any): Promise<Form | null> {
    this.check_viewtemplate();
    const vt_display_state_form = this.viewtemplateObj!.display_state_form;
    const display_state_form =
      typeof vt_display_state_form === "function"
        ? vt_display_state_form(this.configuration)
        : vt_display_state_form;
    if (display_state_form) {
      const fields = await this.get_state_fields();

      fields.forEach((f: FieldLike) => {
        f.required = false;
        if (f.label === "Anywhere" && f.name === "_fts")
          f.label = req.__(f.label);
        if (instanceOfType(f.type) && f.type.name === "Bool")
          f.fieldview = "tristate";
        if (
          instanceOfType(f.type) &&
          f.type.read &&
          typeof query[f.name] !== "undefined"
        ) {
          query[f.name] = f.type.read(query[f.name]);
        }
      });
      const form = new Form({
        methodGET: true,
        action: `/view/${encodeURIComponent(this.name)}`,
        fields,
        submitLabel: req.__("Apply"),
        isStateForm: true,
        __: req.__,
        values: removeEmptyStrings(query),
      });
      if (!isWeb(req))
        form.onSubmit = `javascript:stateFormSubmit(this, 'get/view/${encodeURIComponent(
          this.name
        )}')`;
      await form.fill_fkey_options(true);
      return form;
    } else return null;
  }

  /**
   * @param {object} req
   * @returns {Promise<object>}
   */
  async get_config_flow(req: any): Promise<Workflow> {
    this.check_viewtemplate();
    if (!this.id)
      throw new InvalidConfiguration(
        `Unable to execute 'get_config_flow' of view '${this.name}', 'this.name' must be set.`
      );

    const configFlow = this.viewtemplateObj!.configuration_workflow(req);
    configFlow.action = `/viewedit/config/${encodeURIComponent(this.name)}`;
    const oldOnDone = configFlow.onDone || ((c: any) => c);
    configFlow.onDone = async (ctx: any) => {
      const { table_id, ...configuration } = await oldOnDone(ctx);

      await View.update({ configuration }, this.id!);
      return {
        redirect: `/viewedit`,
        flash: ["success", `View ${this.name || ""} saved`],
      };
    };
    configFlow.saveURL = `/viewedit/saveconfig/${this.name}`;
    configFlow.autoSave = true;
    configFlow.startAtStepURL = (stepNm) =>
      `/viewedit/config/${this.name}?step=${stepNm}`;
    return configFlow;
  }

  rewrite_query_from_slug(query: any, params: any): void {
    let pix = 0;
    if (this.slug && this.slug.steps && this.slug.steps.length > 0) {
      for (const step of this.slug.steps) {
        if (step.unique && params[pix]) {
          query[step.field] = step.transform
            ? { [step.transform]: params[pix] }
            : params[pix];
          return;
        }
        pix += 1;
      }
    }
  }

  async connected_objects(): Promise<ConnectedObjects> {
    if (!this.viewtemplateObj?.connectedObjects) return {};
    else {
      const result = await this.viewtemplateObj.connectedObjects(
        this.configuration
      );
      if (this.table_id) {
        const Table = (await import("./table")).default;
        const table = Table.findOne({ id: this.table_id });
        if (table)
          if (result.tables) result.tables.push(table);
          else result.tables = [table];
      }
      return result;
    }
  }

  /**
   * saltcorn-mobile-app helper.
   * Check if the table of a view is local or server-side
   * @returns true if server-side table
   */
  isRemoteTable(): boolean {
    if (isNode() || !this.table_id) return false;
    const { getState } = require("../db/state");
    return (
      getState().mobileConfig &&
      getState().mobileConfig.localTableIds.indexOf(this.table_id) < 0
    );
  }
}

function typeWithDefinedMember<T>(object: any, member: string): object is T {
  return (
    typeof object === "object" &&
    object &&
    member in object &&
    object[member] !== undefined &&
    object[member] !== null
  );
}

namespace View {
  export type FindViewsPred = (arg0: {
    viewrow: View;
    viewtemplate?: ViewTemplate;
    state_fields: Array<FieldLike>;
  }) => boolean;
}

type FindViewsPred = View.FindViewsPred;

export = View;
