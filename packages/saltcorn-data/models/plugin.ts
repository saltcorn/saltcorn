/**
 * Plugin Database Access Layer
 * @category saltcorn-data
 * @module models/plugin
 * @subcategory models
 */
import db from "../db";
import View from "./view";
import fetch from "node-fetch";
import { SelectOptions, Where } from "@saltcorn/db-common/internal";
import { ViewTemplate, PluginSourceType } from "@saltcorn/types/base_types";
import type {
  PluginCfg,
  PluginPack,
  AbstractPlugin,
} from "@saltcorn/types/model-abstracts/abstract_plugin";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import utils from "../utils";
const {
  stringToJSON,
  isStale,
  getFetchProxyOptions,
  pluginsFolderRoot,
  isRoot,
} = utils;

const npmFetch = require("npm-registry-fetch");
let packagejson: any = null;
try {
  packagejson = require("../package.json");
} catch (error: any) {
  packagejson = require("../../package.json");
}

/**
 * Plugin Class
 * @category saltcorn-data
 */
class Plugin implements AbstractPlugin {
  id?: number;
  location: string;
  name: string;
  version?: string | number;
  documentation_link?: string;
  configuration?: any;
  source: PluginSourceType;
  description?: string;
  contents?: string;
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
    this.contents = o.contents;
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
  static async find(
    where?: Where,
    selectopts?: SelectOptions
  ): Promise<Array<Plugin>> {
    return (await db.select("_sc_plugins", where, selectopts)).map(
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
    await getState().refresh_userlayouts();
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

  exclude_from_mobile(): boolean {
    const state = require("../db/state").getState();
    let module = state.plugins[this.name];
    if (!module && state.plugin_module_names[this.name])
      module = state.plugins[state.plugin_module_names[this.name]];
    return module?.ready_for_mobile === false;
  }

  static get_cached_plugins(): Array<Plugin> {
    const { getState } = require("../db/state");

    const stored = getState().getConfigCopy("available_plugins", false);
    return stored || [];
  }

  static get local_store_entries_filepath(): string {
    return path.join(pluginsFolderRoot, "store_entries.json");
  }
  static get local_store_entries_exists(): boolean {
    return existsSync(Plugin.local_store_entries_filepath);
  }
  static async read_local_store_entries(): Promise<any> {
    return JSON.parse(
      await fs.readFile(Plugin.local_store_entries_filepath, "utf8")
    );
  }
  /**
   * List plugins available in store
   * @param msgs - optional packages/plugins-loader/plugin_installer.jsmessages array
   * @returns {Promise<*>}
   */
  static async store_plugins_available(
    msgs?: Array<string>
  ): Promise<Array<Plugin>> {
    const { getState, getRootState } = require("../db/state");
    const stored = getState().getConfig("available_plugins", false);
    const stored_at = getState().getConfig(
      "available_plugins_fetched_at",
      false
    );
    const airgap = getState().getConfig("airgap", false);

    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

    if (airgap) {
      try {
        const modInfos = getRootState().getConfig(
          "pre_installed_module_infos",
          []
        );
        return modInfos
          .map((p: PluginCfg) => new Plugin(p))
          .filter((p: Plugin) => isRoot || !p.has_auth);
      } catch (e) {
        getState().log(2, `Error reading store_entries.json: ${e}`);
        if (msgs) msgs.push("Error reading local plugin store entries.");
        return [];
      }
    } else if (!stored || !stored_at || isStale(stored_at)) {
      try {
        const from_api = await Plugin.store_plugins_available_from_store();
        await getState().setConfig("available_plugins", from_api);
        await getState().setConfig("available_plugins_fetched_at", new Date());
        return from_api.filter((p) => isRoot || !p.has_auth);
      } catch (e) {
        getState().log(2, `Error fetching plugin store entries: ${e}`);
        if (stored) {
          return stored
            .map((p: Plugin) => new Plugin(p))
            .filter((p: Plugin) => isRoot || !p.has_auth);
        }
        try {
          const modInfos = getRootState().getConfig(
            "pre_installed_module_infos",
            []
          );
          return modInfos
            .map((p: Plugin) => new Plugin(p))
            .filter((p: Plugin) => isRoot || !p.has_auth);
        } catch (e2) {
          getState().log(2, `Error reading store_entries.json: ${e2}`);
          if (msgs)
            msgs.push(
              "The store is not reachable and reading the local entries failed."
            );
          return [];
        }
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
  static async store_plugins_available_from_store(
    endpoint?: string
  ): Promise<Array<Plugin>> {
    //console.log("fetch plugins");
    const { getState } = require("../db/state");
    const plugins_store_endpoint =
      endpoint || getState().getConfig("plugins_store_endpoint", false);
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
  static async store_by_name(
    name: string,
    endpoint?: string
  ): Promise<Plugin | null> {
    const { getState } = require("../db/state");
    const plugins_store_endpoint =
      endpoint || getState().getConfig("plugins_store_endpoint", false);
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

  /**
   * check if plugin is base-plugin or sbadmin2
   * @param name
   * @returns
   */
  static is_fixed_plugin(name: string): boolean {
    return ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"].includes(name);
  }

  // ── plugin loading / installation ──────────────────────────────────────

  /**
   * Return cached engine constraint metadata for a plugin, fetching from npm if needed
   * @param plugin - plugin whose npm location is queried
   * @param forceFetch - bypass the cache and re-fetch from npm
   * @returns map of `{ version: { engines?: { saltcorn: string } } }`
   */
  static async getEngineInfos(
    plugin: Plugin,
    forceFetch?: boolean
  ): Promise<any> {
    const { getRootState, getState } = require("../db/state");
    const cached = getRootState().getConfig("engines_cache", {}) || {};
    const airgap = getState().getConfig("airgap", false);
    if (airgap || (cached[plugin.location] && !forceFetch)) {
      return cached[plugin.location] || {};
    } else {
      getState().log(5, `Fetching versions for '${plugin.location}'`);
      const pkgInfo = await npmFetch.json(
        `https://registry.npmjs.org/${plugin.location}`,
        getFetchProxyOptions()
      );
      const versions = pkgInfo.versions;
      const newCached: Record<string, any> = {};
      for (const [k, v] of Object.entries(versions) as [string, any][]) {
        newCached[k] = v.engines?.saltcorn
          ? { engines: { saltcorn: v.engines.saltcorn } }
          : {};
      }
      cached[plugin.location] = newCached;
      await getRootState().setConfig("engines_cache", { ...cached });
      return newCached;
    }
  }

  /**
   * Check the saltcorn engine property and change the plugin version if necessary
   * @param plugin - plugin to validate; `plugin.version` may be mutated
   * @param forceFetch - bypass the engine-info cache when checking versions
   */
  static async ensurePluginSupport(
    plugin: Plugin,
    forceFetch?: boolean
  ): Promise<void> {
    const { getState } = require("../db/state");
    const { supportedVersion, resolveLatest } = require(
      "@saltcorn/plugins-loader/stable_versioning"
    );
    let versions = await Plugin.getEngineInfos(plugin, forceFetch);
    if (
      plugin.version &&
      plugin.version !== "latest" &&
      !versions[plugin.version] &&
      !forceFetch
    ) {
      versions = await Plugin.getEngineInfos(plugin, true);
    }
    const supported = supportedVersion(
      plugin.version || "latest",
      versions,
      packagejson.version
    );
    if (!supported) {
      if (getState().getConfig("airgap", false))
        getState().log(
          5,
          `Warning: No supported version for '${plugin.location}' in airgap mode"}`
        );
      else
        throw new Error(
          `Unable to find a supported version for '${plugin.location}'`
        );
    } else if (
      supported !== plugin.version ||
      (plugin.version === "latest" && supported !== resolveLatest(versions))
    )
      plugin.version = supported;
  }

  /**
   * Load one plugin and register in state (without DB save)
   * @param plugin - plugin to load
   * @param force - remove the install directory and retry on registration failure
   * @param forceFetch - bypass the engine-info cache when resolving versions
   * @param reloadModule - force a fresh module load even if already cached
   * @returns PluginInstaller result (`{ plugin_module, location, … }`)
   */
  static async loadPlugin(
    plugin: Plugin,
    force?: boolean,
    forceFetch?: boolean,
    reloadModule = false
  ): Promise<any> {
    const { getState, getRootState } = require("../db/state");
    const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
    if (
      !isRoot() &&
      !getRootState().getConfig("tenants_install_git", false) &&
      (plugin.source === "git" || plugin.source === "github")
    ) {
      console.error("\nWARNING: Skipping git/github plugin ", plugin.name);
      return;
    }
    if (plugin.source === "npm" && !Plugin.is_fixed_plugin(plugin.location)) {
      try {
        await Plugin.ensurePluginSupport(plugin, forceFetch);
      } catch (e) {
        console.log(
          `Warning: Unable to find a supported version for '${plugin.location}' Continuing with the installed version`
        );
      }
    }

    const airgap = getState().getConfig("airgap", false);
    if (airgap && !Plugin.is_fixed_plugin(plugin.location))
      Plugin.ensureAirgapedVersion(
        plugin,
        getRootState().getConfig("pre_installed_module_infos", [])
      );

    const loader = new PluginInstaller(plugin, {
      scVersion: packagejson.version,
      envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
      reloadModule,
      force,
    });
    const res = await loader.install();
    const configuration =
      typeof plugin.configuration === "string"
        ? JSON.parse(plugin.configuration)
        : plugin.configuration;
    try {
      getState().registerPlugin(
        res.plugin_module.plugin_name || plugin.name,
        res.plugin_module,
        configuration,
        res.location,
        res.name
      );
    } catch (error: any) {
      getState().log(
        3,
        `Error loading plugin ${plugin.name}: ${error.message || error}`
      );
      if (force) {
        await loader.remove();
        await loader.install();
        getState().registerPlugin(
          res.plugin_module.plugin_name || plugin.name,
          res.plugin_module,
          configuration,
          res.location,
          res.name
        );
      }
    }
    if (res.plugin_module.user_config_form)
      await getState().refresh_userlayouts();
    if (res.plugin_module.onLoad) {
      try {
        await res.plugin_module.onLoad(plugin.configuration);
      } catch (error) {
        console.error(error);
      }
    }

    if (isRoot() && res.plugin_module.authentication) {
      const { eachTenant } = require("@saltcorn/admin-models/models/tenant");
      await eachTenant(Plugin.reloadAuthFromRoot);
    }
    return res;
  }

  /**
   * Install plugin without registering in state or saving to database
   * @param plugin - plugin to install
   * @param force - force reinstall even if already present
   * @returns PluginInstaller result (`{ plugin_module, location, version, … }`)
   */
  static async requirePlugin(plugin: Plugin, force?: boolean): Promise<any> {
    const { getState, getRootState } = require("../db/state");
    const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
    const airgap = getState().getConfig("airgap", false);
    if (airgap && !Plugin.is_fixed_plugin(plugin.location))
      Plugin.ensureAirgapedVersion(
        plugin,
        getRootState().getConfig("pre_installed_module_infos", [])
      );

    const loader = new PluginInstaller(plugin, {
      scVersion: packagejson.version,
      envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
      force: force,
    });
    return await loader.install();
  }

  /**
   * Load all plugins from the database into state
   * @param force - passed through to {@link loadPlugin} for each plugin
   * @param reloadModule - force fresh module loads for each plugin
   */
  static async loadAllPlugins(
    force?: boolean,
    reloadModule = false
  ): Promise<void> {
    const { getState } = require("../db/state");
    await getState().refresh(true);
    const plugins = await db.select("_sc_plugins");
    for (const plugin of plugins) {
      try {
        await Plugin.loadPlugin(plugin, force, undefined, reloadModule);
      } catch (e) {
        console.error(e);
      }
    }
    await getState().refresh_userlayouts();
    await getState().refresh(true, true);
    if (!isRoot()) Plugin.reloadAuthFromRoot();
  }

  /**
   * Load plugin and its dependencies and save into local installation
   * @param plugin - plugin to install
   * @param force - force reinstall; retries after removing the install dir on failure
   * @param noSignalOrDB - skip database upsert and processSend signal (e.g. during restore)
   * @param __ - i18n translation function for user-facing messages
   * @param allowUnsafeOnTenantsWithoutConfigSetting - allow unsafe plugins on tenants without the global config flag
   * @param overwriteDependencies - substitute local paths for dependencies; testing only
   * @returns warning/info messages collected during install, or `undefined` if skipped
   */
  static async loadAndSaveNewPlugin(
    plugin: Plugin,
    force?: boolean,
    noSignalOrDB?: boolean,
    __: (str: string, ...args: any[]) => string = (str) => str,
    allowUnsafeOnTenantsWithoutConfigSetting?: boolean,
    overwriteDependencies?: Record<string, string>
  ): Promise<string[] | undefined> {
    const { getState, getRootState } = require("../db/state");
    const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
    const tenants_unsafe_plugins = getRootState().getConfig(
      "tenants_unsafe_plugins",
      false
    );
    const tenants_install_git = getRootState().getConfig(
      "tenants_install_git",
      false
    );
    if (
      !isRoot() &&
      !tenants_install_git &&
      (plugin.source === "git" || plugin.source === "github")
    ) {
      console.error("\nWARNING: Skipping git/github plugin ", plugin.name);
      return;
    }
    if (!isRoot() && !tenants_unsafe_plugins) {
      if (plugin.source !== "npm") {
        console.error("\nWARNING: Skipping unsafe plugin ", plugin.name);
        return;
      }
      await db.runWithTenant(
        db.connectObj.default_schema,
        async () => await Plugin.store_plugins_available()
      );

      const instore = getRootState().getConfig("available_plugins", []);
      const safes = instore
        .filter((p: any) => !p.unsafe)
        .map((p: any) => p.location);
      if (
        !safes.includes(plugin.location) &&
        !allowUnsafeOnTenantsWithoutConfigSetting
      ) {
        console.error("\nWARNING: Skipping unsafe plugin ", plugin.name);
        return;
      }
    }
    const airgap = getState().getConfig("airgap", false);
    if (plugin.source === "npm" && !airgap)
      await Plugin.ensurePluginSupport(plugin);
    if (airgap && !Plugin.is_fixed_plugin(plugin.location))
      Plugin.ensureAirgapedVersion(
        plugin,
        getRootState().getConfig("pre_installed_module_infos", [])
      );

    const loadMsgs: string[] = [];
    const loader = new PluginInstaller(plugin, {
      scVersion: packagejson.version,
      envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
      force: force,
    });
    const { version, plugin_module, location, loadedWithReload, msgs } =
      await loader.install();
    if (msgs) loadMsgs.push(...msgs);

    for (const loc of plugin_module.dependencies || []) {
      const overwrite = (overwriteDependencies || {})[loc];
      if (overwrite) {
        const pckJson = require(path.join(overwrite, "package.json"));
        await Plugin.loadAndSaveNewPlugin(
          new Plugin({
            name: pckJson.name,
            location: overwrite,
            source: "local",
          }),
          true,
          noSignalOrDB
        );
      } else {
        const existing = await Plugin.findOne({ location: loc });
        if (!existing && loc !== plugin.location) {
          await Plugin.loadAndSaveNewPlugin(
            new Plugin({
              name: loc.replace("@saltcorn/", ""),
              location: loc,
              source: "npm",
            }),
            force,
            noSignalOrDB
          );
        }
      }
    }

    let registeredWithReload = false;
    try {
      getState().registerPlugin(
        plugin_module.plugin_name || plugin.name,
        plugin_module,
        plugin.configuration,
        location,
        plugin.name
      );
    } catch (error) {
      if (force) {
        getState().log(
          2,
          `Error registering plugin ${plugin.name}. Removing and trying again.`
        );
        await loader.remove();
        await loader.install();
        getState().registerPlugin(
          plugin_module.plugin_name || plugin.name,
          plugin_module,
          plugin.configuration,
          location,
          plugin.name
        );
        registeredWithReload = true;
      } else {
        throw error;
      }
    }
    if (loadedWithReload || registeredWithReload) {
      loadMsgs.push(
        __(
          "The plugin was corrupted and had to be repaired. We recommend restarting your server.",
          plugin.name
        )
      );
    }
    if (plugin_module.onLoad) {
      try {
        await plugin_module.onLoad(plugin.configuration);
      } catch (error) {
        console.error(error);
      }
    }
    if (version) plugin.version = version;

    if (isRoot() && plugin_module.authentication) {
      const { eachTenant } = require("@saltcorn/admin-models/models/tenant");
      await eachTenant(Plugin.reloadAuthFromRoot);
    }

    if (!noSignalOrDB) {
      await plugin.upsert();
      getState().processSend({
        installPlugin: plugin,
        tenant: db.getTenantSchema(),
        force: false,
      });
    }
    return loadMsgs;
  }

  /**
   * When the database has another plugin version, don't override the pre-installed module
   * @param plugin - plugin whose version may be mutated
   * @param airgapedStore - content of `pre_installed_module_infos` config
   */
  private static ensureAirgapedVersion(
    plugin: Plugin,
    airgapedStore: any[]
  ): void {
    const { getState } = require("../db/state");
    const airgapedPlugin = airgapedStore.find(
      (p: any) => p.location === plugin.location
    );
    if (!airgapedPlugin) {
      throw new Error(
        `Plugin ${plugin.name} from location ${plugin.location} not found in local airgapped store`
      );
    }
    if (airgapedPlugin.version !== plugin.version) {
      getState().log(
        5,
        `Overriding plugin ${plugin.name} version ${plugin.version} with airgapped store version ${airgapedPlugin.version}`
      );
      plugin.version = airgapedPlugin.version;
    }
  }

  /**
   * Copy auth methods with `shareWithTenants: true` from root state into current tenant state
   */
  private static reloadAuthFromRoot(): void {
    const { getState, getRootState } = require("../db/state");
    if (isRoot()) return;
    const rootState = getRootState();
    const tenantState = getState();
    if (!rootState || !tenantState || rootState === tenantState) return;
    tenantState.auth_methods = {};
    for (const [k, v] of Object.entries(rootState.auth_methods)) {
      if ((v as any).shareWithTenants) tenantState.auth_methods[k] = v;
    }
  }
}

export = Plugin;
