const { getConnectObject, is_sqlite } = require("./connect");
const { sqlsanitize, mkWhere } = require("./internal");
var connectObj = getConnectObject();

const dbmodule = is_sqlite(connectObj) ? require("./sqlite") : require("./pg");

const tenant = require("./tenants");

module.exports = {
  ...tenant,
  sqlsanitize,
  connectObj,
  ...dbmodule
};
