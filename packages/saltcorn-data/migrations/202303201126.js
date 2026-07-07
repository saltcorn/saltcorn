const sql_pg = `CREATE UNLOGGED TABLE IF NOT EXISTS _sc_notifications (
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

const sql_mysql = `CREATE TABLE IF NOT EXISTS _sc_notifications (
  id INT AUTO_INCREMENT primary key,
  created timestamp NOT NULL,
  title text not null,
  body text,
  link text,
  user_id int not null references users(id),
  "read" boolean not null
);`;

module.exports = { sql_pg, sql_sqlite, sql_mysql };
