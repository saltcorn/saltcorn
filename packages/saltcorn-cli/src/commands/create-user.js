const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant } = require("../common");

class CreateUserCommand extends Command {
  async run() {
    const User = require("@saltcorn/data/models/user");
    const { flags } = this.parse(CreateUserCommand);
    await maybe_as_tenant(flags.tenant, async () => {
      const email = await cli.prompt("Email address");
      const password = await cli.prompt("Password", { type: "hide" });
      await User.create({ email, password, role_id: flags.admin ? 1 : 8 });
    });
    this.exit(0);
  }
}

CreateUserCommand.description = `Create a new user`;

CreateUserCommand.flags = {
  admin: flags.boolean({ char: "a", description: "Admin user" }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = CreateUserCommand;
