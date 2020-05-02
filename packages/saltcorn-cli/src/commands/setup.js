const { Command, flags } = require("@oclif/command");
const {
  getConnectObject,
  configFilePath
} = require("saltcorn-data/db/connect");
const { cli } = require("cli-ux");
const { is } = require("contractis");

const gen_password = () => {
  const s = is.str.generate().replace(" ", "");
  if (s.length > 7) return s;
  else return gen_password();
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
  const password = await cli.prompt("Database password [auto-generate]", {
    type: "hide",
    required: false
  });
  return {
    host: host || "localhost",
    port: port || 5432,
    database: database || "saltcorn",
    user: user || "saltcorn",
    password: password || gen_password()
  };
};

const setup_connection_config = async () => {
  const connobj = await prompt_connection();
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
    await setup_connection_config();
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
  const ex_tables = await table_exists(db, "tables");
  const ex_fields = await table_exists(db, "fields");
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
