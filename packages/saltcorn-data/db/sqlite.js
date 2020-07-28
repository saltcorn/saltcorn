const sqlite3 = require("sqlite3").verbose();
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const { getConnectObject } = require("./connect");

var connectObj = getConnectObject();

const get_db_filepath = () => {
  if (connectObj.sqlite_path) return connectObj.sqlite_path;
};
var sqliteDatabase = new sqlite3.Database(get_db_filepath());

var log_sql_enabled = false;

function set_sql_logging(val = true) {
  log_sql_enabled = val;
}

function sql_log(sql, vs) {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}

function query(sql, params) {
  sql_log(sql, params);
  return new Promise((resolve, reject) => {
    sqliteDatabase.all(sql, params, function(err, rows) {
      if (err) {
        console.log("Error running sql " + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT * FROM "${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts
  )}`;
  sql_log(sql, values);
  const tq = await query(sql, values);

  return tq.rows;
};

module.exports = {
  sql_log,
  set_sql_logging,
  sqliteDatabase,
  query,
  select
};
