const sql = [
  `CREATE TABLE IF NOT EXISTS _sc_tags (
  id serial primary key,
  name text NOT NULL
);`,
  `CREATE TABLE IF NOT EXISTS _sc_tag_entries (
    id serial primary key,
    tag_id integer NOT NULL references _sc_tags(id),
    table_id integer references _sc_tables(id),
    view_id integer references _sc_views(id),
    page_id integer references _sc_pages(id),
    trigger_id integer references _sc_triggers(id)
  );`,
];

module.exports = { sql };
