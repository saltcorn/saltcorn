const sql =
  "alter table _sc_fields add column refname text, add column reftype text;";
module.exports = { sql };
