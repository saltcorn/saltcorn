/**
 *
 * View Data Access Layer
 */

const db = require("../db");
const Form = require("../models/form");
const { contract, is } = require("contractis");
const { fieldlike, is_viewtemplate, is_tablely } = require("../contracts");
const {
  removeEmptyStrings,
  numberToBool,
  stringToJSON,
  InvalidConfiguration,
  satisfies,
  structuredClone,
} = require("../utils");
const { remove_from_menu } = require("./config");
const { div } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");

/**
 * View Class
 */
class View {
  constructor(o) {
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
    this.min_role =
      !o.min_role && typeof o.is_public !== "undefined"
        ? o.is_public
          ? 10
          : 8
        : +o.min_role;
    const { getState } = require("../db/state");
    this.viewtemplateObj = getState().viewtemplates[this.viewtemplate];
    this.default_render_page = o.default_render_page;
    contract.class(this);
  }
  static findOne(where) {
    const { getState } = require("../db/state");
    const v = getState().views.find(
      where.id
        ? (v) => v.id === +where.id
        : where.name
        ? (v) => v.name === where.name
        : satisfies(where)
    );
    return v
      ? new View({ ...v, configuration: structuredClone(v.configuration) })
      : v;
  }

  /**
   *
   * @param where
   * @param selectopts
   * @returns {Promise<*>}
   */
  static async find(where, selectopts = { orderBy: "name", nocase: true }) {
    const views = await db.select("_sc_views", where, selectopts);

    return views.map((v) => new View(v));
  }

  /**
   *
   * @returns {Promise<*|*[]>}
   */
  async get_state_fields() {
    if (this.viewtemplateObj.get_state_fields) {
      return await this.viewtemplateObj.get_state_fields(
        this.table_id,
        this.name,
        this.configuration
      );
    } else return [];
  }

  /**
   * Get menu label
   * @returns {*|undefined}
   */
  get menu_label() {
    const { getState } = require("../db/state");
    const menu_items = getState().getConfig("menu_items", []);
    const item = menu_items.find((mi) => mi.viewname === this.name);
    return item ? item.label : undefined;
  }

