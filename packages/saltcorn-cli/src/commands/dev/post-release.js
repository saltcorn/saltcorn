/**
 * @category saltcorn-cli
 * @module commands/post-release
 */
const { Command, flags } = require("@oclif/command");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { sleep } = require("../../common");
const path = require("path");

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
    console.log(this.version);
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
