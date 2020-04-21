const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures");
const reset = require("saltcorn-data/db/reset_schema");
const db = require("saltcorn-data/db");
class RunTestsCommand extends Command {
  async run() {
      await db.changeConnection({database: 'saltcorn_test'})
      await reset();
      await fixtures();
  }
}

RunTestsCommand.description = `Describe the command here
...
Extra documentation goes here
`;

RunTestsCommand.flags = {
};

module.exports = RunTestsCommand;
