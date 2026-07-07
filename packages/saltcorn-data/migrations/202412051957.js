const sql = [
  `CREATE TABLE IF NOT EXISTS _sc_workflow_steps (
    id serial primary key,
    name varchar(255) NOT NULL,
    trigger_id integer references _sc_triggers(id) on delete cascade,
    next_step text,
    only_if text,
    action_name text NOT NULL,
    initial_step boolean,
    configuration jsonb
);`,
  `CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
    id serial primary key,
    trigger_id integer references _sc_triggers(id) on delete cascade,
    context jsonb NOT NULL,
    wait_info jsonb,
    started_at timestamp not null,
    started_by int references users(id) on delete set null,
    error text,
    status text,
    current_step text
);`,
];

module.exports = { sql };
