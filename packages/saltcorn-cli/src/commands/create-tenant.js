const { Command, flags } = require("@oclif/command");

class CreateTenantCommand extends Command {
  async run() {
    const { args } = this.parse(CreateTenantCommand);
    const db = require("@saltcorn/data/db");
    if (!db.is_it_multi_tenant()) {
      console.error("Multitenancy not enabled");
      this.exit(0);
      return;
    }
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
