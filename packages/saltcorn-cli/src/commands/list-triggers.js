/**
 * @category saltcorn-cli
 * @module commands/run-trigger
 */
const { Command, Flags, ux } = require("@oclif/core");
const {
  maybe_as_tenant,
  init_some_tenants,
  print_table,
} = require("../common");

/**
 * ListTriggerCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ListTriggersCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = await this.parse(ListTriggersCommand);
    await init_some_tenants(flags.tenant);

    const { mockReqRes } = require("@saltcorn/data/tests/mocks");
    const Trigger = require(`@saltcorn/data/models/trigger`);
    //const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const triggers = Trigger.find();
      if (!triggers) {
        console.log(`There are no triggers`);
        this.exit(1);
      }
      if (!flags.verbose) {
        print_table(triggers, ["name"], flags.json);
      } else {
        print_table(
          triggers,
          [
            "id",
            "name",
            "action",
            "when_trigger",
            "min_role",
            "channel",
            "table_id",
            "table_name",
            "description",
          ],
          flags.json
        );
      }
    });
    this.exit(0);
  }
}
/**
 * @type {string}
 */
ListTriggersCommand.description = `List triggers`;

/**
 * @type {object}
 */
ListTriggersCommand.flags = {
  tenant: Flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
  verbose: Flags.boolean({
    name: "verbose",
    char: "v",
    description: "verbose output",
    required: false,
  }),
  json: Flags.boolean({ char: "j", description: "json format" }),
};

module.exports = ListTriggersCommand;
