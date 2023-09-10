const sql =
  "alter table _sc_tables add column has_sync_info boolean NOT NULL DEFAULT false";

module.exports = { sql };
