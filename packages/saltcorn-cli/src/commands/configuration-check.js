/**
 * @category saltcorn-cli
 * @module commands/configuration-check
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant } = require("../common");

/**
 * ConfigurationCheckCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ConfigurationCheckCommand extends Command {
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const User = require("@saltcorn/data/models/user");

    const { flags } = this.parse(ConfigurationCheckCommand);

    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    const {
      runConfigurationCheck,
    } = require("@saltcorn/admin-models/models/config-check");
    const { mockReqRes } = require("@saltcorn/data/tests/mocks");
    await loadAllPlugins();
    const tenants = await getAllTenants();
    await init_multi_tenant(loadAllPlugins, undefined, tenants);
    const that = this;
    await maybe_as_tenant(flags.tenant, async () => {
      const { passes, errors, pass } = await runConfigurationCheck(
        mockReqRes.req
      );

      if (!pass) {
        errors.forEach((s) => console.log(s + "\n"));
        console.log(`FAIL - ${errors.length} checks failed`);
        that.exit(1);
      } else {
        passes.forEach((s) => console.log(s));
        console.log("Success - all checks pass");
      }
    });
    this.exit(0);
  }
}

/**
 * @type {string}
 */
ConfigurationCheckCommand.description = `Check configuration`;

/**
 * @type {object}
 */
ConfigurationCheckCommand.flags = {
  tenant: flags.string({
    char: "t",
    description: "tenant",
  }),
};

module.exports = ConfigurationCheckCommand;
