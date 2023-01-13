const sql =
  "alter table _sc_tables add column is_user_group boolean NOT NULL DEFAULT false";

module.exports = { sql };
