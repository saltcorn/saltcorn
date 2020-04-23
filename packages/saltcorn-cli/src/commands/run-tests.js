const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures");
const reset = require("saltcorn-data/db/reset_schema");
const db = require("saltcorn-data/db");
const { spawnSync } = require("child_process");

class RunTestsCommand extends Command {
  static args = [
    { name: "package", description: "which package to run tests for" }
  ];
  async run() {
    const { args, flags } = this.parse(RunTestsCommand);
    await db.changeConnection({ database: "saltcorn_test" });
    await reset();
    await fixtures();
    const env = { ...process.env, PGDATABASE: "saltcorn_test" };
    const covargs = flags.coverage ? ["--", "--coverage"] : [];
    if (args.package === "core") {
      const res = spawnSync("npm", ["run", "test", ...covargs], {
        stdio: "inherit",
        env
      });
      this.exit(res.status);
    } else if (args.package) {
      const cwd = "packages/" + args.package;
      const res = spawnSync("npm", ["run", "test", ...covargs], {
        stdio: "inherit",
        env,
        cwd
      });
      this.exit(res.status);
    } else {
      const lerna = process.platform === "win32" ? "lerna.cmd" : "lerna";
      const res = spawnSync(lerna, ["run", "test", ...covargs], {
        stdio: "inherit",
        env
      });
      this.exit(res.status);
    }
  }
}

RunTestsCommand.description = `Describe the command here
...
Extra documentation goes here
`;

RunTestsCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" })
};

module.exports = RunTestsCommand;
