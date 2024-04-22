const { mergeWithCustomize, merge } = require("webpack-merge");
const { join } = require("path");
const { requirePlugin } = require("@saltcorn/server/load_plugins");

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

const buildPluginEntries = async (plugins) => {
  let result = [];
  const nameToModule = new Map();
  for (const plugin of plugins) {
    const requireResult = await requirePlugin(plugin, true);
    const packageName = require(`${requireResult.location}/package.json`).name;
    nameToModule.set(plugin.name, { packageName, requireResult });
  }
  const nameByPackageName = (pckName) => {
    for (const [pluginName, value] of nameToModule.entries()) {
      if (value.packageName === pckName) {
        return pluginName;
      }
    }
    throw new Error(`Unable to find a plugin name for package: '${pckName}'`);
  };

  for (const plugin of plugins) {
    const { requireResult } = nameToModule.get(plugin.name);
    const additionalDependencies = requireResult.plugin_module?.dependencies
      ? requireResult.plugin_module.dependencies.map((dep) =>
          nameByPackageName(dep)
        )
      : [];
    const genericEntry = {
      [plugin.name]: {
        import: requireResult.location,
        dependOn: ["markup", "data", ...additionalDependencies],
      },
    };
    result.push({
      entry: genericEntry,
    });
  }
  return result;
};

module.exports = async (env) => {
  const pluginEntries = env.plugins
    ? await buildPluginEntries(JSON.parse(env.plugins))
    : [];
  return mergeWithCustomize({
    customizeArray(a, b, key) {
      // Fall back to default merging
      return undefined;
    },
    customizeObject(a, b, key) {
      if (key === "output") {
        const copy = { ...a };
        copy.path = env.output;
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
