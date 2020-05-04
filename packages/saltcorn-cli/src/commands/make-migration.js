const { Command, flags } = require("@oclif/command");
const { create_blank_migration } = require("saltcorn-data/migrate");

class MigrationCommand extends Command {
  async run() {
    await create_blank_migration();
  }
}

MigrationCommand.description = `Describe the command here
...
Extra documentation goes here
`;

module.exports = MigrationCommand;
