/**
 * @category saltcorn-cli
 * @module commands/migrate
 */
const { Command, Flags } = require("@oclif/core");
const db = require("@saltcorn/data/db");
const { eachTenant } = require("@saltcorn/admin-models/models/tenant");
const { maybe_as_tenant, init_some_tenants } = require("../common");

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
    const { flags } = await this.parse(MigrateCommand);

    const { migrate } = require("@saltcorn/data/migrate");
    const Plugin = require("@saltcorn/data/models/plugin");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");

    if (flags.tenant) {
      await init_some_tenants(flags.tenant);
      await maybe_as_tenant(flags.tenant, async () => {
        const domain = db.getTenantSchema();
        await migrate(domain, true);
      });
    } else {
      await Plugin.loadAllPlugins();

      await eachTenant(async () => {
        const domain = db.getTenantSchema();
        await init_multi_tenant(Plugin.loadAllPlugins, undefined, [domain]);
        console.log("Tenant %s check for migrations...", domain);
        try {
          await migrate(domain, true);
        } catch (e) {
          console.error(e);
        }
      });
    }
    console.log("Done migrations");
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

MigrateCommand.flags = {
  tenant: Flags.string({
    name: "tenant",
    char: "t",
    description: "tenant",
    required: false,
  }),
};

module.exports = MigrateCommand;
