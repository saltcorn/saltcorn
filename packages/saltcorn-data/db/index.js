const { getConnectObject } = require("./connect");
const { sqlsanitize, mkWhere } = require("./internal");
var connectObj = getConnectObject();

const dbmodule = require("./pg");

const tenant = require("./tenants");
module.exports = {
  ...tenant,
  sqlsanitize,
  connectObj,
  ...dbmodule
};
