/**
 * init fixtures
 * @category saltcorn-data
 * @module db/index
 * @subcategory db
 */

/**
 * All files in the db module.
 * @namespace db_overview
 * @property {module:db/connect} connect
 * @property {module:db/fixtures} fixtures
 * @property {module:db/internal} internal
 * @property {module:db/multi-tenant} multi-tenant
 * @property {module:db/pg} pg
 * @property {module:db/reset_schema} reset_schema
 * @property {module:db/single-tenant} single-tenant
 * @property {module:db/sqlite} sqlite
 * @property {module:db/state} state
 * @property {module:db/connect} connect
 * @property {module:db/tenants} tenants
 * 
 * @category saltcorn-data
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

