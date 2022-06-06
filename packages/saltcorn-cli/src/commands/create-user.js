/**
 * @category saltcorn-cli
 * @module commands/create-user
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, init_some_tenants } = require("../common");

// todo update logic based on modify-user command
/**
 * CreateUserCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class CreateUserCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {

    const User = require("@saltcorn/data/models/user");

    const { flags } = this.parse(CreateUserCommand);
    if (flags.admin && flags.role && flags.role !== "admin") {
      console.error("Error: specify at most one of admin and role");
      this.exit(1);
    }
    // init tenant
    await init_some_tenants(flags.tenant);

    // run function as specified tenant
    await maybe_as_tenant(flags.tenant, async () => {
      let role_id = flags.admin ? 1 : 8;
      if (flags.role) {
        const roles = await User.get_roles();
        const role = roles.find((r) => r.role === flags.role);
        if (!role) {
          console.error(`Error: role ${flags.role} not found`);
          this.exit(1);
        }
        role_id = role.id;
      }
      const email = flags.email || (await cli.prompt("Email address"));
      const password =
        flags.password || (await cli.prompt("Password", { type: "hide" }));
      const u = await User.create({ email, password, role_id });
      if(u instanceof User)
        console.log(`Success: User ${email} created successfully ${
          typeof flags.tenant !== "undefined" ? "in tenant " + flags.tenant : ""
        }`);
      else
        console.error(`Error: ${u.error}`);
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
CreateUserCommand.description = `Create a new user`;

/**
 * @type {object}
 */
CreateUserCommand.flags = {
  admin: flags.boolean({ char: "a", description: "Admin user" }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  email: flags.string({
    char: "e",
    description: "email",
  }),
  role: flags.string({
    char: "r",
    description: "role",
  }),
  password: flags.string({
    char: "p",
    description: "password",
  }),
};

module.exports = CreateUserCommand;
