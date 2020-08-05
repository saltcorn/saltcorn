const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");
const { is_stale } = require("./pack");
const fetch = require("node-fetch");

class Plugin {
  constructor(o) {
    this.id = o.id ? +o.id : o.id;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
    this.version = o.version;
    this.configuration = o.configuration;
    contract.class(this);
  }
  static async findOne(where) {
    return new Plugin(await db.selectOne("_sc_plugins", where));
  }
  static async find(where) {
    return (await db.select("_sc_plugins", where)).map(p => new Plugin(p));
  }
  async upsert() {
    const row = {
      name: this.name,
      source: this.source,
      location: this.location,
      version: this.version,
      configuration: this.configuration
    };
    if (typeof this.id === "undefined") {
      // insert
      await db.insert("_sc_plugins", row);
    } else {
      await db.update("_sc_plugins", row, this.id);
    }
  }
  async delete() {
    await db.deleteWhere("_sc_plugins", { id: this.id });
  }

  async dependant_views() {
    const views = await View.find({});
    const { getState } = require("../db/state");
    const myViewTemplates = getState().plugins[this.name].viewtemplates || [];
    const vt_names = myViewTemplates.map(vt => vt.name);
    return views
      .filter(v => vt_names.includes(v.viewtemplate))
      .map(v => v.name);
  }

  static async store_plugins_available() {
    const { getState } = require("../db/state");
    const stored = getState().getConfig("available_plugins", false);
    const stored_at = getState().getConfig(
      "available_plugins_fetched_at",
      false
    );
    if (!stored || !stored_at || is_stale(stored_at)) {
      const from_api = await Plugin.store_plugins_available_from_store();
      await getState().setConfig("available_plugins", from_api);
      await getState().setConfig("available_plugins_fetched_at", new Date());
      return from_api;
    } else return stored.map(p => new Plugin(p));
  }
  static async store_plugins_available_from_store() {
    //console.log("fetch plugins");
    const response = await fetch("http://store.saltcorn.com/api/extensions");
    const json = await response.json();
    return json.success.map(p => new Plugin(p));
  }

  static async store_by_name(name) {
    const response = await fetch(
      "http://store.saltcorn.com/api/extensions?name=" +
        encodeURIComponent(name)
    );
    const json = await response.json();
    if (json.success.length == 1)
      return new Plugin({ version: "latest", ...json.success[0] });
    else return null;
  }
}
Plugin.contract = {
  variables: {
    id: is.maybe(is.posint),
    location: is.str,
    name: is.str,
    version: is.maybe(is.str),
    configuration: is.maybe(is.obj()),
    source: is.one_of(["npm", "github", "local"])
  },
  methods: {
    upsert: is.fun([], is.promise(is.eq(undefined))),
    delete: is.fun([], is.promise(is.eq(undefined))),
    dependant_views: is.fun([], is.promise(is.array(is.str)))
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("Plugin")))),
    findOne: is.fun(is.obj(), is.promise(is.class("Plugin"))),
    store_by_name: is.fun(is.str, is.promise(is.maybe(is.class("Plugin")))),
    store_plugins_available_from_store: is.fun(
      [],
      is.promise(is.array(is.class("Plugin")))
    ),
    store_plugins_available: is.fun(
      [],
      is.promise(is.array(is.class("Plugin")))
    )
  }
};

module.exports = Plugin;
