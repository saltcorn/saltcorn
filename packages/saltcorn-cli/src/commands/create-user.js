const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const User = require("saltcorn-data/models/user");

class CreateUserCommand extends Command {
  async run() {
    const { flags } = this.parse(CreateUserCommand);
    const email = await cli.prompt("Email address");
    const password = await cli.prompt("Password", { type: "hide" });
    await User.create({ email, password, role_id: flags.admin ? 1 : 3 });
  }
}

CreateUserCommand.description = `Describe the command here
...
Extra documentation goes here
`;

CreateUserCommand.flags = {
  admin: flags.boolean({ char: "a", description: "Admin user" })
};

module.exports = CreateUserCommand;
