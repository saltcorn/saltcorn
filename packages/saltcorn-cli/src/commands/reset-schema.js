/**
 * @category saltcorn-cli
 * @module commands/reset-schema
 */
const { Command, Flags, ux } = require("@oclif/core");
const { maybe_as_tenant } = require("../common");

/**
 * ResetCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ResetCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const reset = require("@saltcorn/data/db/reset_schema");
    const db = require("@saltcorn/data/db");
    const { flags } = await this.parse(ResetCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      const schema = db.getTenantSchema();
      if (flags.force) {
        await reset(false, schema);
      } else {
        const ans = await ux.confirm(
          `This will wipe all data from database "${
            db.isSQLite ? "SQLite" : db.connectObj.database + "." + schema
          }".\nContinue (y/n)?`
        );
        if (ans) await reset(false, schema);
      }
    });
    console.log("Successfully ran the 'reset-schema' command");
    this.exit(0);
  }
}

/**
 * @type {string}
 */
ResetCommand.description = `Reset the database
...
This will delete all existing information
`;

/**
 * @type {string}
 */
ResetCommand.help = `Reset the database
...
This will delete all existing information
`;

/**
 * @type {object}
 */
ResetCommand.flags = {
  force: Flags.boolean({ char: "f", description: "force command execution" }),
  tenant: Flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = ResetCommand;
