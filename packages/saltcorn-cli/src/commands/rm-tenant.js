/**
 * @category saltcorn-cli
 * @module commands/rm-tenant
 */
const { Command, flags } = require("@oclif/command");
const {cli} = require("cli-ux");

/**
 * RmTenantCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RmTenantCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {


    const { flags } = this.parse(RmTenantCommand);

    const { deleteTenant } = require("@saltcorn/admin-models/models/tenant");

    if (!flags.force) {
      const ans = await cli.confirm(
        `This will delete tenant ${flags.tenant}. Attention! All tenant data will be lost!\nContinue (y/n)?`);
      if (!ans) {
        console.log(`Success: Command execution canceled`);
        this.exit(1);
      }
    }
    // make changes
    await deleteTenant(flags.tenant);

    this.exit(0);
  }
}

/**
 * @type {object}
 */
RmTenantCommand.args = []; /*[
  { name: "tenant", required: true, description: "Tenant to remove" },
];
*/
/**
 * @type {string}
 */
RmTenantCommand.description = `Remove a tenant.
Attention! All tenant data will be lost!
It recommended to make backup of tenant before perform this command.
`;

/**
 * @type {object}
 */
RmTenantCommand.help = `Remove a tenant.
Attention! All tenant data will be lost!
It recommended to make backup of tenant before perform this command.
`;

/**
 * @type {object}
 */
RmTenantCommand.flags = {
  force: flags.boolean({ char: "f", description: "force command execution" }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
    required: true,
  }),
};

module.exports = RmTenantCommand;
