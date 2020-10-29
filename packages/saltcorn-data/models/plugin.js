const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");
const { is_stale } = require("./pack");
const fetch = require("node-fetch");
const { stringToJSON } = require("../utils");

class Plugin {
  constructor(o) {
    this.id = o.id ? +o.id : o.id;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
    this.version = o.version;
    this.description = o.description;
    this.documentation_link = o.documentation_link;
    this.has_theme = o.has_theme;
    this.configuration = stringToJSON(o.configuration);
    contract.class(this);
  }
  static async findOne(where) {
    const p = await db.selectMaybeOne("_sc_plugins", where);
    return p ? new Plugin(p) : p;
  }
  static async find(where) {
    return (await db.select("_sc_plugins", where)).map((p) => new Plugin(p));
  }
  async upsert() {
    const row = {
      name: this.name,
      source: this.source,
      location: this.location,
      version: this.version,
      configuration: this.configuration,
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
    const { getState } = require("../db/state");
    getState().remove_plugin(this.name);
  }

  async upgrade_version(requirePlugin) {
    if (this.source === "npm") {
      const old_version = this.version;
      this.version = "latest";
      const { version } = await requirePlugin(this, true);
      if (version && version !== old_version) {
        this.version = version;
        this.upsert();
      }
    } else {
      await requirePlugin(this, true);
    }
  }

  async dependant_views() {
    const views = await View.find({});
    const { getState } = require("../db/state");
    if (!getState().plugins[this.name]) return [];
    const myViewTemplates = getState().plugins[this.name].viewtemplates || [];
    const vt_names = myViewTemplates.map((vt) => vt.name);
    return views
      .filter((v) => vt_names.includes(v.viewtemplate))
      .map((v) => v.name);
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
    } else return stored.map((p) => new Plugin(p));
  }
  static async store_plugins_available_from_store() {
    //console.log("fetch plugins");
    const response = await fetch("http://store.saltcorn.com/api/extensions");
    const json = await response.json();
    return json.success.map((p) => new Plugin(p));
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
    documentation_link: is.maybe(is.str),
    configuration: is.maybe(is.obj()),
    source: is.one_of(["npm", "github", "local"]),
  },
  methods: {
    upsert: is.fun([], is.promise(is.eq(undefined))),
    delete: is.fun([], is.promise(is.eq(undefined))),
    dependant_views: is.fun([], is.promise(is.array(is.str))),
  },
  static_methods: {
    find: is.fun(is.maybe(is.obj()), is.promise(is.array(is.class("Plugin")))),
    findOne: is.fun(is.obj(), is.promise(is.maybe(is.class("Plugin")))),
    store_by_name: is.fun(is.str, is.promise(is.maybe(is.class("Plugin")))),
    store_plugins_available_from_store: is.fun(
      [],
      is.promise(is.array(is.class("Plugin")))
    ),
    store_plugins_available: is.fun(
      [],
      is.promise(is.array(is.class("Plugin")))
    ),
  },
};

module.exports = Plugin;
