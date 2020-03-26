const db = require("saltcorn-data/db");
const { PluginManager } = require("live-plugin-manager");
const State = require("saltcorn-data/db/state");

const manager = new PluginManager();

const registerPlugin = plugin => {
  (plugin.types || []).forEach(t => {
    State.addType(t);
  });
  (plugin.viewtemplates || []).forEach(vt => {
    State.viewtemplates[vt.name] = vt;
  });
  if (plugin.layout && plugin.layout.wrap)
    State.layout.wrap = plugin.layout.wrap;
};

const loadPlugin = async plugin => {
  if (["saltcorn-base-plugin", "saltcorn-sbadmin2"].includes(plugin.location)) {
    registerPlugin(require(plugin.location));
  } else if (plugin.source === "npm") {
    await manager.install(plugin.location);
    registerPlugin(manager.require(plugin.location));
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location);
    await manager.installFromPath(plugin.location, { force: true });
    registerPlugin(manager.require(plugin.name));
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

module.exports = {
  loadAllPluginsSync,
  loadAllPlugins,
  loadPlugin,
  registerPlugin
};
