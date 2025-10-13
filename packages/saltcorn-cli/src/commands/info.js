/**
 * @category saltcorn-cli
 * @module commands/info
 */
const { Command, Flags, Args } = require("@oclif/core");
const {
  configFilePath,
  getConnectObject,
} = require("@saltcorn/data/db/connect");
const packagejson = require("../../package.json");
const { print_it } = require("../common");
const si = require("systeminformation");

/**
 * InfoCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class InfoCommand extends Command {
  /**
   * @type {string[]}
   */
  static aliases = ["paths"];

  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags, args } = await this.parse(InfoCommand);
    const db = require("@saltcorn/data/db");
    const cliPath = __dirname;
    const conn = getConnectObject();
    const cpu = await si.cpu();

    const res = {
      saltcornVersion: packagejson.version,
      configFilePath,
      nodeVersion: process.version,
      cliPath,
      databaseVendor: db.isSQLite ? "SQLite" : "PostgreSQL",
      defaultNWorkers: cpu.performanceCores || cpu.physicalCores,
    };
    try {
      res.databaseVersion = await db.getVersion();
      res.configuration = conn;
    } catch (e) {
      res.configuration = conn;
      res.connectionError = e.message;
    }
    res.environmentVariables = {};
    const envVars =
      "DATABASE_URL SQLITE_FILEPATH PGDATABASE PGUSER PGHOST PGPORT PGPASSWORD PGDATABASE SALTCORN_SESSION_SECRET SALTCORN_MULTI_TENANT SALTCORN_FILE_STORE SALTCORN_DEFAULT_SCHEMA SALTCORN_FIXED_CONFIGURATION SALTCORN_EXPOSED_CONFIGURATION SALTCORN_FIXED_PLUGIN_CONFIGURATION SALTCORN_INHERIT_CONFIGURATION SALTCORN_SERVE_ADDITIONAL_DIR SALTCORN_NWORKERS SALTCORN_DISABLE_UPGRADE PUPPETEER_CHROMIUM_BIN HTTPS_PROXY".split(
        " ",
      );
    envVars.forEach((v) => {
      if (process.env[v]) res.environmentVariables[v] = process.env[v];
      else res.environmentVariables[v] = "";
    });
    if (args.key === "file_store" || args.key === "version_tag") {
      console.log(res.configuration[args.key]);
    } else if (args.key) {
      console.log(res[args.key]);
    } else print_it(res, flags.json);
    this.exit(0);
  }
}

/**
 * @type {string}
 */
InfoCommand.description = `Show paths
...
Show configuration and file store paths
`;

/**
 * @type {object}
 */
InfoCommand.flags = {
  json: Flags.boolean({ char: "j", description: "json format" }),
};

InfoCommand.args = {
  key: Args.string({
    required: false,
    description: "Output single value",
    options: [
      "configFilePath",
      "cliPath",
      "file_store",
      "saltcornVersion",
      "version_tag",
    ],
  }),
};

module.exports = InfoCommand;
