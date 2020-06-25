const sql = `create table _sc_pages (
    id serial primary key,
    name text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    min_role integer NOT NULL references _sc_roles(id),
    layout jsonb not null,
    fixed_states jsonb not null
);`;

module.exports = { sql };
