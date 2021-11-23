/**
 * @category server
 * @module restart_watcher
 */

const path = require("path");
const { spawnSync } = require('child_process');
const watch = require('node-watch');

/**
 * packages that should trigger a server re-start
 */
const relevantPackages = [
  "db-common",
  "postgres",
  "saltcorn-data",
  "saltcorn-markup",
  "server",
  "sqlite",
];

/**
 * excluded directories or file name patterns
 */
const excludePatterns = [
  /\/node_modules/,
  /\/public/,
  /\.git/,
  /\.docs/,
  /\.docs/,
  /\migrations/,
  /.*test.js/,
]
 
/**
 * get the root directory of the saltcorn project
 * @returns {string} project root path
 */
const getProjectRoot = () => {
  return path.normalize(`${__dirname}/../../`);
}

/**
 * get the packages directory of the saltcorn project
 * @returns {string} packages path
 */
const getPackagesDirectory = () => {
  return `${getProjectRoot()}/packages`;
}

/**
 * get all package directories that should trigger a server re-start
 * @returns {string[]} list of paths to relevant directories
 */
const getRelevantPackages = () => {
  const packagesDir = getPackagesDirectory();
  return relevantPackages.map((packageName) =>
    `${packagesDir}/${packageName}`
  );
}

/**
 * get all plugin directories that should trigger a server re-start
 * @returns {string[]} list of paths to relevant directories
 */
const getPluginDirectories = () => {
  return [];
}

const projectRoot = getProjectRoot();

/**
 * register many file change listener and do re-starts on changes
 * The listener calls process.exit() and assumes 
 * that pm2 does the actual re-start.
 * @param {string[]} projectDirs package paths that should trigger re-starts.
 * @param {string[]} pluginDirs plugin paths that should trigger re-starts. 
 */
const listenForChanges = (projectDirs, pluginDirs) => {
  for(const projectDir of projectDirs) {
    watch(projectDir, {
      recursive: true,
      filter(file, skip) {
        for (const excludePattern of excludePatterns) {
          if (excludePattern.test(file)) 
            return skip;
        }
        return /(\.js|\.ts)$/.test(file);
      }
    }, 
    // event is either 'update' or 'remove'
    (event, file) => { 
      console.log("'%s' changed \n re-starting now", file);
      spawnSync("npm", ["run", "tsc"], {
        stdio: "inherit",
        cwd: projectRoot,
      });
      process.exit();
    });
  }
}

module.exports = {
  listenForChanges,
  getProjectRoot,
  getPackagesDirectory,
  getRelevantPackages,
  getPluginDirectories,
};
