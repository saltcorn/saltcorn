/**
 * @category saltcorn-cli
 * @module commands/post-release
 */
const { Command, flags } = require("@oclif/command");
const fs = require("fs");
const fsp = fs.promises;
const { spawnSync, spawn } = require("child_process");
const { sleep } = require("../../common");
const path = require("path");
const fetch = require("node-fetch");
const { exitCode } = require("process");

const runWithOutput = (cmd, args, opts = {}) =>
  new Promise(function (resolve, reject) {
    const stdouterrs = [];
    let exitCode;
    const child = spawn(cmd, args, {
      stdio: "pipe",
      ...opts,
    });
    child.stdout.on("data", (data) => {
      console.log(data.toString());
      stdouterrs.push(data.toString());
    });
    child.stderr.on("data", (data) => {
      console.error(data.toString());
      stdouterrs.push(data.toString());
    });
    child.on("exit", function (code, signal) {
      exitCode = code;
      resolve({ output: stdouterrs.join(""), exitCode });
    });
  });

/**
 * PostReleaseCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class PostReleaseCommand extends Command {
  get baseRepoDir() {
    return path.join(__dirname, "..", "..", "..", "..", "..");
  }
  async docker() {
    spawnSync("bash", ["deploy/docker_build_push.sh"], {
      stdio: "inherit",
      cwd: this.baseRepoDir,
    });
  }
  async vagrant() {
    const token = process.env.SALTCORN_RELEASE_REPORT_TOKEN;
    if (!token) {
      console.error("Token not found in env var SALTCORN_RELEASE_REPORT_TOKEN");
      process.exit(1);
    }
    const fres = await fetch("https://releases.saltcorn.com/api/Release", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        version: this.version,
      }),
    });
    const jresp = await fres.json();
    const release_id = jresp.success;
    if (!release_id) {
      console.error("cannot insert");
      process.exit(1);
    }

    const vagrantDir = path.join(
      this.baseRepoDir,
      "deploy",
      "vagrant-test-install"
    );
    const dirs = fs.readdirSync(vagrantDir);
    for (const dir of dirs) {
      console.log(dir);
      const cwd = path.join(vagrantDir, dir);

      const stat = await fsp.stat(cwd);
      if (!stat.isDirectory()) continue;
      const runres = await runWithOutput("vagrant", ["up"], {
        cwd,
      });
      spawnSync("vagrant", ["destroy", "-f"], {
        stdio: "inherit",
        cwd,
      });
      const fres1 = await fetch(
        "https://releases.saltcorn.com/api/Build Result",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            build_output: runres.output,
            pass: runres.exitCode === 0,
            name: dir,
            release: release_id,
            vagrantfile: `https://github.com/saltcorn/saltcorn/blob/v${this.version}/deploy/vagrant-test-install/${dir}/Vagrantfile`,
          }),
        }
      );
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async run() {
    const {
      args: { task },
    } = this.parse(PostReleaseCommand);
    this.version = require(path.join(
      __dirname,
      "..",
      "..",
      "..",
      "package.json"
    )).version;
    console.log("Version", this.version);
    if (!this.version) this.exit(1);
    if (!task || task === "docker" || task === "all") await this.docker();

    if (!task || task === "vagrant" || task === "all") await this.vagrant();
    this.exit(0);
  }
}

/**
 * @type {string}
 */
PostReleaseCommand.description = `Post-release tasks: docker and vagrant builds`;

/**
 * @type {object}
 */
PostReleaseCommand.args = [
  {
    name: "task",
    options: ["docker", "vagrant", "all", "none"],
    description: "What to do",
  },
];

module.exports = PostReleaseCommand;
