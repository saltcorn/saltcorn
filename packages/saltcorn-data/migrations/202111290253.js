const sql_pg = `alter table _sc_files add column "s3_store" boolean;`;

const sql_sqlite = `alter table _sc_files add column "s3_store" integer;`;

module.exports = { sql_pg, sql_sqlite };
