const sql_pg = `
alter table _sc_workflow_runs add column status_updated_at timestamp;

ALTER TABLE _sc_workflow_steps ADD CONSTRAINT constraintname UNIQUE (trigger_id, name);

CREATE TABLE IF NOT EXISTS _sc_workflow_trace (
    id serial primary key,  
    run_id integer references _sc_workflow_runs(id) on delete cascade,
    step_name_run text NOT NULL,    
    context jsonb NOT NULL,
    status text,    
    wait_info jsonb,
    step_started_at timestamp not null,
    elapsed double precision,
    error text
);`;

const sql_sqlite = [
  `alter table _sc_workflow_runs add column status_updated_at timestamp;`,
  `create unique index workflow_steps_name_uniq on _sc_workflow_steps(trigger_id, name);`,
  `CREATE TABLE IF NOT EXISTS _sc_workflow_trace (
    id serial primary key,  
    run_id integer references _sc_workflow_runs(id) on delete cascade,
    step_name_run text NOT NULL,    
    context json NOT NULL,
    status text,    
    wait_info json,
    step_started_at timestamp not null,
    elapsed double precision,
    error text,
);`,
];

module.exports = { sql_pg, sql_sqlite };
