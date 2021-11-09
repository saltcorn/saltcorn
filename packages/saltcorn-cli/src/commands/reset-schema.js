/**
 * @category saltcorn-cli
 * @module commands/reset-schema
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
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
    const db = require("@saltcorn/data/db/");
    const { flags } = this.parse(ResetCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      const schema = db.getTenantSchema();
      if (flags.force) {
        await reset(false, schema);
      } else {
        const ans = await cli.confirm(
          `This will wipe all data from database "${
            db.isSQLite ? "SQLite" : db.connectObj.database + "." + schema
          }".\nContinue (y/n)?`
        );
        if (ans) await reset(false, schema);
      }
    });
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
 * @type {object}
 */
ResetCommand.flags = {
  force: flags.boolean({ char: "f", description: "force" }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = ResetCommand;
