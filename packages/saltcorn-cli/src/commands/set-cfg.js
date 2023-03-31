/**
 * @category saltcorn-cli
 * @module commands/set-cfg
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const {
  maybe_as_tenant,
  init_some_tenants,
  parseJSONorString,
} = require("../common");
const fs = require("fs");
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
    if (args.key && !!args.value + !!flags.stdin + !!flags.file !== 1) {
      console.error(
        "Must supply one value, as argument, stdin (with -i), or file (with -f)"
      );
      this.exit(1);
    }

    const theValue = flags.stdin
      ? fs.readFileSync(0, "utf-8")
      : flags.file
      ? fs.readFileSync(flags.file, "utf-8")
      : args.value;
    if (flags.tenant) await init_some_tenants(flags.tenant);
    await maybe_as_tenant(flags.tenant, async () => {
      if (flags.plugin) {
        const Plugin = require("@saltcorn/data/models/plugin");
        const plugin = await Plugin.findOne({ name: flags.plugin });
        if (!plugin.configuration) plugin.configuration = {};
        if (!args.key) {
          console.error("Key required for plugin configuration");
          this.exit(1);
        }
        plugin.configuration[args.key] = parseJSONorString(theValue);
        await plugin.upsert();
      } else {
        const { getState } = require("@saltcorn/data/db/state");
        const { configTypes } = require("@saltcorn/data/models/config");
        if (args.key)
          await getState().setConfig(args.key, parseJSONorString(theValue));
        else {
          console.log("Valid configuration keys: \n");
          Object.keys(configTypes).forEach((k) => console.log(k));
        }
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
SetCfgCommand.description = `Set a configuration value. The supplied value (argument, or file stdin) will be parsed as JSON. If this fails, it is stored as a string.`;

/**
 * @type {object[]}
 */
SetCfgCommand.args = [
  { name: "key", required: false, description: "Configuration key" },
  {
    name: "value",
    description: "Configuration value (JSON or string)",
  },
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
  file: flags.string({
    char: "f",
    description: "file",
  }),
  stdin: flags.boolean({
    char: "i",
    description: "read value from stdin",
  }),
};

module.exports = SetCfgCommand;
