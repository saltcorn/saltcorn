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
  const tq = await query(sql, values);

  return tq;
};

const insert = async (tbl, obj, noid = false) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs.map((kv, ix) => "?").join();
  const valList = kvs.map(([k, v]) => v);
  const sql = `insert into "${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList})`;

  await query(sql, valList);
  if (noid) return;
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids[0].id;
};

const selectOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where, true);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

const selectMaybeOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) return null;
  else return rows[0];
};

const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT COUNT(*) FROM "${sqlsanitize(tbl)}" ${where}`;
  const tq = await query(sql, values);

  return parseInt(tq[0].count);
};

module.exports = {
  sql_log,
  set_sql_logging,
  sqliteDatabase,
  query,
  select,
  selectOne,
  selectMaybeOne,
  insert,
  count
};
