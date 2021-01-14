const sql =
  "alter table _sc_tables add column ownership_field_id integer references _sc_fields(id)";

module.exports = { sql };
