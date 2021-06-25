const db = require("../db");
const { contract, is } = require("contractis");
const View = require("./view");
const { is_stale } = require("./pack");
const fetch = require("node-fetch");
const { stringToJSON } = require("../utils");

/**
 * Plugin Class
 */
class Plugin {
  /**
   * Plugin constructor
   * @param o
   */
  constructor(o) {
    this.id = o.id ? +o.id : o.id;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
    this.version = o.version;
    this.description = o.description;
    this.documentation_link = o.documentation_link;
    this.has_theme = o.has_theme;
    this.has_auth = o.has_auth;
    this.configuration = stringToJSON(o.configuration);
    contract.class(this);
  }

  /**
   * Find one plugin
   * @param where - where object
   * @returns {Promise<Plugin|null|*>} return existing plugin or new plugin
   */
  static async findOne(where) {
    const p = await db.selectMaybeOne("_sc_plugins", where);
    return p ? new Plugin(p) : p;
  }

  /**
   * Find plugins
   * @param where - where object
   * @returns {Promise<*>} returns plugins list
   */
  static async find(where) {
    return (await db.select("_sc_plugins", where)).map((p) => new Plugin(p));
  }

  /**
   * Update or Insert plugin
   * @returns {Promise<void>}
   */
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

  /**
   * Delete plugin
   * @returns {Promise<void>}
   */
  async delete() {
    await db.deleteWhere("_sc_plugins", { id: this.id });
    const { getState } = require("../db/state");
    await getState().remove_plugin(this.name);
  }

  /**
   * Upgrade plugin version
   * @param requirePlugin
   * @returns {Promise<void>}
   */
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

  /**
   * List of views relay on this plugin
   * @returns {Promise<*[]|*>}
   */
  async dependant_views() {
    const views = await View.find({});
    const { getState } = require("../db/state");
    if (!getState().plugins[this.name]) return [];
    const myViewTemplates = getState().plugins[this.name].viewtemplates || [];
    const vt_names = Array.isArray(myViewTemplates)
      ? myViewTemplates.map((vt) => vt.name)
      : typeof myViewTemplates === "function"
      ? myViewTemplates(getState().plugin_cfgs[this.name]).map((vt) => vt.name)
      : Object.keys(myViewTemplates);
    return views
      .filter((v) => vt_names.includes(v.viewtemplate))
      .map((v) => v.name);
  }

  /**
   * List plugins availabe in store
   * @returns {Promise<*>}
   */
  static async store_plugins_available() {
    const { getState } = require("../db/state");
    const stored = getState().getConfig("available_plugins", false);
    const stored_at = getState().getConfig(
      "available_plugins_fetched_at",
      false
    );
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

    if (!stored || !stored_at || is_stale(stored_at)) {
      try {
        const from_api = await Plugin.store_plugins_available_from_store();
        await getState().setConfig("available_plugins", from_api);
        await getState().setConfig("available_plugins_fetched_at", new Date());
        return from_api.filter((p) => isRoot || !p.has_auth);
      } catch (e) {
        console.error(e);
        if (stored)
          return stored
            .map((p) => new Plugin(p))
            .filter((p) => isRoot || !p.has_auth);
        else throw e;
      }
    } else
      return stored
        .map((p) => new Plugin(p))
        .filter((p) => isRoot || !p.has_auth);
  }

  /**
   *
   * @returns {Promise<*>}
   */
  static async store_plugins_available_from_store() {
    //console.log("fetch plugins");
    // TODO support of other store URLs
    const response = await fetch("http://store.saltcorn.com/api/extensions");
    const json = await response.json();
    return json.success.map((p) => new Plugin(p));
  }

  /**
   *
   * @param name
   * @returns {Promise<null|Plugin>}
   */
  static async store_by_name(name) {
    // TODO support of other store URLs
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
    source: is.one_of(["npm", "github", "local", "git"]),
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
