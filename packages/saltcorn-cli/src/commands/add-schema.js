const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");

class AddSchemaCommand extends Command {
  async run() {
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset(true);

    this.exit(0);
  }
}

AddSchemaCommand.description = `Add Saltcorn schema to existing database`;

module.exports = AddSchemaCommand;
