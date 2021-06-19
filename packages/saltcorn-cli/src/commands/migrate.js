const { Command, flags } = require("@oclif/command");
const db = require("@saltcorn/data/db");
const { eachTenant } = require("@saltcorn/data/models/tenant");
// todo add dryrun mode
class MigrateCommand extends Command {
  async run() {
    const { migrate } = require("@saltcorn/data/migrate");
    await eachTenant(async () => {
      const domain = db.getTenantSchema();
      console.log("Tenant %s check for migrations...", domain);
      await migrate(domain, true);
    });
    this.exit(0);
  }
}

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

MigrateCommand.help = `Run Database structure migrations.
Command goes in circle via all tenants and applies all unapplyed database structure migrations.

NOTE!
- Please stop Saltcorn before run DB migrations.
- Please make db backup before migration.
- There are no way to rollback migration if you doesn't make backup.
`;


MigrateCommand.usage = "saltcorn migrate";

module.exports = MigrateCommand;
