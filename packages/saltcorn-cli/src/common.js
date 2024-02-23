/**
 * @category saltcorn-cli
 * @module common
 */
// todo need to be reorganized
const { dump } = require("js-yaml");

/**
 * Execute function for specified tenant
 * @param {object} ten - specified tenant
 * @param {function} f  - function
 * @returns {Promise<void>}
 */
const maybe_as_tenant = async (ten, f) => {
  if (!ten) return await f();
  const db = require("@saltcorn/data/db");
  if (ten === "*") {
    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    const tenants = await getAllTenants();

    for (const tenant of tenants) await db.runWithTenant(tenant, f);
  } else return await db.runWithTenant(ten, f);
};
/**
 * Init specified tenant
 * @param tenant - specified tenant
 * @returns {Promise<void>}
 */
const init_some_tenants = async (tenant) => {
  const { loadAllPlugins } = require("@saltcorn/server/load_plugins/install_utils");
  const { init_multi_tenant } = require("@saltcorn/data/db/state");
  await loadAllPlugins();
  if (tenant === "*") {
    const { getAllTenants } = require("@saltcorn/admin-models/models/tenant");
    const tenants = await getAllTenants();
    await init_multi_tenant(loadAllPlugins, undefined, tenants);
  } else if (tenant)
    await init_multi_tenant(loadAllPlugins, undefined, [tenant]);
  else await init_multi_tenant(loadAllPlugins, undefined, []);
  //await init_multi_tenant(loadAllPlugins, undefined, tenants);
};

/**
 * parse JSON or String
 * @param {string} s
 * @returns {object}
 */
const parseJSONorString = (s) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
};

/**
 * Sleep ms miliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read txt file (SyncMode)
 * @param filename - absolute path to file
 * @returns {null|string}
 */
function readFileSync(filename) {
  const path = require("path"),
    fs = require("fs");
  try {
    //let p = path.join(__dirname, filename);
    let str = fs.readFileSync(filename, "utf8");
    // let str = fs.readFileSync(p, {encoding: 'utf8'});
    console.log(str);
    return str;
  } catch (e) {
    console.error(e.message);
    return null;
  }
}

/**
 *
 * @param {object[]} results
 * @param {boolean} json
 * @returns {void}
 */
const print_it = (results, json) => {
  if (json) console.log(JSON.stringify(results, null, 2));
  else console.log(dump(results, { lineWidth: process.stdout.columns }));
};

/**
 *
 * @param {object[]} results
 * @param {boolean} json
 * @returns {void}
 */
const print_table = (results, properties, json) => {
  if (json) console.log(JSON.stringify(results, null, 2));
  else console.table(results, properties);
};

/**
 * make schema reset and restore the backup file
 * @param {string} backupFile path to a backupfile with test data
 */
const prep_test_db = async (backupFile) => {
  const fs = require("fs");
  if (!fs.existsSync(backupFile))
    throw new Error(`backup file '${backupFile}' does not exist`);
  const load_plugins = require("@saltcorn/server/load_plugins/install_utils");
  await require("@saltcorn/data/db/reset_schema")();
  await load_plugins.loadAllPlugins();
  const savePlugin = (p) => load_plugins.loadAndSaveNewPlugin(p);
  const { restore } = require("@saltcorn/admin-models/models/backup");
  const err = await restore(backupFile, savePlugin);
  if (err) console.log(`warning: ${err}`);
};

module.exports = {
  maybe_as_tenant,
  parseJSONorString,
  sleep,
  init_some_tenants,
  readFileSync,
  print_it,
  print_table,
  prep_test_db,
};
