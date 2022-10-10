const sudo = require("sudo");
const { is } = require("contractis");
const { execSync } = require("child_process");
const os = require("os");
const crypto = require("crypto");

/**
 * Execute os  sudo command with args
 * @param args - args
 * @param allowFail - if true allows to fail of sudo
 * @param dryRun - if true it does not execute sudo but displays commands (to test purposes)
 * @returns {Promise<unknown>}
 */
const asyncSudo = (args, allowFail, dryRun) => {
  console.log(">", args.join(" "));
  if(!dryRun) return new Promise(function (resolve, reject) {
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
  } else return asyncSudo(["sudo", "-iu", user, ...args], allowFail,dryRun);
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

module.exports = { asyncSudo, asyncSudoPostgres, asyncSudoUser, gen_password, genJwtSecret };
