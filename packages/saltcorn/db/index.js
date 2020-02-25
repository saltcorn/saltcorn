const { Pool } = require("pg");

const pool = new Pool();

const sqlsanitize = nm => nm.replace(/\b@[a-zA-Z][a-z_A-Z0-9]*\b/g, "");

const mkWhere = whereObj => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where = whereObj
    ? "where " +
      wheres.map((kv, i) => `${sqlsanitize(kv[0])}=$${i + 1}`).join(" and ")
    : "";
  const values = wheres.map(kv => kv[1]);
  return { where, values };
};

const select = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  const tq = await pool.query(
    `SELECT * FROM ${sqlsanitize(tbl)} ${where}`,
    values
  );

  return tq.rows;
};

const deleteWhere = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  const tq = await pool.query(
    `delete FROM ${sqlsanitize(tbl)} ${where}`,
    values
  );

  return tq.rows;
};

const insert = async (tbl, obj) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(kv => sqlsanitize(kv[0])).join();
  const valPosList = kvs.map((kv, ix) => "$" + (ix + 1)).join();
  const valList = kvs.map(kv => kv[1]);
  await pool.query(
    `insert into ${sqlsanitize(tbl)}(${fnameList}) values(${valPosList})`,
    valList
  );
};

const update = async (tbl, obj, id) => {
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map((kv, ix) => sqlsanitize(kv[0]) + "=$" + (ix + 1))
    .join();
  var valList = kvs.map(kv => kv[1]);
  valList.push(id);
  const q = `update ${sqlsanitize(tbl)} set ${assigns} where id=$${kvs.length +
    1}`;
  await pool.query(q, valList);
};
const selectOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  return rows[0];
};
const get_table_by_id = async id => {
  const tq = await pool.query("SELECT * FROM tables WHERE id = $1", [id]);
  return tq.rows[0];
};

const get_table_by_name = async id => {
  const tq = await pool.query("SELECT * FROM tables WHERE name = $1", [id]);
  return tq.rows[0];
};

const get_tables = async () => {
  const tq = await pool.query("SELECT * FROM tables");
  return tq.rows;
};

const get_field_by_id = async id => {
  const tq = await pool.query("SELECT * FROM fields WHERE id = $1", [id]);
  return tq.rows[0];
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  get_table_by_id,
  get_field_by_id,
  get_table_by_name,
  get_tables,
  select,
  selectOne,
  insert,
  update,
  deleteWhere
};
