const { Command, flags } = require("@oclif/command");
const db = require("@saltcorn/data/db");
const { eachTenant } = require("@saltcorn/data/models/tenant");

class MigrateCommand extends Command {
  async run() {
    const { migrate } = require("@saltcorn/data/migrate");
    await eachTenant(async () => {
      const domain = db.getTenantSchema();
      await migrate(domain);
    });
    this.exit(0);
  }
}

MigrateCommand.description = `Run migrations
...
This is not normally required as migrations will be run when the server starts. 
However, this command may be useful if you are running multiple application 
servers and need to control when the migrations are run.
`;

module.exports = MigrateCommand;
