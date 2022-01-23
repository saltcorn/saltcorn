/**
 * @category saltcorn-cli
 * @module commands/rm-tenant
 */
const { Command, flags } = require("@oclif/command");

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
    const { args } = this.parse(RmTenantCommand);
    const { deleteTenant } = require("@saltcorn/models-common/models/tenant");
    await deleteTenant(args.tenant);
    this.exit(0);
  }
}

/**
 * @type {object}
 */
RmTenantCommand.args = [
  { name: "tenant", required: true, description: "Tenant to remove" },
];

/**
 * @type {string}
 */
RmTenantCommand.description = `Remove a tenant`;

/**
 * @type {object}
 */
RmTenantCommand.flags = {};

module.exports = RmTenantCommand;
