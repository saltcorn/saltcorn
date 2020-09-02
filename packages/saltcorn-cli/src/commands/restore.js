const { Command, flags } = require("@oclif/command");
const { spawnSync } = require("child_process");

const env = process.env;

class RestoreCommand extends Command {
  async run() {
    const { args } = this.parse(RestoreCommand);

    const pgdb = env.PGDATABASE || "saltcorn";
    const pguser = env.PGUSER;
    const fnm = args.file;

    const res = spawnSync(
      "pg_restore",
      ["-d", pgdb, "-U", pguser, "-h", "localhost", fnm],
      { stdio: "inherit" }
    );
    this.exit(res.status);
  }
}

RestoreCommand.args = [
  { name: "file", required: true, description: "backup file to restore" },
];

RestoreCommand.description = `Restore a previously backed up database from a file`;

RestoreCommand.flags = {};

module.exports = RestoreCommand;
