/**
 * @category server
 * @module restart_watcher
 */

const path = require("path");
const { spawnSync } = require("child_process");
const watch = require("node-watch");
const Plugin = require("@saltcorn/data/models/plugin");
const db = require("@saltcorn/data/db");
const { eachTenant } = require("@saltcorn/admin-models/models/tenant");

/**
 * packages that should trigger a server re-start
 */
const relevantPackages = [
  "db-common",
  "postgres",
  "saltcorn-data",
  "saltcorn-admin-models",
  "saltcorn-markup",
  "saltcorn-sbadmin2",
  "server",
  "sqlite",
];

/**
 * excluded directories or file name patterns
 */
const excludePatterns = [
  /\/node_modules/,
  /\.git/,
  /\.docs/,
  /\.docs/,
  /\migrations/,
  /.*test.js/,
];

/**
 * get the root directory of the saltcorn project
 * @returns {string} project root path
 */
const getProjectRoot = () => {
  return path.normalize(`${__dirname}/../../`);
};

/**
 * get the packages directory of the saltcorn project
 * @returns {string} packages path
 */
const getPackagesDirectory = () => {
  return `${getProjectRoot()}/packages`;
};

/**
 * get all package directories that should trigger a server re-start
 * @returns {string[]} list of paths to relevant directories
 */
const getRelevantPackages = () => {
  const packagesDir = getPackagesDirectory();
  return relevantPackages.map((packageName) => `${packagesDir}/${packageName}`);
};

/**
 * get all plugin directories that should trigger a server re-start
 * @returns {string[]} list of paths to relevant directories
 */
const getPluginDirectories = async () => {
  const getDirs = async () => {
    const local_plugins = await Plugin.find({ source: "local" });
    return local_plugins.map((p) => p.location);
  };
  const listOfDirs = [];
  await eachTenant(async () => {
    listOfDirs.push(await getDirs());
  });
  return [...new Set(listOfDirs.flat(1))];
};

const projectRoot = getProjectRoot();

const watchCfg = {
  recursive: true,
  filter(file, skip) {
    for (const excludePattern of excludePatterns) {
      if (excludePattern.test(file)) return skip;
    }
    return /(\.js|\.ts)$/.test(file);
  },
};

let activeWatchers = [];

/**
 * close all open file watchers
 */
const closeWatchers = () => {
  for (const activeWatcher of activeWatchers) {
    if (!activeWatcher.isClosed()) {
      activeWatcher.close();
    }
  }
};

/**
 * register many file change listener and do re-starts on changes
 * The listener calls process.exit() and assumes
 * that pm2 does the actual re-start.
 * @param {string[]} projectDirs package paths that should trigger re-starts.
 * @param {string[]} pluginDirs plugin paths that should trigger re-starts.
 */
const listenForChanges = (projectDirs, pluginDirs) => {
  // watch project dirs
  for (const projectDir of projectDirs) {
    activeWatchers.push(
      watch(
        projectDir,
        watchCfg,
        // event is either 'update' or 'remove'
        (event, file) => {
          console.log("'%s' changed \n re-starting now", file);
          closeWatchers();
          spawnSync("npm", ["run", "tsc"], {
            stdio: "inherit",
          });
          process.exit();
        }
      )
    );
  }
  // watch plugin dirs
  for (const pluginDir of pluginDirs) {
    activeWatchers.push(
      watch(
        pluginDir,
        watchCfg,
        // event is either 'update' or 'remove'
        (event, file) => {
          console.log("'%s' changed \n re-starting now", file);
          closeWatchers();
          process.exit();
        }
      )
    );
  }
};

module.exports = {
  listenForChanges,
  getProjectRoot,
  getPackagesDirectory,
  getRelevantPackages,
  getPluginDirectories,
  closeWatchers,
};
