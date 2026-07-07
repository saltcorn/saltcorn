const sql_pg = `alter table _sc_files add column "s3_store" boolean;`;

const sql_sqlite = `alter table _sc_files add column "s3_store" integer;`;

const sql_mysql = sql_pg;

module.exports = { sql_pg, sql_sqlite, sql_mysql };
