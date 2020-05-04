const { Command, flags } = require("@oclif/command");
const {migrate} = require("saltcorn-data/migrate");

class MigrateCommand extends Command {
  async run() {
    await migrate()
  }
}

MigrateCommand.description = `Describe the command here
...
Extra documentation goes here
`;

module.exports = MigrateCommand;
