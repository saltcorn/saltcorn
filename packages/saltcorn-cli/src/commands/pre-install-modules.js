const { Command, Flags, Args } = require("@oclif/core");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Plugin = require("@saltcorn/data/models/plugin");
const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");
const {
  getFetchProxyOptions,
  pluginsFolderRoot,
} = require("@saltcorn/data/utils");
const npmFetch = require("npm-registry-fetch");

const upsertInfosFile = (plugins) => {
  const entriesFile = path.join(pluginsFolderRoot, "store_entries.json");
  if (!fs.existsSync(pluginsFolderRoot))
    fs.mkdirSync(pluginsFolderRoot, { recursive: true });
  if (!fs.existsSync(entriesFile))
    fs.writeFileSync(
      entriesFile,
      JSON.stringify(plugins.map((plugin) => ({ ...plugin })))
    );
  else {
    const existingEntries = JSON.parse(fs.readFileSync(entriesFile, "utf8"));
    const updatedEntries = [...existingEntries];
    for (const plugin of plugins) {
      const index = updatedEntries.findIndex(
        (entry) => entry.name === plugin.name
      );
      if (index !== -1) {
        updatedEntries[index] = { ...plugin };
      } else {
        updatedEntries.push({ ...plugin });
      }
    }
    fs.writeFileSync(entriesFile, JSON.stringify(updatedEntries));
  }
};

const latestVersion = async (packageName) => {
  const pkgInfo = await npmFetch.json(
    `https://registry.npmjs.org/${packageName}`,
    getFetchProxyOptions()
  );
  return pkgInfo["dist-tags"].latest;
};

class PreInstallModulesCommand extends Command {
  async run() {
    const { flags, args } = await this.parse(PreInstallModulesCommand);

    if (args.pluginSelector === "all") {
      const plugins = await Plugin.store_plugins_available_from_store(
        flags.store_endpoint
      );
      for (const plugin of plugins) {
        const latestVer = await latestVersion(plugin.location);
        plugin.version = latestVer;
        console.log(`Latest version of ${plugin.name} is ${latestVer}`);
        const installer = new PluginInstaller(plugin, {
          rootFolder: pluginsFolderRoot,
        });
        await installer.install(true, true);
      }
      upsertInfosFile(plugins);
    } else {
      const plugin = await Plugin.store_by_name(
        args.pluginSelector,
        flags.store_endpoint
      );
      if (!plugin)
        throw new Error(
          `Plugin ${args.pluginSelector} not found in store at ${flags.store_endpoint}`
        );

      const latestVer = await latestVersion(plugin.location);
      plugin.version = latestVer;
      console.log(`Latest version of ${plugin.name} is ${latestVer}`);
      const installer = new PluginInstaller(plugin, {
        rootFolder: pluginsFolderRoot,
      });
      await installer.install(true, true);
      upsertInfosFile([plugin]);
    }
  }
}

PreInstallModulesCommand.description =
  "Pre-install modules required by Saltcorn before running the application.";

PreInstallModulesCommand.args = {
  pluginSelector: Args.string({
    required: true,
    description:
      "Either 'all' to pre-install all plugins or one specific plugin name",
  }),
};

PreInstallModulesCommand.flags = {
  store_endpoint: Flags.string({
    description: "Saltcorn Modules Store endpoint",
    required: false,
    default: "https://store.saltcorn.com/api/extensions",
  }),
};

module.exports = PreInstallModulesCommand;
