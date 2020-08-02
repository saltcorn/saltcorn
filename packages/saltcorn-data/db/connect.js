const path = require("path");
const fs = require("fs");
const envPaths = require("env-paths");

const pathsNoApp = envPaths("", { suffix: "" });
const pathsWithApp = envPaths("saltcorn", { suffix: "" });

const getConnectObject = (connSpec = {}) => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  var connObj = { ...connSpec };

  connObj.user = connObj.user || process.env.PGUSER;
  connObj.sqlite_path = connObj.sqlite_path || process.env.SQLITE_FILEPATH;
  connObj.host = connObj.host || process.env.PGHOST;
  connObj.port = connObj.port || process.env.PGPORT;
  connObj.password = connObj.password || process.env.PGPASSWORD;
  connObj.database = connObj.database || process.env.PGDATABASE;
  connObj.session_secret =
    connObj.session_secret || process.env.SALTCORN_SESSION_SECRET;
  connObj.multi_tenant =
    connObj.multi_tenant || process.env.SALTCORN_MULTI_TENANT;
  connObj.file_store = connObj.file_store || process.env.SALTCORN_FILE_STORE;

  if (!(connObj.user && connObj.password && connObj.database)) {
    const cfg = getConfigFile() || {};
    connObj.sqlite_path = connObj.sqlite_path || cfg.sqlite_path;
    connObj.user = connObj.user || cfg.user;
    connObj.password = connObj.password || cfg.password;
    connObj.host = connObj.host || cfg.host;
    connObj.port = connObj.port || cfg.port;
    connObj.file_store = connObj.file_store || cfg.file_store;
    connObj.database = connObj.database || cfg.database;
    connObj.session_secret = connObj.session_secret || cfg.session_secret;
    connObj.multi_tenant =
      typeof connObj.multi_tenant === "undefined"
        ? cfg.multi_tenant
        : connObj.multi_tenant;
  }

  connObj.file_store = connObj.file_store || pathsWithApp.data;

  if (
    connObj.sqlite_path ||
    (connObj.user && connObj.password && connObj.database)
  ) {
    return connObj;
  } else {
    return false;
  }
};

const configFileDir = pathsNoApp.config;

const configFilePath = path.join(configFileDir, ".saltcorn");

const getConfigFile = () => {
  try {
    let rawdata = fs.readFileSync(configFilePath);
    return JSON.parse(rawdata);
  } catch (e) {
    return false;
  }
};

const is_sqlite = connObj => {
  if (connObj.connectionString)
    return connObj.connectionString.startsWith("sqlite");

  return !!connObj.sqlite_path;
};

module.exports = {
  getConnectObject,
  getConfigFile,
  configFileDir,
  configFilePath,
  is_sqlite
};
