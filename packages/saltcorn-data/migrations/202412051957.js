const sql_pg = `CREATE TABLE IF NOT EXISTS _sc_workflow_steps (
    id serial primary key,
    name text NOT NULL,
    trigger_id integer references _sc_triggers(id),
    next_step text,
    action_name text NOT NULL,
    initial_step boolean,
    configuration jsonb
);

CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
    id serial primary key,  
    trigger_id integer references _sc_triggers(id),
    context jsonb NOT NULL,
    wait_info jsonb,
    started_at timestamp not null,
    started_by_id int references users(id) not null,
    error text,
    status text,
);`;

const sql_sqlite = `CREATE TABLE _sc_workflow_steps (
    id integer primary key,
    name text NOT NULL,
    trigger_id integer references _sc_triggers(id),
    next_step text,
    action_name text NOT NULL,
    initial_step boolean,
    configuration json
);

CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
    id serial primary key,  
    trigger_id integer references _sc_triggers(id),
    context json NOT NULL,
    wait_info json,
    started_at timestamp not null,
    started_by_id int references users(id) not null,
    error text,
    status text,
);`;

module.exports = { sql_pg, sql_sqlite };