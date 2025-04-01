/**
 * @category saltcorn-cli
 * @module commands/add-schema
 */
const { Command, Flags } = require("@oclif/core");
const inquirer = require("inquirer").default;

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
    const { flags } = await this.parse(AddSchemaCommand);
    const reset = require("@saltcorn/data/db/reset_schema");
    if (!flags.force) {
      const confirmation = await inquirer.prompt([
        {
          type: "confirm",
          name: "continue",
          message: "This adds Saltcorn schema to existing database\nContinue?",
          default: false,
        },
      ]);
      if (!confirmation.continue) {
        console.log(`Success: Command execution canceled`);
        this.exit(1);
      }
    }
    await reset(true);
    console.log(`Successfully ran the 'add-schema' command`);
    this.exit(0);
  }
}

/**
 * @type {string}
 */
AddSchemaCommand.description = `Add Saltcorn schema to existing database`;

/**
 * @type {string}
 */
AddSchemaCommand.help = `Add Saltcorn schema to existing database`;

/**
 * @type {object}
 */
AddSchemaCommand.flags = {
  force: Flags.boolean({ char: "f", description: "force command execution" }),
};

module.exports = AddSchemaCommand;
