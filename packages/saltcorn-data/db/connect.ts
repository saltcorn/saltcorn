/**
 * Controls Saltcorn configuration
 * @category saltcorn-data
 * @module db/connect
 * @subcategory db
 */

import { join } from "path";
import { readFileSync } from "fs";
import envPaths from "env-paths";
const is = require("contractis/is");
import { randomBytes, createHash } from "crypto";

const pathsNoApp = envPaths("", { suffix: "" });
const pathsWithApp = envPaths("saltcorn", { suffix: "" });

import utils from "../utils";
const { isNode } = utils;

/**
 * Default data path?
 */
const defaultDataPath = pathsWithApp.data;

/**
 * @param x
 * @returns
 */
const stringToJSON = (x: any) => (typeof x === "string" ? JSON.parse(x) : x);
/**
 * Get Git revision of Saltcorn source.
 * Required to work:
 *  - Git client installed,
 *  - Local git with repo Saltcorn sources.
 * @returns - Return current Git commit
 */
const getGitRevision = () => {
  let options = { stdio: "pipe", cwd: __dirname };
  try {
    return require("child_process")
      .execSync("git rev-parse HEAD", options)
      .toString()
      .trim();
  } catch (error) {
    return null;
  }
};
/**
 * Prepare Saltcorn connection object that controls main Saltcorn instance settings like:
 * - PostgreSQL or SQLite
 * - Connection to DB settings
 * - Multitenant mode
 * - Web Session secret
 * - File store path
 * - Saltcorn confuration inheritance and fixed configuration
 * For all parameters and priority see the code of function.
 * @param [connSpec = {}]
 * @returns
 */
const getConnectObject = (connSpec: any = {}) => {
  const git_commit = getGitRevision();
  let sc_version;
  try {
    sc_version = require("../../package.json").version;
  } catch (error) {
    sc_version = require("../package.json").version;
  }
  var connObj: any = { git_commit, sc_version };
  const fileCfg = getConfigFile() || {};

  function setKey(k: string, envnm: string, opts: any = {}) {
    const f = opts.transform || ((x: string) => x);
    // Priorities:
    // 1. getConnectObject argument
    if (typeof connSpec[k] !== "undefined") connObj[k] = f(connSpec[k]);
    // 2. Environment variables
    else if (typeof process.env[envnm] !== "undefined")
      connObj[k] = f(process.env[envnm]);
    // 3. Config file
    else if (typeof fileCfg[k] !== "undefined") connObj[k] = f(fileCfg[k]);
    // 4. default
    else if (typeof opts.default !== "undefined") connObj[k] = f(opts.default);
  }

  setKey("user", "PGUSER");
  setKey("sqlite_path", "SQLITE_FILEPATH");
  setKey("host", "PGHOST");
  setKey("port", "PGPORT");
  setKey("password", "PGPASSWORD");
  setKey("database", "PGDATABASE");
  setKey("session_secret", "SALTCORN_SESSION_SECRET");
  setKey("sslmode", "PGSSLMODE");
  setKey("sslcert", "PGSSLCERT");
  setKey("sslkey", "PGSSLKEY");
  setKey("sslrootcert", "PGSSLROOTCERT");
  setKey("jwt_secret", "SALTCORN_JWT_SECRET");
  setKey("multi_tenant", "SALTCORN_MULTI_TENANT", { default: false });
  setKey("file_store", "SALTCORN_FILE_STORE", { default: pathsWithApp.data });
  setKey("default_schema", "SALTCORN_DEFAULT_SCHEMA", { default: "public" });
  setKey("fixed_configuration", "SALTCORN_FIXED_CONFIGURATION", {
    default: {},
    transform: stringToJSON,
  });
  setKey("inherit_configuration", "SALTCORN_INHERIT_CONFIGURATION", {
    default: [],
    transform: stringToJSON,
  });
  setKey("fixed_plugin_configuration", "SALTCORN_FIXED_PLUGIN_CONFIGURATION", {
    default: {},
    transform: stringToJSON,
  });
  if (
    connObj.sslmode ||
    connObj.sslcert ||
    connObj.sslkey ||
    connObj.sslrootcert
  ) {
    //https://github.com/brianc/node-postgres/blob/2a8efbee09a284be12748ed3962bc9b816965e36/packages/pg/test/unit/connection-parameters/creation-tests.js#L333
    connObj.ssl = {
      sslmode: connObj.sslmode,
      sslrootcert: connObj.sslrootcert,
      sslcert: connObj.sslcert,
      sslkey: connObj.sslkey,
    };
    delete connObj.sslmode;
    delete connObj.sslcert;
    delete connObj.sslkey;
    delete connObj.sslrootcert;
  }
  if (!connObj.session_secret) connObj.session_secret = is.str.generate();
  if (!connObj.jwt_secret) connObj.jwt_secret = randomBytes(64).toString("hex");
  connObj.version_tag = createHash("sha256")
    .update(`${connObj.session_secret}${git_commit || sc_version}`)
    .digest("hex")
    .slice(0, 16);

  if (process.env.FORCE_SQLITE === "true") {
    delete connObj["user"];
    delete connObj["password"];
    delete connObj["database"];
    return connObj;
  } else if (process.env.DATABASE_URL) {
    delete connObj["user"];
    delete connObj["password"];
    delete connObj["database"];
    delete connObj["sqlite_path"];
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
/**
 * Path to Config directory
 */
const configFileDir = pathsNoApp.config;
/**
 * Path to config file .saltcorn
 */
const configFilePath = join(configFileDir, ".saltcorn");
/**
 * Reads Saltcorn configuration file
 * @returns - Returns JSON presentation of Saltcorn confuration file. Returns false in case of Exception.
 */
const getConfigFile = () => {
  try {
    let rawdata = readFileSync(configFilePath);
    return JSON.parse(rawdata.toString());
  } catch (e) {
    return false;
  }
};
/**
 * Check that Saltcorn configured to use SQLite as database
 * @param connObj - connectin object
 * @returns - Returns true if Saltcorn configured to use SQLite as database
 */
const is_sqlite = (connObj: any) => {
  if (!isNode()) return true;
  if (connObj.connectionString)
    return connObj.connectionString.startsWith("sqlite");

  return !!connObj.sqlite_path;
};

export = {
  getConnectObject,
  getConfigFile,
  configFileDir,
  configFilePath,
  is_sqlite,
  defaultDataPath,
};
