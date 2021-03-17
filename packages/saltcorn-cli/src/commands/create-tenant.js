const { Command, flags } = require("@oclif/command");

class CreateTenantCommand extends Command {
  async run() {
    const { args } = this.parse(CreateTenantCommand);
    const { createTenant } = require("@saltcorn/data/models/tenant");
    await createTenant(args.tenant);
    this.exit(0);
  }
}

CreateTenantCommand.args = [
  { name: "tenant", required: true, description: "Tenant subdomain to create" },
];

CreateTenantCommand.description = `Create a tenant`;

CreateTenantCommand.flags = {};

module.exports = CreateTenantCommand;
