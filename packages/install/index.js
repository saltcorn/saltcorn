#! /usr/bin/env node
/**
 * npx saltcorn-install
 *
 * Script intended to quick install of Saltcorn to server.
 *
 * Script creates basic  infrastructure for Saltcorn including database installation,
 * system service creation and os user creation.
 *
 * @type {path.PlatformPath | path}
 */
// todo test scripts
//const { cli } = require("cli-ux");
const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
const tcpPortUsed = require("tcp-port-used");
const envPaths = require("env-paths");
const si = require("systeminformation");
const os = require("os");
const {
  asyncSudo,
  asyncSudoUser,
  asyncSudoPostgres,
  gen_password,
  genJwtSecret,
} = require("./utils");
//const {fetchAsyncQuestionProperty} = require("inquirer/lib/utils/utils");

//https://github.com/sindresorhus/is-root/blob/main/index.js
const isRoot = process.getuid && process.getuid() === 0;

if (process.argv.includes("--help")) {
  console.log("Install saltcorn\n");
  console.log("OPTIONS:");
  console.log(
    "  -y, --yes\tNon-interactive, accept all defaults: \n"+
    "\t\tLocal PostgreSQL, saltcorn user, port 80, create systemd unit\n"+
    "  -v, --verbose\tVerbose mode, show debug information\n"+
    "  -e, --expert\tExpert mode, more abilities for configuration (Not compatible with -y)\n"+
    "  -d, --dryrun\tDry Run mode, displays the operations that would be performed using the specified command without actually running them\n"+
    "  -s  --skip-chromium\n\t\tSkip the Chromium installation\n"
  );
  process.exit(0);
}
const yes = process.argv.includes("-y") || process.argv.includes("--yes");
const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");
const expert = process.argv.includes("-e") || process.argv.includes("--expert");
const dryRun = process.argv.includes("-d") || process.argv.includes("--dryrun");
const skipChromium = process.argv.includes("-s") || process.argv.includes("--skip-chromium");

/**
 * Define saltcorn config dir and path
 * @param user
 * @returns {{configFilePath: string, configFileDir: string}}
 */
const get_paths = (user) => {
  const me = os.userInfo().username;
  let configFileDir = envPaths("", { suffix: "" }).config;
  if (me === "root")
    configFileDir = configFileDir.replace("/root/", `/home/${user}/`);
  else if (me !== user)
    configFileDir = configFileDir.replace(`/${me}/`, `/${user}/`);

  const configFilePath = path.join(configFileDir, ".saltcorn");
  return { configFileDir, configFilePath };
};
/**
 * Write configuration file ${user}/.config/.saltcorn
 * @param connobj - DB connection object
 * @param user - OS user
 * @param dryRun
 * @returns {Promise<void>}
 */
const write_connection_config = async (connobj, user, dryRun) => {
  const { configFilePath, configFileDir } = get_paths(user);
  await asyncSudo(["mkdir", "-p", configFileDir], false, dryRun);
  await asyncSudo(["chown", `${user}:${user}`, configFileDir], false, dryRun);
  if(!dryRun)
    fs.writeFileSync("/tmp/.saltcorn", JSON.stringify(connobj), { mode: 0o600 });
  await asyncSudo(["mv", "/tmp/.saltcorn", configFilePath], false, dryRun);
  await asyncSudo(["chown", `${user}:${user}`, configFilePath], false, dryRun);
};
/**
 * Ask for OS user name (Not in Expert Mode)
 * @returns {Promise<string|*>}
 */
