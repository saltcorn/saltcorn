/**
 * @category saltcorn-cli
 * @module commands/prepare
 */
const { Command, Flags } = require("@oclif/core");

/**
 * PrepareCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class PrepareCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = await this.parse(PrepareCommand);
    const serveArgs = {
      defaultNCPUs: 1,
    };
    if (flags.addschema) {
      try {
        const { getConfig } = require("@saltcorn/data/models/config");
        await getConfig("log_sql");
      } catch (e) {
        const msg = e.message;
        if (msg && msg.includes("_sc_config")) {
          console.log("Adding Saltcorn schema to database...");
          const reset = require("@saltcorn/data/db/reset_schema");
          await reset(true);
        } else {
          console.error("Database is not reachable. The error was: ", msg);
          process.exit(1);
        }
      }
    }

    if (flags.verbose) {
      const db = require("@saltcorn/data/db");
      db.set_sql_logging();
    }

    const getApp = require("@saltcorn/server/app");
    await getApp(serveArgs);
    process.exit(0);

  }
}

/**
 * @type {string}
 */
PrepareCommand.description = `Prepare to serve. Optional, may accelerate subsequent 'saltcorn serve' startup`;

/**
 * @type {object}
 */
PrepareCommand.flags = {
  verbose: Flags.boolean({ char: "v", description: "Verbose" }),
  addschema: Flags.boolean({ char: "a", description: "Add schema if missing" }),
};

module.exports = PrepareCommand;
