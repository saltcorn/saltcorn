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

const getUserUid = (user) => {
  const res = spawnSync("id", ["-u", user]);
  return parseInt(res.stdout.toString());
};

const getDockerEnvVars = (user, dockerMode) => {
  let result = "";
  if (dockerMode === "rootless") {
    try {
      result = `DOCKER_HOST=unix:///run/user/${getUserUid(
        user
      )}/docker.sock DOCKER_BIN=/home/${user}/bin`;
    } catch (error) {
      console.log("Unable to set up docker environment variables");
      console.log(error);
    }
  }
  return result;
};

const setupDocker = async (
  user,
  dockerMode,
  addToDockerGroup,
  osInfo,
  dryRun
) => {
  if (dockerMode === "rootless") {
    console.log("Setting up docker for rootless mode");
    await asyncSudo(
      ["apt", "install", "-y", "uidmap", "dbus-user-session"],
      false,
      dryRun
    );
    if (!dryRun) {
      // TODO check if ubuntu and osInfo.version needs an appArmor file
      await writeAppArmoreFile(user);
    }
    await asyncSudo(
      ["systemctl", "restart", "apparmor.service"],
      false,
      dryRun
    );
    await asyncSudo(["loginctl", "enable-linger", "saltcorn"], false, dryRun);
    await runDockerRootlessScript(user, dryRun);
  } else if (dockerMode === "standard") {
    console.log("Setting up docker for standard mode");
    await runDockerScript(dryRun);
    if (addToDockerGroup) {
      await asyncSudo(["usermod", "-aG", "docker", user], false, dryRun);
    }
  }
};

const pullCordovaBuilder = async (user, dockerMode, dryRun) => {
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
      dryRun
    );
  } else if (dockerMode === "standard") {
    await asyncSudoUser(
      user,
      ["docker", "pull", "saltcorn/cordova-builder"],
      false,
      dryRun
    );
  } else throw new Error(`Unknown docker mode ${dockerMode}`);
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

const runDockerRootlessScript = async (user, dryRun) => {
  await asyncSudoUser(
    user,
    ["mkdir", "-p", `/home/${user}/bin`],
    false,
    dryRun
  );
  await asyncSudoUser(
    user,
    ["curl", "-fsSL", "https://get.docker.com/rootless", "-o", "get-docker.sh"],
    false,
    dryRun
  );
  await asyncSudo(
    ["apt-get", "install", "-y", "systemd-container"],
    false,
    dryRun
  );
  await asyncSudo(
    ["machinectl", "shell", "saltcorn@", "/bin/bash", "get-docker.sh"],
    false,
    dryRun
  );
};

const runDockerScript = async (dryRun) => {
  await asyncSudo(
    ["curl", "-fsSL", "https://get.docker.com", "-o", "get-docker.sh"],
    false,
    dryRun
  );
  await asyncSudo(["sh", "get-docker.sh"], false, dryRun);
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
    if (!dryRun)
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
  writeAppArmoreFile,
  setupDocker,
  pullCordovaBuilder,
  getDockerEnvVars,
};
