const sql = `CREATE TABLE IF NOT EXISTS _sc_library (
    id serial primary key,
    name varchar(255) NOT NULL UNIQUE,
    icon text,
    layout jsonb
);`;

module.exports = { sql };
