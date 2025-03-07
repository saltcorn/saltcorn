const sql_pg =
  "alter table _sc_workflow_runs drop constraint _sc_workflow_runs_started_by_fkey, add constraint _sc_workflow_runs_started_by_fkey foreign key (started_by) references users (id) on delete set null;";

module.exports = { sql_pg };
