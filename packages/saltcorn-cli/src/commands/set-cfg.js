const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, parseJSONorString } = require("../common");

class SetCfgCommand extends Command {
  async run() {
    const { args, flags } = this.parse(SetCfgCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.plugin) {
        const Plugin = require("@saltcorn/data/models/plugin");
        const plugin = await Plugin.findOne({ name: flags.plugin });
        plugin.configuration[args.key] = parseJSONorString(args.value);
        await plugin.upsert();
      } else {
        const { getState } = require("@saltcorn/data/db/state");
        await getState().setConfig(args.key, parseJSONorString(args.value));
      }
    });
    this.exit(0);
  }
}

SetCfgCommand.description = `Set a configuration value`;
SetCfgCommand.args = [
  { name: "key", required: true, description: "Configuration key" },
  {
    name: "value",
    required: true,
    description: "Configuration value (JSON or string)",
  },
];
SetCfgCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  plugin: flags.string({
    char: "p",
    description: "plugin",
  }),
};

module.exports = SetCfgCommand;
