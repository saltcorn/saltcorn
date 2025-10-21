/**
 * @category saltcorn-cli
 * @module commands/scheduler
 */
const { Command, Flags } = require("@oclif/core");

/**
 * ScheduleCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ScheduleCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = await this.parse(ScheduleCommand);
    if (flags.verbose) {
      const db = require("@saltcorn/data/db");
      db.set_sql_logging();
    }
    const { runScheduler } = require("@saltcorn/data/models/scheduler");
    const opts = {};
    if (typeof flags.tickSeconds === "number" && !isNaN(flags.tickSeconds)) {
      opts.tickSeconds = flags.tickSeconds;
    }
    await runScheduler(opts);
  }
}

/**
 * @type {string}
 */
ScheduleCommand.description = `Run the Saltcorn scheduler`;

/**
 * @type {object}
 */
ScheduleCommand.flags = {
  verbose: Flags.boolean({ char: "v", description: "Verbose" }),
  tickSeconds: Flags.integer({
    description: "Scheduler tick interval in seconds (default 300)",
  }),
};

module.exports = ScheduleCommand;
