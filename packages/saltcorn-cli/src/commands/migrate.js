const { Command, flags } = require("@oclif/command");
const { migrate } = require("@saltcorn/data/migrate");

class MigrateCommand extends Command {
  async run() {
    await migrate();
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
