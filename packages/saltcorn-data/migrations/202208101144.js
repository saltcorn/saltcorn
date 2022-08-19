const sql_pg = [
  `CREATE TABLE _sc_tags (
  id serial primary key,
  name text NOT NULL
);`,
  `CREATE TABLE _sc_tag_entries(
    id serial primary key,
    tag_id integer references _sc_tags(id) NOT NULL,
    table_id integer references _sc_tables(id),
    view_id integer references _sc_views(id),
    page_id integer references _sc_pages(id),
    trigger_id integer references _sc_triggers(id)
  );`,
];

const sql_sqlite = [
  `CREATE TABLE _sc_tags (
  id integer primary key,
  name text NOT NULL
);`,
  `CREATE TABLE _sc_tag_entries (
  id integer primary key,
  tag_id integer references _sc_tags(id) NOT NULL,
  table_id integer references _sc_tables(id),
  view_id integer references _sc_views(id),
  page_id integer references _sc_pages(id),
  trigger_id integer references _sc_triggers(id)
);
`,
];

module.exports = { sql_pg, sql_sqlite };
