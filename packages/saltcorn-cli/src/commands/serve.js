/**
 * @category saltcorn-cli
 * @module commands/serve
 */
const { Command, Flags } = require("@oclif/core");
const si = require("systeminformation");

/**
 * ServeCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ServeCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = await this.parse(ServeCommand);
    const cpu = await si.cpu();
    const serveArgs = {
      defaultNCPUs: cpu.performanceCores || cpu.physicalCores,
    };
    serveArgs.port = flags.port || 3000;
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
    if (flags.nomigrate) serveArgs.disableMigrate = true;
    if (flags.noscheduler) serveArgs.disableScheduler = true;
    if (flags.watchReaper) serveArgs.watchReaper = true;
    if (flags.dev) serveArgs.dev = true;
    if (flags.verbose) {
      const db = require("@saltcorn/data/db");
      db.set_sql_logging();
    }
    if (flags.subdomain_offset)
      serveArgs.subdomainOffset = flags.subdomain_offset;
    const serve = require("@saltcorn/server/serve");
    await serve(serveArgs);
  }
}

/**
 * @type {string}
 */
ServeCommand.description = `Start the Saltcorn server`;

/**
 * @type {object}
 */
ServeCommand.flags = {
  port: Flags.integer({ char: "p", description: "port", default: 3000 }),
  verbose: Flags.boolean({ char: "v", description: "Verbose" }),
  watchReaper: Flags.boolean({ char: "r", description: "Watch reaper" }),
  dev: Flags.boolean({
    string: "dev",
    char: "d",
    description: "Run in dev mode and re-start on file changes",
  }),
  addschema: Flags.boolean({ char: "a", description: "Add schema if missing" }),
  nomigrate: Flags.boolean({ char: "n", description: "No migrations" }),
  noscheduler: Flags.boolean({ char: "s", description: "No scheduler" }),
  subdomain_offset: Flags.integer({
    string: "subdomain_offset",
    description:
      "Number of parts to remove to access subdomain in 'multi_tenant' mode",
  }),
};

module.exports = ServeCommand;
