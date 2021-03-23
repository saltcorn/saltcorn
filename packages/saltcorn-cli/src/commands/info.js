const { Command, flags } = require("@oclif/command");
const {
  configFilePath,
  getConnectObject,
} = require("@saltcorn/data/db/connect");
const {dump} = require('js-yaml');

const print_it = (results, json) => {
  if (json) console.log(JSON.stringify(results, null, 2));
  else
    console.log(dump(results))
};

class InfoCommand extends Command {
  static aliases = ["paths"];
  async run() {
    const { flags } = this.parse(InfoCommand);
    const db = require("@saltcorn/data/db");
    const cliPath = __dirname
    const conn = getConnectObject();
    const res = {
      configFilePath,
      nodeVersion: process.version,
      databaseVendor: db.isSQLite ? "SQLite" : "PostgreSQL",
      cliPath,
      configuration: conn
    };
    print_it(res, flags.json);
    this.exit(0);
  }
}

InfoCommand.description = `Show paths
...
Show configuration and file store paths
`;

InfoCommand.flags = {
  json: flags.boolean({ char: "j", description: "json format" }),
};
module.exports = InfoCommand;
