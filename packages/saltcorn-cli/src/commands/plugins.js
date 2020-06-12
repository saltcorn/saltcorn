const { Command, flags } = require("@oclif/command");
const fixtures = require("@saltcorn/server/fixtures");
const reset = require("@saltcorn/data/db/reset_schema");
const { auto_test_plugin } = require("@saltcorn/data/plugin-testing");
const db = require("@saltcorn/data/db");
const { requirePlugin } = require("@saltcorn/server/load_plugins");
const { getAllTenants } = require("@saltcorn/data/models/tenant");
const Plugin = require("@saltcorn/data/models/plugin");

class PluginsCommand extends Command {
  async run() {
      var plugins = [];
    const tenantList = await getAllTenants();
    for (const domain of tenantList) {
        await db.runWithTenant(domain, async () => {
          const plugin = await Plugin.find({});
            if(plugin.source==='npm'&&!plugins.includes(plugin.location)) {
                plugins.push(plugin.location)
                console.log(plugin.location)
            }
        });
    }
    this.exit(0);
  }
}

PluginsCommand.flags = {
    upgrade: flags.boolean({ char: "u", description: "Upgrade" })
  };

PluginsCommand.description = `List and upgrade plugins for tenants
...
Extra documentation goes here
`;

module.exports = PluginsCommand;
