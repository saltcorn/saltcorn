const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant } = require("../common");
const fs = require("fs");
const path = require("path");

class InstallPluginCommand extends Command {
  async run() {
    const { flags } = this.parse(InstallPluginCommand);
    const {
      fetch_pack_by_name,
      install_pack,
    } = require("@saltcorn/data/models/pack");
    const load_plugins = require("@saltcorn/server/load_plugins");

    if (!flags.name && !flags.directory) {
      console.error(
        "You must provide either a plugin name (-n) or a directory with the plugin (-d)"
      );
      this.exit(1);
    }
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();
    await init_multi_tenant(loadAllPlugins);

    const Plugin = require("@saltcorn/data/models/plugin");

    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.name) {
        const plugin = await Plugin.store_by_name(flags.name);
        if (!plugin) {
          console.error(`Plugin ${flags.name} not found in store`);
          this.exit(1);
        }
        delete plugin.id;

        await load_plugins.loadAndSaveNewPlugin(plugin);
      } else if (flags.directory) {
        const pkgpath = path.join(flags.directory, "package.json");
        if (!fs.existsSync(pkgpath)) {
          console.error(`${pkgpath} not found`);
          this.exit(1);
        }
        try {
          const pkg = require(pkgpath);
          const plugin = new Plugin({
            name: pkg.name,
            source: "local",
            location: path.resolve(flags.directory),
          });
          await load_plugins.loadAndSaveNewPlugin(plugin);
        } catch (e) {
          console.error(e.message);
          this.exit(1);
        }
      }
    });
    this.exit(0);
  }
}

InstallPluginCommand.description = `Install a plugin`;

InstallPluginCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  name: flags.string({
    char: "n",
    description: "Plugin name in store",
  }),
  directory: flags.string({
    char: "d",
    description: "Directory with local plugin",
  }),
};

module.exports = InstallPluginCommand;
