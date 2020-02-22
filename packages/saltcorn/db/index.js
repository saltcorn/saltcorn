const { Pool } = require("pg");

const pool = new Pool();

const get_table_by_id = async id => {
  const tq = await pool.query("SELECT * FROM tables WHERE id = $1", [id]);
  return tq.rows[0];
};

const get_field_by_id = async id => {
  const tq = await pool.query("SELECT * FROM fields WHERE id = $1", [id]);
  return tq.rows[0];
};
module.exports = {
  query: (text, params) => pool.query(text, params),
  get_table_by_id,
  get_field_by_id
};
