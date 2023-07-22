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
    "  -y, --yes\tNon-interactive, accept all defaults: \n" +
      "\t\tLocal PostgreSQL, saltcorn user, port 80, create systemd unit\n" +
      "  -v, --verbose\tVerbose mode, show debug information\n" +
      "  -e, --expert\tExpert mode, more abilities for configuration (Not compatible with -y)\n" +
      "  -d, --dryrun\tDry Run mode, displays the operations that would be performed using the specified command without actually running them\n" +
      "  -s  --skip-chromium\n\t\tSkip the Chromium installation\n"
  );
  process.exit(0);
}
const yes = process.argv.includes("-y") || process.argv.includes("--yes");
const verbose =
  process.argv.includes("-v") || process.argv.includes("--verbose");
const expert = process.argv.includes("-e") || process.argv.includes("--expert");
const dryRun = process.argv.includes("-d") || process.argv.includes("--dryrun");
const skipChromium =
  process.argv.includes("-s") || process.argv.includes("--skip-chromium");

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
  if (!dryRun)
    fs.writeFileSync("/tmp/.saltcorn", JSON.stringify(connobj), {
      mode: 0o600,
    });
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
  if (!expert) return await askUserNonExpertMode();

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
  if (!expert) return dbName;

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
  let port = mode === "dev" ? 3000 : 80;
  if (!expert) {
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
  if (!expert) return osService;

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

const isRedHat = (osInfo) =>
  [
    "Fedora Linux",
    "Fedora",
    "CentOS Linux",
    "Rocky Linux",
    "Red Hat Enterprise Linux",
    "AlmaLinux",
  ].includes(osInfo.distro);

const installSystemPackages = async (osInfo, user, db, mode, port, dryRun) => {
  const distro_code = `${osInfo.distro} ${osInfo.codename}`;
  let python, installer;
  switch (distro_code) {
    case "Ubuntu Bionic Beaver":
    case "Debian GNU/Linux buster":
    case "Debian GNU/Linux stretch":
      python = "python3";
      installer = "apt";
      break;

    default:
      python = "python-is-python3";

      break;
  }
  const isSUSE = osInfo.distro.includes("SUSE");

  if (isRedHat(osInfo)) {
    installer = "dnf";
  } else if (isSUSE) {
    installer = "zypper";
  } else {
    installer = "apt";
  }
  const packages =
    installer === "apt"
      ? ["libpq-dev", "build-essential", python, "git", "libsystemd-dev"]
      : ["systemd-devel"];
  if (!skipChromium) {
    if (osInfo.distro === "Ubuntu") packages.push("chromium-browser");
    if (osInfo.distro === "Debian GNU/Linux" || isSUSE)
      packages.push("chromium");
    if (osInfo.distro === "Fedora Linux") packages.push("chromium-headless");
  }
  if (installer === "dnf")
    packages.push(
      "git",
      "make",
      osInfo.distro === "Fedora Linux" ? "g++" : "gcc-c++",
      "policycoreutils-python-utils",
      "python3"
    );

  if (port === 80 && installer === "apt") packages.push("libcap2-bin"); // libcap-progs
  if (port === 80 && installer === "zypper") packages.push("libcap-progs"); //
  if (db === "pg-local" && installer === "apt")
    packages.push("postgresql", "postgresql-client");
  if (db === "pg-local" && installer === "dnf")
    packages.push("postgresql-server", "postgresql");
  if (installer === "zypper") packages.push("make", "gcc-c++");
  if (db === "pg-local" && installer === "zypper")
    packages.push("postgresql", "postgresql-server", "postgresql-contrib");

  const nonInteractiveFlag = installer === "zypper" ? ["-n"] : [];
  const quietFlags = installer === "apt" ? "-qqy" : "-y";
  await asyncSudo(
    [installer, ...nonInteractiveFlag, "install", quietFlags, ...packages],
    false,
    dryRun
  );
  if (db === "pg-local" && isSUSE) {
    await asyncSudo(["systemctl", "enable", "postgresql"], false, dryRun);
    await asyncSudo(["systemctl", "start", "postgresql"], false, dryRun);
  }
  if (isSUSE) {
    await asyncSudo(
      [
        "bash",
        "-c",
        "echo 'net.ipv4.ip_unprivileged_port_start=80' >> /etc/sysctl.conf",
      ],
      false,
      dryRun
    );
    await asyncSudo(["sysctl", "--system"], false, dryRun);
  }
  if (db === "pg-local" && installer === "dnf") {
    await asyncSudo(["postgresql-setup", "--initdb"], false, dryRun);
    await asyncSudo(
      ["systemctl", "enable", "--now", "postgresql"],
      false,
      dryRun
    );
    //await asyncSudo(["sed", "-E", "-i", "s/local(\\s+)all(\\s+)all(\\s+)peer/local\\1all\\2all\\3trust/", "/var/lib/pgsql/data/pg_hba.conf"], false, dryRun);
    //await asyncSudo(["systemctl", "reload", "postgresql"], false, dryRun);
  }
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
  const isSUSE = osInfo.distro.includes("SUSE");
  if (user !== "root") {
    if (isSUSE) await asyncSudo(["groupadd", user], true, dryRun);
    await asyncSudo(
      isRedHat(osInfo)
        ? ["adduser", user]
        : isSUSE
        ? ["useradd", "-g", user, "-d", "/home/" + user, "-m", user]
        : ["adduser", "--disabled-password", "--gecos", '""', user],
      true,
      dryRun
    );
  }
  const { configFileDir } = get_paths(user);

  await asyncSudoUser(user, ["mkdir", "-p", configFileDir], false, dryRun);
  await asyncSudoUser(
    user,
    ["npm", "config", "set", "prefix", `/home/${user}/.local/`],
    false,
    dryRun
  );
  await asyncSudoUser(
    user,
    [
      "npm",
      "install",
      "-g",
      "--legacy-peer-deps",
      "@saltcorn/cli@latest",
      "--unsafe",
    ],
    false,
    dryRun
  );
  await asyncSudoUser(
    user,
    ["npm", "install", "-g", "sd-notify"],
    true,
    dryRun
  );
  await asyncSudo(
    [
      "bash",
      "-c",
      `echo 'export PATH=/home/${user}/.local/bin:$PATH' >> /home/${user}/.bashrc`,
    ],
    false,
    dryRun
  );
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
  await asyncSudoPostgres(
    [
      "psql",
      "-U",
      "postgres",
      "-c",
      `CREATE USER ${user} WITH CREATEDB PASSWORD '${pg_pass}';`,
    ],
    false,
    dryRun
  );
  await asyncSudoUser(user, ["createdb", dbName], false, dryRun);
  await asyncSudoPostgres(
    [
      "psql",
      "-U",
      "postgres",
      "-d",
      dbName,
      "-c",
      `ALTER SCHEMA public OWNER TO ${user};`,
    ],
    false,
    dryRun
  );
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
      host: "/var/run/postgresql",
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
  await asyncSudoUser(
    user,
    [`/home/${user}/.local/bin/saltcorn`, "reset-schema", "-f"],
    false,
    dryRun
  );

  if (mode === "dev") return;

  // if 80, setcap
  if (port === 80)
    await asyncSudo(
      ["bash", "-c", "setcap 'cap_net_bind_service=+ep' `which node`"],
      false,
      dryRun
    );

  let hasSDnotify;
  try {
    await asyncSudo(
      ["bash", "-c", `find /home/${user}/.local/ | grep sd-notify`],
      false,
      dryRun
    );
    hasSDnotify = true;
  } catch {
    hasSDnotify = false;
  }
  console.log("Has sd-notify:", hasSDnotify);
  //systemd unit
  if (!dryRun)
    fs.writeFileSync(
      "/tmp/saltcorn.service",
      `[Unit]
Description=saltcorn
Documentation=https://saltcorn.com
After=network.target

[Service]
Type=${hasSDnotify ? `notify` : `simple`}
${hasSDnotify ? "WatchdogSec=5" : ""}
User=${user}
WorkingDirectory=/home/${user}
ExecStart=/home/${user}/.local/bin/saltcorn serve -p ${port}
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target`
    );
  await asyncSudo(
    [
      "mv",
      "/tmp/saltcorn.service",
      `${
        isRedHat(osInfo) || osInfo.distro.includes("SUSE")
          ? `/etc/systemd/system`
          : `/lib/systemd/system`
      }/${osService}.service`,
    ],
    false,
    dryRun
  );
  if (isRedHat(osInfo)) {
    await asyncSudo(
      ["chown", "root:root", "/etc/systemd/system/saltcorn.service"],
      false,
      dryRun
    );
    await asyncSudo(
      ["restorecon", "-v", "/etc/systemd/system/saltcorn.service"],
      false,
      dryRun
    );
    await asyncSudo(
      [
        "semanage",
        "fcontext",
        "-a",
        "-t",
        "bin_t",
        "/home/saltcorn/.local/lib/node_modules/@saltcorn/cli/bin.*",
      ],
      false,
      dryRun
    );
    await asyncSudo(
      [
        "chcon",
        "-Rv",
        "-u",
        "system_u",
        "-t",
        "bin_t",
        "/home/saltcorn/.local/lib/node_modules/@saltcorn/cli/bin",
      ],
      false,
      dryRun
    );
    await asyncSudo(
      [
        "restorecon",
        "-R",
        "-v",
        "/home/saltcorn/.local/lib/node_modules/@saltcorn/cli/bin",
      ],
      false,
      dryRun
    );
  }
  // start systemd service
  await asyncSudo(["systemctl", "daemon-reload"], false, dryRun);
  await asyncSudo(["systemctl", "start", osService], false, dryRun);
  await asyncSudo(["systemctl", "enable", osService], false, dryRun);
  if (!hasSDnotify) await asyncSudo(["sleep", "5"], false, dryRun);
})().catch((e) => {
  console.error(e ? e.message || e : e);
  process.exit(1);
});
