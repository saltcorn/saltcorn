const { Command, flags } = require("@oclif/command");
const fixtures = require("saltcorn/fixtures");
const reset = require("saltcorn-data/db/reset_schema");
const db = require("saltcorn-data/db");
const { spawnSync } = require("child_process");

class RunTestsCommand extends Command {
  async do_test(cmd, args, forever, cwd) {
    const env = { ...process.env, PGDATABASE: "saltcorn_test" };
    const res = spawnSync(cmd, args, {
      stdio: "inherit",
      env,
      cwd
    });
    if (forever && res.status === 0)
      await this.do_test(cmd, args, forever, cwd);
    else this.exit(res.status);
  }

  async run() {
    const { args, flags } = this.parse(RunTestsCommand);
    await db.changeConnection({ database: "saltcorn_test" });
    await reset();
    await fixtures();
    const env = { ...process.env, PGDATABASE: "saltcorn_test" };
    const covargs = flags.coverage ? ["--", "--coverage"] : [];
    if (args.package === "core") {
      await this.do_test("npm", ["run", "test", ...covargs], flags.forever);
    } else if (args.package) {
      const cwd = "packages/" + args.package;
      await this.do_test(
        "npm",
        ["run", "test", ...covargs],
        flags.forever,
        cwd
      );
    } else {
      const lerna = process.platform === "win32" ? "lerna.cmd" : "lerna";
      await this.do_test(lerna, ["run", "test", ...covargs], flags.forever);
    }
  }
}

RunTestsCommand.args = [
  { name: "package", description: "which package to run tests for" }
];

RunTestsCommand.description = `Run test suites`;

RunTestsCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" }),
  forever: flags.boolean({ char: "f", description: "Run forever till failure" })
};

module.exports = RunTestsCommand;
