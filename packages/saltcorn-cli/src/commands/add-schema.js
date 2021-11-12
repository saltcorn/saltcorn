/**
 * @category saltcorn-cli
 * @module commands/add-schema
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");

/**
 * AddSchemaCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class AddSchemaCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset(true);

    this.exit(0);
  }
}

/**
 * @type {string}
 */
AddSchemaCommand.description = `Add Saltcorn schema to existing database`;

module.exports = AddSchemaCommand;
