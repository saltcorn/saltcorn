const db = require("saltcorn-data/db");
const { PluginManager } = require("live-plugin-manager");
const State = require("saltcorn-data/db/state");

const manager = new PluginManager();

const registerPlugin = plugin => {
  State.registerPlugin(plugin);
};

const loadPlugin = async plugin => {
  if (["saltcorn-base-plugin", "saltcorn-sbadmin2"].includes(plugin.location)) {
    registerPlugin(require(plugin.location));
  } else if (plugin.source === "npm") {
    await manager.install(plugin.location);
    registerPlugin(manager.require(plugin.location));
  } else if (plugin.source === "local") {
    await manager.installFromPath(plugin.location, { force: true });
    registerPlugin(manager.require(plugin.name));
  } else if (plugin.source === "github") {
    await manager.installFromGithub(plugin.location, { force: true });
    registerPlugin(manager.require(plugin.name));
  }
};

const loadAllPlugins = async () => {
  const plugins = await db.select("plugins");
  for (const plugin of plugins) {
    await loadPlugin(plugin);
  }
  await State.refresh();
};

const loadAllPluginsSync = app => {
  loadAllPlugins().then(
    () => {
      app.emit("ready");
    },
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
