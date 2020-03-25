const db = require("saltcorn-data/db");
const { PluginManager } = require("live-plugin-manager");

const manager = new PluginManager();

const loadAsync = async () => {
  const plugins = await db.select("plugins");
  for (const plugin of plugins) {
    if (
      ["saltcorn-base-plugin", "saltcorn-sbadmin2"].includes(plugin.location)
    ) {
      require(plugin.location).register();
    } else if (plugin.source === "npm") {
      await manager.install(plugin.location);
      require(plugin.location).register();
    }
  }
};

const load = () => {
  loadAsync().then(
    () => {},
    err => {
      console.error(err);
      process.exit(1);
    }
  );
};

module.exports = load;
