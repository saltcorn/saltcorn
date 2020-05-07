const { Command, flags } = require("@oclif/command");
const {
  getConnectObject,
  configFilePath
} = require("saltcorn-data/db/connect");
const { cli } = require("cli-ux");
const { is } = require("contractis");
const inquirer = require("inquirer");
var tcpPortUsed = require("tcp-port-used");
const { spawnSync } = require("child_process");
var sudo = require("sudo");

const gen_password = () => {
  const s = is.str.generate().replace(" ", "");
  if (s.length > 7) return s;
  else return gen_password();
};

const check_db = async () => {
  const inUse = await tcpPortUsed.check(5432, "127.0.0.1");
  if (!inUse) {
    console.log("No local database running. ");
    const responses = await inquirer.prompt([
      {
        name: "whatnow",
        message: "How would you like to connect to a database?",
        type: "list",
        choices: [
          { name: "Install PostgreSQL locally", value: "install" },
          { name: "Connect to a remote database", value: "connect" }
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

const get_password = async for_who => {
  var password = await cli.prompt(
    `Set ${for_who} password to [auto-generate]`,
    {
      type: "hide",
      required: false
    }
  );
  if (!password) {
    password = gen_password();
    console.log(`Setting ${for_who} password to:`, password);
    await cli.anykey();
  }
  return password;
};

const install_db = async () => {
  await asyncSudo(["apt", "install", "-y", "postgresql", "postgresql-client"]);
  const user = process.env.USER;
  console.log({ user });
  //const pgpass=await get_password("postgres")
  //await asyncSudo(['sudo', '-u', 'postgres', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', `"alter user postgres with password '${pgpass}';"`])
  const scpass = await get_password(user + "'s database");
  await asyncSudo([
    "sudo",
    "-u",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-c",
    `CREATE USER ${user} WITH PASSWORD '${scpass}';`
  ]);
  await asyncSudo([
    "sudo",
    "-u",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-c",
    `CREATE DATABASE "saltcorn";`
  ]);
  await asyncSudo([
    "sudo",
    "-u",
    "postgres",
    "psql",
    "-U",
    "postgres",
    "-c",
    `GRANT ALL PRIVILEGES ON DATABASE "saltcorn" to ${user};`
  ]);
  await write_connection_config({
    host: "localhost",
    port: 5432,
    database: "saltcorn",
    user,
    password: scpass
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
  return {
    host: host || "localhost",
    port: port || 5432,
    database: database || "saltcorn",
    user: user || "saltcorn",
    password: password
  };
};

const setup_connection_config = async () => {
  const connobj = await prompt_connection();
  await write_connection_config(connobj);
};

const write_connection_config = async connobj => {
  const fs = require("fs");
  fs.writeFileSync(configFilePath, JSON.stringify(connobj), { mode: 0o600 });
};

const setup_connection = async () => {
  const connobj = getConnectObject();
  if (connobj) {
    // check if it works
    const db = require("saltcorn-data/db");
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
    const db = require("saltcorn-data/db");
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
  const db = require("saltcorn-data/db");
  const ex_tables = await table_exists(db, "_sc_tables");
  const ex_fields = await table_exists(db, "_sc_fields");
  if (!(ex_fields && ex_tables)) {
    console.log("Installing schema");
    const reset = require("saltcorn-data/db/reset_schema");
    await reset(true);
  } else console.log("Schema already present");
};

const setup_users = async () => {
  const User = require("saltcorn-data/models/user");
  const users = await User.find({});
  if (users.length === 0) {
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
    // check if i already know how to connect
    await setup_connection();
    // check if schema is live
    await setup_schema();
    //check if there are any users
    await setup_users();

    await require("saltcorn-data/db").close();
  }
}

SetupCommand.description = `Describe the command here
...
Extra documentation goes here
`;

SetupCommand.flags = {
  coverage: flags.boolean({ char: "c", description: "Coverage" })
};

module.exports = SetupCommand;
