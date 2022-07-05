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
    const {
      insertTenant,
      switchToTenant,
      deleteTenant,
    } = require("@saltcorn/admin-models/models/tenant");

    if (!db.is_it_multi_tenant()) {
      console.error("Multitenancy not enabled");
      this.exit(0);
      return;
    }
    //db.set_sql_logging(true);

    const ten = "cfgcheckbackuptenannt";
    await deleteTenant(ten);
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();
    for (const file of argv) {
      let hasError = false;
      if (file.endsWith(".zip")) {
        console.log(file);
        //create tenant, reset schema
        await switchToTenant(await insertTenant(ten, "", ""), "");
        await init_multi_tenant(loadAllPlugins, undefined, [ten]);

        await db.runWithTenant(ten, async () => {
          //restore
          const { restore } = require("@saltcorn/admin-models/models/backup");
          await loadAllPlugins();

          const load_plugins = require("@saltcorn/server/load_plugins");
          const savePlugin = (p) => load_plugins.loadAndSaveNewPlugin(p);
          const err = await restore(file, savePlugin, true);
          if (err) {
            console.error("Error on restoring backup: " + file);
            console.error(err);
            hasError = true;
          } else {
            const { passes, errors, pass } = await runConfigurationCheck(
              mockReqRes.req
            );

            if (!pass) {
              console.error("Configuration error in backup file: " + file);

              errors.forEach((s) => console.error(s + "\n"));
              console.error(`FAIL - ${errors.length} checks failed`);
              hasError = true;
            }
          }
        });
        await deleteTenant(ten);
        if (hasError) this.exit(1);
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
