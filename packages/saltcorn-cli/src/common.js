/**
 * @category saltcorn-cli
 * @module common
 */
// todo need to be reorganized
/**
 * Execute function for specified tenant
 * @param {object} ten - specified tenant
 * @param {function} f  - function
 * @returns {Promise<void>}
 */
const maybe_as_tenant = async (ten, f) => {
  if (!ten) return await f();
  const db = require("@saltcorn/data/db");
  return await db.runWithTenant(ten, f);
};
/**
 * Init specified tenant
 * @param tenant - specified tenant
 * @returns {Promise<void>}
 */
const init_some_tenants = async (tenant) => {
  const { loadAllPlugins } = require("@saltcorn/server/load_plugins");
  const { init_multi_tenant } = require("@saltcorn/data/db/state");
  await loadAllPlugins();
  if (tenant) await init_multi_tenant(loadAllPlugins, undefined, [tenant]);
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
function readFileSync(filename){
  const path = require('path'), fs = require('fs');
  try {
    //let p = path.join(__dirname, filename);
    let str = fs.readFileSync(filename, 'utf8');
    // let str = fs.readFileSync(p, {encoding: 'utf8'});
    console.log(str);
    return str;
  } catch (e) {
    console.error(e.message);
    return null;
  }
}

module.exports = {
  maybe_as_tenant,
  parseJSONorString,
  sleep,
  init_some_tenants,
  readFileSync,
};
