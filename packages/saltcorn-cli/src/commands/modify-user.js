/**
 * @category saltcorn-cli
 * @module commands/modify-user
 */

// todo support for  users without emails (using user.id)
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant } = require("../common");
const {loadAllPlugins} = require("@saltcorn/server/load_plugins");
const { init_multi_tenant } = require("@saltcorn/data/db/state");
const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
const User = require("@saltcorn/data/models/user");

/**
 * ModifyUserCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ModifyUserCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {

    const { args } = this.parse(ModifyUserCommand);
    const { flags } = this.parse(ModifyUserCommand);

    if (flags.admin && flags.role && flags.role !== "admin") {
      console.error("Error: specify at most one of admin and role");
      this.exit(1);
    }

    await loadAllPlugins();
    // get list of tenants
    const tenants = await getAllTenants();
    // init all tenants - can spend a lot of time (if you have many tenants)
    await init_multi_tenant(loadAllPlugins, undefined, tenants);
    // run function as specified tenant
    await maybe_as_tenant(flags.tenant, async () => {
      // role_id
      let role_id; // = flags.admin ? 1 : 8;
      if (flags.admin) role_id = 1;
      else if (flags.role) {
        const roles = await User.get_roles();
        const role = roles.find((r) => r.role === flags.role);
        if (!role) {
          console.error(`Error: role ${flags.role} not found`);
          this.exit(1);
        }
        role_id = role.id;
      }
      // email
      let email;
      if (flags.email) email = flags.email;
      else if (flags.imode) email = await cli.prompt("New Email address", { default : args.user_email });
      if (email)
        if (!User.valid_email(email)){
          console.error(`Error: Email is invalid`);
          this.exit(1);
        }

      // password
      // todo check for repeated passwords
      let password;
      if (flags.password) password = flags.password;
      else if (flags.imode) password = await cli.prompt("Password", { type: "hide" });
      if (password)
        if (User.unacceptable_password_reason(password)){
          console.error(`Error: ${User.unacceptable_password_reason(password)}`);
          this.exit(1);
        }
      // try to find user
      const u = await User.findOne({ email: args.user_email });
      if(!u instanceof User){
        console.error(`Error: ${u.error}`);
        this.exit(1);
      }

      // make changes
      if (email && role_id)
        await u.update({ email, role_id });
      else if(email)
        await u.update({ email });
      else
        await u.update({ role_id });

      if (password)
        await u.changePasswordTo(password, false);

      if(email)
        console.log(`User ${email} updated successfully in tenant ${flags.tenant}`);
      else
        console.log(`User ${args.user_email} updated successfully in tenant ${flags.tenant}`);

    });
    this.exit(0);
  }
}

/**
 * @type {object}
 */
ModifyUserCommand.args = [
  { name: "user_email", required: true, description: "User to modify" },
];

/**
 * @type {string}
 */
ModifyUserCommand.description = `Modify (update) user.

Command changes the user specified by USER_EMAIL.

You can change the user group, password and email.

NOTE that -a and -r role (--role=role) can give conflict.
`;

/**
 * @type {string}
 */
ModifyUserCommand.help = `Modify (update) user.

Command changes the user specified by USER_EMAIL.

You can change the user group, password and email.

NOTE that -a and -r role (--role=role) can give conflict.
`;

/**
 * @type {object}
 */
ModifyUserCommand.flags = {
  admin: flags.boolean({ char: "a", description: "make user be Admin" }),
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
  email: flags.string({
    char: "e",
    description: "new email",
  }),
  role: flags.string({
    char: "r",
    description: "new role (can conflict with -a option)",
  }),
  password: flags.string({
    char: "p",
    description: "new password",
  }),
  imode: flags.boolean({ char: "i", description: "interactive mode" }),
};

module.exports = ModifyUserCommand;
