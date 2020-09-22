const sql =
  "alter table _sc_tables DROP COLUMN expose_api_read, DROP COLUMN expose_api_write;";

module.exports = { sql };
