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

    const { flags } = this.parse(AddSchemaCommand);
    const reset = require("@saltcorn/data/db/reset_schema");
    if(!flags.force){
      const ans = await cli.confirm(
        `This add Saltcorn schema to existing database\nContinue (y/n)?`);
      if (!ans) {
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
  force: flags.boolean({ char: "f", description: "force command execution" }),
};

module.exports = AddSchemaCommand;
