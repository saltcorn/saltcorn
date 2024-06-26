const sql = `insert into _sc_fields(table_id, name, label, type, attributes, required, is_unique)
       values((select id from _sc_tables where name='users'),'role_id','Role','Integer', '{}', true, false)`;

module.exports = { sql };
