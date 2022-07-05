/**
 * @category saltcorn-cli
 * @module commands/configuration-check-backups
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, init_some_tenants } = require("../common");

/**
 * ConfigurationCheckBackupsCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class ConfigurationCheckBackupsCommand extends Command {
  static strict = false;
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { argv } = this.parse(ConfigurationCheckBackupsCommand);
    //await init_some_tenants(flags.tenant);
    const {
      runConfigurationCheck,
    } = require("@saltcorn/admin-models/models/config-check");
    const { mockReqRes } = require("@saltcorn/data/tests/mocks");
    const db = require("@saltcorn/data/db");
    if (!db.is_it_multi_tenant()) {
      console.error("Multitenancy not enabled");
      this.exit(0);
      return;
    }
    const ten = "_cfgcheck";
    for (const file of argv) {
      if (file.endsWith(".zip")) {
        console.log(file);
        //create tenant, reset schema
        const {
          insertTenant,
          switchToTenant,
        } = require("@saltcorn/admin-models/models/tenant");
        await switchToTenant(await insertTenant(ten, "", ""), "");

        await db.runWithTenant(ten, async () => {
          //restore
          const { restore } = require("@saltcorn/admin-models/models/backup");

          const load_plugins = require("@saltcorn/server/load_plugins");
          const savePlugin = (p) => load_plugins.loadAndSaveNewPlugin(p);
          const err = await restore(file, savePlugin, true);
          if (err) {
            console.error(err);
            this.exit(1);
          }
          //cfgcheck, fail if errs
        });
      }
    }

    this.exit(0);
  }
}

/**
 * @type {string}
 */
ConfigurationCheckBackupsCommand.description = `Check configuration`;

/**
 * @type {object}
 */
ConfigurationCheckBackupsCommand.args = [
  {
    name: "files",
    required: true,
    description: "backup file to check. can be repeated, e.g. with *",
  },
];

module.exports = ConfigurationCheckBackupsCommand;
