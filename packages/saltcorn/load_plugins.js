const db = require("saltcorn-data/db");

const loadAsync = async () => {
  const plugins = await db.select("plugins");
  plugins.forEach(plugin => {
    if (plugin.source === "npm") {
      require(plugin.location).register();
    }
  });
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
