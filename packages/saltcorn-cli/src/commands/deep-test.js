/**
 * @category saltcorn-cli
 * @module commands/deep-test
 */
const { Command, flags } = require("@oclif/command");
const { cli } = require("cli-ux");
const { maybe_as_tenant, init_some_tenants } = require("../common");

/**
 * DeepTestCommand Class
 * @extends oclif.Command
 * @category saltcorn-cli
 */
class DeepTestCommand extends Command {
  static strict = false;
  /**
   * @returns {Promise<void>}
   */
  async run() {
    const { flags } = this.parse(DeepTestCommand);
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

    const ten = "deeptesttenannt";
    await deleteTenant(ten);
    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
    const { init_multi_tenant } = require("@saltcorn/data/db/state");
    await loadAllPlugins();

    let hasError = false;

    //create tenant, reset schema
    await switchToTenant(await insertTenant(ten, "", ""), "");
    await init_multi_tenant(loadAllPlugins, undefined, [ten]);

    await db.runWithTenant(ten, async () => {
      //restore
      const { restore } = require("@saltcorn/admin-models/models/backup");
      await loadAllPlugins();

      const load_plugins = require("@saltcorn/server/load_plugins");

      const Plugin = require("@saltcorn/data/models/plugin");
      const plugin_names = flags.modules ? flags.modules.split(",") : [];
      for (const pluginName of plugin_names) {
        const plugin = await Plugin.store_by_name(pluginName);
        if (!plugin) {
          console.error(`Module ${pluginName} not found in store`);
          this.exit(1);
        }
        delete plugin.id;

        await load_plugins.loadAndSaveNewPlugin(plugin);
      }

      const { passes, errors, pass } = await runConfigurationCheck(
        mockReqRes.req,
        flags.destructive,
        flags.destructive ? require("@saltcorn/server/app") : undefined
      );

      if (!pass) {
        console.error("Configuration error in deep test");

        errors.forEach((s) => console.error(s + "\n"));
        console.error(`FAIL - ${errors.length} checks failed`);
        hasError = true;
      } else console.log("Pass");
    });
    await deleteTenant(ten);
    if (hasError) this.exit(1);

    this.exit(0);
  }
}

/**
 * @type {string}
 */
DeepTestCommand.description = `Deep test`;

/**
 * @type {object}
 */

DeepTestCommand.flags = {
  modules: flags.string({
    char: "m",
    description: "Modules to enable (comma-separated list).", // anyN to include N random plugins
  }),
};

module.exports = DeepTestCommand;
