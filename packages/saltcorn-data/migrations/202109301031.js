const sql_pg = `CREATE TABLE _sc_library (
    id serial primary key,
    name text NOT NULL UNIQUE,
    icon text,
    layout jsonb
);`;

const sql_sqlite = `CREATE TABLE _sc_library (
    id integer primary key,
    name text NOT NULL UNIQUE,
    icon text,
    layout json
);`;

module.exports = { sql_pg, sql_sqlite };
