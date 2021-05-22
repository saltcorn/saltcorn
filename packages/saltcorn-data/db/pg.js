const { Pool } = require("pg");
const copyStreams = require("pg-copy-streams");
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
  const sql = `DROP SCHEMA IF EXISTS "${schema}" CASCADE;
  CREATE SCHEMA "${schema}";
  GRANT ALL ON SCHEMA "${schema}" TO postgres;
  GRANT ALL ON SCHEMA "${schema}" TO "public" ;
  COMMENT ON SCHEMA "${schema}" IS 'standard public schema';`;
  sql_log(sql);

  await pool.query(sql);
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

const getVersion = async (short) => {
  const sql = `SELECT version();`;
  sql_log(sql);
  const tq = await pool.query(sql);
  const v = tq.rows[0].version;
  if (short) {
    const ws = v.split(" ");
    return ws[1];
  }
  return v;
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

const insert = async (tbl, obj, opts = {}) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList = [];
  var valList = [];
  const schema = getTenantSchema();
  kvs.forEach(([k, v]) => {
    if (v && v.next_version_by_id) {
      valPosList.push(
        `coalesce((select max(_version) from "${schema}"."${sqlsanitize(
          tbl
        )}" where id=${+v.next_version_by_id}), 0)+1`
      );
    } else {
      valList.push(v);
      valPosList.push(`$${valList.length}`);
    }
  });
  const sql = `insert into "${schema}"."${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList.join()}) returning ${
    opts.noid ? "*" : opts.pk_name || "id"
  }`;
  sql_log(sql, valList);
  const { rows } = await (opts.client || pool).query(sql, valList);
  if (opts.noid) return;
  else return rows[0][opts.pk_name || "id"];
};

const update = async (tbl, obj, id, opts = {}) => {
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  var valList = kvs.map(([k, v]) => v);
  valList.push(id);
  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} where ${opts.pk_name || "id"}=$${kvs.length + 1}`;
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

const add_unique_constraint = async (table_name, field_names) => {
  const sql = `alter table "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" add CONSTRAINT "${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique" UNIQUE (${field_names
    .map((f) => `"${sqlsanitize(f)}"`)
    .join(",")});`;
  sql_log(sql);
  await pool.query(sql);
};

const drop_unique_constraint = async (table_name, field_names) => {
  const sql = `alter table "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" drop CONSTRAINT "${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique";`;
  sql_log(sql);
  await pool.query(sql);
};

const copyFrom = (fileStream, tableName, fieldNames, client) => {
  const quote = (s) => `"${s}"`;
  const sql = `COPY "${sqlsanitize(tableName)}" (${fieldNames
    .map(quote)
    .join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  var stream = client.query(copyStreams.from(sql));

  return new Promise((resolve, reject) => {

    fileStream.on("error", reject);
    stream.on("error", reject);
    stream.on("finish", resolve);
    fileStream.pipe(stream).on("error", reject);
  });
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
  add_unique_constraint,
  drop_unique_constraint,
  reset_sequence,
  getVersion,
  copyFrom,
};
