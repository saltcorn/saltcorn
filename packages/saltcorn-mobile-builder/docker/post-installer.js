const { spawn } = require("child_process");
const { join } = require("path");

if (process.env.SKIP_DOCKER_IMAGE_INSTALL === "true") {
  console.log("skipping build 'saltcorn/cordova-builder' docker image");
} else {
  spawn(
    "docker",
    [
      "build",
      __dirname,
      "--network",
      "host",
      "-f",
      join(__dirname, "Dockerfile"),
      "-t",
      "saltcorn/cordova-builder",
    ],
    { cwd: ".", stdio: "ignore", detached: true }
  ).unref();
}
