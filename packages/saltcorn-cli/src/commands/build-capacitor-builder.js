const { Command, Flags } = require("@oclif/core");
const { join } = require("path");
const { spawnSync } = require("child_process");

/**
 * This is a oclif command to build the 'saltcorn/capacitor-builder' docker image.
 * The image is used in the 'build-app' command to run the capacitor commands.
 * Please make sure docker is callable without sudo (see rootless mode, or add the user to the docker group).
 */
class BuildCapacitorBuilder extends Command {
  async run() {
    const { flags } = await this.parse(BuildCapacitorBuilder);
    if (flags.pullFromHub) {
      const result = spawnSync(
        "docker",
        ["pull", "saltcorn/capacitor-builder"],
        { cwd: ".", stdio: "inherit" }
      );
      if (result.error) console.log(result.error.toString());
    } else {
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
        "saltcorn/capacitor-builder",
        "--progress=plain"
      );
      const result = spawnSync("docker", dArgs, { cwd: ".", stdio: "inherit" });
      if (result.error) console.log(result.error.toString());
    }
  }
}

BuildCapacitorBuilder.description =
  "Build the 'saltcorn/capacitor-builder' docker image or pull it from docker hub.";

BuildCapacitorBuilder.help =
  "Build or pull the 'saltcorn/capacitor-builder' docker image. " +
  "This image is used in the 'build-app' command to run the capacitor commands. " +
  "Please make sure docker is callable without using root (see rootless mode, or add the user to the docker group).";

BuildCapacitorBuilder.flags = {
  buildClean: Flags.boolean({
    name: "build clean",
    string: "clean",
    description: "run a clean build with --no-cache",
    default: false,
  }),
  pullFromHub: Flags.boolean({
    name: "pull from docker hub",
    description: "pull the image from docker hub",
    default: false,
  }),
};

module.exports = BuildCapacitorBuilder;
