
const sql_pg = `
alter table _sc_views add column min_role integer NOT NULL references _sc_roles(id) default 10;
update _sc_views set min_role = (case when is_public then 10 else 8 end);
alter table _sc_views drop column is_public;
`;

const sql_sqlite = `
alter table _sc_views add column min_role integer NOT NULL references _sc_roles(id) default 10;
update _sc_views set min_role = (case when is_public then 10 else 8);
`;

module.exports = { sql_pg, sql_sqlite };
    