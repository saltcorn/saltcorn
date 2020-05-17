const { Command, flags } = require("@oclif/command");
const serve = require("saltcorn/serve");
class ServeCommand extends Command {
  async run() {
    const { flags } = this.parse(ServeCommand);
    const port = flags.port || 3000;
    await serve(port);
  }
}

ServeCommand.description = `Start the Saltcorn server`;

ServeCommand.flags = {
  port: flags.integer({ char: "p", description: "port", default: 3000 })
};

module.exports = ServeCommand;
