const { Command, Flags } = require("@oclif/core");
const path = require("path");
const { spawnSync } = require("child_process");
const { getState } = require("@saltcorn/data/db/state");
const fs = require("fs");
const Plugin = require("@saltcorn/data/models/plugin");
const { prep_test_db } = require("../../common");
const { loadAndSaveNewPlugin } = require("@saltcorn/server/load_plugins");
const PluginInstaller = require("@saltcorn/plugins-loader/plugin_installer");

const pluginsPath = path.join(__dirname, "test_plugin_packages");

const removePluginsDir = () => {
  if (fs.existsSync(pluginsPath))
    fs.rmSync(pluginsPath, { force: true, recursive: true });
};

const writeJestConfigIntoPluginDir = (location, plugin) => {
  const state = getState();
  const modName = state.plugin_module_names[plugin.name];
  const module = state.plugins[modName];
  fs.writeFileSync(
    path.join(location, "jest.config.js"),
    `const sqliteDir = process.env.JEST_SC_SQLITE_DIR;
const dbCommonDir = process.env.JEST_SC_DB_COMMON_DIR;
const dataDir = process.env.JEST_SC_DATA_DIR;
const typesDir = process.env.JEST_SC_TYPES_DIR;
const markupDir = process.env.JEST_SC_MARKUP_DIR;
const adminModelsDir = process.env.JEST_SC_ADMIN_MODELS_DIR;
const modulePath = process.env.TEST_PLUGIN_PACKAGES_DIR;
const config = {
  moduleNameMapper: {
    "mjml": "${path.join(location, "mjml.js")}",
    "@saltcorn/sqlite/(.*)": sqliteDir + "/$1",
    "@saltcorn/db-common/(.*)": dbCommonDir + "/$1",
    "@saltcorn/data/(.*)": dataDir + "/$1",
    "@saltcorn/types/(.*)": typesDir + "/$1",
    "@saltcorn/markup$": markupDir,
    "@saltcorn/markup/(.*)": markupDir + "/$1",
    "@saltcorn/admin-models/(.*)": adminModelsDir + "/$1",
    ${(module?.dependencies || [])
      .map((dep) => {
        let pluginLocation = state.plugin_locations[dep];
        if (!pluginLocation) {
          // try without org
          const orgRemoved = dep.replace(/^@[^/]+\//, "");
          pluginLocation = state.plugin_locations[orgRemoved];
        }
        return pluginLocation ? `"${dep}": "${pluginLocation}",` : "";
      })
      .join("\n    ")}
  },
  modulePaths: [modulePath],
};
module.exports = config;`
  );
};

const writeMockFilesIntoPluginDir = (location) => {
  const mjmlPath = path.join(location, "mjml.js");
  if (!fs.existsSync(mjmlPath)) fs.writeFileSync(mjmlPath, "");
};

const spawnTest = async (installDir, env) => {
  const scEnvVars = {};
  for (const pckName of [
    "sqlite",
    "db-common",
    "data",
    "types",
    "markup",
    "admin-models",
  ]) {
    scEnvVars[`JEST_SC_${pckName.toUpperCase().replace("-", "_")}_DIR`] =
      path.dirname(require.resolve(`@saltcorn/${pckName}`));
  }
  scEnvVars.TEST_PLUGIN_PACKAGES_DIR = path.join(
    __dirname,
    "test_plugin_packages"
  );
  const ret = spawnSync("npm", ["run", "test"], {
    stdio: "inherit",
    env: !env
      ? {
          ...process.env,
          ...scEnvVars,
        }
      : { ...env, ...scEnvVars },
    cwd: installDir,
  });
  return ret.status;
};

const preparePlugin = async (plugin, overwrites) => {
  await removeOldPlugin(plugin);
  removePluginsDir();
  await loadAndSaveNewPlugin(
    plugin,
    false,
    false,
    (str) => str,
    false,
    overwrites
  );
  const location = getPluginLocation(plugin.name);
  writeMockFilesIntoPluginDir(location);
  writeJestConfigIntoPluginDir(location, plugin);
  return location;
};

