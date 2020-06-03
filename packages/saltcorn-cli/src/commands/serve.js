const { Command, flags } = require("@oclif/command");
class ServeCommand extends Command {
  async run() {
    const { flags } = this.parse(ServeCommand);
    const port = flags.port || 3000;
    if (flags.verbose) {
      const db = require("@saltcorn/data/db");
      db.set_sql_logging();
    }
    const serve = require("@saltcorn/server/serve");
    await serve(port);
  }
}

ServeCommand.description = `Start the Saltcorn server`;

ServeCommand.flags = {
  port: flags.integer({ char: "p", description: "port", default: 3000 }),
  verbose: flags.boolean({ char: "v", description: "Verbose" })
};

module.exports = ServeCommand;
