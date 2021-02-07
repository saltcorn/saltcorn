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

    if (flags.tenant) {
      const { create_backup } = require("@saltcorn/data/models/backup");

      const db = require("@saltcorn/data/db");
      const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
      const { init_multi_tenant } = require("@saltcorn/data/db/state");

      await loadAllPlugins();
      await init_multi_tenant(loadAllPlugins);
      await db.runWithTenant(flags.tenant, async () => {
        const fnm = await create_backup(flags.output);
        console.log(fnm);
      });
    } else if (flags.zip) {
      const { create_backup } = require("@saltcorn/data/models/backup");
      const fnm = await create_backup(flags.output);
      console.log(fnm);
    } else {
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
}

BackupCommand.description = `Backup the PostgreSQL database to a file with pg_dump or zip`;

BackupCommand.flags = {
  output: flags.string({
    char: "o",
    description: "output filename",
    default: default_filenm,
  }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  zip: flags.boolean({
    char: "z",
    description: "zip format",
  }),
};

module.exports = BackupCommand;
