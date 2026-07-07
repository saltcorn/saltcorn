const sql_pg = `CREATE TABLE IF NOT EXISTS _sc_snapshots (
    id serial primary key,
    created timestamptz NOT NULL,
    pack jsonb
);`;

const sql_sqlite = `CREATE TABLE _sc_snapshots (
    id integer primary key,
    created timestamptz NOT NULL,
    pack json
);`;

const sql_mysql = `CREATE TABLE IF NOT EXISTS _sc_snapshots (
    id INT AUTO_INCREMENT primary key,
    created timestamp NOT NULL,
    pack JSON
);`;

module.exports = { sql_pg, sql_sqlite, sql_mysql };
