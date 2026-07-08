
const sql_pg = `
alter table _sc_tenants alter column description set default '';
alter table _sc_tables alter column description set default '';
alter table _sc_views alter column description set default '';
alter table _sc_fields alter column description set default '';
alter table _sc_pages alter column description set default '';
update _sc_triggers set description = '' where description is null;
update _sc_tables set description = '' where description is null;
update _sc_views set description = '' where description is null;
update _sc_fields set description = '' where description is null;
update _sc_pages set description = '' where description is null;
`;
const sql_sqlite = `
alter table _sc_triggers add column description1 text default '';
update _sc_triggers set description = '' where description is null;
update _sc_triggers set description1 = description;
alter table _sc_triggers drop column description;
alter table _sc_triggers rename column description1 to description;
alter table _sc_tenants add column description1 text default '';
update _sc_tenants set description = '' where description is null;
update _sc_tenants set description1 = description;
alter table _sc_tenants drop column description;
alter table _sc_tenants rename column description1 to description;
alter table _sc_tables add column description1 text default '';
update _sc_tables set description = '' where description is null;
update _sc_tables set description1 = description;
alter table _sc_tables drop column description;
alter table _sc_tables rename column description1 to description;
alter table _sc_views add column description1 text default '';
update _sc_views set description = '' where description is null;
update _sc_views set description1 = description;
alter table _sc_views drop column description;
alter table _sc_views rename column description1 to description;
alter table _sc_fields add column description1 text default '';
update _sc_fields set description = '' where description is null;
update _sc_fields set description1 = description;
alter table _sc_fields drop column description;
alter table _sc_fields rename column description1 to description;
alter table _sc_pages add column description1 text default '';
update _sc_pages set description = '' where description is null;
update _sc_pages set description1 = description;
alter table _sc_pages drop column description;
alter table _sc_pages rename column description1 to description;
`;

module.exports = { sql_pg, sql_sqlite };
    