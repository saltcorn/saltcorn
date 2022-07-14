const { spawnSync } = require("child_process");

if (process.env.SKIP_DOCKER_IMAGE_INSTALL === "true") {
  console.log("skipping build 'saltcorn/cordova-builder' docker image");
} else {
  const result = spawnSync(
    "docker",
    [
      "build",
      __dirname,
      "-f",
      `${__dirname}/Dockerfile`,
      "-t",
      "saltcorn/cordova-builder",
    ],
    { cwd: ".", stdio: "inherit" }
  );
  if (result.error) console.log(result.error.toString());
}
