const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const reset = require("@saltcorn/data/db/reset_schema");
const db = require("@saltcorn/data/db/");
class ResetCommand extends Command {
  async run() {
    const { flags } = this.parse(ResetCommand);
    if (flags.force) {
      await reset();
    } else {
      const ans = await cli.confirm(
        `This will wipe all data from database "${
          db.isSQLite ? "SQLite" : db.connectObj.database
        }".\nContinue (y/n)?`
      );
      if (ans) await reset();
    }
    this.exit(0);
  }
}

ResetCommand.description = `Reset the database
...
This will delete all existing information
`;

ResetCommand.flags = {
  force: flags.boolean({ char: "f", description: "force" })
};

module.exports = ResetCommand;
