/**
 * @category saltcorn-cli
 * @module commands/localize-plugin
 */
const { Command, flags } = require("@oclif/command");
const { maybe_as_tenant } = require("../common");

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
      if (!plugin || plugin.source === "local") {
        console.error("Localisable plugin not found");
        this.exit(1);
      }

      plugin.name = plugin.source === "npm" ? plugin.location : args.plugin;
      plugin.source = "local";
      plugin.location = args.path;
      await plugin.upsert();
      console.log("Plugin saved", plugin);
    });
    this.exit(0);
  }
}

LocalizePluginCommand.args = [
  { name: "plugin", required: true, description: "Current plugin name" },
  { name: "path", required: true, description: "Absolute path to local plugin" },
];

/**
 * @type {string}
 */
LocalizePluginCommand.description = `Convert plugin to local plugin`;

/**
 * @type {object}
 */
LocalizePluginCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = LocalizePluginCommand;
