const sql = `create table _sc_triggers (
    id serial primary key,
    action text NOT NULL,
    table_id integer references _sc_tables(id),    
    configuration jsonb not null,
    when_trigger text NOT NULL
);`;

module.exports = { sql };
