const { cli } = require("cli-ux");
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
} = require("./utils");

//https://github.com/sindresorhus/is-root/blob/main/index.js
const isRoot = process.getuid && process.getuid() === 0;

if (process.argv.includes("--help")) {
  console.log("Install saltcorn\n");
  console.log("OPTIONS:");
  console.log(
    "  -y, --yes\tNon-interactive, accept all defaults: \n\t\tLocal PostgreSQL, saltcorn user, port 80, create systemd unit\n"
  );
  process.exit(0);
}
const yes = process.argv.includes("-y") || process.argv.includes("--yes");

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

const write_connection_config = async (connobj, user) => {
  const { configFilePath, configFileDir } = get_paths(user);
  await asyncSudo(["mkdir", "-p", configFileDir]);
  await asyncSudo(["chown", `${user}:${user}`, configFileDir]);
  fs.writeFileSync("/tmp/.saltcorn", JSON.stringify(connobj), { mode: 0o600 });
  await asyncSudo(["mv", "/tmp/.saltcorn", configFilePath]);
  await asyncSudo(["chown", `${user}:${user}`, configFilePath]);
};

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

const installSystemPackages = async (osInfo, user, db, mode, port) => {
  const packages = [
    "libpq-dev",
    "build-essential",
    "python-is-python3",
    "git",
    "libsystemd-dev",
  ];
  if (port === 80) packages.push("libcap2-bin");
  if (db === "pg-local") packages.push("postgresql", "postgresql-client");
  await asyncSudo(["apt", "install", "-y", ...packages]);
};

const installSaltcorn = async (osInfo, user, db, mode, port) => {
  /*
adduser --disabled-password --gecos "" saltcorn
sudo -iu saltcorn mkdir -p /home/saltcorn/.config/
sudo -iu saltcorn npm config set prefix /home/saltcorn/.local
sudo -iu saltcorn NODE_ENV=production npm install -g @saltcorn/cli@latest --unsafe
echo 'export PATH=/home/saltcorn/.local/bin:$PATH' >> /home/saltcorn/.bashrc
 */
  if (user === "saltcorn")
    await asyncSudo([
      "adduser",
      "--disabled-password",
      "--gecos",
      '""',
      "saltcorn",
    ]);
  const { configFileDir } = get_paths(user);

  await asyncSudoUser(user, ["mkdir", "-p", configFileDir]);
  await asyncSudoUser(user, [
    "npm",
    "config",
    "set",
    "prefix",
    `/home/${user}/.local/`,
  ]);
  await asyncSudoUser(user, [
    "npm",
    "install",
    "-g",
    "@saltcorn/cli@latest",
    "--unsafe",
  ]);
  await asyncSudo([
    "bash",
    "-c",
    `echo 'export PATH=/home/${user}/.local/bin:$PATH' >> /home/${user}/.bashrc`,
  ]);
};

const setupPostgres = async (osInfo, user, db, mode, port, pg_pass) => {
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-c",
    `CREATE USER ${user} WITH CREATEDB;`,
  ]);
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-c",
    `ALTER USER ${user} WITH PASSWORD '${pg_pass}';`,
  ]);

  await asyncSudoUser(user, ["createdb", "saltcorn"]);
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-d",
    "saltcorn",
    "-c",
    `ALTER SCHEMA public OWNER TO ${user};`,
  ]);
};

(async () => {
  const osInfo = await si.osInfo();
  // for me (only if not root) or create saltcorn user
  const user = await askUser();

  // postgres or sqlite
  const db = await askDatabase();

  const mode = await askDevServer(db);

  const port = await askPort(mode);
  if (process.argv.includes("-v"))
    console.log({ yes, user, db, mode, port, osInfo });

  // install system pkg
  await installSystemPackages(osInfo, user, db, mode, port);

  // global saltcorn install
  await installSaltcorn(osInfo, user, db, mode, port);

  const session_secret = gen_password();

  // if sqlite, save cfg & exit
  if (db === "sqlite") {
    const dbdir = envPaths("saltcorn", { suffix: "" });
    const dbPath = path.join(dbdir, "scdb.sqlite");
    fs.promises.mkdir(dbdir, {
      recursive: true,
    });
    await write_connection_config(
      { sqlite_path: dbPath, session_secret },
      user
    );

    return;
  }

  // set up pg role, db
  const pg_pass = gen_password();
  await setupPostgres(osInfo, user, db, mode, port, pg_pass);

  //save cfg
  await write_connection_config(
    {
      host: "localhost",
      port: 5432,
      database: "saltcorn",
      user,
      password: pg_pass,
      session_secret,
      multi_tenant: false,
    },
    user
  );
  //initialize schema
  await asyncSudoUser(user, [
    `/home/${user}/.local/bin/saltcorn`,
    "reset-schema",
    "-f",
  ]);

  if (mode === "dev") return;

  // if 80, setcap
  if (port === 80)
    await asyncSudo([
      "bash",
      "-c",
      "setcap 'cap_net_bind_service=+ep' `which node`",
    ]);

  //systemd unit
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
    "/lib/systemd/system/saltcorn.service",
  ]);
  await asyncSudo(["systemctl", "daemon-reload"]);
  await asyncSudo(["systemctl", "start", "saltcorn"]);
  await asyncSudo(["systemctl", "enable", "saltcorn"]);
})();
