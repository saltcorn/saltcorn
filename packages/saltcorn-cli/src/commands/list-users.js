/**
 * @category saltcorn-cli
 * @module commands/run-trigger
 */
const { Command, Flags, ux } = require("@oclif/core");
const { maybe_as_tenant, init_some_tenants } = require("../common");

/**
 * ListTriggerCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ListUsersCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = await this.parse(ListUsersCommand);
    await init_some_tenants(flags.tenant);

    const { mockReqRes } = require("@saltcorn/data/tests/mocks");
    const User = require(`@saltcorn/data/models/user`);
    //const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const users = await User.find({});
      if (!users) {
        console.log(`There are no users`);
        this.exit(1);
      }

      if (!flags.verbose) {
        console.table(users, ["email"]);
      } else {
        console.table(users, ["id", "email", "language", "role_id"]);
      }
    });
    this.exit(0);
  }
}
/**
 * @type {string}
 */
ListUsersCommand.description = `List users`;
/**
 * @type {string}
 */
ListUsersCommand.help = `List users`;

/**
 * @type {object}
 */
ListUsersCommand.flags = {
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
  // todo option to specify list of fields for user (because dynamic list of fields for user)
  // todo filter password and other secret fields
  // todo print role.name instead of role_id
};

module.exports = ListUsersCommand;
