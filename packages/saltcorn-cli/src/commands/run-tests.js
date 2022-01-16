/**
 * @category saltcorn-cli
 * @module commands/run-tests
 */
const { Command, flags } = require("@oclif/command");

const { spawnSync, spawn } = require("child_process");
const { sleep } = require("../common");

/**
 * RunTestsCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class RunTestsCommand extends Command {
  /**
   *
   * @param {string} cmd
   * @param {string[]} args
   * @param {*} env
   * @param {*} cwd
   * @param {boolean} keepalive
   * @returns {object}
   */
  async do_test(cmd, args, env, cwd, keepalive) {
    const res = spawnSync(cmd, args, {
      stdio: "inherit",
      env,
      cwd,
    });
    if (res.status !== 0 && !keepalive) this.exit(res.status);
    return res;
  }

  /**
   *
   * @param {*} env
   * @returns {Promise<void>}
   */
  async e2etest(env) {
    spawnSync("packages/saltcorn-cli/bin/saltcorn", ["fixtures", "-r"], {
      stdio: "inherit",
      env,
    });

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
      "packages/e2e",
      true
    );
    server.kill();
    if (res.status !== 0) this.exit(res.status);
  }

  /**
   *
   * @param {object} args
   * @param {object} flags
   * @throws {Error}
   * @returns {void}
   */
  validateCall(args, flags) {
    if (!args.package && flags.testFilter) {
      throw new Error(
        "No package name given. To use -t please specify a package or use core."
      );
    }
    if (flags.watch && flags.watchAll) {
      throw new Error(
        "Ether use 'watch' or 'watchAll' but not both at the same time."
      );
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = this.parse(RunTestsCommand);
    this.validateCall(args, flags);
    var env;

    spawnSync("npm", ["run", "tsc"], {
      stdio: "inherit",
    });

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
    let jestParams = ["--"];
    if (flags.coverage) {
      jestParams.push("--coverage");
    }
    if (flags.testFilter) {
      jestParams.push("-t", flags.testFilter);
    }
    if (flags.watch) {
      jestParams.push("--watch");
    }
    if (flags.watchAll) {
      jestParams.push("--watchAll");
    }
    if (args.package === "core") {
      await this.do_test("npm", ["run", "test", ...jestParams], env);
    } else if (args.package === "e2e") {
      await this.e2etest(env);
    } else if (args.package) {
      const cwd = "packages/" + args.package;
      await this.do_test("npm", ["run", "test", ...jestParams], env, cwd);
    } else {
      const lerna = process.platform === "win32" ? "lerna.cmd" : "lerna";
      await this.do_test(
        lerna,
        ["run", "test", "--stream", ...jestParams],
        env
      );
      await this.e2etest(env);
    }
    this.exit(0);
  }
}

/**
 * @type {object}
 */
RunTestsCommand.args = [
  { name: "package", description: "which package to run tests for" },
];

/**
 * @type {string}
 */
RunTestsCommand.description = `Run test suites`;

/**
 * @type {object}
 */
RunTestsCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" }),
  testFilter: flags.string({
    char: "t",
    description: "Filter tests by suite or test name",
  }),
  watch: flags.boolean({
    string: "watch",
    description:
      "Watch files for changes and rerun tests related to changed files.",
  }),
  watchAll: flags.boolean({
    string: "watchAll",
    description: "Watch files for changes and rerun all tests.",
  }),
};

module.exports = RunTestsCommand;
