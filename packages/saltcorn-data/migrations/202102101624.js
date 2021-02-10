const sql = [
  "alter table _sc_fields add column refname text",
  "alter table _sc_fields add column reftype text;",
];
module.exports = { sql };
