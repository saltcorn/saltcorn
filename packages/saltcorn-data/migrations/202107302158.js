const sql_pg = `CREATE UNLOGGED TABLE _sc_event_log (
    id serial primary key,
    event_type text NOT NULL,
    channel text,
    occur_at timestamp not null,
    user_id int,
    payload jsonb
);`;

const sql_sqlite = `CREATE TABLE _sc_event_log (
    id integer primary key,
    event_type text NOT NULL,
    channel text,
    occur_at timestamp not null,
    user_id int,
    payload json
);`;

module.exports = { sql_pg, sql_sqlite };
    