const sql_pg = `alter table _sc_tables add column "provider_cfg" jsonb, add column "provider_name" text`;
const sql_sqlite = `alter table _sc_tables add column "provider_cfg" json, add column "provider_name" text`;

module.exports = { sql_pg, sql_sqlite };
