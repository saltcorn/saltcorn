/**
 * init fixtures
 * @category saltcorn-data
 * @module db/index
 * @subcategory db
 */
const { getConnectObject, is_sqlite } = require("./connect");
const { sqlsanitize, mkWhere } = require("./internal");
var connectObj = getConnectObject();

/** @type {db/sqlite|db/pg} */
const dbmodule = is_sqlite(connectObj) ? require("./sqlite") : require("./pg");

/** @type {db/tenant} */
const tenant = require("./tenants");

/** @type {boolean} */
const isSQLite = is_sqlite(connectObj);

/** 
 * @returns {string} 
 */
const getTenantSchemaPrefix = () =>
  isSQLite ? "" : `"${tenant.getTenantSchema()}".`;

module.exports = {
  ...tenant,
  sqlsanitize,
  connectObj,
  isSQLite,
  ...dbmodule,
  /**
   * @param {object} q 
   * @returns {function}
   */
  mkWhere: (q) => mkWhere(q, isSQLite),
  getTenantSchemaPrefix,
};
