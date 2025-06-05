const sql_pg = `
CREATE TABLE IF NOT EXISTS _sc_metadata (
    id serial primary key,
    type text NOT NULL,
    name text NOT NULL,
    user_id integer references users(id) on delete cascade,
    written_at timestamp not null,
    body jsonb
);`;

const sql_sqlite = `CREATE TABLE IF NOT EXISTS _sc_metadata (
    id serial primary key,
    type text NOT NULL,
    name text NOT NULL,
    user_id integer references users(id) on delete cascade,
    written_at timestamp not null,
    body json
);`;
module.exports = { sql_pg, sql_sqlite };
