const { Command, flags } = require("@oclif/command");

class ListTenantsCommand extends Command {
  async run() {
    const { getAllTenants } = require("@saltcorn/data/models/tenant");
    const db = require("@saltcorn/data/db");
    const tenantList = await getAllTenants();
    console.log("domain,files, users, tables, views, pages");
    for (const domain of tenantList)
      await db.runWithTenant(domain, async () => {
        console.log(
          `${domain},${await db.count("_sc_files")},${await db.count(
            "users"
          )},${await db.count("_sc_tables")},${await db.count("_sc_views")},${await db.count("_sc_pages")}`
        );
      });
    this.exit(0);
  }
}

ListTenantsCommand.description = `List tenants in CSV format`;

module.exports = ListTenantsCommand;
