const { Pool } = require("pg");

const pool = new Pool();

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

const get_fields_by_table_id = async id => {
  const tq = await pool.query("SELECT * FROM fields WHERE table_id = $1", [id]);
  return tq.rows;
};
module.exports = {
  query: (text, params) => pool.query(text, params),
  get_table_by_id,
  get_field_by_id,
  get_table_by_name,
  get_fields_by_table_id,
  get_tables
};
