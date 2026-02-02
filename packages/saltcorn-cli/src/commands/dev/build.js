/**
 * @category saltcorn-cli
 * @module commands/dev/build
 */
const { Command, Flags, Args } = require("@oclif/core");
const { spawnSync } = require("child_process");
const { sleep } = require("../../common");
/**
 * DevBuildCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class DevBuildCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { args } = await this.parse(DevBuildCommand);

    const { reactPackages } = require("@saltcorn/server/restart_watcher");

    for (const { buildDir } of reactPackages) {
      if (args.component && !buildDir.includes(args.component)) continue;

      const { status, signal } = spawnSync("npm", ["run", "build"], {
        stdio: "inherit",
        cwd: buildDir,
      });
      if (status) process.exit(status);
      if (signal) process.exit();
    }
  }
}

/**
 * @type {string}
 */
DevBuildCommand.description = `Rebuild static assets`;

DevBuildCommand.args = {
  component: Args.string({
    required: false,
    description: "Component to rebuild",
    options: ["builder", "filemanager", "workflow-editor"],
  }),
};
module.exports = DevBuildCommand;
