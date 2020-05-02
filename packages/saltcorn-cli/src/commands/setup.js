const { Command, flags } = require("@oclif/command");
const {
  getConnectObject,
  configFilePath
} = require("saltcorn-data/db/connect");
const { cli } = require("cli-ux");
const { is } = require("contractis");

const gen_password = () => is.str.generate().replace(" ", "");
const prompt_connection = async () => {
  const host = await cli.prompt("Database host [localhost]");
  const port = await cli.prompt("Database port [5432]");
  const database = await cli.prompt("Database name [saltcorn]");
  const user = await cli.prompt("Database user [saltcorn]");
  const password = await cli.prompt("Database password [auto-generate]", {
    type: "hide"
  });
  return {
    host: host || "localhost",
    port: port || 5432,
    database: database || "saltcorn",
    user: user || "saltcorn",
    password: password || gen_password()
  };
};

const setup_connection = async () => {
  const connobj = await prompt_connection();
  const fs = require("fs");
  fs.writeFileSync(configFilePath, JSON.stringify(connobj), { mode: 0o600 });
};

class SetupCommand extends Command {
  async run() {
    // check if i already know how to connect
    const connobj = getConnectObject();
    if (connobj) {
      // check if it works
      try {
        require("saltcorn-data/db");
        console.log("I already know how to connect!");
      } catch {
        await setup_connection();
      }
    } else {
      await setup_connection();
    }
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
