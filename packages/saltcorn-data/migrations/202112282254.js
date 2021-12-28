const sql_pg = `alter table _sc_views add column "slug" jsonb`;
const sql_sqlite = `alter table _sc_views add column "slug" json`;

module.exports = { sql_pg, sql_sqlite };
