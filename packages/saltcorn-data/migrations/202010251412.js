const sql = [
  `insert into _sc_tables(name,min_role_read,min_role_write,versioned) 
       values('users',1,1,'false');`,
  `insert into _sc_fields(table_id, name, label, type, attributes)
       values((select id from _sc_tables where name='users'),'email','Email','String', '{}')
  ;`,
];

module.exports = { sql };
