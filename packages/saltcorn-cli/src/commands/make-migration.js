const { Command, flags } = require("@oclif/command");

class MigrationCommand extends Command {
  async run() {
    const { create_blank_migration } = require("@saltcorn/data/migrate");
    await create_blank_migration();
  }
}

MigrationCommand.description = `Create a new blank Database structure migration file.
These migrations update database structure.
You should not normally need to run this
unless you are a developer.
`;

MigrationCommand.help = `Create a new blank Database structure migration file.
These migrations update database structure.
You should not normally need to run this
unless you are a developer.
`;

MigrationCommand.usage = "make-migration";

module.exports = MigrationCommand;
