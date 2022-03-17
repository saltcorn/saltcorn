const { mergeWithCustomize, merge } = require("webpack-merge");
const { join } = require("path");
const { PluginManager } = require("live-plugin-manager");
const {
  staticDependencies,
  requirePlugin,
} = require("@saltcorn/server/load_plugins");

const manager = new PluginManager({
  pluginsPath: join(__dirname, "plugin_packages", "node_modules"),
  staticDependencies,
});

const dataCfg = require(join(
  require.resolve("@saltcorn/data"),
  "../..",
  "webpack.config"
));
const markupCfg = require(join(
  require.resolve("@saltcorn/markup"),
  "../..",
  "webpack.config"
));
const basePluginCfg = require(join(
  require.resolve("@saltcorn/base-plugin"),
  "../",
  "webpack.config"
));
const sbAdmin2Cfg = require(join(
  require.resolve("@saltcorn/sbadmin2"),
  "../",
  "webpack.config"
));

const addDependOn = (dataEntryPoint, b) => {
  const copy = { ...dataEntryPoint };
  copy.data.dependOn = "markup";
  return merge({}, copy, b);
};

const buildPluginEntries = async (env) => {
  const plugins = JSON.parse(env.plugins);
  let result = [];
  for (plugin of plugins) {
    await requirePlugin(plugin, false, manager);
    const info = manager.getInfo(plugin.location);
    let genericEntry = {};
    genericEntry[plugin.name] = {
      import: info.mainFile,
      dependOn: ["markup", "data"],
    };
    result.push({
      entry: genericEntry,
    });
  }
  return result;
};

module.exports = async (env) => {
  const pluginEntries = env.plugins ? await buildPluginEntries(env) : [];
  return mergeWithCustomize({
    customizeArray(a, b, key) {
      if (key === "library") {
        return _.uniq([...a, ...b]);
      }
      return undefined;
    },
    customizeObject(a, b, key) {
      if (key === "output") {
        const copy = { ...a };
        copy.path = __dirname;
        return copy;
      }
      if (key === "entry") {
        if (a.data) return addDependOn(a, b);
        else if (b.data) return addDependOn(b, a);
      }
      return undefined;
    },
  })(dataCfg, markupCfg, basePluginCfg, sbAdmin2Cfg, ...pluginEntries);
};
