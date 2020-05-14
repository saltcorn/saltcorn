const { Pool } = require("pg");
const { getConnectObject } = require("./connect");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const { createNamespace, getNamespace } = require("cls-hooked");
const { AsyncLocalStorage } = require("async_hooks");

var connectObj = getConnectObject();
var pool = new Pool(connectObj);

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
  await pool.end();
};

const changeConnection = async (connObj = {}) => {
  await close();
  pool = new Pool(getConnectObject(connObj));
};
var is_multi_tenant = false;

const is_it_multi_tenant = () => is_multi_tenant;
var tenantNamespace;

const enable_multi_tenant = () => {
  is_multi_tenant = true;
  tenantNamespace = new AsyncLocalStorage();
};
const setTenant = domain => {};

const runWithTenant = (tenant, f) => tenantNamespace.run(tenant, f);

if (connectObj.multi_tenant) enable_multi_tenant();

const getTenantSchema = () =>
  is_multi_tenant ? tenantNamespace.getStore() || "public" : "public";

const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj);
  const sql = `SELECT * FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where} ${mkSelectOptions(selectopts)}`;
  sql_log(sql, values);
  const tq = await pool.query(sql, values);

  return tq.rows;
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

const insert = async (tbl, obj, noid = false) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs.map((kv, ix) => "$" + (ix + 1)).join();
  const valList = kvs.map(([k, v]) => v);
  const sql = `insert into "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList}) returning ${noid ? "*" : "id"}`;
  sql_log(sql, valList);
  const { rows } = await pool.query(sql, valList);
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

module.exports = {
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
  pool,
  close,
  changeConnection,
  set_sql_logging,
  getClient,
  getTenantSchema,
  tenantNamespace,
  enable_multi_tenant,
  setTenant,
  runWithTenant,
  is_it_multi_tenant
};
