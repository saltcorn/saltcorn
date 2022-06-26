/**
 * @category saltcorn-cli
 * @module commands/set-cfg
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, init_some_tenants } = require("../common");

/**
 * SetCfgCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class SetCfgCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = this.parse(SetCfgCommand);
    await init_some_tenants(flags.tenant);

    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.plugin) {
        const Plugin = require("@saltcorn/data/models/plugin");
        const plugin = await Plugin.findOne({ name: flags.plugin });
        console.log(JSON.stringify(plugin.configuration[args.key], null, 2));
        await plugin.upsert();
      } else {
        const { getState } = require("@saltcorn/data/db/state");
        console.log(JSON.stringify(getState().getConfig(args.key), null, 2));
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
SetCfgCommand.description = `Get a configuration value. The value is printed to stdout as a JSON value`;

/**
 * @type {object[]}
 */
SetCfgCommand.args = [
  { name: "key", required: true, description: "Configuration key" },
];

/**
 * @type {object}
 */
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
