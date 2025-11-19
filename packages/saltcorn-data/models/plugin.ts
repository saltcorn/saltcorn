/**
 * Plugin Database Access Layer
 * @category saltcorn-data
 * @module models/plugin
 * @subcategory models
 */
import db from "../db";
import View from "./view";
const { isStale, getFetchProxyOptions } = require("../utils");
import fetch from "node-fetch";
import { Where } from "@saltcorn/db-common/internal";
import { ViewTemplate, PluginSourceType } from "@saltcorn/types/base_types";
import type {
  PluginCfg,
  PluginPack,
} from "@saltcorn/types/model-abstracts/abstract_plugin";

const { stringToJSON } = require("../utils");

/**
 * Plugin Class
 * @category saltcorn-data
 */
class Plugin {
  id?: number;
  location: string;
  name: string;
  version?: string | number;
  documentation_link?: string;
  configuration?: any;
  source: PluginSourceType;
  description?: string;
  has_theme?: boolean;
  has_auth?: boolean;
  unsafe?: boolean;
  deploy_private_key?: string;

  /**
   * Plugin constructor
   * @param {object} o
   */
  constructor(o: PluginCfg | PluginPack | Plugin) {
    this.id = o.id ? +o.id : undefined;
    this.name = o.name;
    this.source = o.source;
    this.location = o.location;
    this.version = o.version;
    this.description = o.description;
    this.documentation_link = o.documentation_link;
    this.has_theme = o.has_theme;
    this.has_auth = o.has_auth;
    this.unsafe = o.unsafe;
    this.deploy_private_key = o.deploy_private_key;
    this.configuration = stringToJSON(o.configuration);
  }

  /**
   * Find one plugin
   * @param where - where object
   * @returns {Promise<Plugin|null|*>} return existing plugin or new plugin
   */
  static async findOne(where: Where): Promise<Plugin | null> {
    const p = await db.selectMaybeOne("_sc_plugins", where);
    return p ? new Plugin(p) : p;
  }

  /**
   * Find plugins
   * @param where - where object
   * @returns {Promise<*>} returns plugins list
   */
  static async find(where?: Where): Promise<Array<Plugin>> {
    return (await db.select("_sc_plugins", where)).map(
      (p: PluginCfg) => new Plugin(p)
    );
  }

  /**
   * Update or Insert plugin
   * @returns {Promise<void>}
   */
  async upsert(): Promise<void> {
    const row = {
      name: this.name,
      source: this.source,
      location: this.location,
      version: this.version,
      configuration: this.configuration,
      deploy_private_key: this.deploy_private_key,
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
  async delete(): Promise<void> {
    await db.deleteWhere("_sc_plugins", { id: this.id });
    const { getState } = require("../db/state");
    await getState().remove_plugin(this.name);
    await getState().refreshUserLayouts();
  }

  /**
   * Upgrade plugin version
   * @param requirePlugin
   * @returns {Promise<void>}
   */
  async upgrade_version(
    requirePlugin: (arg0: Plugin, arg1: boolean) => Plugin,
    newVersion?: string
  ): Promise<void> {
    if (this.source === "npm") {
      const old_version = this.version;
      this.version = newVersion || "latest";
      const { version } = await requirePlugin(this, true);
      if (version && version !== old_version) {
        this.version = version;
        await this.upsert();
      }
    } else {
      await requirePlugin(this, true);
    }
  }

  /**
   * List of views relay on this plugin
   * @returns {Promise<string[]>}
   */
  async dependant_views(): Promise<string[]> {
    const views = await View.find({}, { cached: true });
    const { getState } = require("../db/state");
    if (!getState().plugins[this.name]) return [];
    const myViewTemplates = getState().plugins[this.name].viewtemplates || [];
    const vt_names = Array.isArray(myViewTemplates)
      ? myViewTemplates.map((vt) => vt.name)
      : typeof myViewTemplates === "function"
        ? myViewTemplates(getState().plugin_cfgs[this.name]).map(
            (vt: ViewTemplate) => vt.name
          )
        : Object.keys(myViewTemplates);
    return views
      .filter((v) => vt_names.includes(v.viewtemplate) && !v.singleton)
      .map((v) => v.name);
  }

  ready_for_mobile(): boolean {
    const state = require("../db/state").getState();
    let module = state.plugins[this.name];
    if (!module && state.plugin_module_names[this.name])
      module = state.plugins[state.plugin_module_names[this.name]];
    return module?.ready_for_mobile === true;
  }

  static get_cached_plugins(): Array<Plugin> {
    const { getState } = require("../db/state");

    const stored = getState().getConfigCopy("available_plugins", false);
    return stored || [];
  }
  /**
   * List plugins available in store
   * @returns {Promise<*>}
   */
  static async store_plugins_available(): Promise<Array<Plugin>> {
    const { getState } = require("../db/state");
    const stored = getState().getConfig("available_plugins", false);
    const stored_at = getState().getConfig(
      "available_plugins_fetched_at",
      false
    );
    const airgap = getState().getConfig("airgap", false);

    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

    if (!airgap && (!stored || !stored_at || isStale(stored_at))) {
      try {
        const from_api = await Plugin.store_plugins_available_from_store();
        await getState().setConfig("available_plugins", from_api);
        await getState().setConfig("available_plugins_fetched_at", new Date());
        return from_api.filter((p) => isRoot || !p.has_auth);
      } catch (e) {
        console.error(e);
        if (stored)
          return stored
            .map((p: Plugin) => new Plugin(p))
            .filter((p: Plugin) => isRoot || !p.has_auth);
        else return [];
      }
    } else
      return (stored || [])
        .map((p: Plugin) => new Plugin(p))
        .filter((p: Plugin) => isRoot || !p.has_auth);
  }

  /**
   *
   * @returns {Promise<*>}
   */
  static async store_plugins_available_from_store(): Promise<Array<Plugin>> {
    //console.log("fetch plugins");
    const { getState } = require("../db/state");
    const plugins_store_endpoint = getState().getConfig(
      "plugins_store_endpoint",
      false
    );
    // console.log(`[store_plugins_available_from_store] plugins_store_endpoint:%s`, plugins_store_endpoint);

    const fetchOptions = getFetchProxyOptions();

    getState().log(
      6,
      `store_plugins_available_from_store fetch options: ${JSON.stringify(
        fetchOptions
      )}`
    );

    const response = await fetch(plugins_store_endpoint, fetchOptions);
    const json: any = await response.json();
    return json.success.map((p: PluginCfg) => new Plugin(p));
  }

  /**
   *
   * @param name
   * @returns {Promise<null|Plugin>}
   */
  static async store_by_name(name: string): Promise<Plugin | null> {
    const { getState } = require("../db/state");
    const plugins_store_endpoint = getState().getConfig(
      "plugins_store_endpoint",
      false
    );
    // console.log(`[store_by_name] plugins_store_endpoint:%s`, plugins_store_endpoint);

    const response = await fetch(
      plugins_store_endpoint + "?name=" + encodeURIComponent(name),
      getFetchProxyOptions()
    );
    const json: any = await response.json();
    if (json.success.length == 1)
      return new Plugin({ version: "latest", ...json.success[0] });
    else return null;
  }
}

export = Plugin;
