const { Command } = require("@oclif/command");
const { join } = require("path");
const { spawnSync } = require("child_process");

/**
 * This is a oclif command to build the 'saltcorn/cordova-builder' docker image.
 * The image is used in the 'build-app' command to run the cordova commands.
 * Please make sure docker is callable without sudo (see rootless mode, or add the user to the docker group).
 */
class BuildCordovaBuilder extends Command {
  run() {
    const dockerDir = join(
      require.resolve("@saltcorn/mobile-builder"),
      "..",
      "..",
      "docker"
    );
    const result = spawnSync(
      "docker",
      [
        "build",
        dockerDir,
        "--network",
        "host",
        "-f",
        join(dockerDir, "Dockerfile"),
        "-t",
        "saltcorn/cordova-builder",
      ],
      { cwd: ".", stdio: "inherit" }
    );
    if (result.error) console.log(result.error.toString());
  }
}

BuildCordovaBuilder.description =
  "Build the 'saltcorn/cordova-builder' docker image";

BuildCordovaBuilder.help =
  "Build the 'saltcorn/cordova-builder' docker image. " +
  "This image is used in the 'build-app' command to run the cordova commands. " +
  "Please make sure docker is callable without using root (see rootless mode, or add the user to the docker group).";

module.exports = BuildCordovaBuilder;
