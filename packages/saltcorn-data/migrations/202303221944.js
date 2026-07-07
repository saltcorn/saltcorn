const sql_pg = `alter table _sc_tables add column "provider_cfg" jsonb, add column "provider_name" text`;
const sql_sqlite = [
  `alter table _sc_tables add column "provider_cfg" json;`,
  `alter table _sc_tables add column "provider_name" text default '';`,
];

const sql_mysql = `alter table _sc_tables add column "provider_cfg" JSON, add column "provider_name" text default ('')`;

module.exports = { sql_pg, sql_sqlite, sql_mysql };
