/**
 * Load plugins
 * File: load_plugins.js
 *
 * @category server
 * @module load_plugins
 */
const db = require("@saltcorn/data/db");
const { getState, getRootState } = require("@saltcorn/data/db/state");
const Plugin = require("@saltcorn/data/models/plugin");
const { isRoot, getFetchProxyOptions } = require("@saltcorn/data/utils");
const { eachTenant } = require("@saltcorn/admin-models/models/tenant");

const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
const npmFetch = require("npm-registry-fetch");
const packagejson = require("./package.json");
const {
  supportedVersion,
  resolveLatest,
} = require("@saltcorn/plugins-loader/stable_versioning");

const isFixedPlugin = (plugin) =>
  plugin.location === "@saltcorn/sbadmin2" ||
  plugin.location === "@saltcorn/base-plugin";

/**
 * return the cached engine infos or fetch them from npm and update the cache
 * @param plugin plugin to load
 */
const getEngineInfos = async (plugin, forceFetch) => {
  const rootState = getRootState();
  const cached = rootState.getConfig("engines_cache", {}) || {};
  const airgap = rootState.getConfig("airgap", false);

  if (airgap || (cached[plugin.location] && !forceFetch)) {
    return cached[plugin.location] || {};
  } else {
    getState().log(5, `Fetching versions for '${plugin.location}'`);
    const pkgInfo = await npmFetch.json(
      `https://registry.npmjs.org/${plugin.location}`,
      getFetchProxyOptions()
    );
    const versions = pkgInfo.versions;
    const newCached = {};
    for (const [k, v] of Object.entries(versions)) {
      newCached[k] = v.engines?.saltcorn
        ? { engines: { saltcorn: v.engines.saltcorn } }
        : {};
    }
    cached[plugin.location] = newCached;
    await rootState.setConfig("engines_cache", { ...cached });
    return newCached;
  }
};

/**
 * checks the saltcorn engine property and changes the plugin version if necessary
 * @param plugin plugin to load
 */
const ensurePluginSupport = async (plugin, forceFetch) => {
  let versions = await getEngineInfos(plugin, forceFetch);
  if (
    plugin.version &&
    plugin.version !== "latest" &&
    !versions[plugin.version] &&
    !forceFetch
  ) {
    versions = await getEngineInfos(plugin, true);
  }
  const supported = supportedVersion(
    plugin.version || "latest",
    versions,
    packagejson.version
  );
  if (!supported)
    throw new Error(
      `Unable to find a supported version for '${plugin.location}'`
    );
  else if (
    supported !== plugin.version ||
    (plugin.version === "latest" && supported !== resolveLatest(versions))
  )
    plugin.version = supported;
};

/**
 * Load one plugin
 * TODO correct names for functions loadPlugin, requirePlugin - currently uncler
 * @param plugin - plugin to load
 * @param force - force flag
 */
const loadPlugin = async (plugin, force, forceFetch) => {
  if (plugin.source === "npm" && !isFixedPlugin(plugin)) {
    try {
      await ensurePluginSupport(plugin, forceFetch);
    } catch (e) {
      console.log(
        `Warning: Unable to find a supported version for '${plugin.location}' Continuing with the installed version`
      );
    }
  }
  // load plugin
  const loader = new PluginInstaller(plugin, {
    scVersion: packagejson.version,
    envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
  });
  const res = await loader.install(force);
  const configuration =
    typeof plugin.configuration === "string"
      ? JSON.parse(plugin.configuration)
      : plugin.configuration;
  try {
    // register plugin
    getState().registerPlugin(
      res.plugin_module.plugin_name || plugin.name,
      res.plugin_module,
      configuration,
      res.location,
      res.name
    );
  } catch (error) {
    getState().log(
      3,
      `Error loading plugin ${plugin.name}: ${error.message || error}`
    );
    if (force) {
      // remove the install dir and try again
      await loader.remove();
      await loader.install(force);
      getState().registerPlugin(
        res.plugin_module.plugin_name || plugin.name,
        res.plugin_module,
        configuration,
        res.location,
        res.name
      );
    }
  }
  if (res.plugin_module.user_config_form) await getState().refreshUserLayouts();
  if (res.plugin_module.onLoad) {
    try {
      await res.plugin_module.onLoad(plugin.configuration);
    } catch (error) {
      console.error(error); // todo i think that situation is not resolved
    }
  }

  if (isRoot() && res.plugin_module.authentication)
    await eachTenant(reloadAuthFromRoot);
  return res;
};

