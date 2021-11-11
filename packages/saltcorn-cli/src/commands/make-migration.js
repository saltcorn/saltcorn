/**
 * @category saltcorn-cli
 * @module commands/make-migration
 */
const { Command, flags } = require("@oclif/command");

/**
 * MigrationCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class MigrationCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { create_blank_migration } = require("@saltcorn/data/migrate");
    await create_blank_migration();
  }
}

/**
 * @type {string}
 */
MigrationCommand.description = `Create a new blank Database structure migration file.
These migrations update database structure.
You should not normally need to run this
unless you are a developer.
`;

/**
 * @type {string}
 */
MigrationCommand.help = `Create a new blank Database structure migration file.
These migrations update database structure.
You should not normally need to run this
unless you are a developer.
`;

/**
 * @type {string}
 */
MigrationCommand.usage = "make-migration";

module.exports = MigrationCommand;
