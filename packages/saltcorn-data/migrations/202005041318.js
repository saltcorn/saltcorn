
const sql= `
  insert into _sc_config(key, value) values ('testMigration', '"success"'::json);
`;

module.exports = { sql }
    