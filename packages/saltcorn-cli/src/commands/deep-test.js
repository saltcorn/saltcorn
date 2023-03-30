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

  async generate_tables() {
    const {
      random_table,
      fill_table_row,
      all_views,
    } = require("@saltcorn/data/models/random");
    for (let index = 0; index < 20; index++) {
      //db.set_sql_logging(true);
      try {
        const table = await random_table();
        await all_views(table);
        console.log("Generated table", table.name);
      } catch (e) {
        console.error("Error creating table", e);
        this.exit(1);
      }
    }
  }

  async enable_plugins() {
    const { flags } = this.parse(DeepTestCommand);

    const { loadAllPlugins } = require("@saltcorn/server/load_plugins");

    await loadAllPlugins();

    const load_plugins = require("@saltcorn/server/load_plugins");

    const Plugin = require("@saltcorn/data/models/plugin");
    const plugin_names = flags.modules ? flags.modules.split(",") : [];

    for (const pluginName of plugin_names) {
      if (pluginName.startsWith("any") && !pluginName.includes("-")) {
        const plugins0 = await Plugin.store_plugins_available();
        // shuffle https://stackoverflow.com/a/46545530/19839414
        const plugins = plugins0
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);

        const n = +pluginName.replace("any", "") || 1;
        for (let index = 0; index < n; index++) {
          const plugin = plugins[index];
          console.log("Installing module", plugin.name);
          await load_plugins.loadAndSaveNewPlugin(plugin);
        }
      } else {
        console.log("Installing module", pluginName);
        const plugin = await Plugin.store_by_name(pluginName);
        if (!plugin) {
          console.error(`Module ${pluginName} not found in store`);
          this.exit(1);
        }
        delete plugin.id;

        await load_plugins.loadAndSaveNewPlugin(plugin);
      }
    }
  }
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
    const {
      init_multi_tenant,
      add_tenant,
    } = require("@saltcorn/data/db/state");
    await loadAllPlugins();

    let hasError = false;

    //create tenant, reset schema
    const tenrow = await insertTenant(ten, "", "");
    add_tenant(ten);

    await switchToTenant(tenrow, "");

    await init_multi_tenant(loadAllPlugins, undefined, [ten]);
    await db.runWithTenant(ten, async () => {
      await this.enable_plugins();
      await this.generate_tables();
      //todo set rnd page as root
      console.log("Running configuration check");
      const { passes, errors, pass } = await runConfigurationCheck(
        mockReqRes.req,
        false,
        require("@saltcorn/server/app"),
        true
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
