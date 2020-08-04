const sql =
  "alter table _sc_tables add column versioned boolean NOT NULL DEFAULT false";

module.exports = { sql };
