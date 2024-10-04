const sudo = require("sudo");
const { is } = require("contractis");
const { execSync, spawnSync, spawn } = require("child_process");
const os = require("os");
const crypto = require("crypto");
const { writeFileSync } = require("fs");

/**
 * Execute os  sudo command with args
 * @param args - args
 * @param allowFail - if true allows to fail of sudo
 * @param dryRun - if true it does not execute sudo but displays commands (to test purposes)
 * @returns {Promise<unknown>}
 */
const asyncSudo = (args, allowFail, dryRun) => {
  console.log(">", args.join(" "));
  if (!dryRun)
    return new Promise(function (resolve, reject) {
      let child = sudo(args, { cachePassword: true });
      //var child = sudo(['ls'], {cachePassword: true})
      child.stdout.on("data", function (data) {
        console.log(data.toString());
      });
      child.stderr.on("data", function (data) {
        console.error(data.toString());
      });
      child.on("exit", function (data) {
        if (data !== 0 && !allowFail) reject(data);
        else resolve();
      });
    });
};

const writeAppArmoreFile = async (user) => {
  const fileName = `/home/${user}/bin/rootlesskit`
    .replace(/^\/?/, "")
    .replace(/\//g, ".");

  writeFileSync(
    os.homedir() + "/" + fileName,
    `abi <abi/4.0>,
include <tunables/global>

"/home/saltcorn/bin/rootlesskit" flags=(unconfined) {
  userns,

  include if exists <local/${fileName}>
}`
  );
  await asyncSudo([
    "mv",
    os.homedir() + "/" + fileName,
    `/etc/apparmor.d/${fileName}`,
  ]);
};

const runDockerRootlessScript = async (user) => {
  await asyncSudoUser(user, ["mkdir", "-p", `/home/${user}/bin`], false, false);
  await asyncSudoUser(
    user,
    ["curl", "-fsSL", "https://get.docker.com/rootless", "-o", "get-docker.sh"],
    false,
    false
  );
  await asyncSudo(["loginctl", "enable-linger", "saltcorn"], false, false);
  await asyncSudo(
    ["apt-get", "install", "-y", "systemd-container"],
    false,
    false
  );
  await asyncSudo(
    ["machinectl", "shell", "saltcorn@", "/bin/bash", "get-docker.sh"],
    false,
    false
  );
};

/**
 * run docker pull saltcorn/cordova-builder as another user
 * and preserver DOCKER_HOST environment variable
 * @param user - user to run docker with
 */
const pullWithSudo = async (user, dockerMode) => {
  if (dockerMode === "rootless") {
    await asyncSudo(
      [
        "machinectl",
        "shell",
        `${user}@`,
        "/bin/bash",
        "--login",
        "-c",
        "docker pull saltcorn/cordova-builder",
      ],
      false,
      false
    );
  } else {
    const res = spawnSync("sudo", [
      "-iu",
      user,
      "docker",
      "pull",
      "saltcorn/cordova-builder",
    ]);
    console.log(res.stdout.toString());
    if (res.status !== 0) {
      console.error("Error pulling docker image");
      console.log(res.stderr?.toString());
    }
  }
};
/**
 * Execute OS commands. For current user uses direct exec instead of sudo
 * @param user - user
 * @param args - args
 * @param allowFail - if true than allow OS process execution fail
 * @param dryRun - if true than it does not execute sudo but displays commands (to test purposes)
 * @returns {Promise<*>}
 */
const asyncSudoUser = (user, args, allowFail, dryRun) => {
  if (os.userInfo().username === user) {
    console.log(">", args.join(" "));
    execSync(args.join(" "), {
      stdio: "inherit",
    });
  } else return asyncSudo(["sudo", "-iu", user, ...args], allowFail, dryRun);
};
/**
 * Execute sudo for postgres user with arguments
 * @param args
 * @param allowFail - if true than allow OS process execution fail
 * @param dryRun
 * @returns {Promise<*>}
 */
const asyncSudoPostgres = (args, allowFail, dryRun) => {
  return asyncSudoUser("postgres", args, allowFail, dryRun);
};
/**
 * Generate random password. At least 8 characters
 * @returns {*}
 */
const gen_password = () => {
  const s = is.str.generate().replace(" ", "");
  if (s.length > 7) return s;
  else return gen_password();
};

/**
 * Generate jwt secret
 * @returns {string}
 */
const genJwtSecret = () => {
  return crypto.randomBytes(64).toString("hex");
};

module.exports = {
  asyncSudo,
  asyncSudoPostgres,
  asyncSudoUser,
  gen_password,
  genJwtSecret,
  pullWithSudo,
  writeAppArmoreFile,
  runDockerRootlessScript,
};
