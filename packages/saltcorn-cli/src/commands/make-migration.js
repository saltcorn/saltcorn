const { Command, flags } = require("@oclif/command");

class MigrationCommand extends Command {
  async run() {
    const { create_blank_migration } = require("@saltcorn/data/migrate");
    await create_blank_migration();
  }
}

MigrationCommand.description = `Create a new blank migration file
...
These migrations track internal structures to the database. You should not
normally need to run this unless you are a developer.
`;

module.exports = MigrationCommand;
