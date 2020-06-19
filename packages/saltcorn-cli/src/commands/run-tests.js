const { Command, flags } = require("@oclif/command");
const fixtures = require("@saltcorn/server/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
const db = require("@saltcorn/data/db");
const { spawnSync, spawn } = require("child_process");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RunTestsCommand extends Command {
  async do_test(cmd, args, forever, cwd, keepalive) {
    const env = { ...process.env, PGDATABASE: "saltcorn_test" };
    const res = spawnSync(cmd, args, {
      stdio: "inherit",
      env,
      cwd
    });
    if (forever && res.status === 0)
      await this.do_test(cmd, args, forever, cwd);
    else if(res.status !== 0 && !keepalive)
      this.exit(res.status);
    return res;
  }
  async e2etest() {
    const server=spawn("packages/saltcorn-cli/bin/saltcorn", ['serve'], 
    {stdio: "inherit",env:{ ...process.env, PGDATABASE: "saltcorn_test" }})
    await sleep(3000);
    const res = await this.do_test(
      "npm",
      ["run", "gotest"],
      false,
      "packages/e2e",
      true
    );
    server.kill()
    if(res.status !== 0)
      this.exit(res.status);
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
    } else if (args.package==="e2e") {
      await this.e2etest()
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
      if(process.env.CI !== 'true')
        await this.e2etest()
    }
    this.exit(0);

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
