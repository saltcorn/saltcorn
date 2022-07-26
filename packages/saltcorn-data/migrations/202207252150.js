const sql_pg = `CREATE TABLE _sc_snapshots (
    id serial primary key,
    created timestamptz NOT NULL,
    pack jsonb
);`;

const sql_sqlite = `CREATE TABLE _sc_snapshots (
    id integer primary key,
    created timestamptz NOT NULL,
    pack json
);`;

module.exports = { sql_pg, sql_sqlite };
