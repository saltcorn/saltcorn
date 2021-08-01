/**
 * SQLite3 data access layer
 */
// TODO move all sqlite specific to this module
const sqlite3 = require("sqlite3").verbose();
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const { getConnectObject } = require("./connect");
const fs = require("fs").promises;
const connectObj = getConnectObject(); // was var
/**
 * Get sqlite path
 * @returns {*}
 */
const get_db_filepath = () => {
  if (connectObj.sqlite_path) return connectObj.sqlite_path;
};

let current_filepath = get_db_filepath();
let sqliteDatabase = new sqlite3.Database(current_filepath);

let log_sql_enabled = false;

/**
 * Control Logging sql statements to console
 * @param val - if true then log sql statements to console
 */
function set_sql_logging(val = true) {
  log_sql_enabled = val;
}

/**
 * Get sql logging state
 * @returns {boolean} if true then sql logging eabled
 */
function get_sql_logging() {
  return log_sql_enabled;
}
/**
 * Log SQL statement to console
 * @param sql - SQL statement
 * @param vs - any additional parameter
 */
function sql_log(sql, vs) {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}

function query(sql, params) {
  sql_log(sql, params);
  return new Promise((resolve, reject) => {
    sqliteDatabase.all(sql, params, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve({ rows });
      }
    });
  });
}
/**
 * Change connection (close connection and open new connection from connObj)
 * @param connObj - connection object
 * @returns {Promise<void>}
 */
const changeConnection = async (connObj) => {
  await sqliteDatabase.close();
  current_filepath = connObj.sqlite_path;
  sqliteDatabase = new sqlite3.Database(current_filepath);
};
/**
 * Close database connection
 * @returns {Promise<void>}
 */
const close = async () => {
  await sqliteDatabase.close();
};
/**
 * Execute Select statement
 * @param tbl - table name
 * @param whereObj - where object
 * @param selectopts - select options
 * @returns {Promise<*>} return rows
 */

const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT * FROM "${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts
  )}`;
  const tq = await query(sql, values);

  return tq.rows;
};
/**
 *
 * @param v
 * @returns {boolean}
 */
// TODO Utility function - needs ti be moved out this module
const reprAsJson = (v) =>
  typeof v === "object" && v !== null && !(v instanceof Date);
const mkVal = ([k, v]) => (reprAsJson(v) ? JSON.stringify(v) : v);

/**
 * Drop unique constraint
 * @param tbl - table name
 * @param obj - list of column=value pairs
 * @param id - primary key column value
 * @returns {Promise<void>} no results
 */
const update = async (tbl, obj, id) => {
  const kvs = Object.entries(obj);
  const assigns = kvs.map(([k, v], ix) => `"${sqlsanitize(k)}"=?`).join();
  let valList = kvs.map(mkVal);
  valList.push(id);
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} where id=?`;
  await query(q, valList);
};

/**
 * Delete rows in table
 * @param tbl - table name
 * @param whereObj - where object
 * @returns {Promise<*>} result of delete execution
 */
const deleteWhere = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `delete FROM "${sqlsanitize(tbl)}" ${where}`;

  const tq = await query(sql, values);

};
/**
 * Insert rows into table
 * @param tbl - table name
 * @param obj - columns names and data
 * @param opts - columns attributes
 * @returns {Promise<*>} returns id.
 */
const insert = async (tbl, obj, opts = {}) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs
    .map(([k, v], ix) =>
      v && v.next_version_by_id
        ? `coalesce((select max(_version) from "${sqlsanitize(
            tbl
          )}" where id=${+v.next_version_by_id}), 0)+1`
        : reprAsJson(v)
        ? "json(?)"
        : "?"
    )
    .join();
  const valList = kvs
    .filter(([k, v]) => !(v && v.next_version_by_id))
    .map(mkVal);
  const sql = `insert into "${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList})`;

  await query(sql, valList);
  if (opts.noid) return;
  // TBD Support of primary key column different from id
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids.rows[0].id;
};

/**
 * Select one record
 * @param tbl - table name
 * @param where - where object
 * @returns {Promise<*>} return first record from sql result
 */
const selectOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where, true);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

/**
 * Select one record or null if no records
 * @param tbl - table name
 * @param where - where object
 * @returns {Promise<null|*>} - null if no record or first record data
 */
const selectMaybeOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) return null;
  else return rows[0];
};

/**
 * Get count of rows in table
 * @param tbl - table name
 * @param whereObj - where object
 * @returns {Promise<number>} count of tables
 */
const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT COUNT(*) FROM "${sqlsanitize(tbl)}" ${where}`;
  const tq = await query(sql, values);
  return parseInt(tq.rows[0]["COUNT(*)"]);
};
/**
 * Get version of PostgreSQL
 * @returns {Promise<*>} returns version
 */
const getVersion = async () => {
  const sql = `SELECT sqlite_version();`;
  sql_log(sql);
  const tq = await query(sql);
  return tq.rows[0]["sqlite_version()"];
};

/**
 * Reset DB Schema using drop schema and recreate it.
 * Attention! You will lost data after call this function!
 * @returns {Promise<void>} no result
 */
const drop_reset_schema = async () => {
  await sqliteDatabase.close();
  await fs.unlink(current_filepath);
  sqliteDatabase = new sqlite3.Database(current_filepath);
};

/**
 * Add unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns {Promise<void>} no result
 */
const add_unique_constraint = async (table_name, field_names) => {
  const sql = `create unique index ${sqlsanitize(
    table_name
  )}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique on "${sqlsanitize(table_name)}"(${field_names
    .map((f) => `"${sqlsanitize(f)}"`)
    .join(",")});`;
  sql_log(sql);
  await query(sql);
};

/**
 * Drop unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns {Promise<void>} no results
 */
const drop_unique_constraint = async (table_name, field_names) => {
  const sql = `drop index ${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique;`;
  sql_log(sql);
  await query(sql);
};

module.exports = {
  sql_log,
  set_sql_logging,
  get_sql_logging,
  sqliteDatabase,
  changeConnection,
  query,
  select,
  selectOne,
  selectMaybeOne,
  insert,
  count,
  close,
  drop_reset_schema,
  update,
  deleteWhere,
  add_unique_constraint,
  drop_unique_constraint,
  getVersion,
};
