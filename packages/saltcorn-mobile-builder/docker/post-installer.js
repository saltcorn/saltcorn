const { spawn, spawnSync } = require("child_process");
const { join } = require("path");

if (process.env.SKIP_DOCKER_IMAGE_INSTALL === "true") {
  console.log("skipping build 'saltcorn/cordova-builder' docker image");
} else {
  const dArgs = [
    "build",
    __dirname,
    "--network",
    "host",
    "--no-cache",
    "-f",
    join(__dirname, "Dockerfile"),
    "-t",
    "saltcorn/cordova-builder",
  ];
  if (process.env.ATTTACH_DOCKER_IMAGE_BUILD === "true") {
    const result = spawnSync("docker", dArgs, { cwd: ".", stdio: "inherit" });
    if (result.error) console.log(result.error.toString());
  } else {
    const child = spawn("docker", dArgs, {
      cwd: ".",
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    child.on("error", () => {
      // console not available
    });
  }
}