const reloadAuthFromRoot = () => {
  if (isRoot()) return;
  const rootState = getRootState();
  const tenantState = getState();
  if (!rootState || !tenantState || rootState === tenantState) return;
  tenantState.auth_methods = {};
  for (const [k, v] of Object.entries(rootState.auth_methods)) {
    if (v.shareWithTenants) tenantState.auth_methods[k] = v;
  }
};

/**
 * Install plugin
 * @param plugin - plugin name
 * @param force - force flag
 * @returns {Promise<{plugin_module: *}|{plugin_module: any}>}
 */
const requirePlugin = async (plugin, force) => {
  const loader = new PluginInstaller(plugin, {
    scVersion: packagejson.version,
    envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
  });
  return await loader.install(force);
};

/**
 * Load all plugins
 * @returns {Promise<void>}
 */
const loadAllPlugins = async (force) => {
  await getState().refresh(true);
  const plugins = await db.select("_sc_plugins");
  for (const plugin of plugins) {
    try {
      await loadPlugin(plugin, force);
    } catch (e) {
      console.error(e);
    }
  }
  await getState().refreshUserLayouts();
  await getState().refresh(true, true);
  if (!isRoot()) reloadAuthFromRoot();
};

/**
 * Load Plugin and its dependencies and save into local installation
 * @param plugin
 * @param force
 * @param noSignalOrDB
 * @param __ translation function
 * @returns {Promise<void>}
 */
const loadAndSaveNewPlugin = async (
  plugin,
  force,
  noSignalOrDB,
  __ = (str) => str,
  allowUnsafeOnTenantsWithoutConfigSetting
) => {
  const tenants_unsafe_plugins = getRootState().getConfig(
    "tenants_unsafe_plugins",
    false
  );
  if (!isRoot() && !tenants_unsafe_plugins) {
    if (plugin.source !== "npm") {
      console.error("\nWARNING: Skipping unsafe plugin ", plugin.name);
      return;
    }
    //get allowed plugins

    //refresh root store
    await db.runWithTenant(
      db.connectObj.default_schema,
      async () => await Plugin.store_plugins_available()
    );

    const instore = getRootState().getConfig("available_plugins", []);
    const safes = instore.filter((p) => !p.unsafe).map((p) => p.location);
    if (
      !safes.includes(plugin.location) &&
      !allowUnsafeOnTenantsWithoutConfigSetting
    ) {
      console.error("\nWARNING: Skipping unsafe plugin ", plugin.name);
      return;
    }
  }
  if (plugin.source === "npm") await ensurePluginSupport(plugin);
  const loadMsgs = [];
  const loader = new PluginInstaller(plugin, {
    scVersion: packagejson.version,
    envVars: { PUPPETEER_SKIP_DOWNLOAD: true },
  });
  const { version, plugin_module, location, loadedWithReload, msgs } =
    await loader.install(force);
  if (msgs) loadMsgs.push(...msgs);
  // install dependecies
  for (const loc of plugin_module.dependencies || []) {
    const existing = await Plugin.findOne({ location: loc });
    if (!existing && loc !== plugin.location) {
      await loadAndSaveNewPlugin(
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
      await loader.install(force);
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

  if (isRoot() && plugin_module.authentication)
    await eachTenant(reloadAuthFromRoot);

  if (!noSignalOrDB) {
    await plugin.upsert();
    getState().processSend({
      installPlugin: plugin,
      tenant: db.getTenantSchema(),
      force: false, // okay ??
    });
  }
  return loadMsgs;
};

module.exports = {
  loadAndSaveNewPlugin,
  loadAllPlugins,
  loadPlugin,
  requirePlugin,
  getEngineInfos,
  ensurePluginSupport,
};
