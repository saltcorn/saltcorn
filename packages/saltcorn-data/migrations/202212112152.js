const sql_pg = `alter table _sc_views add column "attributes" jsonb`;
const sql_sqlite = `alter table _sc_views add column "attributes" json`;

module.exports = { sql_pg, sql_sqlite };
