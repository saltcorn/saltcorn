const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures");
const reset = require("saltcorn-data/db/reset_schema");
const db = require("saltcorn-data/db");
const { spawnSync } = require("child_process");

class RunTestsCommand extends Command {
  async run() {
    await db.changeConnection({ database: "saltcorn_test" });
    await reset();
    await fixtures();
    const env = { ...process.env, PGDATABASE: "saltcorn_test" };
    const lerna = process.platform === "win32" ? "lerna.cmd" : "lerna";
    const res = spawnSync(lerna, ["run", "test"], { stdio: "inherit", env });
    this.exit(res.status);
  }
}

RunTestsCommand.description = `Describe the command here
...
Extra documentation goes here
`;

RunTestsCommand.flags = {};

module.exports = RunTestsCommand;
