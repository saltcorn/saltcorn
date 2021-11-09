/**
 * @category saltcorn-data
 * @module db/tenant
 * @subcategory db
 */
const { getConnectObject } = require("./connect");

var connectObj = getConnectObject();
module.exports = connectObj.multi_tenant
  ? require("./multi-tenant")(connectObj)
  : require("./single-tenant")(connectObj);
