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
  connObj.host = connObj.host || process.env.PGHOST;
  connObj.port = connObj.port || process.env.PGPORT;
  connObj.password = connObj.password || process.env.PGPASSWORD;
  connObj.database = connObj.database || process.env.PGDATABASE;
  connObj.session_secret =
    connObj.session_secret || process.env.SALTCORN_SESSION_SECRET;
  connObj.multi_tenant =
    connObj.multi_tenant || process.env.SALTCORN_MULTI_TENANT;

  if (!(connObj.user && connObj.password && connObj.database)) {
    const cfg = getConfigFile() || {};
    connObj.user = connObj.user || cfg.user;
    connObj.password = connObj.password || cfg.password;
    connObj.host = connObj.host || cfg.host;
    connObj.port = connObj.port || cfg.port;
    connObj.database = connObj.database || cfg.database;
    connObj.session_secret = connObj.session_secret || cfg.session_secret;
    connObj.multi_tenant =
      typeof connObj.multi_tenant === "undefined"
        ? cfg.multi_tenant
        : connObj.multi_tenant;
  }
  if (connObj.user && connObj.password && connObj.database) {
    return connObj;
  } else {
    return false;
  }
};

const configFileDir = 
  xdgBasedir.config || os.homeDir()

const configFilePath = path.join(
  configFileDir,
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
module.exports = { getConnectObject, getConfigFile, configFileDir, configFilePath };
