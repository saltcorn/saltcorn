/**
 * @category saltcorn-cli
 * @module commands/run-trigger
 */
const { Command, Flags, Args } = require("@oclif/core");
const {
  maybe_as_tenant_in_transaction,
  init_some_tenants,
} = require("../common");

/**
 * RunTriggerCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RunTriggerCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = await this.parse(RunTriggerCommand);
    await init_some_tenants(flags.tenant);

    const { mockReqRes } = require("@saltcorn/data/tests/mocks");
    const Trigger = require(`@saltcorn/data/models/trigger`);
    const that = this;
    await maybe_as_tenant_in_transaction(flags.tenant, async () => {
      const trigger = await Trigger.findOne({ name: args.trigger });
      if (!trigger) {
        console.error(`Trigger ${args.trigger} not found`);
        this.exit(1);
      }
      await trigger.runWithoutRow({ user: { role_id: 1 } });
    });
    this.exit(0);
  }
}
/**
 * @type {string}
 */
RunTriggerCommand.description = `Run a trigger`;

RunTriggerCommand.args = {
  trigger: Args.string({
    required: true,
    description: "trigger name",
  }),
  // tenant: Args.string({
  //   required: false,
  //   description: "tenant",
  // }),
};

/**
 * @type {object}
 */
RunTriggerCommand.flags = {
  tenant: Flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
};

module.exports = RunTriggerCommand;
