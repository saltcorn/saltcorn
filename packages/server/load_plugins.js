const db = require("@saltcorn/data/db");
const { PluginManager } = require("live-plugin-manager");
const { getState } = require("@saltcorn/data/db/state");
const Plugin = require("@saltcorn/data/models/plugin");

const manager = new PluginManager({
  staticDependencies: {
    contractis: require("contractis"),
    "@saltcorn/markup": require("@saltcorn/markup"),
    "@saltcorn/markup/tags": require("@saltcorn/markup/tags"),
    "@saltcorn/markup/layout": require("@saltcorn/markup/layout"),
    "@saltcorn/markup/layout_utils": require("@saltcorn/markup/layout_utils"),
    "@saltcorn/data": require("@saltcorn/data"),
    "@saltcorn/data/db": require("@saltcorn/data/db"),
    "@saltcorn/data/utils": require("@saltcorn/data/utils"),
    "@saltcorn/data/db/state": require("@saltcorn/data/db/state"),
    "@saltcorn/data/plugin-helper": require("@saltcorn/data/plugin-helper"),
    "@saltcorn/data/plugin-testing": require("@saltcorn/data/plugin-testing"),
    "@saltcorn/data/models/field": require("@saltcorn/data/models/field"),
    "@saltcorn/data/models/fieldrepeat": require("@saltcorn/data/models/fieldrepeat"),
    "@saltcorn/data/models/table": require("@saltcorn/data/models/table"),
    "@saltcorn/data/models/form": require("@saltcorn/data/models/form"),
    "@saltcorn/data/models/view": require("@saltcorn/data/models/view"),
    "@saltcorn/data/models/page": require("@saltcorn/data/models/page"),
    "@saltcorn/data/models/file": require("@saltcorn/data/models/file"),
    "@saltcorn/data/models/user": require("@saltcorn/data/models/user"),
    "@saltcorn/data/models/layout": require("@saltcorn/data/models/layout"),
    "@saltcorn/data/models/expression": require("@saltcorn/data/models/expression"),
    "@saltcorn/data/models/workflow": require("@saltcorn/data/models/workflow"),
  },
});

const loadPlugin = async (plugin, force) => {
  const res = await requirePlugin(plugin, force);
  getState().registerPlugin(
    plugin.name,
    res.plugin_module,
    plugin.configuration
  );
  return res;
};

const requirePlugin = async (plugin, force) => {
  const installed_plugins = (await manager.list()).map((p) => p.name);
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
  for (const location of plugin_module.dependencies || []) {
    const existing = await Plugin.findOne({ location });
    if (!existing && location !== plugin.location) {
      await loadAndSaveNewPlugin(
        new Plugin({ name: location, location, source: "npm" })
      );
    }
  }
  getState().registerPlugin(plugin.name, plugin_module);
  if (version) plugin.version = version;
  await plugin.upsert();
};

module.exports = {
  loadAndSaveNewPlugin,
  loadAllPlugins,
  loadPlugin,
  requirePlugin,
};
