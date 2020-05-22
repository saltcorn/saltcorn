const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
class FixturesCommand extends Command {
  async run() {
    const { flags } = this.parse(FixturesCommand);
    if (flags.reset) {
      await reset();
    }
    await fixtures();
  }
}

FixturesCommand.description = `Load fixtures for testing
...
This manual step it is never required for users and rarely required for developers
`;

FixturesCommand.flags = {
  reset: flags.boolean({ char: "r", description: "Also reset schema" })
};

module.exports = FixturesCommand;
