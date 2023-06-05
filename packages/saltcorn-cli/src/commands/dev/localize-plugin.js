/**
 * @category saltcorn-cli
 * @module commands/localize-plugin
 */
const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant } = require("../../common");
const path = require("path");

/**
 * LocalizePluginCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class LocalizePluginCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const db = require("@saltcorn/data/db");
    const Plugin = require("@saltcorn/data/models/plugin");
    const { args, flags } = this.parse(LocalizePluginCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      const plugin = await Plugin.findOne({ name: args.plugin });
      if (
        !plugin ||
        (plugin.source === "local" && !flags.unlocalize) ||
        (plugin.source !== "local" && flags.unlocalize)
      ) {
        console.error("Localisable plugin not found", args.plugin);
        this.exit(1);
      }
      if (flags.unlocalize) {
        plugin.source = "npm";
        const pkgpath = path.join(plugin.location, "package.json");
        const pkg = require(pkgpath);
        plugin.location = pkg.name;
      } else {
        if (!args.path) {
          console.error("Path required");
          this.exit(1);
        }
        plugin.name = plugin.source === "npm" ? plugin.location : args.plugin;
        plugin.source = "local";
        plugin.location = args.path;
      }
      await plugin.upsert();
      console.log("Plugin saved", plugin);
    });
    this.exit(0);
  }
}

LocalizePluginCommand.args = [
  { name: "plugin", required: true, description: "Current plugin name" },
  {
    name: "path",
    description: "Absolute path to local plugin",
  },
];

/**
 * @type {string}
 */
LocalizePluginCommand.description = `Convert plugin to local plugin`;

/**
 * @type {object}
 */
LocalizePluginCommand.flags = {
  unlocalize: flags.boolean({
    char: "u",
    description: "Unlocalize plugin (local to npm)",
  }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = LocalizePluginCommand;
