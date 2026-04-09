const sql = [
  "alter table _sc_tables add column updated_at timestamp;",
  "alter table _sc_views add column updated_at timestamp;",
  "alter table _sc_pages add column updated_at timestamp;",
  "alter table _sc_triggers add column updated_at timestamp;",
];

module.exports = { sql };
