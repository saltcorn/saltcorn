/**
 * @category saltcorn-cli
 * @module commands/install-plugin
 */
const { Command, Flags } = require("@oclif/core");
const {
  maybe_as_tenant_in_transaction,
  init_some_tenants,
} = require("../common");
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
    if (!flags.name && !flags.directory && !flags.npm) {
      console.error(
        "You must provide either a plugin name (-n), a directory (-d), or an npm package (-p)"
      );
      this.exit(1);
    }

    await init_some_tenants(flags.tenant);

    const Plugin = require("@saltcorn/data/models/plugin");

    await maybe_as_tenant_in_transaction(flags.tenant, async () => {
      if (flags.name) {
        const plugin = await Plugin.store_by_name(flags.name);
        if (!plugin) {
          console.error(`Plugin ${flags.name} not found in store`);
          this.exit(1);
        }
        delete plugin.id;

        await this.installOrFail(plugin, Plugin, [
          undefined,
          undefined,
          (s) => s,
          !!flags.unsafe,
        ]);
      } else if (flags.npm) {
        const plugin = new Plugin({
          name: flags.npm,
          source: "npm",
          location: flags.npm,
        });
        await this.installOrFail(plugin, Plugin, [
          undefined,
          undefined,
          (s) => s,
          !!flags.unsafe,
        ]);
      } else if (flags.directory) {
        const pkgpath = path.join(flags.directory, "package.json");
        if (!fs.existsSync(pkgpath)) {
          console.error(`${pkgpath} not found`);
          this.exit(1);
        }
        let pkg;
        try {
          pkg = require(pkgpath);
        } catch (e) {
          console.error(`Unable to read ${pkgpath}: ${e.message}`);
          this.exit(1);
        }
        if (!pkg.name) {
          console.error(`${pkgpath} has no name field`);
          this.exit(1);
        }
        const plugin = new Plugin({
          name: pkg.name,
          source: "local",
          location: path.resolve(flags.directory),
        });
        await this.installOrFail(plugin, Plugin, [true]);
      }
    });
    this.exit(0);
  }

  /**
   * Install a plugin and report why it failed, instead of dumping a stack
   * trace that only shows saltcorn internals.
   * @param {object} plugin
   * @param {object} Plugin the Plugin model
   * @param {Array} rest further arguments to loadAndSaveNewPlugin
   * @returns {Promise<void>}
   */
  async installOrFail(plugin, Plugin, rest) {
    try {
      await Plugin.loadAndSaveNewPlugin(plugin, ...rest);
    } catch (e) {
      console.error(`Error installing plugin ${plugin.name}:`);
      console.error(e.message || e);
      // stack of the error inside the plugin, if we have one
      if (e.pluginStack) console.error(e.pluginStack);
      else if (process.env.NODE_ENV === "development" && e.stack)
        console.error(e.stack);
      this.exit(1);
    }
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
  npm: Flags.string({
    char: "p",
    description: "Install plugin directly from npm by package name",
  }),
  unsafe: Flags.boolean({
    char: "u",
    description: "Allow unsafe plugins on tenants",
  }),
};

module.exports = InstallPluginCommand;
