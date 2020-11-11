const sql = `create table _sc_table_constraints (
    id serial primary key,
    table_id integer not null references _sc_tables(id) on delete cascade,    
    configuration jsonb not null,
    type text NOT NULL
);`;

module.exports = { sql };
