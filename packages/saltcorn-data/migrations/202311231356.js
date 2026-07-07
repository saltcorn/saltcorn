const sql = [
  `create table IF NOT EXISTS _sc_page_groups (
  id serial primary key,
  name text NOT NULL,
  description text,
  min_role integer NOT NULL references _sc_roles(id)
);`,
  `create table IF NOT EXISTS _sc_page_group_members (
  id serial primary key,
  page_id integer NOT NULL references _sc_pages(id),
  page_group_id integer NOT NULL references _sc_page_groups(id),
  sequence integer NOT NULL,
  eligible_formula text,
  description text
);`,
];

module.exports = { sql };