  /**
   *
   * @param table
   * @param pred
   * @returns {Promise<*[]>}
   */
  static async find_table_views_where(table, pred) {
    var link_view_opts = [];
    const link_views = await View.find(
      table.id
        ? {
            table_id: table.id,
          }
        : table.name
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

  get select_option() {
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

  static async find_all_views_where(pred) {
    var link_view_opts = [];
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

  static async find_possible_links_to_table(table) {
    return View.find_table_views_where(table, ({ state_fields }) =>
      state_fields.some((sf) => sf.name === "id" || sf.primary_key)
    );
  }

  /**
   * Create view in database
   * @param v
   * @returns {Promise<View>}
   */
  // todo there hard code about roles and flag is_public
  static async create(v) {
    // is_public flag processing
    if (!v.min_role && typeof v.is_public !== "undefined") {
      v.min_role = v.is_public ? 10 : 8;
      delete v.is_public;
    }
    // insert view defintion into _sc_views
    const id = await db.insert("_sc_views", v);
    // refresh views list cache
    await require("../db/state").getState().refresh_views();
    return new View({ id, ...v });
  }

  /**
   * Clone View
   * @returns {Promise<View>}
   */
  async clone() {
    const basename = this.name + " copy";
    let newname;
    // todo there is hard code linmitation about 100 copies of veiew
    for (let i = 0; i < 100; i++) {
      newname = i ? `${basename} (${i})` : basename;
      const existing = await View.findOne({ name: newname });
      if (!existing) break;
    }
    const createObj = {
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
  async delete() {
    if (this.viewtemplateObj && this.viewtemplateObj.on_delete)
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
  static async delete(where) {
    const vs = await View.find(where);
    for (const v of vs) await v.delete();
  }

  /**
   * Update View description
   * @param v - view name
   * @param id - id
   * @returns {Promise<void>}
   */
  static async update(v, id) {
    // update view description
    await db.update("_sc_views", v, id);
    // fresh view list cache
    await require("../db/state").getState().refresh_views();
  }

  async authorise_post(arg) {
    if (!this.viewtemplateObj.authorise_post) return false;
    return await this.viewtemplateObj.authorise_post(arg);
  }
  async authorise_get(arg) {
    if (!this.viewtemplateObj.authorise_get) return false;
    return await this.viewtemplateObj.authorise_get(arg);
  }

  getStringsForI18n() {
    if (!!this.viewtemplateObj || !this.viewtemplateObj.getStrings) return [];
    return this.viewtemplateObj.getStrings(this.configuration);
  }

  /**
   * Run (Execute) View
   * @param query
   * @param extraArgs
   * @returns {Promise<*>}
   */
  async run(query, extraArgs) {
    return await this.viewtemplateObj.run(
      this.exttable_name || this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query),
      extraArgs
    );
  }

  async run_possibly_on_page(query, req, res) {
    const view = this;
    if (view.default_render_page && (!req.xhr || req.headers.pjaxpageload)) {
      const Page = require("../models/page");
      const db_page = await Page.findOne({ name: view.default_render_page });
      if (db_page) {
        const contents = await db_page.run(query, { res, req });
        return contents;
      }
    }
    const state = view.combine_state_and_default_state(query);
    const resp = await view.run(state, { res, req });
    const state_form = await view.get_state_form(state, req);
    const contents = div(
      state_form ? renderForm(state_form, req.csrfToken()) : "",
      resp
    );
    return contents;
  }

  async runMany(query, extraArgs) {
    if (this.viewtemplateObj.runMany)
      return await this.viewtemplateObj.runMany(
        this.table_id,
        this.name,
        this.configuration,
        query,
        extraArgs
      );
    if (this.viewtemplateObj.renderRows) {
      const Table = require("./table");
      const { stateFieldsToWhere } = require("../plugin-helper");

      const tbl = await Table.findOne({ id: this.table_id });
      const fields = await tbl.getFields();
      const qstate = await stateFieldsToWhere({ fields, state: query });
      const rows = await tbl.getRows(qstate);
      const rendered = await this.viewtemplateObj.renderRows(
        tbl,
        this.name,
        this.configuration,
        extraArgs,
        rows
      );

      return rendered.map((html, ix) => ({ html, row: rows[ix] }));
    }

    throw new InvalidConfiguration(
      `runMany on view ${this.name}: viewtemplate ${this.viewtemplate} does not have renderRows or runMany methods`
    );
  }
  async runPost(query, body, extraArgs) {
    return await this.viewtemplateObj.runPost(
      this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query),
      removeEmptyStrings(body),
      extraArgs
    );
  }

  async runRoute(route, body, res, extraArgs) {
    const result = await this.viewtemplateObj.routes[route](
      this.table_id,
      this.name,
      this.configuration,
      body,
      extraArgs
    );
    if (result && result.json) res.json(result.json);
    else if (result && result.html) res.send(result.html);
    else res.json({ success: "ok" });
  }

  combine_state_and_default_state(req_query) {
    var state = { ...req_query };
    const defstate = this.viewtemplateObj.default_state_form
      ? this.viewtemplateObj.default_state_form(this.configuration)
      : {};

    Object.entries(defstate || {}).forEach(([k, v]) => {
      if (!state[k]) {
        state[k] = v;
      }
    });
    return state;
  }
  async get_state_form(query, req) {
    const vt_display_state_form = this.viewtemplateObj.display_state_form;
    const display_state_form =
      typeof vt_display_state_form === "function"
        ? vt_display_state_form(this.configuration)
        : vt_display_state_form;
    if (display_state_form) {
      const fields = await this.get_state_fields();

      fields.forEach((f) => {
        f.required = false;
        if (f.label === "Anywhere" && f.name === "_fts")
          f.label = req.__(f.label);
        if (f.type && f.type.name === "Bool") f.fieldview = "tristate";
        if (f.type && f.type.read && typeof query[f.name] !== "undefined") {
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
      await form.fill_fkey_options(true);
      return form;
    } else return null;
  }

  async get_config_flow(req) {
    const configFlow = this.viewtemplateObj.configuration_workflow(req);
    configFlow.action = `/viewedit/config/${encodeURIComponent(this.name)}`;
    const oldOnDone = configFlow.onDone || ((c) => c);
    configFlow.onDone = async (ctx) => {
      const { table_id, ...configuration } = await oldOnDone(ctx);

      await View.update({ configuration }, this.id);
      return {
        redirect: `/viewedit`,
        flash: ["success", `View ${this.name || ""} saved`],
      };
    };
    return configFlow;
  }
}

View.contract = {
  variables: {
    name: is.str,
    id: is.maybe(is.posint),
    table_id: is.maybe(is.posint),
    viewtemplate: is.str,
    min_role: is.posint,
    viewtemplateObj: is.maybe(is_viewtemplate),
    default_render_page: is.maybe(is.str),
  },
  methods: {
    get_state_fields: is.fun([], is.promise(is.array(fieldlike))),
    get_state_form: is.fun(
      [is.obj(), is.obj({ __: is.fun(is.str, is.str) })],
      is.promise(is.maybe(is.class("Form")))
    ),
    get_config_flow: is.fun(
      is.obj({ __: is.fun(is.str, is.str) }),
      is.promise(is.class("Workflow"))
    ),
    delete: is.fun([], is.promise(is.undefined)),
    menu_label: is.getter(is.maybe(is.str)),
    run: is.fun(
      [is.obj(), is.obj({ req: is.defined, res: is.defined })],
      is.promise(is.any)
    ),
    runPost: is.fun(
      [is.obj(), is.obj(), is.obj({ req: is.defined, res: is.defined })],
      is.promise(is.any)
    ),
    runRoute: is.fun(
      [
        is.str,
        is.obj(),
        is.obj(),
        is.obj({ req: is.defined, res: is.defined }),
      ],
      is.promise(is.any)
    ),
    runMany: is.fun(
      [is.obj(), is.obj({ req: is.defined, res: is.defined })],
      is.promise(is.array(is.obj({ html: is.defined, row: is.obj() })))
    ),
    combine_state_and_default_state: is.fun(is.obj(), is.obj()),
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("View")))
    ),
    findOne: is.fun(is.obj(), is.maybe(is.class("View"))),
    create: is.fun(
      is.obj({
        name: is.str,
        table_id: is.maybe(is.posint),
        viewtemplate: is.str,
      }),
      is.promise(is.class("View"))
    ),
    update: is.fun([is.obj(), is.posint], is.promise(is.undefined)),
    delete: is.fun(is.obj(), is.promise(is.undefined)),

    find_possible_links_to_table: is.fun(
      is.or(is.posint, is_tablely, is.str),
      is.promise(is.array(is.class("View")))
    ),
    find_all_views_where: is.fun(
      is.fun(
        is.obj({
          viewrow: is.class("View"),
          viewtemplate: is.obj(),
          state_fields: is.array(fieldlike),
        }),
        is.bool
      ),
      is.promise(is.array(is.class("View")))
    ),
    find_table_views_where: is.fun(
      [
        is.or(is.posint, is_tablely, is.str),
        is.fun(
          is.obj({
            viewrow: is.class("View"),
            viewtemplate: is.obj(),
            state_fields: is.array(fieldlike),
          }),
          is.bool
        ),
      ],
      is.promise(is.array(is.class("View")))
    ),
  },
};
module.exports = View;
