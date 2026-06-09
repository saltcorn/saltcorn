// File: run-tests.js
/**
 * run-tests
 * @category saltcorn-cli
 * @module commands/run-tests
 */
const { Command, Flags, Args } = require("@oclif/core");

const { spawnSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const { sleep } = require("../common");
const { build_schema_data } = require("@saltcorn/data/plugin-helper");
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
    serverEnv.REMOTE_QUERIES = true;
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

  async copySchemaIntoPck(pckNames) {
    const schemaData = await build_schema_data();
    const copy = (name) => {
      const schemaFile = path.join(
        process.cwd(),
        "packages",
        name,
        "tests",
        "schema_data.json"
      );
      fs.writeFileSync(schemaFile, JSON.stringify(schemaData));
    };
    for (const name of pckNames) copy(name);
  }

  /**
   * Run
   * @returns {Promise<void>}
   */
  async run() {
    const { args, flags } = await this.parse(RunTestsCommand);
    this.validateCall(args, flags);
    let env;

    const dbname = flags.database ? flags.database : "saltcorn_test";

    const db = require("@saltcorn/data/db");
    if (db.isSQLite) {
      const testdbpath = "/tmp/sctestdb";
      await db.changeConnection({ sqlite_path: testdbpath });
      env = { ...process.env, SQLITE_FILEPATH: testdbpath };
    } else if (db.connectObj.database !== dbname) {
      await db.changeConnection({ database: dbname });
      env = { ...process.env, PGDATABASE: dbname };
    }
    spawnSync("npm", ["run", "tsc"], {
      stdio: "inherit",
    });
    const fixtures = require("@saltcorn/data/db/fixtures");
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset();
    await fixtures();
    if (!args.package)
      await this.copySchemaIntoPck(["saltcorn-builder", "common-code"]);
    else if (["saltcorn-builder", "common-code"].includes(args.package))
      await this.copySchemaIntoPck([args.package]);
    await db.close();
    // toddo add --logHeapUsage
    if (args.package === "core") {
      await this.do_test("npm", ["run", "test", ...this.buildTestParams(flags, false)], env);
    } else if (args.package === "view-queries") {
      await this.remoteQueryTest(env, this.buildTestParams(flags, false));
    } else if (args.package) {
      const cwd = path.join("packages", args.package);
      const useNodeTest = this.pkgUsesNodeTest(cwd);
      await this.do_test(
        "npm",
        ["run", "test", ...this.buildTestParams(flags, useNodeTest)],
        env,
        cwd
      );
    } else {
      const cwd = ".";
      await this.do_test(
        "npm",
        ["--workspaces", "run", "test", ...this.buildTestParams(flags, false)],
        env,
        cwd
      );
    }
    this.exit(0);
  }

  /**
   * Whether the given package runs its tests with node's built-in test
   * runner (`node --test`) rather than jest. Test runner flags differ
   * between the two, so the params are translated accordingly.
   * @param {string} cwd - path to the package directory
   * @returns {boolean}
   */
  pkgUsesNodeTest(cwd) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(cwd, "package.json"), "utf8")
      );
      return !!(pkg.scripts && /\bnode\b.*--test\b/.test(pkg.scripts.test));
    } catch {
      return false;
    }
  }

  /**
   * Build the test runner params from the CLI flags, translating between
   * jest and node's built-in test runner flag syntax.
   * @param {object} flags - parsed CLI flags
   * @param {boolean} useNodeTest - target uses `node --test`
   * @returns {string[]}
   */
  buildTestParams(flags, useNodeTest) {
    const params = ["--"];
    if (flags.coverage) {
      if (useNodeTest) params.push("--experimental-test-coverage");
      else params.push("--coverage", "--coverageProvider", "v8");
    }
    // --listTests has no node test runner equivalent; only applies to jest
    if (flags.listTests && !useNodeTest) params.push("--listTests");
    if (flags.verbose && !useNodeTest) params.push("--verbose");
    if (flags.detectOpenHandles && !useNodeTest)
      params.push("--detectOpenHandles");
    if (flags.testFilter) {
      if (useNodeTest) params.push("--test-name-pattern", flags.testFilter);
      else params.push("-t", flags.testFilter);
    }
    if (flags.watch || flags.watchAll) {
      if (useNodeTest) params.push("--watch");
      else params.push(flags.watch ? "--watch" : "--watchAll");
    }
    return params;
  }
}

/**
 * @type {object}
 */
RunTestsCommand.args = {
  package: Args.string({
    description: "which package to run tests for",
  }),
};

/**
 * @type {string}
 */
RunTestsCommand.description = `Run test suites`;

/**
 * @type {object}
 */
RunTestsCommand.flags = {
  coverage: Flags.boolean({ char: "c", description: "Coverage" }),
  listTests: Flags.boolean({ char: "l", description: "List tests" }),
  verbose: Flags.boolean({ char: "v", description: "Verbose" }),
  detectOpenHandles: Flags.boolean({
    char: "d",
    description: "Detect Open Handles",
  }),
  testFilter: Flags.string({
    char: "t",
    description: "Filter tests by suite or test name",
  }),
  watch: Flags.boolean({
    string: "watch",
    description:
      "Watch files for changes and rerun tests related to changed files.",
  }),
  watchAll: Flags.boolean({
    string: "watchAll",
    description: "Watch files for changes and rerun all tests.",
  }),
  database: Flags.string({
    string: "database",
    description: "Run on specified database. Default is saltcorn_test",
  }),
};

module.exports = RunTestsCommand;
