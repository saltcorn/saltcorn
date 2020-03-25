const db = require("saltcorn-data/db");

const basePlugin = require("saltcorn-base-plugin");
const layoutPlugin = require("saltcorn-sbadmin2");


const loadAsync = async () => {
  const plugins = await db.select("plugins");
  plugins.forEach(plugin => {
    if (plugin.source === "npm") {
      require(plugin.location).register();
    }
  });
  basePlugin.register();
  layoutPlugin.register();
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
