const db = require("saltcorn-data/db");
const { PluginManager } = require("live-plugin-manager");
const { getState } = require("saltcorn-data/db/state");

const manager = new PluginManager();

const registerPlugin = plugin => {
  getState().registerPlugin(plugin);
};

const loadPlugin = async plugin => {
  const plugin_module = await requirePlugin(plugin);
  getState().registerPlugin(plugin_module);
};

const requirePlugin = async plugin => {
  if (["saltcorn-base-plugin", "saltcorn-sbadmin2"].includes(plugin.location)) {
    return require(plugin.location);
  } else if (plugin.source === "npm") {
    await manager.install(plugin.location);
    return manager.require(plugin.location);
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location, { force: true });
    return manager.require(plugin.name);
  } else if (plugin.source === "github") {
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
  registerPlugin,
  requirePlugin
};
