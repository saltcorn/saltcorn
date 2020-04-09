const { Pool } = require("pg");
const { sqlsanitize, mkWhere, mkSelectOptions } = require("./internal");
const pool = new Pool();

const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj);
  const tq = await pool.query(
    `SELECT * FROM ${sqlsanitize(tbl)} ${where} ${mkSelectOptions(selectopts)}`,
    values
  );

  return tq.rows;
};

const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  const tq = await pool.query(
    `SELECT COUNT(*) FROM ${sqlsanitize(tbl)} ${where}`,
    values
  );

  return parseInt(tq.rows[0].count);
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
  const fnameList = kvs.map(([k, v]) => sqlsanitize(k)).join();
  const valPosList = kvs.map((kv, ix) => "$" + (ix + 1)).join();
  const valList = kvs.map(([k, v]) => v);
  const { rows } = await pool.query(
    `insert into ${sqlsanitize(
      tbl
    )}(${fnameList}) values(${valPosList}) returning id`,
    valList
  );
  return rows[0].id;
};

const update = async (tbl, obj, id) => {
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map(([k, v], ix) => sqlsanitize(k) + "=$" + (ix + 1))
    .join();
  var valList = kvs.map(([k, v]) => v);
  valList.push(id);
  const q = `update ${sqlsanitize(tbl)} set ${assigns} where id=$${kvs.length +
    1}`;
  await pool.query(q, valList);
};

const selectOne = async (tbl, where) => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where);
    console.log({ where });
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  select,
  selectOne,
  count,
  insert,
  update,
  deleteWhere,
  pool
};
