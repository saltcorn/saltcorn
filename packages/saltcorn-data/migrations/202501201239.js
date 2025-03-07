const sql_sqlite = [
  `DROP TABLE IF EXISTS _sc_workflow_trace;`,
  `DROP TABLE IF EXISTS _sc_workflow_runs;`,
  `CREATE TABLE IF NOT EXISTS _sc_workflow_runs (
      id integer primary key,  
      trigger_id integer references _sc_triggers(id) ON DELETE CASCADE,
      context json NOT NULL,
      wait_info json,
      started_at timestamp not null,
      started_by int references users(id) on delete set null,
      error text,
      status text,
      current_step json,
      status_updated_at timestamp,
      session_id text
  );`,
  `CREATE TABLE IF NOT EXISTS _sc_workflow_trace (
    id integer primary key,  
    run_id integer references _sc_workflow_runs(id) on delete cascade,
    user_id integer references users(id) on delete cascade,
    step_name_run text NOT NULL,    
    context json NOT NULL,
    status text,    
    wait_info json,
    step_started_at timestamp not null,
    elapsed double precision,
    error text
);`,
];
module.exports = { sql_sqlite };
