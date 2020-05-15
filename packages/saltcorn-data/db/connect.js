const xdgBasedir = require("xdg-basedir");
const path = require("path");
const os = require("os");
const fs = require("fs");

const getConnectObject = (connSpec = {}) => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  var connObj = { ...connSpec };

  connObj.user = connObj.user || process.env.PGUSER;
  connObj.password = connObj.password || process.env.PGPASSWORD;
  connObj.database = connObj.database || process.env.PGDATABASE;
  connObj.multi_tenant =
    connObj.multi_tenant || process.env.SALTCORN_MULTI_TENANT;

  if (!(connObj.user && connObj.password && connObj.database)) {
    const cfg = getConfigFile() || {};
    connObj.user = connObj.user || cfg.user;
    connObj.password = connObj.password || cfg.password;
    connObj.host = connObj.host || cfg.host;
    connObj.port = connObj.port || cfg.port;
    connObj.database = connObj.database || cfg.database;
    connObj.multi_tenant = connObj.multi_tenant || cfg.multi_tenant;
  }
  console.log(connObj)
  if (connObj.user && connObj.password && connObj.database) {
    return connObj;
  } else {
    return false;
  }
};

const configFilePath = path.join(
  xdgBasedir.config || os.homeDir(),
  ".saltcorn"
);

const getConfigFile = () => {
  try {
    let rawdata = fs.readFileSync(configFilePath);
    return JSON.parse(rawdata);
  } catch (e) {
    return false;
  }
};
module.exports = { getConnectObject, getConfigFile, configFilePath };
