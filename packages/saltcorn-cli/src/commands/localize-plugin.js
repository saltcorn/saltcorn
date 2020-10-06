const { Command, flags } = require("@oclif/command");

class LocalizePluginCommand extends Command {
  async run() {
    const db = require("@saltcorn/data/db");
    const Plugin = require("@saltcorn/data/models/plugin");
    const { args } = this.parse(LocalizePluginCommand);
    const plugin = await Plugin.findOne({ name: args.plugin, source: "npm" });
    plugin.source = "local";
    plugin.name = plugin.location;
    plugin.location = args.path;
    await plugin.upsert();
    console.log("Plugin saved", plugin);
    this.exit(0);
  }
}

LocalizePluginCommand.args = [
  { name: "plugin", required: true, description: "Current (npm) plugin name" },
  { name: "path", required: true, description: "path to local plugin" },
];

LocalizePluginCommand.description = `Convert npm to local plugin`;

LocalizePluginCommand.flags = {};

module.exports = LocalizePluginCommand;
