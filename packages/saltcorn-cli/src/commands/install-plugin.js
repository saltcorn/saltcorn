/**
 * @category saltcorn-cli
 * @module commands/install-plugin
 */
const { Command, Flags } = require("@oclif/core");
const { maybe_as_tenant, init_some_tenants } = require("../common");
const fs = require("fs");
const path = require("path");

/**
 * InstallPluginCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class InstallPluginCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = await this.parse(InstallPluginCommand);
    const {
      fetch_pack_by_name,
      install_pack,
    } = require("@saltcorn/admin-models/models/pack");
    const load_plugins = require("@saltcorn/server/load_plugins");

    if (!flags.name && !flags.directory) {
      console.error(
        "You must provide either a plugin name (-n) or a directory with the plugin (-d)"
      );
      this.exit(1);
    }

    await init_some_tenants(flags.tenant);

    const Plugin = require("@saltcorn/data/models/plugin");

    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.name) {
        const plugin = await Plugin.store_by_name(flags.name);
        if (!plugin) {
          console.error(`Plugin ${flags.name} not found in store`);
          this.exit(1);
        }
        delete plugin.id;

        await load_plugins.loadAndSaveNewPlugin(
          plugin,
          undefined,
          undefined,
          (s) => s,
          !!flags.unsafe
        );
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
          console.error(e);
          this.exit(1);
        }
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
InstallPluginCommand.description = `Install a plugin`;

/**
 * @type {object}
 */
InstallPluginCommand.flags = {
  tenant: Flags.string({
    char: "t",
    description: "tenant",
  }),
  name: Flags.string({
    char: "n",
    description: "Plugin name in store",
  }),
  directory: Flags.string({
    char: "d",
    description: "Directory with local plugin",
  }),
  unsafe: Flags.boolean({
    char: "u",
    description: "Allow unsafe plugins on tenants",
  }),
};

module.exports = InstallPluginCommand;
