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
    try {
      require("saltcorn-data/db");
      console.log("I already know how to connect!");
    } catch {
      await setup_connection_config();
    }
  } else {
    await setup_connection_config();
  }
};

class SetupCommand extends Command {
  async run() {
    // check if i already know how to connect
    await setup_connection();
    // check if schema is live

    //check if there are any users
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
