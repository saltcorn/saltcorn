const { Command, flags } = require("@oclif/command");
class ScheduleCommand extends Command {
  async run() {
    const { flags } = this.parse(ScheduleCommand);
    if (flags.verbose) {
      const db = require("@saltcorn/data/db");
      db.set_sql_logging();
    }
    const runScheduler = require("@saltcorn/data/models/scheduler");
    await runScheduler();
  }
}

ScheduleCommand.description = `Run the Saltcorn scheduler`;

ScheduleCommand.flags = {
  verbose: flags.boolean({ char: "v", description: "Verbose" }),
};

module.exports = ScheduleCommand;
