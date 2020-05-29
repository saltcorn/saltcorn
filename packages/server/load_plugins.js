const db = require("@saltcorn/data/db");
const { PluginManager } = require("live-plugin-manager");
const { getState } = require("@saltcorn/data/db/state");

const manager = new PluginManager({
  staticDependencies: {
    "@saltcorn/markup": require("@saltcorn/markup"),
    "@saltcorn/data/db": require("@saltcorn/data/db")
  }
});

const loadPlugin = async plugin => {
  const plugin_module = await requirePlugin(plugin);
  getState().registerPlugin(plugin.name, plugin_module);
};

const requirePlugin = async (plugin, force) => {
  const installed_plugins=(await manager.list()).map(p=>p.name)
  if (
    ["@saltcorn/base-plugin", "@saltcorn/sbadmin2"].includes(plugin.location)
  ) {
    return require(plugin.location);
  } else if (plugin.source === "npm") {
    if(!force && !installed_plugins.includes(plugin.location))
      await manager.install(plugin.location, plugin.version);
    return manager.require(plugin.location);
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location, { force: true });
    return manager.require(plugin.name);
  } else if (plugin.source === "github") {
    if(!force && !installed_plugins.includes(plugin.location))
      await manager.installFromGithub(plugin.location, { force: true });
    return manager.require(plugin.name);
  }
};

const loadAllPlugins = async () => {
  const plugins = await db.select("_sc_plugins");
  for (const plugin of plugins) {
    await loadPlugin(plugin);
  }
  await getState().refresh();
};

module.exports = {
  loadAllPlugins,
  loadPlugin,
  requirePlugin
};
