const sqlite3 = require("sqlite3").verbose();
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const { getConnectObject } = require("./connect");
const fs = require("fs").promises;
var connectObj = getConnectObject();

const get_db_filepath = () => {
  if (connectObj.sqlite_path) return connectObj.sqlite_path;
};

var current_filepath = get_db_filepath();
var sqliteDatabase = new sqlite3.Database(current_filepath);

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
    sqliteDatabase.all(sql, params, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve({ rows });
      }
    });
  });
}

const changeConnection = async (connObj) => {
  await sqliteDatabase.close();
  current_filepath = connObj.sqlite_path;
  sqliteDatabase = new sqlite3.Database(current_filepath);
};

const close = async () => {
  await sqliteDatabase.close();
};
const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT * FROM "${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts
  )}`;
  const tq = await query(sql, values);

  return tq.rows;
};

const reprAsJson = (v) =>
  typeof v === "object" && v !== null && !(v instanceof Date);
const mkVal = ([k, v]) => (reprAsJson(v) ? JSON.stringify(v) : v);

const update = async (tbl, obj, id) => {
  const kvs = Object.entries(obj);
  const assigns = kvs.map(([k, v], ix) => `"${sqlsanitize(k)}"=?`).join();
  var valList = kvs.map(mkVal);
  valList.push(id);
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} where id=?`;
  await query(q, valList);
};

const deleteWhere = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `delete FROM "${sqlsanitize(tbl)}" ${where}`;

  const tq = await query(sql, values);

  return;
};

const insert = async (tbl, obj, opts = {}) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs
    .map(([k, v], ix) => (v && v.sql ? v.sql : reprAsJson(v) ? "json(?)" : "?"))
    .join();
  const valList = kvs.filter(([k, v]) => !(v && v.sql)).map(mkVal);
  const sql = `insert into "${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList})`;

  await query(sql, valList);
  if (opts.noid) return;
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids.rows[0].id;
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
  return parseInt(tq.rows[0]["COUNT(*)"]);
};

const drop_reset_schema = async () => {
  await sqliteDatabase.close();
  await fs.unlink(current_filepath);
  sqliteDatabase = new sqlite3.Database(current_filepath);
};

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
};
