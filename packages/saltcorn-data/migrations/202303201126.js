const sql_pg = `CREATE UNLOGGED TABLE _sc_notifications (
  id serial primary key,
  created timestamptz NOT NULL,
  title text not null,
  body text,
  link text,
  user_id int references users(id) not null,
  read boolean not null
);`;
//CREATE INDEX ON _sc_notifications (user_id);

const sql_sqlite = `CREATE TABLE _sc_notifications (
  id integer primary key,
  created timestamptz NOT NULL,
  title text not null,
  body text,
  link text,
  user_id int references users(id) not null,
  read boolean not null
);`;

module.exports = { sql_pg, sql_sqlite };
