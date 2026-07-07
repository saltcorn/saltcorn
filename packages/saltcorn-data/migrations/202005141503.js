const sql = `CREATE TABLE IF NOT EXISTS _sc_tenants (
    subdomain varchar(255) primary key,
    email text not null
  )`;

module.exports = { sql };
