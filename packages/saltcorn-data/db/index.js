const { Pool } = require("pg");
const { sqlsanitize, mkWhere } = require("./internal");
const pool = new Pool();

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
  if (rows.length === 0) {
    const w = mkWhere(where);
    console.log({ where });
    throw new Error(`no ${tbl} where ${w.where} are ${w.values}`);
  } else return rows[0];
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  select,
  selectOne,
  insert,
  update,
  deleteWhere,
  pool
};
