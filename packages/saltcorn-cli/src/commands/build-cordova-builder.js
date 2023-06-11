const { Command, flags } = require("@oclif/command");
const { join } = require("path");
const { spawnSync } = require("child_process");

/**
 * This is a oclif command to build the 'saltcorn/cordova-builder' docker image.
 * The image is used in the 'build-app' command to run the cordova commands.
 * Please make sure docker is callable without sudo (see rootless mode, or add the user to the docker group).
 */
class BuildCordovaBuilder extends Command {
  async run() {
    const { flags } = this.parse(BuildCordovaBuilder);
    const dockerDir = join(
      require.resolve("@saltcorn/mobile-builder"),
      "..",
      "..",
      "docker"
    );
    const dArgs = ["build", dockerDir, "--network", "host"];
    if (flags.buildClean) dArgs.push("--no-cache");
    dArgs.push(
      "-f",
      join(dockerDir, "Dockerfile"),
      "-t",
      "saltcorn/cordova-builder"
    );
    const result = spawnSync("docker", dArgs, { cwd: ".", stdio: "inherit" });
    if (result.error) console.log(result.error.toString());
  }
}

BuildCordovaBuilder.description =
  "Build the 'saltcorn/cordova-builder' docker image";

BuildCordovaBuilder.help =
  "Build the 'saltcorn/cordova-builder' docker image. " +
  "This image is used in the 'build-app' command to run the cordova commands. " +
  "Please make sure docker is callable without using root (see rootless mode, or add the user to the docker group).";

BuildCordovaBuilder.flags = {
  buildClean: flags.boolean({
    name: "build clean",
    string: "clean",
    description: "run a clean build with --no-cache",
    default: false,
  }),
};

module.exports = BuildCordovaBuilder;
