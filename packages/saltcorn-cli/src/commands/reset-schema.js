const { Command, flags } = require("@oclif/command");
const reset = require("saltcorn-data/db/reset_schema")
class ResetCommand extends Command {
  async run() {
    await reset()
  }
}

ResetCommand.description = `Describe the command here
...
Extra documentation goes here
`;

ResetCommand.flags = {
};

module.exports = ResetCommand;
