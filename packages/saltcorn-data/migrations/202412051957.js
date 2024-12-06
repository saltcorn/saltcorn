const sql_pg = `CREATE TABLE IF NOT EXISTS  _sc_workflow_steps (
    id serial primary key,
    name text NOT NULL,
    trigger_id integer references _sc_triggers(id),
    next_step text,
    action_name text NOT NULL,
    initial_step boolean NOT NULL DEFAULT false,
    configuration jsonb
);`;

const sql_sqlite = `CREATE TABLE _sc_workflow_steps (
    id integer primary key,
    name text NOT NULL,
    trigger_id integer references _sc_triggers(id),
    next_step text,
    action_name text NOT NULL,
    initial_step boolean NOT NULL DEFAULT false,
    configuration json
);`;

module.exports = { sql_pg, sql_sqlite };