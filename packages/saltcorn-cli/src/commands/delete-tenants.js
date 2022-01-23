/**
 * @category saltcorn-cli
 * @module commands/delete-tenants
 */
const { Command, flags } = require("@oclif/command");

/**
 * DeleteTenantsCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class DeleteTenantsCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const {
      getAllTenantRows,
      deleteTenant,
    } = require("@saltcorn/admin-models/models/tenant");
    const db = require("@saltcorn/data/db");
    const tenantList = await getAllTenantRows();
    const tensExamine = tenantList.slice(
      0,
      Math.round(tenantList.length * 0.8)
    );

    for (const ten of tensExamine) {
      let nusers, ntables, nviews, npages;
      await db.runWithTenant(ten.subdomain, async () => {
        nusers = await db.count("users");
        ntables = await db.count("_sc_tables");
        nviews = await db.count("_sc_views");
        npages = await db.count("_sc_pages");
      });
      if (nusers < 2 && ntables < 2 && nviews < 1 && npages < 1) {
        console.log("deleting ", ten.subdomain, {
          nusers,
          ntables,
          nviews,
          npages,
        });
        await deleteTenant(ten.subdomain);
      } else {
        console.log("leaving", ten.subdomain, {
          nusers,
          ntables,
          nviews,
          npages,
        });
      }
    }
    this.exit(0);
  }
}

/**
 * @type {string}
 */
DeleteTenantsCommand.description = `Delete inactive tenants`;

module.exports = DeleteTenantsCommand;
