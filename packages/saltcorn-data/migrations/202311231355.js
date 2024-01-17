const sql = [
  `create table _sc_page_groups (
  id serial primary key,
  name text NOT NULL,
  description text,
  min_role integer references _sc_roles(id) NOT NULL
);`,
  `create table _sc_page_group_members (
  id serial primary key,
  page_id integer references _sc_pages(id) NOT NULL,
  page_group_id integer references _sc_page_groups(id) NOT NULL,
  sequence integer NOT NULL,
  eligible_formula text,
  description text
);`,
];

module.exports = { sql };
