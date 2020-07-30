const { getConnectObject } = require("./connect");

var connectObj = getConnectObject();
module.exports = connectObj.multi_tenant
  ? require("./multi-tenant")
  : require("./single-tenant");
