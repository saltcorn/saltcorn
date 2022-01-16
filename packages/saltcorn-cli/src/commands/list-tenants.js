/**
 * @category saltcorn-cli
 * @module commands/list-tenants
 */
const { Command, flags } = require("@oclif/command");


/**
 * ListTenantsCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ListTenantsCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { getAllTenants } = require("@saltcorn/data/models/tenant");
    const db = require("@saltcorn/data/db");
    const tenantList = await getAllTenants();
    console.log("domain                  ,    files,    users,   tables,    views,    pages");
    for (const domain of tenantList)
      await db.runWithTenant(domain, async () => {
        console.log("%s, %s, %s, %s, %s, %s",
          domain.padEnd(24),
          (await db.count("_sc_files" )).toString().padStart(8),
          (await db.count("users"     )).toString().padStart(8),
          (await db.count("_sc_tables")).toString().padStart(8),
          (await db.count("_sc_views" )).toString().padStart(8),
          (await db.count("_sc_pages" )).toString().padStart(8)
        );
      });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
ListTenantsCommand.description = `List tenants in CSV format`;

// TODO Extra help here
/**
 * @type {string}
 */
ListTenantsCommand.help= "Extra help here"

module.exports = ListTenantsCommand;
