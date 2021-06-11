const { Command, flags } = require("@oclif/command");

//const {
//  getConfig,
//} = require("@saltcorn/data/models/config");

class CreateTenantCommand extends Command {
  async run() {
    const { args } = this.parse(CreateTenantCommand);
    const { flags } = this.parse(CreateTenantCommand);
    const db = require("@saltcorn/data/db");
    if (!db.is_it_multi_tenant()) {
      console.error("Multitenancy not enabled");
      this.exit(0);
      return;
    }
    const { createTenant } = require("@saltcorn/data/models/tenant");
    //const url = typeof flags.url !== `undefined`? flags.url : "";
    //const email = typeof flags.email !== `undefined`? flags.email : "";
    //const description = flags.description !==  `undefined` ? flags.description : "";
    // TODO Do we need to set default value for base url or not? And what is correct way to get domain of base_url here?
    // const base =  await db.getgetConfig("base_url");
    await createTenant(args.tenant, flags.url, flags.email, flags.description);
    console.log()
    this.exit(0);
  }
}

CreateTenantCommand.args = [
  { name: "tenant", required: true, description: "Tenant subdomain to create" },
];

CreateTenantCommand.description = `Create a tenant`;

CreateTenantCommand.flags = {
  email: flags.string({
    name: "url",
    //char: "",
    description: "Url of tenant",
  }),
  email: flags.string({
    name: "email",
    char: "e",
    description: "Email of owner of tenant",
  }),
  description: flags.string({
    name: "description",
    char: "d",
    description: "Description of tenant",
  }),
};

module.exports = CreateTenantCommand;
