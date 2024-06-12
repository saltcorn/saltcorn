const sql = `CREATE TABLE IF NOT EXISTS _sc_tenants (
    subdomain text primary key,
    email text not null
  )`;

module.exports = { sql };
