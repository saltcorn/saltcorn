const { Command, flags } = require("@oclif/command");
const { execSync } = require("child_process");
const dateFormat = require("dateformat");
const os = require("os");

const env = process.env;
var day = dateFormat(new Date(), "yyyymmdd");
const pgdb = env.PGDATABASE || "saltcorn";
var default_filenm = `${day}-backup-${pgdb}-${os.hostname}.sqlc`;

class BackupCommand extends Command {
  async run() {
    const { flags } = this.parse(BackupCommand);

    const pguser = env.PGUSER;
    const outfnm = flags.output || default_filenm;

    execSync(`pg_dump ${pgdb} -U ${pguser} -h localhost -F c >${outfnm}`);
  }
}

BackupCommand.description = `Describe the command here
...
Extra documentation goes here
`;

BackupCommand.flags = {
  output: flags.string({
    char: "o",
    description: "output filename",
    default: default_filenm
  })
};

module.exports = BackupCommand;
