const { Command, flags } = require("@oclif/command");
const { create_blank_migration } = require("@saltcorn/data/migrate");

class MigrationCommand extends Command {
  async run() {
    await create_blank_migration();
  }
}

MigrationCommand.description = `Create a new blank migration file
...
These migrations track internal structures to the database. You should not
normally need to run this unless you are a developer.
`;

module.exports = MigrationCommand;
