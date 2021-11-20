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
 * @property {module:db/reset_schema} reset_schema
 * @property {module:db/state} state
 * @property {module:db/connect} connect
 * 
 * @category saltcorn-data
 * @subcategory db 
 */
const { getConnectObject, is_sqlite } = require("./connect");
const { sqlsanitize, mkWhere } = require("@saltcorn/db-common/internal");
var connectObj = getConnectObject();

/** @type {db/sqlite|db/pg|null} */
let dbmodule = null;
try {
  if(is_sqlite(connectObj)) {
    dbmodule = require("@saltcorn/sqlite/sqlite");
    dbmodule.init(getConnectObject);
  }
  else
    dbmodule = require("@saltcorn/postgres/postgres")(getConnectObject);
} catch(e) {
  console.log("No database package found.")
  throw e;
}

/** @type {db/tenant} */
const tenant = require("@saltcorn/db-common/tenants")(getConnectObject());

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

