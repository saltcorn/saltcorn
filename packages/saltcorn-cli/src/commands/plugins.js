const { Command, flags } = require("@oclif/command");

/**
 * Plugins list and update command
 */
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
        const myplugins = await Plugin.find( flags.name? { name : flags.name} : {});
        myplugins.forEach((plugin) => {

          if (
            plugin.source === "npm" &&
            !plugins.map((p) => p.location).includes(plugin.location)
          ) {
            plugins.push(plugin);
            if(flags.verbose)
              console.log("%s\t%s\t%s\t%s", plugin.location, plugin.name, plugin.version, plugin.source);
            else console.log(plugin.location);
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
              // the plugin can be up to date
              if(!flags.force&&plugin.version===new_versions[plugin.location])
                console.log("Plugin %s is up to date", plugin.location);
              else if (flags.dryRun) {
                console.log(
                `Would upgrade ${domain}'s plugin ${
                  plugin.location
                } version from ${plugin.version} to ${new_versions[plugin.location]}`
              );
              }
              else {
                  plugin.version = new_versions[plugin.location];

                  const sql_logging = db.get_sql_logging();
                  if(flags.verbose) db.set_sql_logging(true);
                  await plugin.upsert();
                  if(flags.verbose) db.set_sql_logging(sql_logging);
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
  //list: flags.boolean({ char: "l", description: "List" }),
  upgrade: flags.boolean({ char: "u", description: "Upgrade" }),
  dryRun: flags.boolean({ char: "d", description: "Upgrade dry-run" }),
  verbose: flags.boolean({ char: "v", description: "Verbose output", default: false }),
  force: flags.boolean({ char: "f", description: "Force update", default: false }),
  name: flags.string({
    char: "n",
    description: "Plugin name",
  }),

};

// TODO Extra documentation goes here
PluginsCommand.description = `List and upgrade plugins for tenants
...
Extra documentation goes here
`;

PluginsCommand.examples = [ //"plugins -l - outputs detailed information about plugins",
  "plugins -v - verbose output of commands",
  "plugins -u -d - dry-run for plugin update",
  "plugins -u -f - force plugin update"
];
// TODO Extra help here
PluginsCommand.help= "Extra help here"

// PluginsCommand.usage

module.exports = PluginsCommand;
