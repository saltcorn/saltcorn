/**
 * @category saltcorn-cli
 * @module commands/migrate
 */
const { Command, flags } = require("@oclif/command");
const db = require("@saltcorn/data/db");
const { eachTenant } = require("@saltcorn/admin-models/models/tenant");
// todo add dryrun mode

/**
 * MigrateCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class MigrateCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { migrate } = require("@saltcorn/data/migrate");
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();
    await eachTenant(async () => {

      const domain = db.getTenantSchema();
      await init_multi_tenant(loadAllPlugins, undefined, [domain]);
      console.log("Tenant %s check for migrations...", domain);
      try {
        await migrate(domain, true);
      } catch (e) {
        console.error(e);
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
MigrateCommand.description = `Run Database structure migrations
...
NOTE!
- Please stop Saltcorn before run DB migrations.
- Please make db backup before migration.
- There are no way to rollback migration if you doesn't make backup.

This is not normally required as migrations will be run when the server starts.
However, this command may be useful if you are running multiple application
servers and need to control when the migrations are run.
`;

/**
 * @type {string}
 */
MigrateCommand.help = `Run Database structure migrations.
Command goes in circle via all tenants and applies all unapplyed database structure migrations.

NOTE!
- Please stop Saltcorn before run DB migrations.
- Please make db backup before migration.
- There are no way to rollback migration if you doesn't make backup.
`;

/**
 * @type {string}
 */
MigrateCommand.usage = "saltcorn migrate";

module.exports = MigrateCommand;
