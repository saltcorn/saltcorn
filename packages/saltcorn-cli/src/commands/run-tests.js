const { Command, flags } = require("@oclif/command");

const { spawnSync, spawn } = require("child_process");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RunTestsCommand extends Command {
  async do_test(cmd, args, env, forever, cwd, keepalive) {
    const res = spawnSync(cmd, args, {
      stdio: "inherit",
      env,
      cwd,
    });
    if (forever && res.status === 0)
      await this.do_test(cmd, args, env, forever, cwd);
    else if (res.status !== 0 && !keepalive) this.exit(res.status);
    return res;
  }
  async e2etest(env) {
    const server = spawn(
      "packages/saltcorn-cli/bin/saltcorn",
      ["serve", "-p", "2987"],
      {
        stdio: "inherit",
        env,
      }
    );
    await sleep(2000);
    const res = await this.do_test(
      "npm",
      ["run", "gotest"],
      env,
      false,
      "packages/e2e",
      true
    );
    server.kill();
    if (res.status !== 0) this.exit(res.status);
  }
  async run() {
    const { args, flags } = this.parse(RunTestsCommand);
    var env;
    const db = require("@saltcorn/data/db");

    if (db.isSQLite) {
      const testdbpath = "/tmp/sctestdb";
      await db.changeConnection({ sqlite_path: testdbpath });
      env = { ...process.env, SQLITE_FILEPATH: testdbpath };
    } else if (db.connectObj.database !== "saltcorn_test") {
      await db.changeConnection({ database: "saltcorn_test" });
      env = { ...process.env, PGDATABASE: "saltcorn_test" };
    }
    const fixtures = require("@saltcorn/data/db/fixtures");
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset();
    await fixtures();
    await db.close();
    const covargs = flags.coverage ? ["--", "--coverage"] : [];
    if (args.package === "core") {
      await this.do_test(
        "npm",
        ["run", "test", ...covargs],
        env,
        flags.forever
      );
    } else if (args.package === "e2e") {
      await this.e2etest(env);
    } else if (args.package) {
      const cwd = "packages/" + args.package;
      await this.do_test(
        "npm",
        ["run", "test", ...covargs],
        env,
        flags.forever,
        cwd
      );
    } else {
      const lerna = process.platform === "win32" ? "lerna.cmd" : "lerna";
      await this.do_test(
        lerna,
        ["run", "test", ...covargs],
        env,
        flags.forever
      );
      await this.e2etest(env);
    }
    this.exit(0);
  }
}

RunTestsCommand.args = [
  { name: "package", description: "which package to run tests for" },
];

RunTestsCommand.description = `Run test suites`;

RunTestsCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" }),
  forever: flags.boolean({
    char: "f",
    description: "Run forever till failure",
  }),
};

module.exports = RunTestsCommand;
