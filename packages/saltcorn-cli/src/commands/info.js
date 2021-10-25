const { Command, flags } = require("@oclif/command");
const {
  configFilePath,
  getConnectObject,
} = require("@saltcorn/data/db/connect");
const { dump } = require("js-yaml");
const packagejson = require("../../package.json");

const print_it = (results, json) => {
  if (json) console.log(JSON.stringify(results, null, 2));
  else console.log(dump(results, { lineWidth: process.stdout.columns }));
};

class InfoCommand extends Command {
  static aliases = ["paths"];
  async run() {
    const { flags } = this.parse(InfoCommand);
    const db = require("@saltcorn/data/db");
    const cliPath = __dirname;
    const conn = getConnectObject();
    const res = {
      saltcornVersion: packagejson.version,
      configFilePath,
      nodeVersion: process.version,
      cliPath,
      databaseVendor: db.isSQLite ? "SQLite" : "PostgreSQL",
    };
    try {
      res.databaseVersion = await db.getVersion();
      res.configuration = conn;
    } catch (e) {
      res.configuration = conn;
      res.connectionError = e.message;
    }
    res.environmentVariables = {};
    const envVars = "DATABASE_URL SQLITE_FILEPATH PGDATABASE PGUSER PGHOST PGPORT PGPASSWORD PGDATABASE SALTCORN_SESSION_SECRET SALTCORN_MULTI_TENANT SALTCORN_FILE_STORE SALTCORN_DEFAULT_SCHEMA SALTCORN_FIXED_CONFIGURATION SALTCORN_INHERIT_CONFIGURATION SALTCORN_SERVE_ADDITIONAL_DIR SALTCORN_NWORKERS SALTCORN_DISABLE_UPGRADE".split(
      " "
    );
    envVars.forEach((v) => {
      if (process.env[v]) res.environmentVariables[v] = process.env[v];
      else res.environmentVariables[v] = "";
    });
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
