// File: run-tests.js
/**
 * run-tests
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
   * Prepare and start Test Instance of Saltcorn server
   * @param env - environment variables
   * @param port - ip port to start server
   * @returns {Promise<ChildProcess>}
   */
  async prepareTestServer(env, port) {
    let serverEnv = JSON.parse(JSON.stringify(env));
    serverEnv.SQLITE_FILEPATH = "/tmp/sctestdb_server";
    spawnSync("packages/saltcorn-cli/bin/saltcorn", ["fixtures", "-r"], {
      stdio: "inherit",
      env: serverEnv,
    });

    const server = spawn(
      "packages/saltcorn-cli/bin/saltcorn",
      ["serve", "-p", port],
      {
        stdio: "inherit",
        env: serverEnv,
      }
    );
    await sleep(2000);
    return server;
  }

  /**
   * RUN End To End Text (E2E) using npm
   * @param {*} env
   * @returns {Promise<void>}
   */
  async e2etest(env) {
    const port = 2987;
    const server = await this.prepareTestServer(env, port);
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
   * Remote Query tests run
   * @param {*} env
   * @param jestParams
   */
  async remoteQueryTest(env, jestParams) {
    const port = 3000;
    env.jwt_secret = require("@saltcorn/data/db").connectObj.jwt_secret;
    const server = await this.prepareTestServer(env, port);
    const res = await this.do_test(
      "npm",
      ["run", "remote-queries-test", ...jestParams],
      env,
      "packages/saltcorn-data"
    );
    server.kill();
    if (res.status !== 0) this.exit(res.status);
  }
  /**
   * Validate CLI Call
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
   * Run
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = this.parse(RunTestsCommand);
    this.validateCall(args, flags);
    let env;

    const db = require("@saltcorn/data/db");
    if (db.isSQLite) {
      const testdbpath = "/tmp/sctestdb";
      await db.changeConnection({ sqlite_path: testdbpath });
      env = { ...process.env, SQLITE_FILEPATH: testdbpath };
    } else if (db.connectObj.database !== "saltcorn_test") {
      await db.changeConnection({ database: "saltcorn_test" });
      env = { ...process.env, PGDATABASE: "saltcorn_test" };
    }
    spawnSync("npm", ["run", "tsc"], {
      stdio: "inherit",
    });
    const fixtures = require("@saltcorn/data/db/fixtures");
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset();
    await fixtures();
    await db.close();
    let jestParams = ["--"];
    // toddo add --logHeapUsage
    if (flags.coverage) {
      jestParams.push("--coverage");
      jestParams.push("--coverageProvider", "v8");
    }
    if (flags.listTests) {
      jestParams.push("--listTests");
    }
    if (flags.verbose) {
      jestParams.push("--verbose");
    }
    if (flags.detectOpenHandles){
      jestParams.push("--detectOpenHandles");
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
    } else if (args.package === "view-queries") {
      await this.remoteQueryTest(env, jestParams);
    } else if (args.package === "e2e") {
      await this.e2etest(env);
    } else if (args.package) {
      const cwd = "packages/" + args.package;
      await this.do_test("npm", ["run", "test", ...jestParams], env, cwd);
    } else {
      const cwd = ".";
      await this.do_test(
        "npm",
        ["--workspaces", "run", "test", ...jestParams],
        env,
        cwd
      );
      //await this.e2etest(env);
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
  listTests: flags.boolean({ char: "l", description: "List tests" }),
  verbose: flags.boolean({ char: "v", description: "Verbose" }),
  detectOpenHandles: flags.boolean({ char: "d", description: "Detect Open Handles"}),
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
