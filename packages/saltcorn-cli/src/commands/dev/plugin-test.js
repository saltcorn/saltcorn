const { Command, flags } = require("@oclif/command");
const path = require("path");
const { spawnSync } = require("child_process");
const { getState } = require("@saltcorn/data/db/state");
const fs = require("fs");
const Plugin = require("@saltcorn/data/models/plugin");
const { prep_test_db } = require("../../common");
const {
  staticDependencies,
  loadAndSaveNewPlugin,
} = require("@saltcorn/server/load_plugins");
const { PluginManager } = require("live-plugin-manager");

const spawnTest = async (installDir, env) => {
  const ret = spawnSync("npm", ["run", "test"], {
    stdio: "inherit",
    env,
    cwd: installDir,
  });
  return ret.status;
};

const installPlugin = async (plugin) => {
  await removeOldPlugin(plugin);
  const pluginsPath = path.join(__dirname, "test_plugin_packages");
  if (fs.existsSync(pluginsPath))
    fs.rmSync(pluginsPath, { force: true, recursive: true });
  const manager = new PluginManager({
    staticDependencies: {
      contractis: require("contractis"),
      ...staticDependencies,
    },
    pluginsPath,
  });
  await loadAndSaveNewPlugin(plugin, false, false, manager);
  return getPLuginLocation(plugin.name);
};

const removeOldPlugin = async (plugin) => {
  const byName = await Plugin.findOne({ name: plugin.name });
  if (byName) await byName.delete();
  if (!plugin.name.startsWith("@saltcorn/")) {
    const withOrg = await Plugin.findOne({ name: `@saltcorn/${plugin.name}` });
    if (withOrg) await withOrg.delete();
  } else {
    const withoutOrg = await Plugin.findOne({
      name: plugin.name.replace(/^@saltcorn\//, ""),
    });
    if (withoutOrg) await withoutOrg.delete();
  }
};

const getPLuginLocation = (pluginName) => {
  const pluginLocations = getState().plugin_locations;
  return (
    pluginLocations[pluginName] ||
    pluginLocations[pluginName.replace(/^@saltcorn\//, "")]
  );
};

const testLocalPlugin = async (dir, env, backupFile) => {
  if (backupFile) {
    await prep_test_db(path.join(dir, "tests", backupFile));
  } else await require("@saltcorn/data/db/reset_schema")();
  const pkgpath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgpath)) throw new Error(`${pkgpath} not found`);
  const pkg = require(pkgpath);
  const plugin = new Plugin({
    name: pkg.name,
    source: "local",
    location: path.resolve(dir),
  });
  const installDir = await installPlugin(plugin);
  return await spawnTest(installDir, env);
};

const testReleasedPlugin = async (pluginName, env, backupFile) => {
  await require("@saltcorn/data/db/reset_schema")();
  const plugin = await Plugin.store_by_name(pluginName);
  delete plugin.id;
  const installDir = await installPlugin(plugin);
  if (backupFile) {
    await prep_test_db(path.join(installDir, "tests", backupFile));
  }
  return await spawnTest(installDir, env);
};

/**
 * Install a plugin, spawn 'npm run test' in the install dir and check the return code
 */
class PluginTestCommand extends Command {
  async run() {
    const { flags } = this.parse(PluginTestCommand);
    const dbname = flags.database ? flags.database : "saltcorn_test";
    let env = null;
    const db = require("@saltcorn/data/db");
    if (db.isSQLite) {
      const testdbpath = "/tmp/sctestdb";
      await db.changeConnection({ sqlite_path: testdbpath });
      env = { ...process.env, SQLITE_FILEPATH: testdbpath };
    } else if (db.connectObj.database !== dbname) {
      await db.changeConnection({ database: dbname });
      env = { ...process.env, PGDATABASE: dbname };
    }
    let jestStatus = null;
    try {
      if (flags.directory) {
        console.log(`Testing local plugin in '${flags.directory}'`);
        jestStatus = await testLocalPlugin(
          flags.directory,
          env,
          flags.backupFile
        );
      } else if (flags.name) {
        console.log(`Testing released plugin '${flags.name}'`);
        jestStatus = await testReleasedPlugin(
          flags.name,
          env,
          flags.backupFile
        );
      }
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
    if (jestStatus === 0) {
      console.log("Tests passed");
      process.exit(0);
    } else {
      console.log("Tests failed");
      process.exit(1);
    }
  }
}

PluginTestCommand.flags = {
  directory: flags.string({
    char: "d",
    description: "Directory of local plugin",
  }),
  name: flags.string({
    char: "n",
    description: "Plugin name in store of a released plugin",
  }),
  backupFile: flags.string({
    char: "f",
    description:
      "Optional name of a backup file in the tests folder. If you ommit this, then the test has to create its own data.",
  }),
  database: flags.string({
    string: "database",
    description: "Run on specified database. Default is 'saltcorn_test''",
  }),
};

PluginTestCommand.description =
  "Install a plugin, spawn 'npm run test' in the install directory and check the return code.";

PluginTestCommand.help =
  "Install a plugin, spawn 'npm run test' in the install directory and check the return code.";

PluginTestCommand.usage =
  "saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f test-backup.zip";

module.exports = PluginTestCommand;
