const sql_pg =
  "alter table _sc_workflow_runs alter column current_step type jsonb using '[]'::jsonb;";

  const sql_sqlite = [
  "alter table _sc_workflow_runs drop column current_step;",
  "alter table _sc_workflow_runs add column current_step json;",
];

module.exports = { sql_pg, sql_sqlite };