const askUserNonExpertMode = async () => {
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
/**
 * Ask for OS User Name
 * @returns {Promise<string|*>}
 */
const askUser = async () => {
  let user = "saltcorn";
  if(!expert) return await askUserNonExpertMode();

  const responses = await inquirer.prompt([
    {
      name: "user",
      message: "Which OS user will run Saltcorn?",
      type: "input",
      default: user,
    },
  ]);
  return responses.user;
};
/**
 * Ask for Database Name
 * @returns {Promise<string|*>}
 */
const askDatabaseName = async () => {
  let dbName = "saltcorn";
  if(!expert) return dbName;

  const responses = await inquirer.prompt([
    {
      name: "dbName",
      message: "Which database name will be used for Saltcorn?",
      type: "input",
      default: dbName,
    },
  ]);
  return responses.dbName;
};
/**
 * Ask for Database options
 * @returns {Promise<string|*|string>}
 */
const askDatabase = async () => {
  const inUse = await tcpPortUsed.check(5432, "127.0.0.1");
  if (inUse) {
    console.log("Found PostgreSQL running at 127.0.0.1 port 5432");
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
/**
 * Ask for Server running mode: dev, server
 * @param db - db type
 * @returns {Promise<string|*>}
 */
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
/**
 * Ask for HTTP port. If mode is dev than port 3000. Otherwise, default value is 80.
 * @param mode
 * @returns {Promise<number|number>}
 */
const askHttpPort = async (mode) => {
  let port = mode === "dev"? 3000 : 80;
  if(!expert) {
    if (yes) return 80;
  }
  const responses = await inquirer.prompt([
    {
      name: "port",
      message: "Port Saltcorn HTTP server will listen on?",
      type: "number",
      default: port,
    },
  ]);
  return responses.port;
};
/**
 * Ask for System Service Name
 * @returns {Promise<string|*>}
 */
const askOsService = async () => {
  let osService = "saltcorn";
  if(!expert) return osService;

  const responses = await inquirer.prompt([
    {
      name: "osService",
      message: "Which System Service name will be used for Saltcorn?",
      type: "input",
      default: osService,
    },
  ]);
  return responses.osService;
};

/**
 * Install System packages
 * @param osInfo - OS Info
 * @param user - user
 * @param db - db type
 * @param mode - dev or server
 * @param port - http port
 * @param dryRun - if true then test run
 * @returns {Promise<void>}
 */

const isRedHat =  (osInfo) =>
  ["Fedora Linux"].includes(osInfo.distro)


const installSystemPackages = async (osInfo, user, db, mode, port, dryRun) => {
  const distro_code = `${osInfo.distro} ${osInfo.codename}`;
  let python,installer;
  switch (distro_code) {
    case "Ubuntu Bionic Beaver":
    case "Debian GNU/Linux buster":
    case "Debian GNU/Linux stretch":
      python = "python3";
      installer = "apt"
      break;

    default:
      python = "python-is-python3";

      break;
  }
  if(isRedHat(osInfo)) {
    installer = "dnf"

  } else {
    installer = "apt"
  }
  const packages = installer ==="apt"? [
    "libpq-dev",
    "build-essential",
    python,
    "git",
    "libsystemd-dev",
  ] : [];
  if (!skipChromium) {
    if (osInfo.distro === "Ubuntu") packages.push("chromium-browser"); 
    if (osInfo.distro === "Debian GNU/Linux") packages.push("chromium");
    if (osInfo.distro === "Fedora Linux") packages.push("chromium-headless");
  }
  if (port === 80 && installer ==="apt") packages.push("libcap2-bin");
  if (db === "pg-local" && installer ==="apt")
    packages.push("postgresql", "postgresql-client");
  if (db === "pg-local" && installer ==="dnf") 
    packages.push("postgresql-server", "postgresql");


  await asyncSudo([installer, "install", "-y", ...packages], false, dryRun);
};
/**
 * Install Saltcorn
 * @param osInfo
 * @param user
 * @param db -
 * @param mode - server running mode
 * @param port
 * @param dryRun
 * @returns {Promise<void>}
 */
const installSaltcorn = async (osInfo, user, db, mode, port, dryRun) => {
  /*
adduser --disabled-password --gecos "" saltcorn
sudo -iu saltcorn mkdir -p /home/saltcorn/.config/
sudo -iu saltcorn npm config set prefix /home/saltcorn/.local
sudo -iu saltcorn NODE_ENV=production npm install -g @saltcorn/cli@latest --unsafe
echo 'export PATH=/home/saltcorn/.local/bin:$PATH' >> /home/saltcorn/.bashrc
 */
  //if (user === "saltcorn")
  if (user !== "root")
    await asyncSudo(
      isRedHat(osInfo) 
        ? ["adduser", "--gecos", '""', user]      
        : ["adduser", "--disabled-password", "--gecos", '""', user],
      true, dryRun
    );
  const { configFileDir } = get_paths(user);

  await asyncSudoUser(user, ["mkdir", "-p", configFileDir], false, dryRun);
  await asyncSudoUser(user, [
    "npm",
    "config",
    "set",
    "prefix",
    `/home/${user}/.local/`,
  ], false, dryRun);
  await asyncSudoUser(user, [
    "npm",
    "install",
    "-g",
    "--legacy-peer-deps",
    "@saltcorn/cli@latest",
    "--unsafe",
  ], false, dryRun);
  await asyncSudo([
    "bash",
    "-c",
    `echo 'export PATH=/home/${user}/.local/bin:$PATH' >> /home/${user}/.bashrc`,
  ], false, dryRun);
};
/**
 * Setup Postgres server
 * @param osInfo
 * @param user
 * @param db
 * @param mode
 * @param dbName
 * @param pg_pass
 * @returns {Promise<void>}
 */
const setupPostgres = async (osInfo, user, db, mode, dbName, pg_pass) => {
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-c",
    `CREATE USER ${user} WITH CREATEDB;`,
  ], false, dryRun);
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-c",
    `ALTER USER ${user} WITH PASSWORD '${pg_pass}';`,
  ], false, dryRun);

  await asyncSudoUser(user, ["createdb", dbName], false, dryRun);
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-d",
    dbName,
    "-c",
    `ALTER SCHEMA public OWNER TO ${user};`,
  ], false, dryRun);
};
/** main logic of script **/
(async () => {
  // get OS info
  const osInfo = await si.osInfo();
  // for me (only if not root) or create saltcorn user
  if (verbose) console.log({ osInfo });
  // ask for OS user
  const user = await askUser();
  if (verbose) console.log({ user });

  // ask for database - postgres or sqlite
  const db = await askDatabase();
  if (verbose) console.log({ db });

  // ask for db name
  const dbName = await askDatabaseName();
  if (verbose) console.log({ dbName });

  // ask for server running mode
  const mode = await askDevServer(db);
  if (verbose) console.log({ mode });

  // ask for port
  const port = await askHttpPort(mode);
  if (verbose) console.log({ port });

  // ask for system service name
  const osService = expert ? await askOsService() : "saltcorn";
  if (verbose) console.log({ osService });

  // install system pkg
  await installSystemPackages(osInfo, user, db, mode, port, dryRun);

  // global saltcorn install
  await installSaltcorn(osInfo, user, db, mode, port, dryRun);

  const session_secret = gen_password();

  const jwt_secret = genJwtSecret();

  // if sqlite, save cfg & exit
  if (db === "sqlite") {
    const dbdir = envPaths("saltcorn", { suffix: "" }).data;
    const dbPath = path.join(dbdir, "scdb.sqlite");
    await fs.promises.mkdir(dbdir, {
      recursive: true,
    });
    await write_connection_config(
      { sqlite_path: dbPath, session_secret, jwt_secret },
      user,
      dryRun
    );

    return;
  }

  // set up pg role, db
  const pg_pass = gen_password();
  await setupPostgres(osInfo, user, db, mode, dbName, pg_pass);

  //save cfg
  await write_connection_config(
    {
      host: "localhost",
      port: 5432,
      database: dbName,
      user,
      password: pg_pass,
      session_secret,
      jwt_secret,
      multi_tenant: false,
    },
    user,
    dryRun
  );
  //initialize schema
  await asyncSudoUser(user, [
    `/home/${user}/.local/bin/saltcorn`,
    "reset-schema",
    "-f",
  ], false, dryRun);

  if (mode === "dev") return;

  // if 80, setcap
  if (port === 80)
    await asyncSudo([
      "bash",
      "-c",
      "setcap 'cap_net_bind_service=+ep' `which node`",
    ], false, dryRun);

  //systemd unit
  if(!dryRun)
    fs.writeFileSync(
    "/tmp/saltcorn.service",
    `[Unit]
Description=saltcorn
Documentation=https://saltcorn.com
After=network.target

[Service]
Type=notify
WatchdogSec=5
User=${user}
WorkingDirectory=/home/${user}
ExecStart=/home/${user}/.local/bin/saltcorn serve -p ${port}
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target`
  );
  await asyncSudo([
    "mv",
    "/tmp/saltcorn.service",
    `/lib/systemd/system/${osService}.service`,
  ], false, dryRun);
  // start systemd service
  await asyncSudo(["systemctl", "daemon-reload"], false, dryRun);
  await asyncSudo(["systemctl", "start", osService], false, dryRun);
  await asyncSudo(["systemctl", "enable", osService], false, dryRun);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
