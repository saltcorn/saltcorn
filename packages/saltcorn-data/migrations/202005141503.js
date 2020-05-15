const sql = `CREATE TABLE _sc_tenants (
    subdomain text primary key,
    email text not null
  )`;

module.exports = { sql };
