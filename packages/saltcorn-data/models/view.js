const db = require("../db");
const Form = require("../models/form");
const { contract, is } = require("contractis");
const { fieldlike, is_viewtemplate } = require("../contracts");
const { removeEmptyStrings, numberToBool, stringToJSON } = require("../utils");

class View {
  constructor(o) {
    this.name = o.name;
    this.id = o.id;
    this.viewtemplate = o.viewtemplate;
    if (o.table_id) this.table_id = o.table_id;
    if (o.table && !o.table_id) {
      this.table_id = o.table.id;
    }
    this.configuration = stringToJSON(o.configuration);
    this.min_role =
      !o.min_role && typeof o.is_public !== "undefined"
        ? o.is_public
          ? 10
          : 8
        : +o.min_role;
    this.on_root_page = numberToBool(o.on_root_page);
    const { getState } = require("../db/state");
    this.viewtemplateObj = getState().viewtemplates[this.viewtemplate];
    contract.class(this);
  }
  static async findOne(where) {
    const v = await db.selectMaybeOne("_sc_views", where);
    return v ? new View(v) : v;
  }
  static async find(where, selectopts) {
    const views = await db.select("_sc_views", where, selectopts);

    return views.map(v => new View(v));
  }

  async get_state_fields() {
    if (this.viewtemplateObj.get_state_fields) {
      return await this.viewtemplateObj.get_state_fields(
        this.table_id,
        this.name,
        this.configuration
      );
    } else return [];
  }
  get menu_label() {
    const { getState } = require("../db/state");
    const menu_items = getState().getConfig("menu_items", []);
    const item = menu_items.find(mi => mi.viewname === this.name);
    return item ? item.label : undefined;
  }
  static async find_table_views_where(table_id, pred) {
    var link_view_opts = [];
    const link_views = await View.find({
      table_id
    });

    for (const viewrow of link_views) {
      // may fail if incomplete view
      const sfs = await viewrow.get_state_fields();
      if (
        pred({
          viewrow,
          viewtemplate: viewrow.viewtemplateObj,
          state_fields: sfs
        })
      )
        link_view_opts.push(viewrow);
    }
    return link_view_opts;
  }

  static async find_all_views_where(pred) {
    var link_view_opts = [];
    const link_views = await View.find({});

    for (const viewrow of link_views) {
      // may fail if incomplete view
      const sfs = await viewrow.get_state_fields();
      if (
        pred({
          viewrow,
          viewtemplate: viewrow.viewtemplateObj,
          state_fields: sfs
        })
      )
        link_view_opts.push(viewrow);
    }
    return link_view_opts;
  }

  static async find_possible_links_to_table(table_id) {
    return View.find_table_views_where(table_id, ({ state_fields }) =>
      state_fields.some(sf => sf.name === "id")
    );
  }

  static async create(v) {
    if (!v.min_role && typeof v.is_public !== "undefined") {
      v.min_role = v.is_public ? 10 : 8;
      delete v.is_public;
    }
    const id = await db.insert("_sc_views", v);
    await require("../db/state")
      .getState()
      .refresh();
    return new View({ id, ...v });
  }
  async delete() {
    await View.delete({ id: this.id });
  }
  static async delete(where) {
    await db.deleteWhere("_sc_views", where);
    await require("../db/state")
      .getState()
      .refresh();
  }
  static async update(v, id) {
    await db.update("_sc_views", v, id);
    await require("../db/state")
      .getState()
      .refresh();
  }

  async run(query, extraArgs) {
    return await this.viewtemplateObj.run(
      this.table_id,
      this.name,
      this.configuration,
      removeEmptyStrings(query),
      extraArgs
    );
  }
  async runMany(query, extraArgs) {
    return await this.viewtemplateObj.runMany(
      this.table_id,
      this.name,
      this.configuration,
      query,
      extraArgs
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
    if (result.json) res.json(result.json);
    else if (result.html) res.send(result.html);
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
  async get_state_form(query) {
    const vt_display_state_form = this.viewtemplateObj.display_state_form;
    const display_state_form =
      typeof vt_display_state_form === "function"
        ? vt_display_state_form(this.configuration)
        : vt_display_state_form;
    if (display_state_form) {
      const fields = await this.get_state_fields();

      fields.forEach(f => {
        f.required = false;
        if (f.type && f.type.name === "Bool") f.fieldview = "tristate";
        if (f.type && f.type.read && typeof query[f.name] !== "undefined") {
          query[f.name] = f.type.read(query[f.name]);
        }
      });
      const form = new Form({
        methodGET: true,
        action: `/view/${encodeURIComponent(this.name)}`,
        fields,
        submitLabel: "Apply",
        isStateForm: true,
        values: removeEmptyStrings(query)
      });
      await form.fill_fkey_options(true);
      return form;
    } else return null;
  }

  async get_config_flow() {
    const configFlow = this.viewtemplateObj.configuration_workflow();
    configFlow.action = `/viewedit/config/${encodeURIComponent(this.name)}`;
    const oldOnDone = configFlow.onDone || (c => c);
    configFlow.onDone = async ctx => {
      const { table_id, ...configuration } = oldOnDone(ctx);

      await View.update({ configuration }, this.id);

      return { redirect: `/viewedit` };
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
    viewtemplateObj: is.maybe(is_viewtemplate)
  },
  methods: {
    get_state_fields: is.fun([], is.promise(is.array(fieldlike))),
    get_state_form: is.fun(is.obj(), is.promise(is.maybe(is.class("Form")))),
    get_config_flow: is.fun([], is.promise(is.class("Workflow"))),
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
        is.obj({ req: is.defined, res: is.defined })
      ],
      is.promise(is.any)
    ),
    runMany: is.fun(
      [is.obj(), is.obj({ req: is.defined, res: is.defined })],
      is.promise(is.array(is.obj({ html: is.defined, row: is.obj() })))
    ),
    combine_state_and_default_state: is.fun(is.obj(), is.obj())
  },
  static_methods: {
    find: is.fun(
      [is.maybe(is.obj()), is.maybe(is.obj())],
      is.promise(is.array(is.class("View")))
    ),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("View")))),
    create: is.fun(
      is.obj({
        name: is.str,
        table_id: is.posint,
        viewtemplate: is.str
      }),
      is.promise(is.class("View"))
    ),
    update: is.fun([is.obj(), is.posint], is.promise(is.undefined)),
    delete: is.fun(is.obj(), is.promise(is.undefined)),

    find_possible_links_to_table: is.fun(
      is.posint,
      is.promise(is.array(is.class("View")))
    ),
    find_all_views_where: is.fun(
      is.fun(
        is.obj({
          viewrow: is.class("View"),
          viewtemplate: is.obj(),
          state_fields: is.array(fieldlike)
        }),
        is.bool
      ),
      is.promise(is.array(is.class("View")))
    ),
    find_table_views_where: is.fun(
      [
        is.posint,
        is.fun(
          is.obj({
            viewrow: is.class("View"),
            viewtemplate: is.obj(),
            state_fields: is.array(fieldlike)
          }),
          is.bool
        )
      ],
      is.promise(is.array(is.class("View")))
    )
  }
};
module.exports = View;
