const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures")
const reset = require("saltcorn-data/db/reset_schema");
class FixturesCommand extends Command {
  async run() {
    const { flags } = this.parse(FixturesCommand);
    if (flags.reset) {
        await reset();
    }
    await fixtures()
  }
}

FixturesCommand.description = `Describe the command here
...
Extra documentation goes here
`;

FixturesCommand.flags = {
  reset: flags.boolean({ char: "r", description: "Also reset schema" })

};

module.exports = FixturesCommand;
