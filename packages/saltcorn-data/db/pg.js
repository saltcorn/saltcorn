const { Pool } = require("pg");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const { getConnectObject } = require("./connect");
const { getTenantSchema } = require("./tenants");
var connectObj = getConnectObject();

var pool;
if (connectObj) pool = new Pool(connectObj);

var log_sql_enabled = false;

function set_sql_logging(val = true) {
  log_sql_enabled = val;
}

function sql_log(sql, vs) {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}
const close = async () => {
  if (pool) await pool.end();
};

const changeConnection = async (connObj = {}) => {
  await close();
  pool = new Pool(getConnectObject(connObj));
};

const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj);
  const sql = `SELECT * FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where} ${mkSelectOptions(selectopts)}`;
  sql_log(sql, values);
  const tq = await pool.query(sql, values);

  return tq.rows;
};

const drop_reset_schema = async (schema) => {
  await pool.query(`DROP SCHEMA "${schema}" CASCADE;
  CREATE SCHEMA "${schema}";
  GRANT ALL ON SCHEMA "${schema}" TO postgres;
  GRANT ALL ON SCHEMA "${schema}" TO "${schema}" ;
  COMMENT ON SCHEMA "${schema}" IS 'standard public schema';`);
};

const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  const sql = `SELECT COUNT(*) FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);
  const tq = await pool.query(sql, values);

  return parseInt(tq.rows[0].count);
};

const deleteWhere = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  const sql = `delete FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);

  const tq = await pool.query(sql, values);

  return tq.rows;
};

const insert = async (tbl, obj, noid = false, client) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList = [];
  var valList = [];
  kvs.forEach(([k, v]) => {
    if (v && v.sql) {
      valPosList.push(v.sql);
    } else {
      valList.push(v);
      valPosList.push(`$${valList.length}`);
    }
  });
  const sql = `insert into "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList.join()}) returning ${
    noid ? "*" : "id"
  }`;
  sql_log(sql, valList);
  const { rows } = await (client || pool).query(sql, valList);
  if (noid) return;
  else return rows[0].id;
};

const update = async (tbl, obj, id) => {
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  var valList = kvs.map(([k, v]) => v);
  valList.push(id);
  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} where id=$${kvs.length + 1}`;
  sql_log(q, valList);
  await pool.query(q, valList);
};

const selectOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

const selectMaybeOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) return null;
  else return rows[0];
};

const getClient = async () => await pool.connect();

const reset_sequence = async (tblname) => {
  const sql = `SELECT setval(pg_get_serial_sequence('"${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}"', 'id'), coalesce(max(id),0) + 1, false) FROM "${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}";`;
  await pool.query(sql);
};

module.exports = {
  pool,
  query: (text, params) => {
    sql_log(text, params);
    return pool.query(text, params);
  },
  select,
  selectOne,
  selectMaybeOne,
  count,
  insert,
  update,
  deleteWhere,
  close,
  sql_log,
  changeConnection,
  set_sql_logging,
  getClient,
  mkWhere,
  drop_reset_schema,
  reset_sequence,
};
