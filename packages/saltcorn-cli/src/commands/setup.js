const { Command, flags } = require("@oclif/command");
const {
  getConnectObject,
  configFilePath,
  configFileDir,
  defaultDataPath
} = require("@saltcorn/data/db/connect");
const { cli } = require("cli-ux");
const { is } = require("contractis");
const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer");
var tcpPortUsed = require("tcp-port-used");
const { spawnSync } = require("child_process");
var sudo = require("sudo");

const gen_password = () => {
  const s = is.str.generate().replace(" ", "");
  if (s.length > 7) return s;
  else return gen_password();
};

const askDevServer = async () => {
  if (process.platform !== "linux") {
    console.log("Non-linux platform, continuing development-mode install");
    return "dev";
  }
  const responses = await inquirer.prompt([
    {
      name: "mode",
      message: "How will you run Saltcorn?",
      type: "list",
      choices: [
        {
          name: "Development mode. I will start Saltcorn when needed",
          value: "dev"
        },
        {
          name: "Server mode. Always run in background, with Postgres",
          value: "server"
        }
      ]
    }
  ]);
  return responses.mode;
};

const unloadModule = mod => {
  var name = require.resolve(mod);
  delete require.cache[name];
};

const setupDevMode = async () => {
  const dbPath = path.join(defaultDataPath, "scdb.sqlite");
  fs.promises.mkdir(defaultDataPath, { recursive: true });

  await write_connection_config({ sqlite_path: dbPath });

  if (!fs.existsSync(dbPath)) {
    unloadModule("@saltcorn/data/db");
    unloadModule("@saltcorn/data/db/reset_schema");
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset(true);
  }

  console.log("Done. Run saltcorn by typing:\n\nsaltcorn serve\n");
};

const check_db = async () => {
  const inUse = await tcpPortUsed.check(5432, "127.0.0.1");
  if (!inUse) {
    console.log("Local database not found.");
    const responses = await inquirer.prompt([
      {
        name: "whatnow",
        message: "How would you like to connect to a database?",
        type: "list",
        choices: [
          { name: "Install PostgreSQL locally", value: "install" },
          { name: "Connect to a an existing database", value: "connect" }
        ]
      }
    ]);
    if (responses.whatnow === "install") {
      await install_db();
    } else {
      await setup_connection_config();
    }
  } else {
    console.log("Found local database, how do I connect?");

    await setup_connection_config();
  }
};

const asyncSudo = args => {
  return new Promise(function(resolve, reject) {
    var child = sudo(args, { cachePassword: true });
    //var child = sudo(['ls'], {cachePassword: true})
    child.stdout.on("data", function(data) {
      console.log(data.toString());
    });
    child.stderr.on("data", function(data) {
      console.error(data.toString());
    });
    child.on("exit", function(data) {
      resolve();
    });
  });
};

const asyncSudoPostgres = args => {
  return asyncSudo(["sudo", "-u", "postgres", ...args]);
};

const get_password = async for_who => {
  var password = await cli.prompt(`Set ${for_who} to [auto-generate]`, {
    type: "hide",
    required: false
  });
  if (!password) {
    password = gen_password();
    console.log(`Setting ${for_who} to:`, password);
    await cli.anykey();
  }
  return password;
};

const install_db = async () => {
  await asyncSudo(["apt", "install", "-y", "postgresql", "postgresql-client"]);
  await asyncSudo(["service", "postgresql", "start"]);
  const user = process.env.USER;
  //const pgpass=await get_password("postgres")
  //await asyncSudo(['sudo', '-u', 'postgres', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', `"alter user postgres with password '${pgpass}';"`])
  const scpass = await get_password(user + "'s database password");
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-c",
    `CREATE USER ${user} WITH CREATEDB PASSWORD '${scpass}';`
  ]);
  spawnSync("createdb", ["saltcorn"], {
    stdio: "inherit"
  });
  spawnSync("createdb", ["saltcorn_test"], {
    stdio: "inherit"
  });
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-d",
    "saltcorn",
    "-c",
    `ALTER SCHEMA public OWNER TO ${user};`
  ]);
  await asyncSudoPostgres([
    "psql",
    "-U",
    "postgres",
    "-d",
    "saltcorn_test",
    "-c",
    `ALTER SCHEMA public OWNER TO ${user};`
  ]);
  const session_secret = await get_password("session secret");
  await write_connection_config({
    host: "localhost",
    port: 5432,
    database: "saltcorn",
    user,
    password: scpass,
    session_secret,
    multi_tenant: false
  });
};

const prompt_connection = async () => {
  console.log("Enter database connection parameters");
  const host = await cli.prompt("Database host [localhost]", {
    required: false
  });
  const port = await cli.prompt("Database port [5432]", { required: false });
  const database = await cli.prompt("Database name [saltcorn]", {
    required: false
  });
  const user = await cli.prompt("Database user [saltcorn]", {
    required: false
  });
  const password = await cli.prompt("Database password", {
    type: "hide",
    required: true
  });
  const session_secret = await get_password("session secret");
  return {
    host: host || "localhost",
    port: port || 5432,
    database: database || "saltcorn",
    user: user || "saltcorn",
    password: password,
    session_secret,
    multi_tenant: false
  };
};

const setup_connection_config = async () => {
  const connobj = await prompt_connection();
  await write_connection_config(connobj);
};

const write_connection_config = async connobj => {
  fs.promises.mkdir(configFileDir, { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(connobj), { mode: 0o600 });
};

const setup_connection = async () => {
  const connobj = getConnectObject();
  if (connobj) {
    // check if it works
    const db = require("@saltcorn/data/db");
    try {
      await db.query("select 1");
      console.log("I already know how to connect!");
    } catch (e) {
      console.log("Cannot connect to specified database. Error: ", e.message);
      await setup_connection_config();
      await db.changeConnection();
    }
  } else {
    console.log("No database specified");
    await check_db();
    const db = require("@saltcorn/data/db");
    await db.changeConnection();
  }
};

const table_exists = async (db, tblname) => {
  const { rows } = await db.query(`SELECT EXISTS 
    (
        SELECT 1
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = '${tblname}'
    );`);
  return rows[0].exists;
};

const setup_schema = async () => {
  const db = require("@saltcorn/data/db");
  const ex_tables = await table_exists(db, "_sc_tables");
  const ex_fields = await table_exists(db, "_sc_fields");
  if (!(ex_fields && ex_tables)) {
    console.log("Installing schema");
    const reset = require("@saltcorn/data/db/reset_schema");
    await reset(true);
  } else console.log("Schema already present");
};

const setup_users = async () => {
  const User = require("@saltcorn/data/models/user");
  const hasUsers = await User.nonEmpty();
  if (!hasUsers) {
    console.log("No users found. Please create an admin user");
    const email = await cli.prompt("Email address");
    const password = await cli.prompt("Password", { type: "hide" });
    await User.create({ email, password, role_id: 1 });
  } else {
    console.log("Users already present");
  }
};

class SetupCommand extends Command {
  async run() {
    const mode = await askDevServer();
    if (mode == "server") {
      // check if i already know how to connect
      await setup_connection();
      // check if schema is live
      await setup_schema();
      //check if there are any users
      await setup_users();
      await require("@saltcorn/data/db").close();
    } else {
      await setupDevMode();
    }
  }
}

SetupCommand.description = `Set up a new system
...
This will attempt to install or connect a database, and set up a 
configuration file
`;

SetupCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" })
};

module.exports = SetupCommand;
