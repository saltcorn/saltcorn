const path = require("path");
const fs = require("fs");
const envPaths = require("env-paths");

const pathsNoApp = envPaths("", { suffix: "" });
const pathsWithApp = envPaths("saltcorn", { suffix: "" });

const defaultDataPath = pathsWithApp.data;

const getConnectObject = (connSpec = {}) => {
  var connObj = {};
  const fileCfg = getConfigFile() || {};

  function setKey(k, envnm, opts) {
    // Priorities:
    // 1. getConnectObject argument
    if (typeof connSpec[k] !== "undefined") connObj[k] = connSpec[k];
    // 2. Environment variables
    else if (typeof process.env[envnm] !== "undefined")
      connObj[k] = process.env[envnm];
    // 3. Config file
    else if (typeof fileCfg[k] !== "undefined") connObj[k] = fileCfg[k];
    // 4. default
    else if (typeof opts.default !== "undefined") connObj[k] = opts.default;
  }

  setKey("user", "PGUSER");
  setKey("sqlite_path", "SQLITE_FILEPATH");
  setKey("host", "PGHOST");
  setKey("port", "PGPORT");
  setKey("password", "PGPASSWORD");
  setKey("database", "PGDATABASE");
  setKey("session_secret", "SALTCORN_SESSION_SECRET");
  setKey("multi_tenant", "SALTCORN_MULTI_TENANT", { default: false });
  setKey("file_store", "SALTCORN_FILE_STORE", { default: pathsWithApp.data });
  setKey("default_schema", "SALTCORN_DEFAULT_SCHEMA", "public");

  if (process.env.DATABASE_URL) {
    delete connObj[user];
    delete connObj[password];
    delete connObj[database];
    delete connObj[sqlite_path];
    return { ...connObj, connectionString: process.env.DATABASE_URL };
  } else if (
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

const is_sqlite = (connObj) => {
  if (connObj.connectionString)
    return connObj.connectionString.startsWith("sqlite");

  return !!connObj.sqlite_path;
};

module.exports = {
  getConnectObject,
  getConfigFile,
  configFileDir,
  configFilePath,
  is_sqlite,
  defaultDataPath,
};
