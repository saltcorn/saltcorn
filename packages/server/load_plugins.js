const db = require("@saltcorn/data/db");
const { PluginManager } = require("live-plugin-manager");
const { getState } = require("@saltcorn/data/db/state");
const Plugin = require("@saltcorn/data/models/plugin");

const manager = new PluginManager({
  staticDependencies: {
    contractis: require("contractis"),
    "@saltcorn/markup": require("@saltcorn/markup"),
    "@saltcorn/markup/layout": require("@saltcorn/markup/layout"),
    "@saltcorn/data/db": require("@saltcorn/data/db"),
    "@saltcorn/data/models/field": require("@saltcorn/data/models/field"),
    "@saltcorn/data/models/table": require("@saltcorn/data/models/table"),
    "@saltcorn/data/models/form": require("@saltcorn/data/models/form"),
    "@saltcorn/data/models/view": require("@saltcorn/data/models/view"),
    "@saltcorn/data/models/workflow": require("@saltcorn/data/models/workflow")
  }
});

const loadPlugin = async plugin => {
  const { plugin_module } = await requirePlugin(plugin);
  getState().registerPlugin(plugin.name, plugin_module);
};

const requirePlugin = async (plugin, force) => {
  const installed_plugins = (await manager.list()).map(p => p.name);
  if (
    ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"].includes(plugin.location)
  ) {
    return { plugin_module: require(plugin.location) };
  } else if (plugin.source === "npm") {
    if (force || !installed_plugins.includes(plugin.location)) {
      const plinfo = await manager.install(plugin.location, plugin.version);
      return { plugin_module: manager.require(plugin.location), ...plinfo };
    } else {
      const plinfo = manager.getInfo(plugin.location);
      return { plugin_module: manager.require(plugin.location), ...plinfo };
    }
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location, { force: true });
    return { plugin_module: manager.require(plugin.name) };
  } else if (plugin.source === "github") {
    if (force || !installed_plugins.includes(plugin.location))
      await manager.installFromGithub(plugin.location, { force: true });
    return { plugin_module: manager.require(plugin.name) };
  }
};

const loadAllPlugins = async () => {
  const plugins = await db.select("_sc_plugins");
  for (const plugin of plugins) {
    await loadPlugin(plugin);
  }
  await getState().refresh();
};

const loadAndSaveNewPlugin = async (plugin, force) => {
  const { version, plugin_module } = await requirePlugin(plugin, force);
  getState().registerPlugin(plugin.name, plugin_module);
  if (version) plugin.version = version;
  await plugin.upsert();
};

module.exports = {
  loadAndSaveNewPlugin,
  loadAllPlugins,
  loadPlugin,
  requirePlugin
};
