const { Command, flags } = require("@oclif/command");
const { spawnSync } = require("child_process");

const env = process.env;

class RestoreCommand extends Command {
  async run() {
    const { args } = this.parse(RestoreCommand);
    const { getConnectObject } = require("@saltcorn/data/db/connect");
    const connobj = getConnectObject();

    const pgdb = connobj.database;
    const pguser = connobj.user;
    const pghost = connobj.host || "localhost";
    const fnm = args.file;
    const env = { ...process.env, PGPASSWORD: connobj.password };
    const res = spawnSync(
      "pg_restore",
      ["-d", pgdb, "-U", pguser, "-h", pghost, fnm],
      { stdio: "inherit", env }
    );
    this.exit(res.status);
  }
}

RestoreCommand.args = [
  { name: "file", required: true, description: "backup file to restore" },
];

RestoreCommand.description = `Restore a previously backed up database from a file with pg_dump`;

RestoreCommand.flags = {};

module.exports = RestoreCommand;
