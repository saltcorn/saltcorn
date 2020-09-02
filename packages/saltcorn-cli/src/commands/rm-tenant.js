const { Command, flags } = require("@oclif/command");

class RmTenantCommand extends Command {
  async run() {
    const { args } = this.parse(RmTenantCommand);
    const { deleteTenant } = require("@saltcorn/data/models/tenant");
    await deleteTenant(args.tenant);
    this.exit(0);
  }
}

RmTenantCommand.args = [
  { name: "tenant", required: true, description: "Tenant to remove" },
];

RmTenantCommand.description = `Remove a tenant`;

RmTenantCommand.flags = {};

module.exports = RmTenantCommand;
