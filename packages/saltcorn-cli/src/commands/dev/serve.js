/**
 * @category saltcorn-cli
 * @module commands/dev/serve
 */
const { Command, Flags } = require("@oclif/core");
const { execSync, spawnSync } = require("child_process");
const { sleep } = require("../../common");
/**
 * DevServeCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class DevServeCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    await this.tryTsc();
    for (;;) {
      const scResult = spawnSync("saltcorn", ["serve", "--dev"], {
        stdio: "inherit",
      });
      if (scResult.signal) process.exit();
      switch (scResult.status) {
        case 3:
          //root tsc error
          await this.tryTsc();
          break;

          // todo builder error 
        default:
          break;
      }
    }
  }

  async tryTsc() {
    const tscResult = spawnSync("npm", ["run", "tsc"], {
      stdio: "inherit",
    });
    if (tscResult.status) {
      //todo watch instead
      await sleep(3000);
      await this.tryTsc();
    }
  }
}

/**
 * @type {string}
 */
DevServeCommand.description = `Development server. Serve on port 3000, restart when source files change`;

module.exports = DevServeCommand;
