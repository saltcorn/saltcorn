const sql_pg = `alter table _sc_tables add column if not exists "rls_enabled" boolean not null default false;`;

const sql_sqlite = `alter table _sc_tables add column "rls_enabled" integer not null default 0;`;

module.exports = { sql_pg, sql_sqlite };
