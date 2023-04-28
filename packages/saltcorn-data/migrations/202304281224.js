const sql = `
insert into _sc_roles (id, role) select id*10, role from _sc_roles where id >1;
update users set role_id = role_id*10 where role_id>1;
update _sc_tables set min_role_read = min_role_read*10 where min_role_read>1;
update _sc_tables set min_role_write = min_role_write*10 where min_role_write>1;
update _sc_views set min_role = min_role*10 where min_role>1;
update _sc_pages set min_role = min_role*10 where min_role>1;
update _sc_triggers set min_role = min_role*10 where min_role>1;
update _sc_files set min_role_read = min_role_read*10 where min_role_read>1;

delete from _sc_roles where id > 1 and id <11`;
//`;

module.exports = { sql };
