const { Command, flags } = require("@oclif/command");

class PluginsCommand extends Command {
  async run() {
    const db = require("@saltcorn/data/db");
    const { requirePlugin } = require("@saltcorn/server/load_plugins");
    const { getAllTenants } = require("@saltcorn/data/models/tenant");
    const Plugin = require("@saltcorn/data/models/plugin");
    var plugins = [];
    const { flags } = this.parse(PluginsCommand);

    const tenantList = [
      db.connectObj.default_schema,
      ...(await getAllTenants()),
    ];

    for (const domain of tenantList) {
      await db.runWithTenant(domain, async () => {
        const myplugins = await Plugin.find({});
        myplugins.forEach((plugin) => {
          if (
            plugin.source === "npm" &&
            !plugins.map((p) => p.location).includes(plugin.location)
          ) {
            plugins.push(plugin);
            console.log(plugin.location);
          }
        });
      });
    }
    if (flags.upgrade || flags.dryRun) {
      var new_versions = {};
      for (let plugin of plugins) {
        plugin.version = "latest";
        const { version } = await requirePlugin(plugin, true);
        //console.log(plinfo)
        if (version) new_versions[plugin.location] = version;
      }
      console.log(new_versions);
      for (const domain of tenantList) {
        await db.runWithTenant(domain, async () => {
          const myplugins = await Plugin.find({});
          for (let plugin of myplugins) {
            if (plugin.source === "npm" && new_versions[plugin.location]) {
              if (flags.dryRun)
                console.log(
                  `Would upgrade ${domain}'s plugin ${
                    plugin.location
                  } to version ${new_versions[plugin.location]}`
                );
              else {
                plugin.version = new_versions[plugin.location];
                db.set_sql_logging(true);
                await plugin.upsert();
                db.set_sql_logging(false);
              }
            }
          }
        });
      }
    }

    this.exit(0);
  }
}

PluginsCommand.flags = {
  upgrade: flags.boolean({ char: "u", description: "Upgrade" }),
  dryRun: flags.boolean({ char: "d", description: "Upgrade dry-run" }),
};

PluginsCommand.description = `List and upgrade plugins for tenants
...
Extra documentation goes here
`;

module.exports = PluginsCommand;
