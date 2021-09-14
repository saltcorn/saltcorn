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
  const inUse = await tcpPortUsed.check(5432, "127.0.0.1");
  if (inUse) {
    console.log("Found PostgreSQL running");
    return "pg-local-running";
  }

  if (yes) return "pg-local";

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
          name: `SQLite`,
          value: "sqlite",
        },
      ],
    },
  ]);
  return responses.database;
};
const askDevServer = async (db) => {
  if (process.platform !== "linux") {
    console.log("Non-linux platform, continuing development-mode install");
    return "dev";
  }
  if (db === "sqlite") return "dev";
  if (yes) return "server";
  const responses = await inquirer.prompt([
    {
      name: "mode",
      message: "How will you run Saltcorn?",
      type: "list",
      choices: [
        {
          name: "Server mode as systemd service",
          value: "server",
        },
        {
          name: "Development mode. I will start Saltcorn when needed",
          value: "dev",
        },
      ],
    },
  ]);
  return responses.mode;
};
const askPort = async (mode) => {
  if (mode === "dev") return 3000;
  if (yes) return 80;
  const port = await cli.prompt(
    "Port Saltcorn HTTP server will listen on [80]",
    { required: false }
  );

  return +port ? +port : 80;
};
const go = async () => {
  const osInfo = await si.osInfo();
  // for me (only if not root) or create saltcorn user
  const user = await askUser();

  // postgres or sqlite
  const db = await askDatabase();

  const mode = await askDevServer(db);

  const port = await askPort(mode);

  // install system pkg

  // global saltcorn install

  // if sqlite, save cfg & exit

  // if pg, is it already installed?

  // set up pg db

  //systemd unit?

  // port?

  // if 80, setcap

  //save cfg

  console.log({ yes, configFilePath, user, db, mode, port, osInfo });
};

go();