const removeOldPlugin = async (newPlugin) => {
  const byName = await Plugin.findOne({ name: newPlugin.name });
  if (byName) {
    await byName.delete();
    await new PluginInstaller(byName).remove();
  }
  let oldDbPlugin = null;
  if (!newPlugin.name.startsWith("@saltcorn/")) {
    const withOrg = await Plugin.findOne({
      name: `@saltcorn/${newPlugin.name}`,
    });
    if (withOrg) {
      await withOrg.delete();
      oldDbPlugin = withOrg;
    }
  } else {
    const withoutOrg = await Plugin.findOne({
      name: newPlugin.name.replace(/^@saltcorn\//, ""),
    });
    if (withoutOrg) {
      await withoutOrg.delete();
      oldDbPlugin = withoutOrg;
    }
  }
  await new PluginInstaller(oldDbPlugin || newPlugin).remove();
};

const getPluginLocation = (pluginName) => {
  const pluginLocations = getState().plugin_locations;
  return (
    pluginLocations[pluginName] ||
    pluginLocations[pluginName.replace(/^@saltcorn\//, "")]
  );
};

const testLocalPlugin = async (dir, env, backupFile, overwrites) => {
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
  const installDir = await preparePlugin(plugin, overwrites);
  return await spawnTest(installDir, env);
};

const testReleasedPlugin = async (pluginName, env, backupFile, overwrites) => {
  await require("@saltcorn/data/db/reset_schema")();
  const plugin = await Plugin.store_by_name(pluginName);
  delete plugin.id;
  const installDir = await preparePlugin(plugin, overwrites);
  if (backupFile) {
    await prep_test_db(path.join(installDir, "tests", backupFile));
  }
  return await spawnTest(installDir, env);
};

/**
 *
 * @param {string[]} overwrites paths to local plugins
 * @returns an object mapping module names to paths
 */
const prepOverwritesCfg = (overwrites) => {
  const result = {};
  if (overwrites) {
    for (const flag of overwrites) {
      const pkgpath = path.join(flag, "package.json");
      if (!fs.existsSync(pkgpath))
        throw new Error(
          `Overwrite dependency package.json not found in ${flag}`
        );
      const pkg = require(pkgpath);
      result[pkg.name] = flag;
    }
  }
  return result;
};

/**
 * Install a plugin, spawn 'npm run test' in the install dir and check the return code
 */
class PluginTestCommand extends Command {
  async run() {
    const { flags } = await this.parse(PluginTestCommand);
    const overwrites = prepOverwritesCfg(flags.overwriteDependency);
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
          flags.backupFile,
          overwrites
        );
      } else if (flags.name) {
        console.log(`Testing released plugin '${flags.name}'`);
        jestStatus = await testReleasedPlugin(
          flags.name,
          env,
          flags.backupFile,
          overwrites
        );
      }
    } catch (error) {
      console.log(error);
      removePluginsDir();
      process.exit(1);
    }
    removePluginsDir();
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
  directory: Flags.string({
    char: "d",
    description: "Directory of local plugin",
  }),
  name: Flags.string({
    char: "n",
    description: "Plugin name in store of a released plugin",
  }),
  backupFile: Flags.string({
    char: "f",
    description:
      "Optional name of a backup file in the tests folder. If you ommit this, then the test has to create its own data.",
  }),
  database: Flags.string({
    string: "database",
    description: "Run on specified database. Default is 'saltcorn_test''",
  }),
  overwriteDependency: Flags.string({
    char: "o",
    description:
      "Dependency to overwrite with a local plugin (can be used multiple times). " +
      "Please specify the path to the local plugin, the module name will be taken from there.",
    multiple: true,
  }),
};

PluginTestCommand.description =
  "Install a plugin, spawn 'npm run test' in the install directory and check the return code.";

PluginTestCommand.help =
  "Install a plugin, spawn 'npm run test' in the install directory and check the return code.";

PluginTestCommand.usage =
  "saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f test-backup.zip";

module.exports = PluginTestCommand;
