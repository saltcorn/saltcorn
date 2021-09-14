const { cli } = require("cli-ux");
const { is } = require("contractis");
const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
const tcpPortUsed = require("tcp-port-used");
const { spawnSync } = require("child_process");
const sudo = require("sudo");
const envPaths = require("env-paths");
const si = require("systeminformation");
const os = require("os");
const gen_password = () => {
  const s = is.str.generate().replace(" ", "");
  if (s.length > 7) return s;
  else return gen_password();
};

//https://github.com/sindresorhus/is-root/blob/main/index.js
const isRoot = process.getuid && process.getuid() === 0;

const configFilePath = path.join(
  envPaths("", { suffix: "" }).config,
  ".saltcorn"
);
if (process.argv.includes("--help")) {
  console.log("Install saltcorn\n");
  console.log("OPTIONS:");
  console.log(
    "  -y, --yes\tNon-interactive, accept all defaults: \n\t\tLocal PostgreSQL, saltcorn user, port 80, create systemd unit\n"
  );
  process.exit(0);
}
const yes = process.argv.includes("-y") || process.argv.includes("--yes");

const askUser = async () => {
  if (yes) return "saltcorn";
  if (isRoot) return "saltcorn";
  const me = os.userInfo().username;
  if (me === "saltcorn") return "saltcorn";

  const responses = await inquirer.prompt([
    {
      name: "user",
      message: "Which user will run Saltcorn?",
      type: "list",
      choices: [
        {
          name: "Create a new user: saltcorn",
          value: "saltcorn",
        },
        {
          name: `This user will run saltcorn: ${me}`,
          value: me,
        },
      ],
    },
  ]);
  return responses.user;
};

const askDatabase = async () => {
  if (yes) return "pg";
  const inUse = await tcpPortUsed.check(5432, "127.0.0.1");
  if (inUse) {
    console.log("Found PostgreSQL running");
    return "pg-local";
  }
  const responses = await inquirer.prompt([
    {
      name: "database",
      message: "To which database will Saltcorn connect?",
      type: "list",
      choices: [
        {
          name: "Local PostgreSQL",
          value: "pg-local",
        },
        {
          name: `This user will run saltcorn: ${me}`,
          value: me,
        },
      ],
    },
  ]);
  return responses.database;
};

const go = async () => {
  // for me (only if not root) or create saltcorn user
  const user = await askUser();

  // postgres or sqlite
  // install system pkg
  // global saltcorn install
  // if sqlite, save cfg & exit
  // if pg, is it already installed?
  // set up pg db
  //systemd unit?
  // port?
  // if 80, setcap
  //save cfg

  console.log({ yes, configFilePath, user });
};

go();
