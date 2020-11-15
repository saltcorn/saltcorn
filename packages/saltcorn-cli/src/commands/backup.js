const { Command, flags } = require("@oclif/command");
const { execSync } = require("child_process");
const dateFormat = require("dateformat");
const os = require("os");
const { getConnectObject } = require("@saltcorn/data/db/connect");
const env = process.env;
var day = dateFormat(new Date(), "yyyymmdd");
const connobj = getConnectObject();

const pgdb = connobj.database;

var default_filenm = `${day}-${pgdb}-${os.hostname}.sqlc`;

class BackupCommand extends Command {
  async run() {
    const { flags } = this.parse(BackupCommand);

    const pguser = connobj.user;
    const pghost = connobj.host || "localhost";
    const outfnm = flags.output || default_filenm;
    const env = { ...process.env, PGPASSWORD: connobj.password };
    execSync(`pg_dump ${pgdb} -U ${pguser} -h ${pghost} -F c >${outfnm}`, {
      stdio: "inherit",
      env,
    });
    console.log(outfnm);
  }
}

BackupCommand.description = `Backup the PostgreSQL database to a file with pg_dump`;

BackupCommand.flags = {
  output: flags.string({
    char: "o",
    description: "output filename",
    default: default_filenm,
  }),
};

module.exports = BackupCommand;
