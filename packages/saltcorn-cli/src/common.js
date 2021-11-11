/**
 * @category saltcorn-cli
 * @module common
 */

/**
 * @param {object} ten 
 * @param {function} f 
 * @returns {Promise<void>}
 */
const maybe_as_tenant = async (ten, f) => {
  if (!ten) return await f();
  const db = require("@saltcorn/data/db");
  return await db.runWithTenant(ten, f);
};

/**
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
 * @param {numer} ms 
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
module.exports = { maybe_as_tenant, parseJSONorString, sleep };
