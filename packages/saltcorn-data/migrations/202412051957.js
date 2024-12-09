const sql_pg = `CREATE TABLE IF NOT EXISTS _sc_workflow_steps (
    id serial primary key,
    name text NOT NULL,
    trigger_id integer references _sc_triggers(id) on delete cascade,
    next_step text,
    only_if text,
    action_name text NOT NULL,
    initial_step boolean,
    configuration jsonb
);

CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
    id serial primary key,  
    trigger_id integer references _sc_triggers(id) on delete cascade,
    context jsonb NOT NULL,
    wait_info jsonb,
    started_at timestamp not null,
    started_by int references users(id),
    error text,
    status text,
    current_step text
);`;

const sql_sqlite = `CREATE TABLE _sc_workflow_steps (
    id integer primary key,
    name text NOT NULL,
    only_if text,
    trigger_id integer references _sc_triggers(id) ON DELETE CASCADE,
    next_step text,
    action_name text NOT NULL,
    initial_step boolean,
    configuration json
);

CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
    id serial primary key,  
    trigger_id integer references _sc_triggers(id) ON DELETE CASCADE,
    context json NOT NULL,
    wait_info json,
    started_at timestamp not null,
    started_by int references users(id),
    error text,
    status text,
    current_step text
);`;

module.exports = { sql_pg, sql_sqlite };