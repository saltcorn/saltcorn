/**
 * @category saltcorn-cli
 * @module commands/run-trigger
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, init_some_tenants } = require("../common");

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
    const {flags, args} = this.parse(RunTriggerCommand);
    await init_some_tenants(flags.tenant);

    const {mockReqRes} = require("@saltcorn/data/tests/mocks");
    const Trigger = require(`@saltcorn/data/models/trigger`);
    const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const trigger = await Trigger.findOne({name: flags.trigger});
      if (!trigger) {
        console.error(`Trigger ${flags.trigger} not found`);
        this.exit(1);
      }
      await trigger.runWithoutRow();
    });
    this.exit(0);
  }
}
/**
 * @type {string}
 */
RunTriggerCommand.description = `Run a trigger`;

/*
RunTriggerCommand.args = [

  { name: "tenant", char: "t", required: false, description: "tenant name" },
  { name: "trigger", char: "a", required: true, description: "trigger name" },
];
*/

/**
 * @type {object}
 */
RunTriggerCommand.flags = {
  tenant: flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
  action: flags.string({
      name: "action",
      char: "a",
      description: "action (trigger)",
      required: true,
  }),
};

module.exports = RunTriggerCommand;
