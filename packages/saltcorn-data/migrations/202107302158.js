const sql = `CREATE UNLOGGED TABLE _sc_event_log (
    id serial primary key,
    event_type text NOT NULL,
    channel text,
    occur_at timestamp not null,
    user_id int,
    payload jsonb
);`;

module.exports = { sql };
    