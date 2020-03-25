const db = require("saltcorn-data/db");
const { PluginManager } = require("live-plugin-manager");

const manager = new PluginManager();

const loadPlugin = async plugin => {
  if (["saltcorn-base-plugin", "saltcorn-sbadmin2"].includes(plugin.location)) {
    require(plugin.location).register();
  } else if (plugin.source === "npm") {
    await manager.install(plugin.location);
    manager.require(plugin.location).register();
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location);
    await manager.installFromPath(plugin.location, { force: true });
    manager.require(plugin.name).register();
  }
};

const loadAllPlugins = async () => {
  const plugins = await db.select("plugins");
  for (const plugin of plugins) {
    await loadPlugin(plugin);
  }
};

const loadAllPluginsSync = () => {
  loadAllPlugins().then(
    () => {},
    err => {
      console.error(err);
      process.exit(1);
    }
  );
};

module.exports = { loadAllPluginsSync, loadAllPlugins, loadPlugin };
