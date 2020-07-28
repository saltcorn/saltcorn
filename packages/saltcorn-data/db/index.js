const { getConnectObject, is_sqlite } = require("./connect");
const { sqlsanitize, mkWhere } = require("./internal");
var connectObj = getConnectObject();

const dbmodule = is_sqlite(connectObj) ? require("./sqlite") : require("./pg");

const tenant = require("./tenants");

const isSQLite = is_sqlite(connectObj);

const getTenantSchemaPrefix = () =>
  isSQLite ? "" : `"${tenant.getTenantSchema()}".`;
module.exports = {
  ...tenant,
  sqlsanitize,
  connectObj,
  isSQLite,
  ...dbmodule,
  getTenantSchemaPrefix
};
